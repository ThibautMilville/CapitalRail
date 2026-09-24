/**
 * Soften flaky model JSON before zod: extract fenced JSON and truncate
 * known bounded string fields so validation does not trip on length alone.
 */

const FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/i;

export function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* try fence / slice */
  }
  const fenced = trimmed.match(FENCE_RE);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("not valid JSON");
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  if (max <= 3) return value.slice(0, max);
  return `${value.slice(0, max - 3).trimEnd()}...`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Clamp ranking / risk / verification / intent string fields to schema maxima. */
export function sanitizeServPayload(
  schemaName: string,
  raw: unknown,
): unknown {
  const root = asRecord(raw);
  if (!root) return raw;

  if (schemaName === "capitalrail_ranking") {
    if (typeof root.rationale === "string") {
      root.rationale = truncate(root.rationale, 800);
    }
    if (typeof root.memoMarkdown === "string") {
      root.memoMarkdown = truncate(root.memoMarkdown, 4000);
    }
    if (Array.isArray(root.ranking)) {
      root.ranking = root.ranking.map((entry) => {
        const row = asRecord(entry);
        if (!row) return entry;
        if (typeof row.why === "string") row.why = truncate(row.why, 300);
        return row;
      });
    }
    if (Array.isArray(root.userNextSteps)) {
      root.userNextSteps = root.userNextSteps.map((step) =>
        typeof step === "string" ? truncate(step, 300) : step,
      );
    }
    return root;
  }

  if (schemaName === "capitalrail_risk") {
    if (typeof root.intentReading === "string") {
      root.intentReading = truncate(root.intentReading, 500);
    }
    if (Array.isArray(root.crossCheck)) {
      root.crossCheck = root.crossCheck.map((entry) => {
        const row = asRecord(entry);
        if (!row) return entry;
        if (typeof row.comment === "string") {
          row.comment = truncate(row.comment, 400);
        }
        return row;
      });
    }
    if (Array.isArray(root.riskNotes)) {
      root.riskNotes = root.riskNotes.map((entry) => {
        const row = asRecord(entry);
        if (!row) return entry;
        if (typeof row.note === "string") row.note = truncate(row.note, 300);
        if (Array.isArray(row.facts)) {
          row.facts = row.facts.map((fact) =>
            typeof fact === "string" ? truncate(fact, 60) : fact,
          );
        }
        return row;
      });
    }
    return root;
  }

  if (schemaName === "capitalrail_verification") {
    if (Array.isArray(root.issues)) {
      root.issues = root.issues.map((entry) => {
        const row = asRecord(entry);
        if (!row) return entry;
        if (typeof row.issue === "string") row.issue = truncate(row.issue, 400);
        return row;
      });
    }
    return root;
  }

  if (schemaName === "capitalrail_intent") {
    if (typeof root.summary === "string") {
      root.summary = truncate(root.summary, 600);
    }
    return root;
  }

  if (schemaName === "capitalrail_agent_answer") {
    if (typeof root.answer === "string") {
      root.answer = truncate(root.answer, 1200);
    }
    return root;
  }

  return root;
}
