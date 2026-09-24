"use client";

import { useEffect, useState } from "react";

const PIPELINE_STEPS = [
  { id: "scan", label: "Scan IXS rails", detail: "REST vaults + MCP deposit build" },
  { id: "rules", label: "Apply hard rules", detail: "Chain, KYC, settlement, capacity (code)" },
  { id: "risk", label: "SERV risk notes", detail: "Fact-grounded risks + rules cross-check" },
  { id: "ranking", label: "SERV ranking", detail: "Best eligible vault, memo, next steps" },
  { id: "verify", label: "Independent verifier", detail: "Pass / warn / fail - may veto a GO" },
  { id: "decide", label: "Final decision", detail: "GO / WAIT / NO-GO + safety override" },
] as const;

/** Approximate dwell per step so judges see motion during a ~15-35 s preflight. */
const STEP_MS = 4500;

type CheckingPanelProps = {
  vaultCount?: number;
  servConfigured?: boolean;
};

export function CheckingPanel({ vaultCount, servConfigured }: CheckingPanelProps) {
  const [startedAt] = useState(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setElapsedSec(Math.floor(elapsed / 1000));
      const index = Math.min(
        PIPELINE_STEPS.length - 1,
        Math.floor(elapsed / STEP_MS),
      );
      setActiveIndex(index);
    }, 400);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="cr-check-spinner" aria-hidden />
        <h2 className="m-0 text-[1.1rem] font-semibold tracking-[-0.02em] text-[#f5fbfd] sm:text-[1.25rem]">
          Analyzing {vaultCount ?? "the"} live IXS vaults...
        </h2>
        <span className="font-mono text-[0.72rem] text-slate-500" aria-hidden>
          Usually 15-35 s · {elapsedSec} s
        </span>
      </div>
      <p className="m-0 text-[0.75rem] text-slate-500">
        Progress (not frozen): scan rails → rules → SERV risk → ranking →
        verification → decision
        {servConfigured ? " (SERV live)." : " (deterministic fallback if no SERV key)."}
      </p>
      <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {PIPELINE_STEPS.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li
              key={step.id}
              className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                active
                  ? "border-cyan-200/35 bg-cyan-200/[0.06]"
                  : done
                    ? "border-emerald-200/20 bg-emerald-200/[0.04]"
                    : "border-emerald-200/10 bg-white/[0.02]"
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[0.62rem] ${
                  active
                    ? "border-cyan-200/60 text-cyan-100"
                    : done
                      ? "border-emerald-300/50 text-emerald-200"
                      : "border-white/15 text-slate-500"
                }`}
                aria-hidden
              >
                {done ? "✓" : index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[0.84rem] ${
                    active || done ? "text-slate-100" : "text-slate-400"
                  }`}
                >
                  {step.label}
                  {active ? (
                    <span className="ml-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-cyan-200/80">
                      now
                    </span>
                  ) : null}
                </span>
                <span className="block text-[0.7rem] text-slate-500">{step.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
