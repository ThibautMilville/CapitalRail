"use client";

import type { RailSnapshot } from "@/shared/ixs/types";
import { chainLabel } from "@/shared/wallet/chains";

type ContrastPanelProps = {
  rails: RailSnapshot[];
  decision: "GO" | "NO-GO" | "WAIT" | null;
  selectedVaultId: string | null;
  emphasize?: boolean;
};

export function ContrastPanel({
  rails,
  decision,
  selectedVaultId,
  emphasize,
}: ContrastPanelProps) {
  if (!rails.length) return null;

  const avalancheOpen = rails.find(
    (rail) => rail.chainId === 43114 && !rail.requiresWhitelist,
  );
  const selected = rails.find((rail) => rail.vaultId === selectedVaultId);

  return (
    <section
      id="shadow-contrast"
      className={`rounded-2xl border bg-[#06171e]/85 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5 ${
        emphasize
          ? "border-cyan-300/40 shadow-[0_0_0_1px_rgba(117,217,231,0.2)]"
          : "border-emerald-200/20"
      }`}
    >
      <p className="m-0 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-cyan-200/70">
        Why it matters
      </p>
      <h2 className="m-0 mt-1 mb-4 text-lg font-semibold tracking-[-0.02em] text-[#f5fbfd] sm:text-xl">
        Naive agent vs CapitalRail
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-rose-300/20 bg-rose-300/[0.04] p-3 sm:p-4">
          <h3 className="m-0 mb-2 text-[0.95rem] font-semibold text-rose-100">
            Naive Avalanche path
          </h3>
          <p className="m-0 text-sm text-slate-300">
            Sees &quot;open&quot; + MCP limit 0 and still calls deposit (or treats
            limit 0 as permanently closed).
          </p>
          <p className="mt-3 break-words font-mono text-[0.78rem] leading-snug text-rose-300/90">
            FAIL -{" "}
            {avalancheOpen?.depositBuildError ??
              "Would fail if MCP limit is 0 (NAV stale) or settlement cutoff is ignored."}
          </p>
          {avalancheOpen?.reasonCodes.includes("DEPOSIT_LIMIT_ZERO") ? (
            <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-rose-200/70">
              DEPOSIT_LIMIT_ZERO
            </p>
          ) : null}
        </div>
        <div className="min-w-0 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.05] p-3 sm:p-4">
          <h3 className="m-0 mb-2 text-[0.95rem] font-semibold text-emerald-100">
            CapitalRail path
          </h3>
          <p className="m-0 text-sm text-slate-300">
            Treats MCP limit 0 as WAIT (NAV may be stale - do not force deposit),
            and only prepares deposit steps when a path is really open.
          </p>
          <p className="mt-3 break-words font-mono text-[0.78rem] leading-snug text-emerald-300/90">
            {decision === "GO" && selectedVaultId
              ? `GO - ${selected ? `${chainLabel(selected.chainId)} ${selected.requiresWhitelist ? "KYC" : "open"} vault` : "selected vault"}`
              : decision
                ? `${decision} - no unsafe deposit packed`
                : "Run a check to compare"}
          </p>
        </div>
      </div>
    </section>
  );
}
