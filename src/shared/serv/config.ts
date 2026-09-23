export const SERV_BASE_URL = "https://inference-api.openserv.ai/v1";

export const SERV_DEFAULT_MODEL_SMALL = "gpt-5.4-mini";
export const SERV_DEFAULT_MODEL_LARGE = "gpt-5.4";

export type ServModelTier = "small" | "large";

export type ServStepId = "intent" | "risk" | "ranking" | "verification" | "agent";

/**
 * Cost-aware routing: the small model handles bounded extraction and checking,
 * the large model handles the judgment-heavy ranking + memo.
 */
export const SERV_STEP_TIERS: Record<ServStepId, ServModelTier> = {
  intent: "small",
  risk: "small",
  ranking: "large",
  verification: "small",
  agent: "small",
};

export function servModels(): Record<ServModelTier, string> {
  return {
    small: process.env.SERV_MODEL_SMALL?.trim() || SERV_DEFAULT_MODEL_SMALL,
    large: process.env.SERV_MODEL_LARGE?.trim() || SERV_DEFAULT_MODEL_LARGE,
  };
}

export function tierForStep(step: ServStepId): ServModelTier {
  return SERV_STEP_TIERS[step];
}

export function modelForStep(step: ServStepId): string {
  return servModels()[tierForStep(step)];
}

export type ModelPrice = {
  /** USD per 1M input tokens. */
  inputPerMTok: number;
  /** USD per 1M output tokens. */
  outputPerMTok: number;
};

/**
 * ESTIMATE ONLY: public OpenAI list prices (standard tier, USD per 1M tokens)
 * checked 2026-09-23. SERV Reasoning billing may differ. Override or extend
 * with SERV_PRICES_JSON, e.g. {"my-model":{"inputPerMTok":1,"outputPerMTok":4}}.
 */
export const SERV_LIST_PRICES: Record<string, ModelPrice> = {
  "gpt-5.4-mini": { inputPerMTok: 0.75, outputPerMTok: 4.5 },
  "gpt-5.4": { inputPerMTok: 2.5, outputPerMTok: 15 },
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

/** Returns null when the model has no known price (cost then shows as unknown). */
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
