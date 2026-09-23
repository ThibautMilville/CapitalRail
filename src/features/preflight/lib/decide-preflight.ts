import type { RailSnapshot } from "@/shared/ixs/types";
import { runTracedStep } from "@/shared/serv/client";
import {
  RANKING_JSON_SCHEMA,
  RISK_JSON_SCHEMA,
  VERIFICATION_JSON_SCHEMA,
  rankingSchema,
  riskSchema,
  verificationSchema,
  type Decision,
  type RankingOutput,
  type ReasonCode,
  type RiskNote,
  type RiskOutput,
  type ServDecision,
  type VerificationOutput,
} from "@/shared/serv/schema";
import {
  RANKING_SYSTEM_PROMPT,
  RISK_SYSTEM_PROMPT,
  VERIFICATION_SYSTEM_PROMPT,
} from "@/shared/serv/system-prompt";
import {
  computeTraceTotals,
  type ReasoningStepTrace,
} from "@/shared/serv/trace-types";
import { chainLabel } from "@/shared/wallet/chains";
import type {
  Disagreement,
  MandatePreferences,
  PreflightTrace,
  SafetyGuard,
} from "./types";

export type DecidePreflightInput = {
  walletAddress: string;
  amount: string;
  preferences: MandatePreferences;
  rails: RailSnapshot[];
};

export type DecidePreflightResult = ServDecision & {
  reasoning: "serv" | "fallback";
  rationale: string;
  verification: VerificationOutput;
  riskNotes: RiskNote[];
  intentReading: string;
  disagreements: Disagreement[];
  trace: PreflightTrace;
};

/** Authoritative verdict of the code rules for one rail. */
export type RulesEntry = {
  vaultId: string;
  eligible: boolean;
  reasonCode: ReasonCode;
  explanation: string;
};

function mandatePayload(input: DecidePreflightInput) {
  return {
    walletAddress: input.walletAddress,
    amountUsdc: input.amount,
    allowKyc: input.preferences.allowKyc,
    requireSyncSettlement: input.preferences.requireSyncSettlement,
    preferredChainId: input.preferences.preferredChainId ?? null,
  };
}

function describeMandate(input: DecidePreflightInput): string {
  const { preferences } = input;
  return [
    `${input.amount} USDC`,
    preferences.requireSyncSettlement ? "sync required" : "async ok",
    preferences.allowKyc ? "KYC ok" : "no KYC",
    preferences.preferredChainId
      ? `chain ${preferences.preferredChainId} only`
      : "any chain",
  ].join(", ");
}

function outsideChosenChain(
  rail: RailSnapshot,
  preferences: MandatePreferences,
): boolean {
  return (
    preferences.preferredChainId != null &&
    rail.chainId !== preferences.preferredChainId
  );
}

/** Mandate violations a rail has regardless of what any model says. */
export function mandateViolation(
  rail: RailSnapshot,
  preferences: MandatePreferences,
): ReasonCode | null {
  if (outsideChosenChain(rail, preferences)) return "CHAIN_MISMATCH";
  if (preferences.requireSyncSettlement && rail.settlement !== "sync") {
    return "SETTLEMENT_ASYNC_UNSUPPORTED_BY_MANDATE";
  }
  if (
    !preferences.allowKyc &&
    rail.requiresWhitelist &&
    rail.whitelistOk !== true
  ) {
    return "WHITELIST_REQUIRED";
  }
  return null;
}

/** Live capacity / access blocks. A pending whitelist outranks a 0 limit: onboarding comes first. */
export function capacityBlock(rail: RailSnapshot): ReasonCode | null {
  if (rail.reasonCodes.includes("INSUFFICIENT_BALANCE")) {
    return "INSUFFICIENT_BALANCE";
  }
  if (rail.depositBuildOk && rail.status === "open") return null;
  if (rail.reasonCodes.includes("WHITELIST_REQUIRED")) {
    return "WHITELIST_REQUIRED";
  }
  if (rail.reasonCodes.includes("DEPOSIT_LIMIT_ZERO")) {
    return "DEPOSIT_LIMIT_ZERO";
  }
  return "BUILD_FAILED";
}

