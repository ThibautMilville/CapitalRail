import type { DepositBuildResult, RailSnapshot } from "@/shared/ixs/types";
import type { RiskNote, VerificationOutput } from "@/shared/serv/schema";
import type { ReasoningTrace } from "@/shared/serv/trace-types";

export type MandatePreferences = {
  allowKyc: boolean;
  requireSyncSettlement: boolean;
  preferredChainId?: 56 | 43114;
};

export type PreflightRequest = {
  walletAddress: `0x${string}`;
  amount: string;
  preferences: MandatePreferences;
};

/** Code-level override applied after every model step. */
export type SafetyGuard = {
  applied: boolean;
  reason: string | null;
};

/** A point where SERV disagrees with the code rules or the verifier with the proposal. */
export type Disagreement = {
  step: "risk" | "verification";
  vaultId: string | null;
  /** What the code rules (or the proposal) said. */
  rules: string;
  /** What SERV said. */
  serv: string;
  note: string;
  /** How CapitalRail resolved it. */
  resolution: string;
};

export type PreflightTrace = ReasoningTrace & {
  guard: SafetyGuard;
  disagreements: Disagreement[];
};

export type PreflightResponse = {
  rails: RailSnapshot[];
  decision: "GO" | "NO-GO" | "WAIT";
  selectedVaultId: string | null;
  rejected: {
    vaultId: string;
    reasonCode: string;
    explanation: string;
  }[];
  memoMarkdown: string;
  userNextSteps: string[];
  /** Source of the ranking step (the step that authors the decision). */
  reasoning: "serv" | "fallback";
  rationale: string;
  verification: VerificationOutput;
  /** Fact-grounded notes (SERV, or deterministic fallback) for the rails that matter. */
  riskNotes: RiskNote[];
  /** How the mandate meets the rails on offer ("No tension." when none). */
  intentReading: string;
  disagreements: Disagreement[];
  trace: PreflightTrace;
  txPack?: DepositBuildResult;
  /** True for the placeholder wallet: public data only, never a tx pack. */
  preview: boolean;
  /** Wallet the scan and any tx pack were built for. */
  walletAddress: `0x${string}`;
  scannedAt: string;
  /** SHA-256 of canonical rails + mandate snapshot (0x-prefixed hex). */
  snapshotHash: `0x${string}`;
  /** ISO timestamp when the snapshot hash was attested. */
  attestedAt: string;
};
