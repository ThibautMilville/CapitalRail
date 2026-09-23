import { z } from "zod";

export const REASON_CODES = [
  "DEPOSIT_LIMIT_ZERO",
  "WHITELIST_REQUIRED",
  "SETTLEMENT_ASYNC_UNSUPPORTED_BY_MANDATE",
  "CHAIN_MISMATCH",
  "BUILD_FAILED",
  "INSUFFICIENT_BALANCE",
  "OK",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export const DECISIONS = ["GO", "NO-GO", "WAIT"] as const;

export type Decision = (typeof DECISIONS)[number];

/* Step "risk" - risk notes + independent cross-check of the code rules filter. */

export const RISK_CATEGORIES = [
  "exit_delay",
  "maturity",
  "low_tvl_concentration",
  "whitelist_onboarding",
  "capacity",
  "pricing",
  "mandate_tension",
  "other",
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const RISK_SEVERITIES = ["info", "caution", "high"] as const;

export type RiskSeverity = (typeof RISK_SEVERITIES)[number];

export const RISK_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intentReading", "crossCheck", "riskNotes"],
  properties: {
    intentReading: { type: "string" },
    crossCheck: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["vaultId", "servView", "reasonCode", "comment"],
        properties: {
          vaultId: { type: "string" },
          servView: { type: "string", enum: ["eligible", "ineligible"] },
          reasonCode: { type: "string", enum: [...REASON_CODES] },
          comment: { type: "string" },
        },
      },
    },
    riskNotes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["vaultId", "category", "severity", "note", "facts"],
        properties: {
          vaultId: { type: ["string", "null"] },
          category: { type: "string", enum: [...RISK_CATEGORIES] },
          severity: { type: "string", enum: [...RISK_SEVERITIES] },
          note: { type: "string" },
          facts: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export const riskSchema = z.object({
  intentReading: z.string().max(500),
  crossCheck: z
    .array(
      z.object({
        vaultId: z.string().min(1),
        servView: z.enum(["eligible", "ineligible"]),
        reasonCode: z.enum(REASON_CODES),
        comment: z.string().max(400),
      }),
    )
    .max(50),
  riskNotes: z
    .array(
      z.object({
        vaultId: z.string().min(1).nullable(),
        category: z.enum(RISK_CATEGORIES),
        severity: z.enum(RISK_SEVERITIES),
        note: z.string().min(1).max(300),
        facts: z.array(z.string().max(60)).min(1).max(6),
      }),
    )
    .max(24),
});

export type RiskOutput = z.infer<typeof riskSchema>;

export type RiskNote = RiskOutput["riskNotes"][number];

/* Step "ranking" - order the rails the code filter kept, write the memo. */

export const RANKING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "selectedVaultId",
    "ranking",
    "rationale",
    "memoMarkdown",
    "userNextSteps",
  ],
  properties: {
    selectedVaultId: { type: ["string", "null"] },
    ranking: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["vaultId", "why"],
        properties: {
          vaultId: { type: "string" },
          why: { type: "string" },
        },
      },
    },
    rationale: { type: "string" },
    memoMarkdown: { type: "string" },
    userNextSteps: { type: "array", items: { type: "string" } },
  },
} as const;

export const rankingSchema = z.object({
  selectedVaultId: z.string().min(1).nullable(),
  ranking: z
    .array(z.object({ vaultId: z.string().min(1), why: z.string().max(300) }))
    .max(20),
  rationale: z.string().max(800),
  memoMarkdown: z.string().max(4000),
  userNextSteps: z.array(z.string().max(300)).max(6),
});

export type RankingOutput = z.infer<typeof rankingSchema>;

/* Step "verification" - independent verifier, may contradict and veto a GO. */

export const VERIFICATION_ISSUE_KINDS = [
  "fact_mismatch",
  "rule_violation",
  "missed_option",
  "risk_understated",
  "other",
] as const;

export const VERIFICATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "issues"],
  properties: {
    verdict: { type: "string", enum: ["pass", "warn", "fail"] },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["vaultId", "kind", "issue"],
        properties: {
          vaultId: { type: ["string", "null"] },
          kind: { type: "string", enum: [...VERIFICATION_ISSUE_KINDS] },
          issue: { type: "string" },
        },
      },
    },
  },
} as const;

export const verificationSchema = z.object({
  verdict: z.enum(["pass", "warn", "fail"]),
  issues: z
    .array(
      z.object({
        vaultId: z.string().nullable(),
        kind: z.enum(VERIFICATION_ISSUE_KINDS),
        issue: z.string().max(400),
      }),
    )
    .max(20),
});

export type VerificationOutput = z.infer<typeof verificationSchema>;

export type ServDecision = {
  decision: Decision;
  selectedVaultId: string | null;
  rejected: {
    vaultId: string;
    reasonCode: ReasonCode;
    explanation: string;
  }[];
  memoMarkdown: string;
  userNextSteps: string[];
};