function shortBalance(rail: RailSnapshot): string {
  const value = Number.parseFloat(rail.walletAssetBalance ?? "");
  if (!Number.isFinite(value)) return `less ${rail.assetSymbol}`;
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${rail.assetSymbol}`;
}

function explainBlock(rail: RailSnapshot, code: ReasonCode): string {
  switch (code) {
    case "CHAIN_MISMATCH":
      return `On ${chainLabel(rail.chainId)}, outside the chosen chain.`;
    case "SETTLEMENT_ASYNC_UNSUPPORTED_BY_MANDATE":
      return `Settlement is ${rail.settlement}; mandate requires sync.`;
    case "WHITELIST_REQUIRED":
      return "Whitelist/KYC required and not satisfied for this wallet.";
    case "INSUFFICIENT_BALANCE":
      return `Wallet holds ${shortBalance(rail)}, below the requested amount.`;
    case "DEPOSIT_LIMIT_ZERO":
      return "Deposit limit is 0: the vault accepts no deposit right now.";
    default:
      return rail.depositBuildError ?? `Rail status=${rail.status}`;
  }
}

/**
 * Hard rules, in blocking order: chosen chain, then mandate violations
 * (settlement, KYC), then live capacity. This is the authoritative filter.
 */
export function rulesFilter(input: DecidePreflightInput): RulesEntry[] {
  return input.rails.map((rail) => {
    const blocked =
      mandateViolation(rail, input.preferences) ?? capacityBlock(rail);
    if (blocked) {
      return {
        vaultId: rail.vaultId,
        eligible: false,
        reasonCode: blocked,
        explanation: explainBlock(rail, blocked),
      };
    }
    return {
      vaultId: rail.vaultId,
      eligible: true,
      reasonCode: "OK",
      explanation: `Open ${rail.settlement} rail on ${chainLabel(rail.chainId)}, deposit build ok.`,
    };
  });
}

/** A rail that fits every rule and is blocked only by a 0 deposit limit: capacity may return. */
function capacityMayReturn(input: DecidePreflightInput): boolean {
  return input.rails.some(
    (rail) =>
      rail.reasonCodes.includes("DEPOSIT_LIMIT_ZERO") &&
      !rail.reasonCodes.includes("WHITELIST_REQUIRED") &&
      !rail.reasonCodes.includes("INSUFFICIENT_BALANCE") &&
      !mandateViolation(rail, input.preferences),
  );
}

function balanceBlocked(input: DecidePreflightInput): RailSnapshot | undefined {
  return input.rails.find(
    (rail) =>
      rail.reasonCodes.includes("INSUFFICIENT_BALANCE") &&
      !mandateViolation(rail, input.preferences),
  );
}

export function noEntryDecision(input: DecidePreflightInput): "WAIT" | "NO-GO" {
  if (balanceBlocked(input)) return "NO-GO";
  return capacityMayReturn(input) ? "WAIT" : "NO-GO";
}

/** The outcome class is decided by code; SERV only ranks, explains and may veto. */
export function codeDecision(
  input: DecidePreflightInput,
  rules: RulesEntry[],
): Decision {
  return rules.some((entry) => entry.eligible) ? "GO" : noEntryDecision(input);
}

/* Derived facts, computed by code so the model can cite them without doing math. */

export type DerivedFacts = {
  amountShareOfVaultAssetsPct: number | null;
};

export function deriveFacts(
  rail: RailSnapshot,
  amount: string,
): DerivedFacts {
  const assets = Number.parseFloat(rail.totalAssets ?? "");
  const deposit = Number.parseFloat(amount);
  if (!Number.isFinite(assets) || !Number.isFinite(deposit) || deposit <= 0) {
    return { amountShareOfVaultAssetsPct: null };
  }
  const pct = (deposit / (assets + deposit)) * 100;
  return { amountShareOfVaultAssetsPct: Math.round(pct * 10) / 10 };
}

function railWithFacts(rail: RailSnapshot, amount: string) {
  return { ...rail, derived: deriveFacts(rail, amount) };
}

/* Deterministic fallbacks, one per SERV step. */

const SEVERITY_WEIGHT = { info: 0, caution: 1, high: 2 } as const;

export function fallbackRisk(
  input: DecidePreflightInput,
  rules: RulesEntry[],
): RiskOutput {
  const ruleById = new Map(rules.map((entry) => [entry.vaultId, entry]));
  const notes: RiskNote[] = [];

  const relevant = input.rails
    .filter((rail) => !outsideChosenChain(rail, input.preferences))
    .sort(
      (a, b) =>
        Number(ruleById.get(b.vaultId)?.eligible) -
        Number(ruleById.get(a.vaultId)?.eligible),
    );

  for (const rail of relevant) {
    const label = `${chainLabel(rail.chainId)} ${rail.requiresWhitelist ? "KYC" : "open"} vault`;
    if (rail.settlement.startsWith("async")) {
      notes.push({
        vaultId: rail.vaultId,
        category: "exit_delay",
        severity: "caution",
        note: `${label}: withdrawals are delayed (ERC-7540 request now, claim later), not instant.`,
        facts: ["settlement"],
      });
    }
    if (rail.reasonCodes.includes("DEPOSIT_LIMIT_ZERO")) {
      notes.push({
        vaultId: rail.vaultId,
        category: "capacity",
        severity: "high",
        note: `${label}: deposit limit is 0, a deposit would fail today.`,
        facts: ["reasonCodes", "depositBuildError"],
      });
    }
    if (rail.requiresWhitelist && rail.whitelistOk !== true) {
      notes.push({
        vaultId: rail.vaultId,
        category: "whitelist_onboarding",
        severity: "caution",
        note: `${label}: this wallet is not whitelisted yet; IXS KYC onboarding comes first.`,
        facts: ["requiresWhitelist", "whitelistOk"],
      });
    }
    const { amountShareOfVaultAssetsPct: pct } = deriveFacts(rail, input.amount);
    if (pct != null && pct >= 10 && rail.totalAssets) {
      notes.push({
        vaultId: rail.vaultId,
        category: "low_tvl_concentration",
        severity: pct >= 50 ? "high" : "caution",
        note: `${label}: the vault holds ${rail.totalAssets} ${rail.assetSymbol}; your ${input.amount} would be about ${pct}% of it.`,
        facts: ["totalAssets", "derived.amountShareOfVaultAssetsPct"],
      });
    }
    if (rail.ttm != null && ruleById.get(rail.vaultId)?.eligible) {
      notes.push({
        vaultId: rail.vaultId,
        category: "maturity",
        severity: "info",
        note: `${label}: IXS reports a time to maturity (ttm) of ${rail.ttm}.`,
        facts: ["ttm"],
      });
    }
  }

  const tensions: string[] = [];
  const onChain = relevant;
  if (
    input.preferences.requireSyncSettlement &&
    onChain.length > 0 &&
    onChain.every((rail) => rail.settlement !== "sync")
  ) {
    tensions.push(
      "You asked for instant withdrawals, but every scanned vault settles with delayed (ERC-7540) withdrawals.",
    );
  }
  if (
    !input.preferences.allowKyc &&
    onChain.some((rail) => rail.requiresWhitelist) &&
    !onChain.some((rail) => !rail.requiresWhitelist && rail.status === "open")
  ) {
    tensions.push(
      "KYC is off, and no permissionless vault on your chain has open capacity.",
    );
  }

  return {
    intentReading: tensions.join(" ") || "No tension.",
    crossCheck: rules.map((entry) => ({
      vaultId: entry.vaultId,
      servView: entry.eligible ? "eligible" : "ineligible",
      reasonCode: entry.reasonCode,
      comment: "Fallback mirrors the code rules (no independent SERV view).",
    })),
    riskNotes: notes.slice(0, 8),
  };
}

function rankScore(rail: RailSnapshot, notes: RiskNote[]) {
  let score = 0;
  if (rail.settlement === "sync") score += 4;
  if (!rail.requiresWhitelist) score += 2;
  for (const note of notes) {
    if (note.vaultId === rail.vaultId) score -= SEVERITY_WEIGHT[note.severity];
  }
  return score;
}

export function fallbackRanking(
  input: DecidePreflightInput,
  eligible: RailSnapshot[],
  decision: Decision,
  riskNotes: RiskNote[],
): RankingOutput {
  const ordered = [...eligible].sort(
    (a, b) => rankScore(b, riskNotes) - rankScore(a, riskNotes),
  );
  const selected = ordered[0] ?? null;

  if (!selected) {
    const lowBalance = balanceBlocked(input);
    const rationale = lowBalance
      ? `The ${chainLabel(lowBalance.chainId)} ${lowBalance.settlement} rail is open, but the wallet holds ${shortBalance(lowBalance)}, below ${input.amount} ${lowBalance.assetSymbol}.`
      : decision === "WAIT"
        ? "No eligible rail; a rail that fits every rule reports deposit limit 0, so capacity may return."
        : "No eligible rail; every rail is blocked, gated or outside the mandate.";
    return {
      selectedVaultId: null,
      ranking: [],
      rationale,
      memoMarkdown: [
        "## CapitalRail preflight (fallback)",
        "",
        "No open IXS rail matches the mandate right now.",
        rationale,
      ].join("\n"),
      userNextSteps: lowBalance
        ? [
            "Lower the amount to your available balance, or top up first.",
            "Re-check once the wallet holds enough USDC.",
          ]
        : decision === "WAIT"
          ? [
              "Re-check later: deposit capacity may reopen.",
              "Try another chain if you do not want to wait.",
            ]
          : [
              "Loosen one rule (chain, KYC or instant withdrawals) and re-check.",
              "Enable KYC only if you can complete whitelist onboarding.",
            ],
    };
  }

  const selectedNotes = riskNotes.filter(
    (note) => note.vaultId === selected.vaultId,
  );
  return {
    selectedVaultId: selected.vaultId,
    ranking: ordered.map((rail, index) => ({
      vaultId: rail.vaultId,
      why:
        index === 0
          ? `Best score: ${rail.settlement} settlement, ${rail.requiresWhitelist ? "whitelisted" : "permissionless"} access.`
          : `Ranked lower: ${rail.settlement} settlement, ${rail.requiresWhitelist ? "whitelisted" : "permissionless"} access.`,
    })),
    rationale: [
      `${chainLabel(selected.chainId)} ${selected.settlement} rail ranks first among ${eligible.length} eligible rail(s)`,
      selected.requiresWhitelist ? "" : "with permissionless access.",
    ]
      .filter(Boolean)
      .join(" "),
    memoMarkdown: [
      "## CapitalRail preflight (fallback)",
      "",
      `**Recommendation:** deposit on **${chainLabel(selected.chainId)}** via \`${selected.symbol}\` (${selected.settlement}).`,
      "",
      `- Vault: \`${selected.vaultId}\``,
      `- Whitelist: ${selected.requiresWhitelist ? "required" : "not required"}`,
      `- Price/share: ${selected.pricePerShare ?? "n/a"}`,
      ...(selectedNotes.length > 0
        ? ["", "**Worth knowing:**", ...selectedNotes.map((note) => `- ${note.note}`)]
        : []),
      "",
      "Unsigned approve + deposit steps are prepared for wallet review.",
    ].join("\n"),
    userNextSteps: [
      "Review the deposit steps: approve first, then deposit.",
      "Sign only if the amount and chain match your intent.",
    ],
  };
}

