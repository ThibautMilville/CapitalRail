import OpenAI from "openai";
import type { z } from "zod";
import {
  SERV_BASE_URL,
  estimateCostUsd,
  modelForStep,
  tierForStep,
  type ServStepId,
} from "./config";
import { NO_KEY_REASON, type ReasoningStepTrace } from "./trace-types";

export function hasServApiKey(): boolean {
  return Boolean(process.env.SERV_API_KEY?.trim());
}

function createServClient() {
  const apiKey = process.env.SERV_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("SERV_API_KEY is missing");
  }

  return new OpenAI({
    baseURL: SERV_BASE_URL,
    apiKey,
    timeout: 25_000,
    maxRetries: 1,
  });
}

export type ServJsonRequest<T> = {
  model: string;
  systemPrompt: string;
  userPayload: unknown;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  validator: z.ZodType<T>;
};

export type ServJsonResult<T> = {
  data: T;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
};

export class ServValidationError extends Error {}

/** One bounded SERV call: strict JSON schema on the wire, zod validation on the way back. */
export async function runServJson<T>(
  request: ServJsonRequest<T>,
): Promise<ServJsonResult<T>> {
  const client = createServClient();
  const response = await client.chat.completions.create({
    model: request.model,
    messages: [
      { role: "system", content: request.systemPrompt },
      {
        role: "user",
        content:
          typeof request.userPayload === "string"
            ? request.userPayload
            : JSON.stringify(request.userPayload, null, 2),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: request.schemaName,
        strict: true,
        schema: request.jsonSchema,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("SERV returned empty content");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new ServValidationError("SERV output is not valid JSON");
  }

  const parsed = request.validator.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ServValidationError(
      `schema validation failed at ${first?.path.join(".") || "root"}: ${first?.message ?? "invalid"}`,
    );
  }

  return {
    data: parsed.data,
    model: response.model || request.model,
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
  };
}

export type TracedStepRequest<T> = {
  step: ServStepId;
  id?: string;
  label: string;
  inputSummary: string;
  systemPrompt: string;
  userPayload: unknown;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  validator: z.ZodType<T>;
  /** Semantic checks beyond the schema (e.g. vault ids must exist). Throw to reject. */
  check?: (data: T) => void;
  /** When set, SERV is not called and the fallback runs with this reason. */
  skipServReason?: string;
  fallback: () => T;
};

export type TracedStepResult<T> = {
  output: T;
  trace: ReasoningStepTrace;
};

function errorMessage(error: unknown): string {
  if (error instanceof ServValidationError) return error.message;
  if (error instanceof Error) return `SERV error: ${error.message}`;
  return "SERV error";
}

const CHARS_PER_TOKEN = 4;

/** Rough what-if cost of this step on SERV, from prompt + payload + output size. */
function projectCostUsd<T>(
  model: string,
  request: TracedStepRequest<T>,
  output: T,
): number | null {
  const payload =
    typeof request.userPayload === "string"
      ? request.userPayload
      : JSON.stringify(request.userPayload);
  const inTokens = Math.ceil(
    (request.systemPrompt.length + payload.length) / CHARS_PER_TOKEN,
  );
  const outTokens = Math.ceil(JSON.stringify(output).length / CHARS_PER_TOKEN);
  return estimateCostUsd(model, inTokens, outTokens);
}

/**
 * Runs a step on SERV when a key is set, otherwise (or on any failure) runs the
 * deterministic fallback. Both paths return the same trace shape.
 */
export async function runTracedStep<T>(
  request: TracedStepRequest<T>,
): Promise<TracedStepResult<T>> {
  const routedModel = modelForStep(request.step);
  const tier = tierForStep(request.step);
  const startedAt = new Date();
  const started = performance.now();

  const base = {
    id: request.id ?? request.step,
    label: request.label,
    routedModel,
    tier,
    startedAt: startedAt.toISOString(),
    inputSummary: request.inputSummary,
  };

  let fallbackReason = request.skipServReason ?? NO_KEY_REASON;
  if (!request.skipServReason && hasServApiKey()) {
    try {
      const result = await runServJson({
        model: routedModel,
        systemPrompt: request.systemPrompt,
        userPayload: request.userPayload,
        schemaName: request.schemaName,
        jsonSchema: request.jsonSchema,
        validator: request.validator,
      });
      if (request.check) {
        try {
          request.check(result.data);
        } catch (error) {
          throw new ServValidationError(
            `semantic check failed: ${error instanceof Error ? error.message : "invalid"}`,
          );
        }
      }

      return {
        output: result.data,
        trace: {
          ...base,
          model: result.model,
          source: "serv",
          durationMs: Math.round(performance.now() - started),
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          costUsd: estimateCostUsd(
            result.model,
            result.promptTokens,
            result.completionTokens,
          ),
          projectedCostUsd: null,
          output: result.data,
          ok: true,
          fallbackReason: null,
        },
      };
    } catch (error) {
      fallbackReason = errorMessage(error);
    }
  }

  const output = request.fallback();
  return {
    output,
    trace: {
      ...base,
      model: "deterministic",
      source: "fallback",
      durationMs: Math.round(performance.now() - started),
      promptTokens: null,
      completionTokens: null,
      costUsd: null,
      projectedCostUsd: projectCostUsd(routedModel, request, output),
      output,
      ok: fallbackReason === NO_KEY_REASON || Boolean(request.skipServReason),
      fallbackReason,
    },
  };
}
