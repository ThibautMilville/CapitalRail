"use client";

import { useEffect, useState } from "react";

const CHECKS = [
  { q: "Is the vault open?", a: "IXS vault status and access mode" },
  { q: "Is there room for your amount?", a: "Live MCP deposit build (limit 0 may be NAV stale)" },
  { q: "Are you allowed in?", a: "Whitelist / KYC check for your wallet" },
  { q: "Can you withdraw the way you want?", a: "Instant or delayed (daily SGT cutoff)" },
];

type CheckingPanelProps = {
  vaultCount?: number;
  servConfigured?: boolean;
};

export function CheckingPanel({ vaultCount, servConfigured }: CheckingPanelProps) {
  const [startedAt] = useState(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="cr-check-spinner" aria-hidden />
        <h2 className="m-0 text-[1.1rem] font-semibold tracking-[-0.02em] text-[#f5fbfd] sm:text-[1.25rem]">
          Checking {vaultCount ?? "the"} live IXS vaults...
        </h2>
        <span className="font-mono text-[0.72rem] text-slate-500" aria-hidden>
          Live IXS check, usually 3-15 s · {elapsedSec} s
        </span>
      </div>
      <p className="m-0 text-[0.75rem] text-slate-500">
        Every vault is checked in parallel on the same four questions:
      </p>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {CHECKS.map((check, index) => (
          <li
            key={check.q}
            className="cr-check-item flex items-start gap-2.5 rounded-xl border border-emerald-200/10 bg-white/[0.02] px-3 py-2.5"
            style={{ animationDelay: `${index * 320}ms` }}
          >
            <span className="cr-check-dot mt-1.5" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[0.86rem] text-slate-200">{check.q}</span>
              <span className="block text-[0.72rem] text-slate-500">{check.a}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="m-0 text-[0.75rem] text-slate-500">
        Then code applies the hard rules, and{" "}
        {servConfigured ? "SERV Reasoning" : "the decision engine"} adds risk
        notes, ranks the vaults that pass and runs an independent check.
      </p>
    </div>
  );
}