export function fallbackVerification(
  input: DecidePreflightInput,
  decision: Decision,
  selectedVaultId: string | null,
): VerificationOutput {
  const issues: VerificationOutput["issues"] = [];

  if (decision === "GO") {
    const selected = input.rails.find((rail) => rail.vaultId === selectedVaultId);
    if (!selected) {
      issues.push({
        vaultId: selectedVaultId,
        kind: "rule_violation",
        issue: "GO without a known selected rail.",
      });
    } else {
      const block = capacityBlock(selected);
      if (block) {
        issues.push({
          vaultId: selected.vaultId,
          kind: "rule_violation",
          issue: `Selected rail is not open/buildable (${block}).`,
        });
      }
      const violation = mandateViolation(selected, input.preferences);
      if (violation) {
        issues.push({
          vaultId: selected.vaultId,
          kind: "rule_violation",
          issue: `Selected rail violates the mandate (${violation}).`,
        });
      }
    }
  } else {
    const missed = input.rails.find(
      (rail) => !capacityBlock(rail) && !mandateViolation(rail, input.preferences),
    );
    if (missed) {
      issues.push({
        vaultId: missed.vaultId,
        kind: "missed_option",
        issue: `${decision} while ${missed.chainName} rail is open and inside the mandate.`,
      });
    }
  }

  return { verdict: issues.length === 0 ? "pass" : "fail", issues };
}

