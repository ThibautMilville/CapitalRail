import type { Decision, ServDecision } from "@/shared/serv/schema";
import type { VerificationOutput } from "@/shared/serv/schema";
import { IXS_OPS_FACTS } from "@/shared/ixs/ops-facts";

/** Phrases that invite preparing or signing a deposit - forbidden when not GO. */
const DEPOSIT_INVITE =
  /\b(proceed|go ahead|you can enter|recommendation:\s*deposit|unsigned|prepare (?:a |the |your )?(?:deposit|tx|transaction)|sign (?:the |your )?(?:tx|transaction|deposit|approve)|review the deposit steps|approve first,? then deposit)\b/i;

export type AlignDecisionCopyInput = {
  decision: Decision;
  selectedVaultId: string | null;
  memoMarkdown: string;
  userNextSteps: string[];
  rationale?: string;
  verification?: VerificationOutput;
  vetoed?: boolean;
  safetyReason?: string | null;
};

/**
 * After verifier veto, safety override, or a non-GO code outcome, rewrite memo
 * and next steps so they never contradict the final decision.
 */
export function alignDecisionCopy(input: AlignDecisionCopyInput): Pick<
  ServDecision,
  "memoMarkdown" | "userNextSteps" | "selectedVaultId"
> {
  const {
    decision,
    selectedVaultId,
    memoMarkdown,
    userNextSteps,
    rationale,
    verification,
    vetoed,
    safetyReason,
  } = input;

  if (decision === "GO") {
    return {
      selectedVaultId,
      memoMarkdown,
      userNextSteps: userNextSteps.filter(Boolean).slice(0, 6),
    };
  }

  return {
    selectedVaultId: null,
    memoMarkdown: buildNonGoMemo({
      decision,
      priorMemo: memoMarkdown,
      rationale,
      verification,
      vetoed: Boolean(vetoed),
      safetyReason: safetyReason ?? null,
    }),
    userNextSteps: buildNonGoNextSteps(decision, userNextSteps),
  };
}

function buildNonGoMemo(args: {
  decision: "WAIT" | "NO-GO";
  priorMemo: string;
  rationale?: string;
  verification?: VerificationOutput;
  vetoed: boolean;
  safetyReason: string | null;
}): string {
  const lines: string[] = [
    `## CapitalRail preflight - ${args.decision}`,
    "",
  ];

  if (args.vetoed) {
    lines.push(
      "**Final decision: NO-GO.** The independent verifier blocked this entry. Do not prepare or sign a deposit.",
      "",
    );
    if (args.verification?.issues.length) {
      lines.push("**Verifier issues:**");
      for (const issue of args.verification.issues) {
        lines.push(`- ${issue.issue}`);
      }
      lines.push("");
    }
  } else if (args.safetyReason) {
    lines.push(
      `**Final decision: NO-GO.** Code safety override: ${args.safetyReason}. Do not prepare or sign a deposit.`,
      "",
    );
  } else if (args.decision === "WAIT") {
    lines.push(
      "**Final decision: WAIT.** A vault that fits your rules exists, but live capacity is not ready (often MCP deposit limit 0 / NAV staleness). CapitalRail refuses to force a deposit until the build succeeds.",
      "",
    );
  } else {
    lines.push(
      "**Final decision: NO-GO.** No open IXS rail matches the mandate right now. Nothing was prepared for signing.",
      "",
    );
  }

  if (args.rationale?.trim()) {
    lines.push(`**Context:** ${args.rationale.trim()}`, "");
  }

  lines.push(`Settlement clock (IXS ops): ${IXS_OPS_FACTS.settlementCutoff}`);

  // Keep non-inviting factual lines from a prior SERV memo when useful (short).
  const extras = extractSafeMemoExtras(args.priorMemo);
  if (extras.length > 0) {
    lines.push("", "**Additional notes:**", ...extras.map((line) => `- ${line}`));
  }

  return lines.join("\n");
}

function extractSafeMemoExtras(memo: string): string[] {
  const out: string[] = [];
  for (const raw of memo.split("\n")) {
    const line = raw.replace(/^[-*]\s+/, "").replace(/^#+\s*/, "").trim();
    if (!line || line.length < 12) continue;
    if (DEPOSIT_INVITE.test(line)) continue;
    if (/recommendation|you can enter|go ahead|ready to/i.test(line)) continue;
    if (out.some((existing) => existing === line)) continue;
    out.push(line.slice(0, 220));
    if (out.length >= 3) break;
  }
  return out;
}

function buildNonGoNextSteps(
  decision: "WAIT" | "NO-GO",
  prior: string[],
): string[] {
  const safePrior = prior
    .map((step) => step.trim())
    .filter((step) => step.length > 0 && !DEPOSIT_INVITE.test(step))
    .slice(0, 2);

  if (decision === "WAIT") {
    return [
      "Re-check later: MCP limit 0 may clear after NAV refresh - do not force a deposit.",
      "Try another chain (e.g. BSC) if you do not want to wait.",
      ...safePrior,
    ].slice(0, 4);
  }

  return [
    "Loosen one rule (chain, KYC or instant withdrawals) and re-check.",
    "Do not prepare or sign a deposit while the decision is NO-GO.",
    ...safePrior,
  ].slice(0, 4);
}

/** True when memo or steps still invite a deposit despite a non-GO decision. */
export function decisionCopyConflicts(
  decision: Decision,
  memoMarkdown: string,
  userNextSteps: string[],
): boolean {
  if (decision === "GO") return false;
  if (DEPOSIT_INVITE.test(memoMarkdown)) return true;
  return userNextSteps.some((step) => DEPOSIT_INVITE.test(step));
}
