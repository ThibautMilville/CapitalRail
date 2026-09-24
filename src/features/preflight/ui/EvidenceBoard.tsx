"use client";

import type { PreflightResponse } from "@/features/preflight/lib/types";
import type { RailSnapshot } from "@/shared/ixs/types";
import { chainLabel } from "@/shared/wallet/chains";

type EvidenceBoardProps = {
  result: PreflightResponse;
  highlightVaultId?: string | null;
  highlightReason?: string | null;
};

function factForReason(
  rail: RailSnapshot | undefined,
  reasonCode: string,
): string {
  if (!rail) return "No matching rail in snapshot";

  switch (reasonCode) {
    case "DEPOSIT_LIMIT_ZERO":
      return `${chainLabel(rail.chainId)} ${rail.symbol}: MCP limit 0 (often NAV stale/drift - do not force deposit) - ${rail.depositBuildError?.slice(0, 72) ?? "limit 0"}`;
    case "WHITELIST_REQUIRED":
      return `${chainLabel(rail.chainId)} ${rail.symbol}: whitelist=${String(rail.whitelistOk)} (requiresWhitelist=${rail.requiresWhitelist})`;
    case "SETTLEMENT_ASYNC_UNSUPPORTED_BY_MANDATE":
      return `${chainLabel(rail.chainId)} ${rail.symbol}: settlement=${rail.settlement}`;
    case "CHAIN_MISMATCH":
      return `${chainLabel(rail.chainId)} ${rail.symbol}: chainId=${rail.chainId}`;
    case "BUILD_FAILED":
      return `${chainLabel(rail.chainId)} ${rail.symbol}: ${rail.depositBuildError?.slice(0, 96) ?? "build failed"}`;
    case "OK":
      return `${chainLabel(rail.chainId)} ${rail.symbol}: status=${rail.status}, depositBuildOk=${rail.depositBuildOk}`;
    default:
      return `${chainLabel(rail.chainId)} ${rail.symbol}: reasons=${rail.reasonCodes.join(", ")}`;
  }
}

function statusTone(status: RailSnapshot["status"]) {
  if (status === "open") return "text-emerald-300 border-emerald-300/40";
  if (status === "blocked") return "text-rose-300 border-rose-300/40";
  return "text-amber-200 border-amber-200/40";
}

export function EvidenceBoard({
  result,
  highlightVaultId,
  highlightReason,
}: EvidenceBoardProps) {
  const railById = new Map(result.rails.map((rail) => [rail.vaultId, rail]));

  return (
    <section
      id="evidence-board"
      className="rounded-2xl border border-emerald-200/20 bg-[#06171e]/85 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-cyan-200/70">
            Evidence
          </p>
          <h2 className="m-0 mt-1 text-lg font-semibold tracking-[-0.02em] text-[#f5fbfd] sm:text-xl">
            Facts behind the decision
          </h2>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] ${
            result.reasoning === "serv"
              ? "border-emerald-200/35 bg-emerald-200/[0.08] text-emerald-200"
              : "border-amber-200/35 bg-amber-200/[0.08] text-amber-100"
          }`}
        >
          {result.reasoning === "serv" ? "SERV reasoning" : "Fallback reasoning"}
        </span>
      </div>

      <div className="mb-5">
        <h3 className="m-0 mb-2 text-sm font-medium text-slate-300">
          Raw IXS facts per vault
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {result.rails.map((rail) => {
            const lit =
              highlightVaultId === rail.vaultId ||
              (highlightReason &&
                rail.reasonCodes.includes(highlightReason));
            return (
              <div
                key={rail.vaultId}
                id={`rail-fact-${rail.vaultId}`}
                className={`rounded-xl border bg-white/[0.035] p-3 transition-[border-color,box-shadow] ${
                  lit
                    ? "border-cyan-300/50 shadow-[0_0_0_1px_rgba(117,217,231,0.25)]"
                    : "border-emerald-200/10"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 font-mono text-[0.68rem] uppercase ${statusTone(rail.status)}`}
                  >
                    {rail.status}
                  </span>
                  <span className="font-mono text-[0.78rem] text-slate-200">
                    {chainLabel(rail.chainId)} · {rail.symbol}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-[0.7rem] text-slate-400">
                  <dt>settlement</dt>
                  <dd className="m-0 break-words text-right text-slate-300">
                    {rail.settlement}
                  </dd>
                  <dt>whitelist</dt>
                  <dd className="m-0 break-words text-right text-slate-300">
                    {rail.requiresWhitelist
                      ? `req / ${String(rail.whitelistOk)}`
                      : "open"}
                  </dd>
                  <dt>build</dt>
                  <dd className="m-0 text-right text-slate-300">
                    {rail.depositBuildOk ? "ok" : "fail"}
                  </dd>
                  <dt>codes</dt>
                  <dd className="m-0 break-words text-right text-slate-300">
                    {rail.reasonCodes.join(", ") || "-"}
                  </dd>
                </dl>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="m-0 mb-2 text-sm font-medium text-slate-300">
          Decision cites onchain facts
        </h3>
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/12 bg-black/20 px-3 py-2.5">
          <span
            className={`rounded border px-2 py-0.5 font-mono text-[0.72rem] uppercase tracking-wide ${
              result.decision === "GO"
                ? "border-emerald-300/50 text-emerald-300"
                : result.decision === "NO-GO"
                  ? "border-rose-300/50 text-rose-300"
                  : "border-amber-200/50 text-amber-200"
            }`}
          >
            {result.decision}
          </span>
          {result.selectedVaultId ? (
            <span className="min-w-0 break-all font-mono text-[0.72rem] text-slate-400">
              selected -{" "}
              <a
                href={`#rail-fact-${result.selectedVaultId}`}
                className="text-cyan-300 underline-offset-2 hover:underline"
              >
                {result.selectedVaultId.slice(0, 12)}...
              </a>
            </span>
          ) : (
            <span className="font-mono text-[0.72rem] text-slate-500">
              no vault selected
            </span>
          )}
        </div>

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {result.rejected.map((item) => {
            const rail = railById.get(item.vaultId);
            const lit =
              highlightVaultId === item.vaultId ||
              highlightReason === item.reasonCode;
            return (
              <li
                key={`${item.vaultId}-${item.reasonCode}`}
                className={`rounded-xl border px-3 py-2.5 transition-[border-color] ${
                  lit
                    ? "border-cyan-300/45 bg-cyan-300/[0.06]"
                    : "border-emerald-200/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                  <code className="break-all font-mono text-[0.72rem] text-rose-200/90">
                    {item.reasonCode}
                  </code>
                  <span className="text-slate-500">-</span>
                  <a
                    href={`#rail-fact-${item.vaultId}`}
                    className="font-mono text-[0.72rem] text-cyan-300 underline-offset-2 hover:underline"
                  >
                    {rail
                      ? `${chainLabel(rail.chainId)} ${rail.symbol}`
                      : item.vaultId.slice(0, 10)}
                  </a>
                </div>
                <p className="m-0 mt-1 break-words text-[0.78rem] leading-snug text-slate-400">
                  {factForReason(rail, item.reasonCode)}
                </p>
                <p className="m-0 mt-1 break-words font-mono text-[0.68rem] text-slate-500">
                  {item.explanation.slice(0, 140)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
