/**
 * Cost-aware model routing for SERV (and optional OpenJEV on the fast path).
 * Logic only - call sites use modelForStep / tierForStep; never hardcode models in views.
 */

export const SERV_BASE_URL = "https://inference-api.openserv.ai/v1";

export const SERV_DEFAULT_MODEL_FAST = "gpt-5.4-mini";
export const SERV_DEFAULT_MODEL_SMALL = "gpt-5.4-mini";
export const SERV_DEFAULT_MODEL_LARGE = "gpt-5.4";

export const OPENJEV_BASE_URL = "https://api.openjev.sh/v1/systemone";
export const OPENJEV_MODEL = "openjev";

export type ServModelTier = "fast" | "small" | "large";

export type ServStepId =
  | "intent"
  | "risk"
  | "ranking"
  | "verification"
  | "agent";

/**
 * Task → tier map (defaults). Env SERV_TIER_<STEP> can override (fast|small|large).
 *
 * fast  - simple structured choice / short extract (intent, binary-ish verification)
 * small - structured judgment that still fits mini (risk, ranking+memo, agent)
 * large - reserved for heavy synthesis; unused by default (set SERV_TIER_RANKING=large to restore)
 */
const DEFAULT_STEP_TIERS: Record<ServStepId, ServModelTier> = {
  intent: "fast",
  verification: "fast",
  risk: "small",
  ranking: "small",
  agent: "small",
};

function parseTier(raw: string | undefined): ServModelTier | null {
  const value = raw?.trim().toLowerCase();
  if (value === "fast" || value === "small" || value === "large") return value;
  return null;
}

export function tierForStep(step: ServStepId): ServModelTier {
  const envKey = `SERV_TIER_${step.toUpperCase()}`;
  return parseTier(process.env[envKey]) ?? DEFAULT_STEP_TIERS[step];
}

export function servModels(): Record<ServModelTier, string> {
  return {
    fast:
      process.env.SERV_MODEL_FAST?.trim() ||
      process.env.SERV_MODEL_SMALL?.trim() ||
      SERV_DEFAULT_MODEL_FAST,
    small: process.env.SERV_MODEL_SMALL?.trim() || SERV_DEFAULT_MODEL_SMALL,
    large:
      process.env.SERV_MODEL_LARGE?.trim() ||
      process.env.SERV_MODEL_JUDGE?.trim() ||
      SERV_DEFAULT_MODEL_LARGE,
  };
}

export function modelForStep(step: ServStepId): string {
  return servModels()[tierForStep(step)];
}

/** Steps that may use OpenJEV when OPENJEV_API_KEY is set (typed choice only). */
export const OPENJEV_STEPS: readonly ServStepId[] = ["intent"];

export function hasOpenJevApiKey(): boolean {
  return Boolean(process.env.OPENJEV_API_KEY?.trim());
}

export function openJevPolicy() {
  return {
    configured: hasOpenJevApiKey(),
    model: OPENJEV_MODEL,
    steps: [...OPENJEV_STEPS],
    fallbackModel: servModels().fast,
  };
}

/** Public health payload: models per tier + OpenJEV status (no secrets). */
export function modelPolicyHealth() {
  return {
    models: servModels(),
    tiers: {
      intent: tierForStep("intent"),
      risk: tierForStep("risk"),
      ranking: tierForStep("ranking"),
      verification: tierForStep("verification"),
      agent: tierForStep("agent"),
    },
    openjev: openJevPolicy(),
  };
}

export type ModelPrice = {
  inputPerMTok: number;
  outputPerMTok: number;
};

/**
 * ESTIMATE ONLY: public OpenAI list prices (standard tier, USD per 1M tokens)
 * checked 2026-09-23. SERV Reasoning billing may differ. Override with SERV_PRICES_JSON.
 */
export const SERV_LIST_PRICES: Record<string, ModelPrice> = {
  "gpt-5.4-mini": { inputPerMTok: 0.75, outputPerMTok: 4.5 },
  "gpt-5.4": { inputPerMTok: 2.5, outputPerMTok: 15 },
  openjev: { inputPerMTok: 0.1, outputPerMTok: 0.1 },
};

export const PRICE_SOURCE_LABEL =
  "Estimate at OpenAI list prices (checked 2026-09-23); SERV billing may differ";

function envPrices(): Record<string, ModelPrice> {
  const raw = process.env.SERV_PRICES_JSON?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<ModelPrice>>;
    const out: Record<string, ModelPrice> = {};
    for (const [model, price] of Object.entries(parsed)) {
      if (
        typeof price?.inputPerMTok === "number" &&
        typeof price?.outputPerMTok === "number"
      ) {
        out[model] = {
          inputPerMTok: price.inputPerMTok,
          outputPerMTok: price.outputPerMTok,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function priceForModel(model: string): ModelPrice | null {
  const table = { ...SERV_LIST_PRICES, ...envPrices() };
  if (table[model]) return table[model];
  const base = Object.keys(table)
    .sort((a, b) => b.length - a.length)
    .find((name) => model.startsWith(name));
  return base ? table[base] : null;
}

export function estimateCostUsd(
  model: string,
  promptTokens: number | null,
  completionTokens: number | null,
): number | null {
  if (promptTokens == null && completionTokens == null) return null;
  const price = priceForModel(model);
  if (!price) return null;
  return (
    ((promptTokens ?? 0) * price.inputPerMTok +
      (completionTokens ?? 0) * price.outputPerMTok) /
    1_000_000
  );
}
