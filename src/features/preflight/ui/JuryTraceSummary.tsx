"use client";

import {
  buildJuryTraceLines,
  stepSourceLabel,
} from "@/features/preflight/lib/jury-trace";
import type { PreflightResponse } from "@/features/preflight/lib/types";

type JuryTraceSummaryProps = {
  result: PreflightResponse;
};

const TONE = {
  GO: "border-emerald-300/40 text-emerald-200",
  WAIT: "border-amber-200/40 text-amber-100",
  "NO-GO": "border-rose-300/40 text-rose-200",
} as const;

export function JuryTraceSummary({ result }: JuryTraceSummaryProps) {
  const lines = buildJuryTraceLines(result);
  const sources = result.trace.steps
    .map((step) => `${step.id}:${stepSourceLabel(step)}`)
    .join(" · ");

  return (
    <section
      id="jury-trace"
      aria-label="SERV decision summary"
      className="scroll-mt-28 rounded-2xl border border-emerald-200/18 bg-[#06171e]/90 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-cyan-200/70">
          For the jury
        </p>
        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold ${TONE[result.decision]}`}
        >
          {result.decision}
        </span>
      </div>
      <h2 className="m-0 mt-1.5 text-[1.05rem] font-semibold tracking-[-0.02em] text-[#f5fbfd] sm:text-[1.15rem]">
        How this decision was made
      </h2>
      <p className="m-0 mt-1 text-[0.74rem] text-slate-500">
        Compact view of the API traces - not the full JSON. Steps: {sources}
      </p>
      <ol className="m-0 mt-3 list-none space-y-2.5 p-0">
        {lines.map((line, index) => (
          <li
            key={line.id}
            className="flex gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5"
          >
            <span
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-cyan-200/25 font-mono text-[0.62rem] text-cyan-100/90"
              aria-hidden
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[0.64rem] uppercase tracking-[0.1em] text-slate-500">
                {line.label}
              </span>
              <span className="mt-0.5 block text-[0.84rem] leading-snug text-slate-200">
                {line.body}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
