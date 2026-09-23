import type { ServModelTier } from "./config";

/** "code" = deterministic rule step (authoritative), never a model. */
export type TraceSource = "serv" | "fallback" | "code";

export const NO_KEY_REASON = "no SERV_API_KEY";

export type ReasoningStepTrace = {
  id: string;
  label: string;
  /** Model that actually produced the output ("deterministic" for fallback / code). */
  model: string;
  /** Model the router assigned to this step, even when it ran in fallback. */
  routedModel: string;
  /** Router tier; null for code steps. */
  tier: ServModelTier | null;
  source: TraceSource;
  startedAt: string;
  durationMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  /** Estimated USD cost from real token usage (null when unknown or not a SERV call). */
  costUsd: number | null;
  /**
   * Fallback / code-free steps only: projected cost if SERV had run, from
   * payload size (about 4 chars per token) and the routed model list price.
   */
  projectedCostUsd: number | null;
  inputSummary: string;
  output: unknown;
  ok: boolean;
  /** Why the step fell back (missing key, SERV error, schema validation). */
  fallbackReason: string | null;
};

export type TraceTotals = {
  durationMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  projectedCostUsd: number | null;
  servSteps: number;
  fallbackSteps: number;
  codeSteps: number;
  /** True when every model step of this run was answered by SERV. */
  servLive: boolean;
};

export type ReasoningTrace = {
  steps: ReasoningStepTrace[];
  totals: TraceTotals;
};

function sumNullable(values: (number | null)[]): number | null {
  let total: number | null = null;
  for (const value of values) {
    if (value != null) total = (total ?? 0) + value;
  }
  return total;
}

export function computeTraceTotals(steps: ReasoningStepTrace[]): TraceTotals {
  const promptTokens = sumNullable(steps.map((step) => step.promptTokens));
  const completionTokens = sumNullable(
    steps.map((step) => step.completionTokens),
  );
  const servSteps = steps.filter((step) => step.source === "serv").length;
  const fallbackSteps = steps.filter((step) => step.source === "fallback").length;

  return {
    durationMs: steps.reduce((sum, step) => sum + step.durationMs, 0),
    promptTokens,
    completionTokens,
    totalTokens:
      promptTokens == null && completionTokens == null
        ? null
        : (promptTokens ?? 0) + (completionTokens ?? 0),
    costUsd: sumNullable(steps.map((step) => step.costUsd)),
    projectedCostUsd: sumNullable(
      steps.map((step) => step.costUsd ?? step.projectedCostUsd),
    ),
    servSteps,
    fallbackSteps,
    codeSteps: steps.filter((step) => step.source === "code").length,
    servLive: servSteps > 0 && fallbackSteps === 0,
  };
}