/** A "fail" only vetoes when it cites a hard fact or rule; otherwise it is a warning. */
export function normalizeVerification(
  output: VerificationOutput,
): VerificationOutput {
  if (output.verdict !== "fail") return output;
  const hard = output.issues.some(
    (issue) => issue.kind === "fact_mismatch" || issue.kind === "rule_violation",
  );
  return hard ? output : { ...output, verdict: "warn" };
}

/* Code-level guard: the last word always belongs to deterministic checks. */

export function applySafetyGuard(
  input: DecidePreflightInput,
  decision: ServDecision,
): { decision: ServDecision; guard: SafetyGuard } {
  if (decision.decision !== "GO") {
    return { decision, guard: { applied: false, reason: null } };
  }

  const selected = input.rails.find(
    (rail) => rail.vaultId === decision.selectedVaultId,
  );
  const reason = !selected
    ? "selected rail is unknown"
    : capacityBlock(selected)
      ? "selected rail was not open/buildable"
      : mandateViolation(selected, input.preferences)
        ? "selected rail violates the mandate"
        : null;

  if (!reason) {
    return { decision, guard: { applied: false, reason: null } };
  }

  return {
    decision: {
      ...decision,
      decision: "NO-GO",
      selectedVaultId: null,
      memoMarkdown: `${decision.memoMarkdown}\n\n_CapitalRail safety override: ${reason}._`,
    },
    guard: { applied: true, reason },
  };
}

