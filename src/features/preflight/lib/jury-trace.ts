import type { PreflightResponse } from "@/features/preflight/lib/types";
import type { ReasoningStepTrace } from "@/shared/serv/trace-types";

export type JuryTraceLine = {
  id: string;
  label: string;
  body: string;
};

function rulesLine(result: PreflightResponse): string {
  const rulesStep = result.trace.steps.find((step) => step.id === "rules");
  const summary = rulesStep?.inputSummary?.trim();
  if (summary) return summary;
  const eligible = result.rails.filter((rail) =>
    result.rejected.every(
      (entry) => entry.vaultId !== rail.vaultId || entry.reasonCode === "OK",
    ),
  ).length;
  return `${result.rails.length} rails scanned → outcome ${result.decision} (${eligible} eligible by code).`;
}

function servRiskLine(result: PreflightResponse): string {
  const notes = result.riskNotes ?? [];
  if (notes.length === 0) {
    return result.intentReading?.trim() || "No SERV risk notes for this run.";
  }
  const top = notes
    .slice(0, 2)
    .map((note) => `${note.category} (${note.severity})`)
    .join("; ");
  return `${notes.length} risk note(s): ${top}. ${result.intentReading?.trim() || ""}`.trim();
}

function verifierLine(result: PreflightResponse): string {
  const v = result.verification;
  if (!v) return "Verifier: n/a";
  if (v.verdict === "pass") return "Verifier: pass - no blocking issues.";
  const first = v.issues[0]?.issue;
  const more = v.issues.length > 1 ? ` (+${v.issues.length - 1} more)` : "";
  return `Verifier: ${v.verdict}${first ? ` - ${first}` : ""}${more}`;
}

function decisionLine(result: PreflightResponse): string {
  const guard = result.trace.guard.applied
    ? ` Safety override: ${result.trace.guard.reason}.`
    : "";
  const veto =
    result.verification?.verdict === "fail" && result.decision === "NO-GO"
      ? " (verifier may have vetoed a GO)."
      : "";
  const txs =
    result.decision === "GO"
      ? result.txPack
        ? " Unsigned approve + deposit prepared."
        : result.preview
          ? " Preview: no tx pack until a real wallet is connected."
          : " No tx pack attached."
      : " No unsigned txs (decision is not GO).";
  return `Final: ${result.decision}.${guard}${veto}${txs}`;
}

/** Compact jury-readable lines from existing preflight traces (no raw 17KB JSON). */
export function buildJuryTraceLines(result: PreflightResponse): JuryTraceLine[] {
  return [
    { id: "rules", label: "Deterministic rules (code)", body: rulesLine(result) },
    { id: "serv", label: "What SERV analyzed", body: servRiskLine(result) },
    { id: "verify", label: "Verifier accepted / rejected", body: verifierLine(result) },
    { id: "final", label: "Final decision", body: decisionLine(result) },
  ];
}

export function stepSourceLabel(step: ReasoningStepTrace): string {
  if (step.source === "serv") return "SERV";
  if (step.source === "openjev") return "OpenJEV";
  if (step.source === "code") return "code";
  return "fallback";
}
