"use client";

import type { RailSnapshot } from "@/shared/ixs/types";
import { humanReason, withdrawalLabel } from "@/features/preflight/lib/verdict";
import { chainLabel } from "@/shared/wallet/chains";

type RailBoardProps = {
  rails: RailSnapshot[];
  selectedVaultId: string | null;
  highlightReason?: string | null;
  highlightVaultId?: string | null;
};

function statusPill(status: RailSnapshot["status"]) {
  const tone =
    status === "open"
      ? "border-emerald-300/45 text-emerald-300"
      : status === "blocked"
        ? "border-rose-300/45 text-rose-300"
        : "border-amber-200/45 text-amber-200";
  return `inline-block rounded border px-1.5 py-0.5 font-mono text-[0.68rem] uppercase tracking-wide ${tone}`;
}

function railTone(
  lit: boolean,
  selected: boolean,
): string | undefined {
  if (lit) return "bg-cyan-300/[0.07]";
  if (selected) return "bg-emerald-200/[0.06]";
  return undefined;
}

function railBlocker(rail: RailSnapshot): string {
  const code = rail.reasonCodes.find((item) => item !== "OK");
  if (!code) return rail.status === "open" ? "-" : rail.status;
  return humanReason(rail, code, "the amount");
}

export function RailBoard({
  rails,
  selectedVaultId,
  highlightReason,
  highlightVaultId,
}: RailBoardProps) {
  if (!rails.length) return null;

  return (
    <section
      id="rail-board"
      className="rounded-2xl border border-emerald-200/20 bg-[#06171e]/85 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5"
    >
      <p className="m-0 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-cyan-200/70">
        Vaults
      </p>
      <h2 className="m-0 mt-1 mb-4 text-lg font-semibold tracking-[-0.02em] text-[#f5fbfd] sm:text-xl">
        All IXS vaults checked
      </h2>

      {/* Mobile stacked cards - no horizontal scroll */}
      <div className="flex flex-col gap-3 md:hidden">
        {rails.map((rail) => {
          const selected = rail.vaultId === selectedVaultId;
          const lit =
            highlightVaultId === rail.vaultId ||
            (highlightReason != null &&
              rail.reasonCodes.includes(highlightReason));
          const blocker =
            railBlocker(rail);

          return (
            <article
              key={rail.vaultId}
              className={`rounded-xl border border-emerald-200/12 px-3 py-3 ${railTone(lit, selected) ?? "bg-white/[0.02]"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={statusPill(rail.status)}>{rail.status}</span>
                {selected ? (
                  <span className="font-mono text-[0.68rem] text-emerald-300">
                    picked
                  </span>
                ) : null}
                <span className="font-mono text-[0.78rem] text-slate-200">
                  {chainLabel(rail.chainId)} · {rail.symbol}
                </span>
              </div>
              <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[0.7rem]">
                <dt className="text-slate-500">Withdrawals</dt>
                <dd className="m-0 text-right text-slate-300">
                  {withdrawalLabel(rail.settlement)}
                </dd>
                <dt className="text-slate-500">Access</dt>
                <dd className="m-0 text-right text-slate-300">
                  {rail.requiresWhitelist
                    ? rail.whitelistOk === true
                      ? "KYC ok"
                      : "KYC required"
                    : "open to all"}
                </dd>
                <dt className="text-slate-500">Price/share</dt>
                <dd className="m-0 break-all text-right text-slate-300">
                  {rail.pricePerShare ?? "-"}
                </dd>
                <dt className="text-slate-500">Blocker</dt>
                <dd className="m-0 break-words text-right text-slate-500">
                  {blocker}
                </dd>
              </dl>
            </article>
          );
        })}
      </div>

      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[560px] border-collapse text-[0.85rem]">
          <thead>
            <tr>
              {[
                "Status",
                "Chain",
                "Withdrawals",
                "Access",
                "Price/share",
                "Blocker",
              ].map((label) => (
                <th
                  key={label}
                  className="border-b border-emerald-200/12 px-2 py-2.5 text-left font-mono text-[0.68rem] font-medium uppercase tracking-wider text-slate-500"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rails.map((rail) => {
              const selected = rail.vaultId === selectedVaultId;
              const lit =
                highlightVaultId === rail.vaultId ||
                (highlightReason != null &&
                  rail.reasonCodes.includes(highlightReason));
              const blocker =
                railBlocker(rail);

              return (
                <tr
                  key={rail.vaultId}
                  className={railTone(lit, selected)}
                >
                  <td className="border-b border-emerald-200/10 px-2 py-2.5 align-top">
                    <span className={statusPill(rail.status)}>
                      {rail.status}
                    </span>
                    {selected ? (
                      <span className="font-mono text-[0.68rem] text-emerald-300">
                        {" "}
                        picked
                      </span>
                    ) : null}
                  </td>
                  <td className="border-b border-emerald-200/10 px-2 py-2.5 align-top text-slate-200">
                    {chainLabel(rail.chainId)}
                    <div className="font-mono text-slate-500">{rail.symbol}</div>
                  </td>
                  <td className="border-b border-emerald-200/10 px-2 py-2.5 align-top font-mono text-slate-300">
                    {withdrawalLabel(rail.settlement)}
                  </td>
                  <td className="border-b border-emerald-200/10 px-2 py-2.5 align-top text-slate-300">
                    {rail.requiresWhitelist
                      ? rail.whitelistOk === true
                        ? "KYC ok"
                        : "KYC required"
                      : "open to all"}
                  </td>
                  <td className="border-b border-emerald-200/10 px-2 py-2.5 align-top font-mono text-slate-300">
                    {rail.pricePerShare ?? "-"}
                  </td>
                  <td className="max-w-[14rem] border-b border-emerald-200/10 px-2 py-2.5 align-top text-[0.78rem] break-words text-slate-500">
                    {blocker}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