/** Where SERV and the code rules (or the verifier and the proposal) do not agree. */
export function computeDisagreements(
  rules: RulesEntry[],
  risk: RiskOutput,
  verification: VerificationOutput,
  vetoed: boolean,
): Disagreement[] {
  const ruleById = new Map(rules.map((entry) => [entry.vaultId, entry]));
  const out: Disagreement[] = [];

  for (const view of risk.crossCheck) {
    const rule = ruleById.get(view.vaultId);
    if (!rule) continue;
    const servEligible = view.servView === "eligible";
    if (servEligible === rule.eligible) continue;
    out.push({
      step: "risk",
      vaultId: view.vaultId,
      rules: rule.eligible ? "eligible" : `ineligible (${rule.reasonCode})`,
      serv: servEligible ? "eligible" : `ineligible (${view.reasonCode})`,
      note: view.comment,
      resolution: "Code rules kept (authoritative). Flagged for review.",
    });
  }

  if (verification.verdict !== "pass") {
    for (const issue of verification.issues) {
      out.push({
        step: "verification",
        vaultId: issue.vaultId,
        rules: "proposal",
        serv: `${verification.verdict} (${issue.kind})`,
        note: issue.issue,
        resolution: vetoed
          ? "GO vetoed: the verifier can block an entry, never unlock one."
          : "Decision kept, shown as a warning.",
      });
    }
  }

  return out;
}

function buildRejected(
  rules: RulesEntry[],
  selectedVaultId: string | null,
): ServDecision["rejected"] {
  return rules
    .filter((entry) => entry.vaultId !== selectedVaultId)
    .map((entry) => ({
      vaultId: entry.vaultId,
      reasonCode: entry.reasonCode,
      explanation: entry.eligible
        ? "Eligible but ranked below the selected rail."
        : entry.explanation,
    }));
}

