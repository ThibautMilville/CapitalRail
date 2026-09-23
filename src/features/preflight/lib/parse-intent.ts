import { runTracedStep } from "@/shared/serv/client";
import {
  INTENT_JSON_SCHEMA,
  INTENT_SYSTEM_PROMPT,
  intentSchema,
  type IntentOutput,
  type ParsedIntent,
} from "./intent-schema";

const EMPTY_INTENT: IntentOutput = {
  amount: "1",
  allowKyc: false,
  requireSyncSettlement: true,
  preferredChainId: null,
  summary: "Empty message - using safe defaults (1 USDC, sync, no KYC).",
  confidence: "low",
};

function fallbackParseIntent(message: string): IntentOutput {
  const lower = message.toLowerCase();

  const amountMatch = message.match(
    /(\d+(?:\.\d+)?)\s*(?:usdc|usd|\$)?/i,
  );
  const amount = amountMatch?.[1] ?? "1";

  const allowKyc =
    /\b(kyc|whitelist|onboard)\b/i.test(lower) &&
    !/\bno\s*kyc\b|\bwithout\s*kyc\b|\bnon[-\s]?kyc\b|\bskip\s*kyc\b/i.test(
      lower,
    );

  const acceptsDelayed =
    /\basync\b|\berc[-\s]?7540\b|\bclaim\b|\bdelayed\b|\blater\b/i.test(
      lower.replace(/\bno\s*claim\b/g, ""),
    );
  const requireSyncSettlement = !acceptsDelayed;

  let preferredChainId: "56" | "43114" | null = null;
  if (/\bbsc\b|\bbnb\b|\bbinance\b/i.test(lower)) preferredChainId = "56";
  else if (/\bavax\b|\bavalanche\b/i.test(lower)) preferredChainId = "43114";

  const bits: string[] = [`Deposit ${amount} USDC`];
  bits.push(
    preferredChainId === "56"
      ? "on BSC"
      : preferredChainId === "43114"
        ? "on Avalanche"
        : "on any chain",
  );
  bits.push(requireSyncSettlement ? "instant withdrawals only" : "delayed withdrawals ok");
  bits.push(allowKyc ? "KYC vaults ok" : "no KYC");

  return {
    amount,
    allowKyc,
    requireSyncSettlement,
    preferredChainId,
    summary: `${bits.join(", ")}.`,
    confidence: amountMatch ? "medium" : "low",
  };
}

export async function parseIntent(message: string): Promise<ParsedIntent> {
  const trimmed = message.trim();

  const { output, trace } = await runTracedStep<IntentOutput>({
    step: "intent",
    label: "Intent - parse free text into a mandate",
    inputSummary: `${trimmed.length} chars: "${trimmed.slice(0, 80)}${trimmed.length > 80 ? "..." : ""}"`,
    systemPrompt: INTENT_SYSTEM_PROMPT,
    userPayload: trimmed,
    schemaName: "capitalrail_intent",
    jsonSchema: INTENT_JSON_SCHEMA as unknown as Record<string, unknown>,
    validator: intentSchema,
    skipServReason: trimmed ? undefined : "empty message",
    fallback: () => (trimmed ? fallbackParseIntent(trimmed) : EMPTY_INTENT),
  });

  const summary =
    trace.source === "fallback" && trace.fallbackReason && !trace.ok
      ? `${output.summary} SERV unavailable (${trace.fallbackReason}).`
      : output.summary;

  return { ...output, summary, reasoning: trace.source === "serv" ? "serv" : "fallback", trace };
}
