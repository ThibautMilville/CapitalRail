"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import type { VaultsCatalogResponse } from "@/features/vaults/lib/types";
import {
  buildChainSlices,
  buildVaultSlices,
  TvlDonut,
} from "@/features/vaults/ui/TvlDonut";
import { withdrawalLabel } from "@/features/preflight/lib/verdict";
import { CapitalRailMark } from "@/shared/ui/CapitalRailMark";
import { BrandGlowTitle } from "@/shared/ui/GlowTitle";
import { IconRefresh } from "@/shared/ui/icons";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader, type SiteHeaderStatus } from "@/shared/ui/SiteHeader";
import { useToast } from "@/shared/ui/Toast";
import { SUPPORTED_CHAIN_IDS, chainLabel } from "@/shared/wallet/chains";

const HEADER_LINKS = [
  { href: "/vaults", label: "Vaults" },
  { href: "/#how", label: "How it works" },
  { href: "/#agents", label: "Agents" },
  { href: "/#business", label: "Business" },
  { href: "/#faq", label: "FAQ" },
];

const btnGhost =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-[0.82rem] font-medium text-slate-200 transition-colors touch-manipulation hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45";

const btnPrimary =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200/35 bg-emerald-300/[0.14] px-3.5 py-2 text-[0.84rem] font-semibold text-emerald-50 transition-[filter] touch-manipulation hover:brightness-110";

function formatTtm(ttm: number | null): string {
  if (ttm == null) return "-";
  return `${ttm} (IXS time to maturity)`;
}

function formatWhen(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return "-";
  try {
    return new Date(sec * 1000).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "-";
  }
}