const NUMBER_PATTERN = /\d+(?:\.\d+)?/g;

/** Rejects notes that cite a number absent from the payload (grounding check). */
function assertGrounded(text: string, payloadText: string, where: string) {
  for (const value of text.match(NUMBER_PATTERN) ?? []) {
    if (!payloadText.includes(value)) {
      throw new Error(`${where} cites ${value}, not in the payload`);
    }
  }
}

function codeStepTrace(
  input: DecidePreflightInput,
  rules: RulesEntry[],
  decision: Decision,
  started: number,
  startedAt: Date,
): ReasoningStepTrace {
  const eligible = rules.filter((entry) => entry.eligible).length;
  return {
    id: "rules",
    label: "Rules filter - deterministic code (authoritative)",
    model: "deterministic",
    routedModel: "code",
    tier: null,
    source: "code",
    startedAt: startedAt.toISOString(),
    durationMs: Math.round(performance.now() - started),
    promptTokens: null,
    completionTokens: null,
    costUsd: null,
    projectedCostUsd: null,
    inputSummary: `${input.rails.length} rails vs mandate (${describeMandate(input)}) -> ${eligible} eligible, outcome ${decision}`,
    output: { outcome: decision, rails: rules },
    ok: true,
    fallbackReason: null,
  };
}

