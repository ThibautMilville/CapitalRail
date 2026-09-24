import {
  OPENJEV_MODEL,
  estimateCostUsd,
  hasOpenJevApiKey,
} from "@/shared/serv/model-policy";
import { runOpenJev, OpenJevError } from "@/shared/openjev/client";
import type { ReasoningStepTrace } from "@/shared/serv/trace-types";
import { amountSchema } from "@/shared/validation/amount";
import type { IntentOutput } from "@/features/preflight/lib/intent-schema";

function clampAmount(raw: string): string {
  const parsed = amountSchema.safeParse(raw);
  return parsed.success ? parsed.data : "1";
}

function extractAmount(message: string): { amount: string; found: boolean } {
  const amountMatch = message.match(
    /(\d{1,12}(?:\.\d{1,8})?)\s*(?:usdc|usd|\$)?/i,
  );
  return {
    amount: clampAmount(amountMatch?.[1] ?? "1"),
    found: Boolean(amountMatch),
  };
}

function choiceOf(
  answers: Record<string, { type?: string; choice?: string; noul?: number }>,
  id: string,
): string | null {
  const answer = answers[id];
  if (!answer) return null;
  if (answer.type === "choice" && typeof answer.choice === "string") {
    return answer.choice;
  }
  return null;
}

function noulOf(
  answers: Record<string, { type?: string; noul?: number }>,
  id: string,
): number | null {
  const answer = answers[id];
  if (!answer || answer.type !== "noul" || typeof answer.noul !== "number") {
    return null;
  }
  return answer.noul;
}

/**
 * Fast-path intent: amount via regex, discrete prefs via OpenJEV choice/noul.
 * Returns null when OpenJEV is not configured or the call fails.
 */
export async function tryParseIntentWithOpenJev(
  message: string,
): Promise<{ output: IntentOutput; trace: ReasoningStepTrace } | null> {
  if (!hasOpenJevApiKey() || !message.trim()) return null;

  const startedAt = new Date();
  const started = performance.now();
  const trimmed = message.trim();

  try {
    const result = await runOpenJev({
      state: {
        userMessage: trimmed,
        product:
          "CapitalRail IXS deposit mandate intake. Chains: BSC (56), Avalanche (43114).",
      },
      questions: {
        allowKyc: {
          type: "noul",
          instructions:
            "Does the user accept KYC, whitelist, or onboarding for the vault?",
          criteria: {
            true: "Explicitly accepts KYC / whitelist / onboarding",
            false: "Says no KYC, without KYC, or does not mention KYC",
          },
        },
        requireSync: {
          type: "noul",
          instructions:
            "Does the user require instant / sync withdrawals only (no delayed / async / ERC-7540)?",
          criteria: {
            true: "Wants instant, sync, no claim, no delayed exit",
            false: "Accepts delayed, async, ERC-7540, or claim later",
          },
        },
        chain: {
          type: "choice",
          instructions: "Which chain does the user prefer for the deposit?",
          criteria: {
            bsc: "BSC, BNB, or Binance Smart Chain",
            avalanche: "Avalanche or AVAX",
            any: "No chain named, or any chain is fine",
          },
        },
      },
    });

    const { amount, found: amountFound } = extractAmount(trimmed);
    const allowKyc = (noulOf(result.answers, "allowKyc") ?? 0) >= 0.55;
    const requireSyncRaw = noulOf(result.answers, "requireSync");
    const requireSyncSettlement =
      requireSyncRaw == null ? true : requireSyncRaw >= 0.55;
    const chainChoice = choiceOf(result.answers, "chain") ?? "any";
    const preferredChainId =
      chainChoice === "bsc"
        ? ("56" as const)
        : chainChoice === "avalanche"
          ? ("43114" as const)
          : null;

    const bits: string[] = [`Deposit ${amount} USDC`];
    bits.push(
      preferredChainId === "56"
        ? "on BSC"
        : preferredChainId === "43114"
          ? "on Avalanche"
          : "on any chain",
    );
    bits.push(
      requireSyncSettlement
        ? "instant withdrawals only"
        : "delayed withdrawals ok",
    );
    bits.push(allowKyc ? "KYC vaults ok" : "no KYC");

    const output: IntentOutput = {
      amount,
      allowKyc,
      requireSyncSettlement,
      preferredChainId,
      summary: `${bits.join(", ")}.`,
      confidence: amountFound && chainChoice !== "any" ? "high" : "medium",
    };

    const durationMs = Math.round(performance.now() - started);
    return {
      output,
      trace: {
        id: "intent",
        label: "Intent - parse free text into a mandate",
        model: result.model || OPENJEV_MODEL,
        routedModel: OPENJEV_MODEL,
        tier: "fast",
        source: "openjev",
        startedAt: startedAt.toISOString(),
        durationMs: result.latencyMs || durationMs,
        promptTokens: null,
        completionTokens: null,
        costUsd: estimateCostUsd(OPENJEV_MODEL, 200, 50),
        projectedCostUsd: null,
        inputSummary: `${trimmed.length} chars via OpenJEV`,
        output,
        ok: true,
        fallbackReason: null,
      },
    };
  } catch (error) {
    if (error instanceof OpenJevError || error instanceof Error) {
      return null;
    }
    return null;
  }
}
