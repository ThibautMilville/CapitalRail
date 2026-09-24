"use client";

import type { Disagreement, SafetyGuard } from "@/features/preflight/lib/types";
import { PRICE_SOURCE_LABEL } from "@/shared/serv/config";
import {
  NO_KEY_REASON,
  computeTraceTotals,
  type ReasoningStepTrace,
} from "@/shared/serv/trace-types";

type ReasoningTraceProps = {
  steps: ReasoningStepTrace[];
  guard: SafetyGuard;
  disagreements: Disagreement[];
};

function formatUsd(value: number | null) {
  if (value == null) return null;
  if (value === 0) return "$0";
  return value < 0.01 ? `$${value.toFixed(5)}` : `$${value.toFixed(4)}`;
}

function costLabel(totals: ReturnType<typeof computeTraceTotals>) {
  const real = formatUsd(totals.costUsd);
  if (real) return { text: `${real} est.`, title: PRICE_SOURCE_LABEL };
  const projected = formatUsd(totals.projectedCostUsd);
  if (projected) {
    return {
      text: `~${projected} if live`,
      title: `No SERV call ran. Projected from payload size (about 4 chars per token) at the routed models. ${PRICE_SOURCE_LABEL}`,
    };
  }
  return { text: "cost unknown", title: "No price configured for the routed model (see SERV_PRICES_JSON)" };
}

function formatMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`;
}

function formatTokens(value: number | null) {
  return value == null ? "n/a" : value.toLocaleString("en-US");
}

function modeBadge(steps: ReasoningStepTrace[]) {
  const modelSteps = steps.filter((step) => step.source !== "code");
  const live = modelSteps.filter(
    (step) => step.source === "serv" || step.source === "openjev",
  ).length;
  if (modelSteps.length > 0 && live === modelSteps.length) {
    return {
      label: live && modelSteps.some((s) => s.source === "openjev")
        ? "Live (SERV + OpenJEV)"
        : "SERV live",
      tone: "border-emerald-200/35 bg-emerald-200/[0.08] text-emerald-200",
    };
  }
  if (live === 0) {
    const noKey = modelSteps.every((step) => step.fallbackReason === NO_KEY_REASON);
    return {
      label: noKey ? "Fallback (no SERV_API_KEY)" : "Fallback",
      tone: "border-amber-200/35 bg-amber-200/[0.06] text-amber-100",
    };
  }
  return {
    label: `Live + fallback (${live}/${modelSteps.length})`,
    tone: "border-cyan-200/35 bg-cyan-200/[0.06] text-cyan-100",
  };
}

function sourceChip(step: ReasoningStepTrace) {
  if (step.source === "serv") {
    return { label: "SERV", tone: "border-emerald-200/30 text-emerald-200/90" };
  }
  if (step.source === "openjev") {
    return { label: "OpenJEV", tone: "border-cyan-200/30 text-cyan-100/90" };
  }
  if (step.source === "code") {
    return { label: "Code", tone: "border-cyan-200/30 text-cyan-100/90" };
  }
  return { label: "Fallback", tone: "border-amber-200/30 text-amber-100/90" };
}

function tierLabel(step: ReasoningStepTrace) {
  if (!step.tier) return "rules engine";
  const model =
    step.source === "serv" || step.source === "openjev"
      ? step.model
      : step.routedModel;
  return `${step.tier} · ${step.source === "serv" || step.source === "openjev" ? model : `routed ${model}`}`;
}

function stepCost(step: ReasoningStepTrace) {
  const real = formatUsd(step.costUsd);
  if (real) return `${real} est.`;
  const projected = formatUsd(step.projectedCostUsd);
  return projected ? `~${projected} if live` : null;
}

function stepTone(step: ReasoningStepTrace) {
  // Opaque --bg-2 so the timeline line never shows through the badge.
  if (!step.ok) {
    return {
      dot: "z-10 border-rose-300/70 bg-[var(--bg-2)] text-rose-200",
      status: "text-rose-300",
      label: step.fallbackReason && step.source === "fallback" ? "degraded" : "fail",
    };
  }
  if (step.source === "fallback") {
    return {
      dot: "z-10 border-amber-200/60 bg-[var(--bg-2)] text-amber-100",
      status: "text-amber-100/90",
      label: "ok",
    };
  }
  return {
    dot: "z-10 border-emerald-300/70 bg-[var(--bg-2)] text-emerald-200",
    status: "text-emerald-300",
    label: "ok",
  };
}

const metaChip =
  "rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[0.62rem] text-slate-400";

export function ReasoningTrace({ steps, guard, disagreements }: ReasoningTraceProps) {
  if (steps.length === 0) return null;

  const totals = computeTraceTotals(steps);
  const mode = modeBadge(steps);
  const cost = costLabel(totals);

  return (
    <section
      id="trace"
      className="scroll-mt-24 rounded-2xl border border-emerald-200/20 bg-[#06171e]/85 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="m-0 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-cyan-200/70">
            SERV Reasoning
          </p>
          <h2 className="m-0 mt-1 text-lg font-semibold tracking-[-0.02em] text-[#f5fbfd] sm:text-xl">
            Reasoning trace
          </h2>
          <p className="m-0 mt-1 max-w-xl text-[0.76rem] leading-snug text-slate-500">
            Rules are code, judgment is SERV. Code applies the hard rules and
            has the last word; SERV writes risk notes, cross-checks the rules,
            ranks and verifies. SERV can veto an entry, never unlock one.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.08em] ${mode.tone}`}
          >
            {mode.label}
          </span>
          <span className={metaChip}>{steps.length} steps</span>
          <span className={metaChip}>{formatMs(totals.durationMs)} total</span>
          <span
            className={metaChip}
            title={
              totals.totalTokens == null
                ? "No SERV call ran, so no tokens were billed"
                : `prompt ${formatTokens(totals.promptTokens)} / completion ${formatTokens(totals.completionTokens)}`
            }
          >
            {formatTokens(totals.totalTokens)} tokens
          </span>
          <span className={metaChip} title={cost.title}>
            {cost.text}
          </span>
        </div>
      </div>

      <ol className="relative m-0 list-none space-y-3 p-0 before:absolute before:bottom-3 before:left-[0.95rem] before:top-3 before:z-0 before:w-px before:bg-gradient-to-b before:from-cyan-200/35 before:to-emerald-200/10">
        {steps.map((step, index) => {
          const tone = stepTone(step);
          return (
            <li key={`${step.id}-${step.startedAt}`} className="relative pl-10">
              <span
                className={`absolute left-0 top-2.5 grid h-[1.9rem] w-[1.9rem] place-items-center rounded-full border font-mono text-[0.68rem] font-semibold ${tone.dot}`}
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="rounded-xl border border-emerald-200/12 bg-black/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="m-0 min-w-0 text-[0.9rem] font-semibold text-slate-100">
                    {step.label}
                  </p>
                  <span
                    className={`font-mono text-[0.62rem] uppercase tracking-[0.1em] ${tone.status}`}
                  >
                    {tone.label}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] ${sourceChip(step).tone}`}
                  >
                    {sourceChip(step).label}
                  </span>
                  <span className={metaChip} title="Router tier and model">
                    {tierLabel(step)}
                  </span>
                  <span className={metaChip}>{formatMs(step.durationMs)}</span>
                  {step.source !== "code" ? (
                    <span className={metaChip}>
                      {step.promptTokens == null && step.completionTokens == null
                        ? "tokens n/a"
                        : `${formatTokens(step.promptTokens)} in / ${formatTokens(step.completionTokens)} out`}
                    </span>
                  ) : null}
                  {stepCost(step) ? (
                    <span className={metaChip} title={PRICE_SOURCE_LABEL}>
                      {stepCost(step)}
                    </span>
                  ) : null}
                </div>
                <p className="m-0 mt-2 break-words font-mono text-[0.68rem] leading-relaxed text-slate-500">
                  in: {step.inputSummary}
                  {step.fallbackReason ? ` · fallback: ${step.fallbackReason}` : ""}
                </p>
                <details className="group mt-2">
                  <summary className="cursor-pointer select-none font-mono text-[0.66rem] uppercase tracking-[0.1em] text-cyan-200/70 transition-colors hover:text-cyan-100">
                    Validated output
                  </summary>
                  <pre className="scrollbar-thin m-0 mt-2 max-h-72 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg border border-emerald-200/10 bg-black/30 p-3 font-mono text-[0.7rem] leading-relaxed text-slate-300">
                    {JSON.stringify(step.output, null, 2)}
                  </pre>
                </details>
              </div>
            </li>
          );
        })}
        <li className="relative pl-10">
          <span
            className={`absolute left-0 top-2.5 z-10 grid h-[1.9rem] w-[1.9rem] place-items-center rounded-full border bg-[var(--bg-2)] font-mono text-[0.6rem] font-semibold ${
              guard.applied
                ? "border-rose-300/70 text-rose-200"
                : "border-cyan-200/50 text-cyan-100"
            }`}
            aria-hidden
          >
            fx
          </span>
          <div className="rounded-xl border border-cyan-200/12 bg-black/20 p-3">
            <p className="m-0 text-[0.9rem] font-semibold text-slate-100">
              Code safety override
            </p>
            <p className="m-0 mt-1 font-mono text-[0.68rem] leading-relaxed text-slate-500">
              {guard.applied
                ? `applied - ${guard.reason}`
                : "not triggered - final decision passed the open / buildable / rules checks"}
            </p>
          </div>
        </li>
      </ol>

      <div className="mt-4 rounded-xl border border-white/8 bg-black/20 p-3">
        <p className="m-0 text-[0.9rem] font-semibold text-slate-100">
          Disagreements ({disagreements.length})
        </p>
        {disagreements.length === 0 ? (
          <p className="m-0 mt-1 font-mono text-[0.68rem] leading-relaxed text-slate-500">
            {totals.servSteps > 0
              ? "SERV and the code rules agree on every vault; the verifier raised nothing."
              : "None. In fallback the cross-check mirrors the code rules, so no independent view exists yet."}
          </p>
        ) : (
          <ul className="m-0 mt-2 list-none space-y-2 p-0">
            {disagreements.map((item, index) => (
              <li
                key={`${item.step}-${item.vaultId ?? "all"}-${index}`}
                className="rounded-lg border border-amber-200/15 bg-amber-200/[0.03] px-2.5 py-2"
              >
                <p className="m-0 font-mono text-[0.66rem] text-amber-100/90">
                  {item.step} · {item.vaultId ?? "whole proposal"} · code: {item.rules} · SERV: {item.serv}
                </p>
                <p className="m-0 mt-1 text-[0.78rem] leading-snug text-slate-300">{item.note}</p>
                <p className="m-0 mt-0.5 font-mono text-[0.64rem] text-slate-500">{item.resolution}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
