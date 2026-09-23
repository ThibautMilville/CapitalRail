import { runTracedStep } from "@/shared/serv/client";
import {
  AGENT_JSON_SCHEMA,
  AGENT_SYSTEM_PROMPT,
  agentAnswerSchema,
  type AgentAnswerOutput,
  type AgentContext,
  type AgentRequest,
  type AgentResponse,
  type AgentSuggestedAction,
  type MandatePatch,
  PRODUCT_FACTS,
} from "./agent-schema";
import { fallbackAgentAnswer } from "./fallback-answer";

/** Drops null / no-op fields; returns null when nothing would change. */
function normalizeAction(
  action: AgentAnswerOutput["suggestedAction"],
  context: AgentContext | null,
): AgentSuggestedAction | null {
  if (!action || !context) return null;

  const { mandate } = context;
  const raw = action.mandatePatch;
  const patch: MandatePatch = {};

  if (raw.allowKyc !== null && raw.allowKyc !== mandate.allowKyc) {
    patch.allowKyc = raw.allowKyc;
  }
  if (
    raw.requireSyncSettlement !== null &&
    raw.requireSyncSettlement !== mandate.requireSyncSettlement
  ) {
    patch.requireSyncSettlement = raw.requireSyncSettlement;
  }
  if (raw.preferredChainId !== null) {
    const chain = raw.preferredChainId === "any" ? "" : raw.preferredChainId;
    if (chain !== mandate.preferredChainId) patch.preferredChainId = chain;
  }
  if (raw.amount !== null && raw.amount !== mandate.amount) {
    patch.amount = raw.amount;
  }

  return Object.keys(patch).length > 0
    ? { type: "rerun", mandatePatch: patch }
    : null;
}

function summarizeInput(request: AgentRequest): string {
  const question = request.question.slice(0, 80);
  if (!request.context) return `"${question}" (no preflight context)`;
  return `"${question}" on ${request.context.decision.decision}, ${request.context.rails.length} rails, snapshot ${request.context.snapshotHash.slice(0, 10)}`;
}

export async function answerQuestion(
  request: AgentRequest,
): Promise<AgentResponse> {
  const { output, trace } = await runTracedStep<AgentAnswerOutput>({
    step: "agent",
    label: request.context
      ? "Agent - answer follow-up question"
      : "Agent - answer general question",
    inputSummary: summarizeInput(request),
    systemPrompt: AGENT_SYSTEM_PROMPT,
    userPayload: {
      question: request.question,
      context: request.context,
      product: PRODUCT_FACTS,
    },
    schemaName: "capitalrail_agent_answer",
    jsonSchema: AGENT_JSON_SCHEMA as unknown as Record<string, unknown>,
    validator: agentAnswerSchema,
    check: (data) => {
      if (!request.context) return;
      const ids = new Set(request.context.rails.map((rail) => rail.vaultId));
      for (const fact of data.citedFacts) {
        if (fact.vaultId && !ids.has(fact.vaultId)) {
          throw new Error(`cited unknown vault ${fact.vaultId}`);
        }
      }
    },
    fallback: () => fallbackAgentAnswer(request.question, request.context),
  });

  return {
    answer: output.answer,
    citedFacts: output.citedFacts.map((fact) =>
      fact.vaultId ? { vaultId: fact.vaultId, fact: fact.fact } : { fact: fact.fact },
    ),
    suggestedAction: normalizeAction(output.suggestedAction, request.context),
    reasoning: trace.source === "serv" ? "serv" : "fallback",
    trace,
  };
}
