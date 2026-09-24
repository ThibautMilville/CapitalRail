import {
  OPENJEV_BASE_URL,
  OPENJEV_MODEL,
  hasOpenJevApiKey,
} from "@/shared/serv/model-policy";

export type OpenJevChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type OpenJevNoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true?: string; false?: string };
};

export type OpenJevQuestion = OpenJevChoiceQuestion | OpenJevNoulQuestion;

export type OpenJevChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities?: Record<string, number>;
  confidence?: number;
};

export type OpenJevNoulAnswer = {
  type: "noul";
  noul: number;
};

export type OpenJevAnswer = OpenJevChoiceAnswer | OpenJevNoulAnswer;

export type OpenJevResult = {
  model: string;
  answers: Record<string, OpenJevAnswer>;
  latencyMs: number;
};

export class OpenJevError extends Error {}

export async function runOpenJev(request: {
  state: string | Record<string, unknown>;
  questions: Record<string, OpenJevQuestion>;
}): Promise<OpenJevResult> {
  const apiKey = process.env.OPENJEV_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenJevError("OPENJEV_API_KEY is missing");
  }

  const started = performance.now();
  const response = await fetch(OPENJEV_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENJEV_MODEL,
      state: request.state,
      questions: request.questions,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new OpenJevError(
      `OpenJEV HTTP ${response.status}${body ? `: ${body.slice(0, 120)}` : ""}`,
    );
  }

  const data = (await response.json()) as {
    model?: string;
    answers?: Record<string, OpenJevAnswer>;
  };

  if (!data.answers || typeof data.answers !== "object") {
    throw new OpenJevError("OpenJEV returned no answers");
  }

  return {
    model: data.model || OPENJEV_MODEL,
    answers: data.answers,
    latencyMs: Math.round(performance.now() - started),
  };
}

export { hasOpenJevApiKey };