function sumAssets(values: (string | null)[]): string {
  let total = 0;
  let any = false;
  for (const v of values) {
    const n = Number.parseFloat(v ?? "");
    if (Number.isFinite(n)) {
      total += n;
      any = true;
    }
  }
  if (!any) return "-";
  return `${total.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
}

export function VaultsPage() {
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { notify } = useToast();

  const [data, setData] = useState<VaultsCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [openRisks, setOpenRisks] = useState<Record<string, boolean>>({});

  const walletConnected = Boolean(isConnected && address);
  const wrongNetwork =
    walletConnected && chainId != null && !SUPPORTED_CHAIN_IDS.includes(chainId);

  const onConnect = useCallback(async () => {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (!injected) {
      notify("error", "No wallet connector available");
      return;
    }
    try {
      await connectAsync({ connector: injected });
    } catch (err) {
      const message = err instanceof Error ? err.message.split("\n")[0] : "Connect failed";
      notify("error", message);
    }
  }, [connectAsync, connectors, notify]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/vaults");
      const body = (await response.json()) as VaultsCatalogResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not load vaults");
      setData(body);
      setHealthOk(true);
    } catch (err) {
      setHealthOk(false);
      setError(err instanceof Error ? err.message : "Could not load vaults");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/vaults");
        const body = (await response.json()) as VaultsCatalogResponse & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not load vaults");
        if (cancelled) return;
        setData(body);
        setHealthOk(true);
      } catch (err) {
        if (cancelled) return;
        setHealthOk(false);
        setError(err instanceof Error ? err.message : "Could not load vaults");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const vaultSlices = useMemo(
    () =>
      buildVaultSlices(
        (data?.vaults ?? []).map((v) => ({
          id: v.vaultId,
          label: `${chainLabel(v.chainId)} ${v.requiresWhitelist ? "KYC" : "open"}`,
          totalAssets: v.totalAssets,
        })),
      ),
    [data],
  );

  const chainSlices = useMemo(
    () =>
      buildChainSlices(
        (data?.vaults ?? []).map((v) => ({
          chainLabel: chainLabel(v.chainId),
          totalAssets: v.totalAssets,
        })),
      ),
    [data],
  );

  const headerStatus: SiteHeaderStatus = loading
    ? { tone: "pending", label: "Loading IXS vaults" }
    : healthOk
      ? { tone: "ok", label: `IXS live - ${data?.vaults.length ?? 0} vaults` }
      : { tone: "warn", label: "IXS unreachable" };

  const totalTvl = sumAssets((data?.vaults ?? []).map((v) => v.totalAssets));

  return (
    <div id="top" className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden">
      <SiteHeader
        links={HEADER_LINKS}
        activeHref="/vaults"
        homeHref="/"
        status={headerStatus}
        wallet={{
          address: walletConnected ? (address ?? null) : null,
          connecting,
          networkLabel: chainId != null ? chainLabel(chainId) : null,
          wrongNetwork,
        }}
        onConnect={() => void onConnect()}
        onDisconnect={() => disconnect()}
        onSwitchNetwork={() => switchChain({ chainId: 56 })}
      />

      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#02090d]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_16%,rgba(21,125,116,0.12),transparent_36%),linear-gradient(180deg,#02090d_0%,#031017_72%,#02090d_100%)]" />
      </div>

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-5 px-3 pb-28 pt-24 sm:gap-6 sm:px-4 sm:pb-12 sm:pt-28 md:px-6">
        <header className="relative min-w-0">
          <p className="section-kicker m-0">Live IXS rails</p>
          <div className="mt-3 flex min-w-0 items-center gap-3 sm:gap-4">
            <CapitalRailMark className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
            <h1 className="m-0 min-w-0 text-[clamp(1.85rem,7vw,3.4rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
              <BrandGlowTitle lead="IXS" accent="Vaults" />
            </h1>
          </div>
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-snug text-slate-400 sm:text-[1.02rem]">
            See the four live IX High Yield Bond USDC vaults - chain, access,
            settlement, TVL and time to maturity from IXS. No invented APY.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/" className={btnPrimary}>
              Check entry
            </Link>
            <Link href="/#exit" className={btnGhost}>
              Exit positions
            </Link>
            <button
              type="button"
              className={btnGhost}
              onClick={() => void load()}
              disabled={loading}
            >
              <IconRefresh className="h-3.5 w-3.5 shrink-0" />
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        <section
          aria-label="Vault stats"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {[
            { label: "Vaults", value: data ? String(data.vaults.length) : loading ? "..." : "-" },
            { label: "TVL (sum)", value: loading && !data ? "..." : totalTvl },
            {
              label: "Chains",
              value: data
                ? String(new Set(data.vaults.map((v) => v.chainId)).size)
                : "-",
            },
            {
              label: "Fetched",
              value: data?.fetchedAt
                ? new Date(data.fetchedAt).toLocaleTimeString()
                : "-",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-emerald-200/12 bg-white/[0.02] px-3 py-3"
            >
              <p className="m-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
                {stat.label}
              </p>
              <p className="m-0 mt-1.5 font-mono text-[0.95rem] text-slate-100">{stat.value}</p>
            </div>
          ))}
        </section>

        {error ? (
          <p className="m-0 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <TvlDonut
            title="TVL by vault"
            centerLabel="Total"
            centerValue={totalTvl === "-" ? "-" : totalTvl.replace(" USDC", "")}
            slices={vaultSlices}
          />
          <TvlDonut
            title="TVL by chain"
            centerLabel="Chains"
            centerValue={String(chainSlices.length || "-")}
            slices={chainSlices}
          />
        </div>

        <section aria-label="Vault catalogue" className="flex flex-col gap-3">
          <h2 className="m-0 text-lg font-semibold tracking-[-0.02em] text-[#f5fbfd]">
            Catalogue
          </h2>
          {loading && !data ? (
            <ul
              className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2"
              aria-busy="true"
              aria-label="Loading vault catalogue"
            >
              {[0, 1, 2, 3].map((i) => (
                <li
                  key={i}
                  className="animate-pulse rounded-2xl border border-emerald-200/10 bg-[#06171e]/60 p-4"
                >
                  <div className="h-4 w-16 rounded bg-white/10" />
                  <div className="mt-3 h-5 w-40 rounded bg-white/10" />
                  <div className="mt-2 h-3 w-28 rounded bg-white/5" />
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full rounded bg-white/5" />
                    <div className="h-3 w-3/4 rounded bg-white/5" />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {(data?.vaults ?? []).map((vault) => {
              const risksOpen = Boolean(openRisks[vault.vaultId]);
              return (
                <li
                  key={vault.vaultId}
                  className="rounded-2xl border border-emerald-200/15 bg-[#06171e]/85 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.22)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-emerald-300/35 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide text-emerald-200">
                      {vault.status}
                    </span>
                    {!vault.mcpOk ? (
                      <span className="font-mono text-[0.65rem] text-amber-200/80">
                        pricing incomplete
                      </span>
                    ) : null}
                  </div>
                  <p className="m-0 mt-2 text-[1.05rem] font-semibold text-slate-100">
                    {chainLabel(vault.chainId)} · {vault.requiresWhitelist ? "KYC" : "open"}
                  </p>
                  <p className="m-0 mt-0.5 font-mono text-[0.72rem] text-slate-500">
                    {vault.symbol} · {vault.contractAddress.slice(0, 10)}...
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[0.72rem]">
                    <dt className="text-slate-500">Withdrawals</dt>
                    <dd className="m-0 text-right text-slate-300">
                      {withdrawalLabel(vault.settlement)}
                    </dd>
                    <dt className="text-slate-500">TVL</dt>
                    <dd className="m-0 text-right text-slate-300">
                      {vault.totalAssets
                        ? `${vault.totalAssets} ${vault.assetSymbol}`
                        : "-"}
                    </dd>
                    <dt className="text-slate-500">Price / share</dt>
                    <dd className="m-0 break-all text-right text-slate-300">
                      {vault.pricePerShare ?? "-"}
                    </dd>
                    <dt className="text-slate-500">ttm</dt>
                    <dd className="m-0 text-right text-slate-300">{formatTtm(vault.ttm)}</dd>
                  </dl>
                  {vault.riskBullets.length > 0 ? (
                    <div className="mt-3 border-t border-white/8 pt-3">
                      <button
                        type="button"
                        className="cursor-pointer font-mono text-[0.72rem] text-cyan-200/80 underline-offset-2 hover:underline"
                        aria-expanded={risksOpen}
                        onClick={() =>
                          setOpenRisks((prev) => ({
                            ...prev,
                            [vault.vaultId]: !prev[vault.vaultId],
                          }))
                        }
                      >
                        {risksOpen ? "Hide risk notes" : "Show risk notes"} (
                        {vault.riskBullets.length})
                      </button>
                      {risksOpen ? (
                        <ul className="m-0 mt-2 list-disc space-y-1 pl-4 text-[0.8rem] text-slate-400">
                          {vault.riskBullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/" className={btnPrimary}>
                      Check entry
                    </Link>
                    <Link href="/#exit" className={btnGhost}>
                      Exit
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          aria-label="Recent activity"
          className="rounded-2xl border border-emerald-200/15 bg-[#06171e]/80 p-4 sm:p-5"
        >
          <p className="m-0 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-cyan-200/70">
            Activity
          </p>
          <h2 className="m-0 mt-1 text-lg font-semibold text-[#f5fbfd]">
            Recent deposits and redeems
          </h2>
          <p className="m-0 mt-1.5 text-[0.84rem] text-slate-500">
            {data?.activityNote ??
              (loading ? "Probing IXS subgraphs..." : "No activity source yet.")}
          </p>
          {data?.activitySource === "unavailable" || (data && data.activity.length === 0) ? (
            <p className="m-0 mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[0.9rem] text-slate-400">
              {data?.activitySource === "unavailable"
                ? "Activity history is unavailable from IXS right now - nothing invented."
                : "No recent deposit or redeem requests returned by the subgraphs."}
            </p>
          ) : (
            <ul className="m-0 mt-4 list-none divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10 p-0">
              {(data?.activity ?? []).map((item) => {
                const vault = data?.vaults.find((v) => v.vaultId === item.vaultId);
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="m-0 text-[0.88rem] text-slate-200">
                        <span className="font-medium">{item.label}</span>
                        {item.status ? (
                          <span className="text-slate-500"> · {item.status}</span>
                        ) : null}
                      </p>
                      <p className="m-0 mt-0.5 font-mono text-[0.7rem] text-slate-500">
                        {vault
                          ? `${chainLabel(vault.chainId)} ${vault.requiresWhitelist ? "KYC" : "open"}`
                          : item.vaultId.slice(0, 8)}
                        {item.amountDisplay ? ` · ${item.amountDisplay}` : ""}
                        {item.actor ? ` · ${item.actor}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 font-mono text-[0.72rem] text-slate-500">
                      <span>{formatWhen(item.timestampSec)}</span>
                      {item.explorerTxUrl ? (
                        <a
                          href={item.explorerTxUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-200 underline-offset-2 hover:underline"
                        >
                          Tx
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <div className="mx-auto w-full max-w-[1100px] px-3 pb-24 sm:px-4 sm:pb-8 md:px-6">
        <SiteFooter />
      </div>
    </div>
  );
}