export async function decidePreflight(
  input: DecidePreflightInput,
): Promise<DecidePreflightResult> {
  const mandate = mandatePayload(input);
  const railIds = new Set(input.rails.map((rail) => rail.vaultId));
  const steps: ReasoningStepTrace[] = [];

  const rulesStartedAt = new Date();
  const rulesStarted = performance.now();
  const rules = rulesFilter(input);
  const outcome = codeDecision(input, rules);
  steps.push(codeStepTrace(input, rules, outcome, rulesStarted, rulesStartedAt));

  const eligibleIds = new Set(
    rules.filter((entry) => entry.eligible).map((entry) => entry.vaultId),
  );
  const eligibleRails = input.rails.filter((rail) => eligibleIds.has(rail.vaultId));
  const railsWithFacts = input.rails.map((rail) => railWithFacts(rail, input.amount));

  const riskPayload = {
    mandate,
    rulesFilter: { outcome, rails: rules },
    rails: railsWithFacts,
  };
  const riskPayloadText = JSON.stringify(riskPayload);
  const riskStep = await runTracedStep<RiskOutput>({
    step: "risk",
    label: "Risk notes + rules cross-check",
    inputSummary: `${input.rails.length} rails + code filter (${eligibleIds.size} eligible, ${outcome})`,
    systemPrompt: RISK_SYSTEM_PROMPT,
    userPayload: riskPayload,
    schemaName: "capitalrail_risk",
    jsonSchema: RISK_JSON_SCHEMA as unknown as Record<string, unknown>,
    validator: riskSchema,
    check: (data) => {
      const seen = new Set(data.crossCheck.map((entry) => entry.vaultId));
      for (const id of railIds) {
        if (!seen.has(id)) throw new Error(`crossCheck missing rail ${id}`);
      }
      for (const id of seen) {
        if (!railIds.has(id)) throw new Error(`crossCheck unknown rail ${id}`);
      }
      data.riskNotes.forEach((note, index) => {
        if (note.vaultId && !railIds.has(note.vaultId)) {
          throw new Error(`riskNotes[${index}] unknown rail ${note.vaultId}`);
        }
        assertGrounded(note.note, riskPayloadText, `riskNotes[${index}]`);
      });
      assertGrounded(data.intentReading, riskPayloadText, "intentReading");
    },
    fallback: () => fallbackRisk(input, rules),
  });
  steps.push(riskStep.trace);
  const risk = riskStep.output;

  const rankingStep = await runTracedStep<RankingOutput>({
    step: "ranking",
    label: "Ranking + memo - judgment on eligible rails",
    inputSummary: `${eligibleRails.length} eligible of ${input.rails.length} rails, ${risk.riskNotes.length} risk notes, outcome ${outcome}`,
    systemPrompt: RANKING_SYSTEM_PROMPT,
    userPayload: {
      mandate,
      codeDecision: outcome,
      eligibleRails: eligibleRails.map((rail) => railWithFacts(rail, input.amount)),
      ineligibleRails: rules.filter((entry) => !entry.eligible),
      riskNotes: risk.riskNotes,
      intentReading: risk.intentReading,
    },
    schemaName: "capitalrail_ranking",
    jsonSchema: RANKING_JSON_SCHEMA as unknown as Record<string, unknown>,
    validator: rankingSchema,
    check: (data) => {
      if (eligibleIds.size > 0) {
        if (!data.selectedVaultId || !eligibleIds.has(data.selectedVaultId)) {
          throw new Error("must select one of the eligible rails");
        }
      } else if (data.selectedVaultId !== null) {
        throw new Error("no rail is eligible, selectedVaultId must be null");
      }
      for (const entry of data.ranking) {
        if (!eligibleIds.has(entry.vaultId)) {
          throw new Error(`ranking lists non-eligible rail ${entry.vaultId}`);
        }
      }
    },
    fallback: () => fallbackRanking(input, eligibleRails, outcome, risk.riskNotes),
  });
  steps.push(rankingStep.trace);
  const proposal = rankingStep.output;

  const verificationStep = await runTracedStep<VerificationOutput>({
    step: "verification",
    label: "Independent verifier - may contradict",
    inputSummary: `${outcome}${proposal.selectedVaultId ? ` on ${proposal.selectedVaultId}` : ""} vs ${input.rails.length} raw rails`,
    systemPrompt: VERIFICATION_SYSTEM_PROMPT,
    userPayload: {
      mandate,
      proposal: {
        decision: outcome,
        selectedVaultId: proposal.selectedVaultId,
        rationale: proposal.rationale,
        memoMarkdown: proposal.memoMarkdown,
      },
      riskNotes: risk.riskNotes,
      rawRails: railsWithFacts,
    },
    schemaName: "capitalrail_verification",
    jsonSchema: VERIFICATION_JSON_SCHEMA as unknown as Record<string, unknown>,
    validator: verificationSchema,
    check: (data) => {
      if (data.verdict !== "pass" && data.issues.length === 0) {
        throw new Error(`${data.verdict} verdict without issues`);
      }
    },
    fallback: () =>
      fallbackVerification(input, outcome, proposal.selectedVaultId),
  });
  const verification = normalizeVerification(verificationStep.output);
  steps.push({
    ...verificationStep.trace,
    output: verification,
    ok: verificationStep.trace.ok && verification.verdict !== "fail",
  });

  let composed: ServDecision = {
    decision: outcome,
    selectedVaultId: outcome === "GO" ? proposal.selectedVaultId : null,
    rejected: [],
    memoMarkdown: proposal.memoMarkdown,
    userNextSteps: proposal.userNextSteps,
  };

  const vetoed = verification.verdict === "fail" && composed.decision === "GO";
  if (verification.verdict !== "pass") {
    const issueLines = verification.issues.map((item) => `- ${item.issue}`);
    composed = {
      ...composed,
      ...(vetoed ? { decision: "NO-GO" as const, selectedVaultId: null } : {}),
      memoMarkdown: [
        composed.memoMarkdown,
        "",
        verification.verdict === "fail"
          ? "_Verifier objection (blocking):_"
          : "_Verifier warnings:_",
        ...issueLines,
      ].join("\n"),
    };
  }

  const guarded = applySafetyGuard(input, composed);
  const final = guarded.decision;
  final.rejected = buildRejected(rules, final.selectedVaultId);
  const disagreements = computeDisagreements(rules, risk, verification, vetoed);

  return {
    ...final,
    reasoning: rankingStep.trace.source === "serv" ? "serv" : "fallback",
    rationale: proposal.rationale,
    verification,
    riskNotes: risk.riskNotes,
    intentReading: risk.intentReading,
    disagreements,
    trace: {
      steps,
      totals: computeTraceTotals(steps),
      guard: guarded.guard,
      disagreements,
    },
  };
}
