"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import type { ExitBuildResponse, ExitPosition, ExitTxPack } from "@/features/exit/lib/types";
import { ExitSignPanel } from "@/features/exit/ui/ExitSignPanel";
import { IconRefresh, IconWallet, IconWithdraw } from "@/shared/ui/icons";
import { useToast } from "@/shared/ui/Toast";
import { chainLabel } from "@/shared/wallet/chains";

const btnPrimary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200/40 bg-emerald-300/[0.16] px-4 py-2 text-[0.88rem] font-semibold text-emerald-50 transition-[filter,opacity] touch-manipulation hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45";

const btnGhost =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-[0.82rem] font-medium text-slate-200 transition-colors touch-manipulation hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45";

function stripUnit(display: string) {
  return display.replace(/\s*(shares|USDC)\s*$/i, "").trim();
}

function humanFromBase(baseUnits: string, decimals: number): string {
  const normalized = baseUnits.replace(/^0+(?=\d)/, "") || "0";
  if (decimals === 0) return normalized;
  const padded = normalized.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

function redeemableBase(position: ExitPosition): string {
  try {
    const max = BigInt(position.maxRedeem.baseUnits);
    if (max > BigInt(0)) return position.maxRedeem.baseUnits;
  } catch {
    // fall through
  }
  return position.shares.baseUnits;
}

function settlementHint(settlement: string): string {
  if (settlement.startsWith("async")) {
    return "Async exit: request anytime; processed against the next daily cutoff (5:00 PM SGT). IXS HYB ops: no separate claim - operator finalizes USDC to the receiver.";
  }
  if (settlement === "sync") {
    return "IXS may still queue the redemption cycle even on sync vaults.";
  }
  return "Redemption follows the vault cycle - funds are not instant.";
}

function vaultTitle(position: ExitPosition) {
  return `${chainLabel(position.chainId)} ${position.requiresWhitelist ? "KYC" : "open"} vault`;
}

type ExitPanelProps = {
  /** Optional - unused; kept for call-site flexibility. */
  onGoEnter?: () => void;
};

export function ExitPanel({ onGoEnter }: ExitPanelProps) {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: connecting } = useConnect();
  const { notify } = useToast();

  const [positions, setPositions] = useState<ExitPosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shareAmount, setShareAmount] = useState("");
  const [building, setBuilding] = useState(false);
  const [pack, setPack] = useState<ExitTxPack | null>(null);
  const [claimRequestId, setClaimRequestId] = useState("");
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const walletConnected = Boolean(isConnected && address);

  const onConnect = useCallback(async () => {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (!injected) {
      notify("error", "No wallet connector available");
      return;
    }
    try {
      await connectAsync({ connector: injected });
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : "Connect failed";
      notify("error", message);
    }
  }, [connectAsync, connectors, notify]);

  const loadPositions = useCallback(
    async (wallet: string) => {
      setLoadingPositions(true);
      setPack(null);
      setStatusNote(null);
      try {
        const response = await fetch(`/api/exit/positions?wallet=${wallet}`);
        const data = (await response.json()) as {
          positions?: ExitPosition[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Could not load positions");
        const list = data.positions ?? [];
        setPositions(list);
        setSelectedId((current) => {
          if (list.length === 1) return list[0].vaultId;
          if (current && list.some((p) => p.vaultId === current)) return current;
          return null;
        });
        if (list.length === 1) {
          setShareAmount(humanFromBase(redeemableBase(list[0]), list[0].shares.decimals));
        }
      } catch (error) {
        setPositions([]);
        notify(
          "error",
          error instanceof Error ? error.message : "Could not load positions",
        );
      } finally {
        setLoadingPositions(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    if (!address) return;
    const wallet = address;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadPositions(wallet);
    })();
    return () => {
      cancelled = true;
    };
  }, [address, loadPositions]);

  const visiblePositions = address ? positions : [];
  const selected = visiblePositions.find((p) => p.vaultId === selectedId) ?? null;

  const selectPosition = (position: ExitPosition) => {
    setSelectedId(position.vaultId);
    setShareAmount(humanFromBase(redeemableBase(position), position.shares.decimals));
    setPack(null);
    setClaimRequestId("");
    setStatusNote(null);
  };

  const prepareRedeem = async () => {
    if (!address || !selected) return;
    setBuilding(true);
    setPack(null);
    try {
      const useMax =
        shareAmount.trim() ===
        humanFromBase(redeemableBase(selected), selected.shares.decimals);
      const response = await fetch("/api/exit/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultId: selected.vaultId,
          wallet: address,
          shareAmount: useMax ? redeemableBase(selected) : shareAmount.trim(),
          shareDecimals: selected.shares.decimals,
          asBaseUnits: useMax,
        }),
      });
      const data = (await response.json()) as ExitBuildResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not prepare exit");
      setPack(data.pack);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Could not prepare exit",
      );
    } finally {
      setBuilding(false);
    }
  };

  const prepareClaim = async () => {
    if (!address || !selected || !claimRequestId.trim()) return;
    setBuilding(true);
    setPack(null);
    try {
      const response = await fetch("/api/exit/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultId: selected.vaultId,
          wallet: address,
          requestId: claimRequestId.trim(),
        }),
      });
      const data = (await response.json()) as ExitBuildResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not prepare claim");
      setPack(data.pack);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Could not prepare claim",
      );
    } finally {
      setBuilding(false);
    }
  };

  const checkRequests = async () => {
    if (!address || !selected) return;
    setStatusNote(null);
    try {
      const params = new URLSearchParams({
        wallet: address,
        vaultId: selected.vaultId,
      });
      const response = await fetch(`/api/exit/requests?${params}`);
      const data = (await response.json()) as {
        available?: boolean;
        error?: string;
        requests?: { requestId?: string; status?: string; claimable?: boolean }[];
      };
      if (!data.available) {
        setStatusNote(
          data.error ??
            "IXS request status feed is unavailable. If you have a request id from the explorer or IXS UI, paste it below to claim.",
        );
        return;
      }
      const list = data.requests ?? [];
      if (list.length === 0) {
        setStatusNote("No pending exit requests found for this vault.");
        return;
      }
      const claimable = list.find((r) => r.claimable || /claimable|ready/i.test(r.status ?? ""));
      if (claimable?.requestId) {
        setClaimRequestId(String(claimable.requestId));
        setStatusNote(
          `Found claimable request ${claimable.requestId}. Prepare claim to continue.`,
        );
      } else {
        setStatusNote(
          `${list.length} request(s) found. Status: ${list
            .map((r) => `${r.requestId ?? "?"} (${r.status ?? "unknown"})`)
            .join(", ")}.`,
        );
      }
    } catch {
      setStatusNote("Could not reach the request status feed.");
    }
  };

  return (
    <section
      id="exit"
      aria-label="Exit vault positions"
      className="scroll-mt-24 rounded-2xl border border-emerald-200/20 bg-[#06171e]/85 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5"
    >
      {!walletConnected ? (
        <div>
          <h2 className="m-0 text-[1.15rem] font-semibold text-[#f5fbfd]">
            Connect to see your positions
          </h2>
          <p className="m-0 mt-2 text-[0.9rem] text-slate-300">
            We scan IXS vaults on BSC and Avalanche for shares held by your wallet.
          </p>
          <button
            type="button"
            className={`${btnPrimary} mt-4`}
            onClick={() => void onConnect()}
            disabled={connecting}
          >
            <IconWallet className="h-4 w-4 shrink-0" />
            {connecting ? "Opening wallet..." : "Connect wallet"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="m-0 text-[1.15rem] font-semibold text-[#f5fbfd]">
                Your vault positions
              </h2>
              <p className="m-0 mt-1 text-[0.84rem] text-slate-400">
                {loadingPositions
                  ? "Scanning IXS..."
                  : visiblePositions.length === 0
                    ? "No redeemable shares found on this wallet."
                    : `${visiblePositions.length} position${visiblePositions.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <button
              type="button"
              className={btnGhost}
              onClick={() => address && void loadPositions(address)}
              disabled={loadingPositions || !address}
            >
              <IconRefresh className="h-3.5 w-3.5 shrink-0" />
              {loadingPositions ? "Scanning..." : "Refresh"}
            </button>
          </div>

          {loadingPositions && visiblePositions.length === 0 ? (
            <p className="m-0 flex items-center gap-2 text-[0.9rem] text-slate-300" role="status">
              <span className="cr-check-spinner" aria-hidden />
              Reading live IXS positions...
            </p>
          ) : null}

          {visiblePositions.length > 0 ? (
            <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2">
              {visiblePositions.map((position) => {
                const active = position.vaultId === selectedId;
                return (
                  <li key={position.vaultId}>
                    <button
                      type="button"
                      onClick={() => selectPosition(position)}
                      className={`w-full cursor-pointer rounded-xl border p-3.5 text-left transition-colors touch-manipulation ${
                        active
                          ? "border-emerald-300/40 bg-emerald-300/[0.07]"
                          : "border-white/10 bg-white/[0.02] hover:border-emerald-200/25 hover:bg-white/[0.04]"
                      }`}
                    >
                      <p className="m-0 text-[0.92rem] font-semibold text-slate-100">
                        {vaultTitle(position)}
                      </p>
                      <p className="m-0 mt-1 font-mono text-[0.72rem] text-slate-500">
                        {position.symbol} · {stripUnit(position.shares.display)} shares
                      </p>
                      <p className="m-0 mt-2 text-[0.88rem] text-emerald-100/90">
                        ~{stripUnit(position.shareValueInAssets.display)} USDC
                      </p>
                      <p className="m-0 mt-1 text-[0.76rem] text-slate-500">
                        {settlementHint(position.settlement)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : !loadingPositions ? (
            <p className="m-0 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[0.9rem] text-slate-300">
              Deposit first from{" "}
              {onGoEnter ? (
                <button
                  type="button"
                  onClick={onGoEnter}
                  className="cursor-pointer text-cyan-200 underline-offset-2 hover:underline"
                >
                  Enter
                </button>
              ) : (
                <a href="#flow" className="text-cyan-200 underline-offset-2 hover:underline">
                  Enter
                </a>
              )}
              , then come back here to exit.
            </p>
          ) : null}

          {selected ? (
            <div className="rounded-xl border border-cyan-100/12 bg-[#041219]/60 p-3.5 sm:p-4">
              <p className="m-0 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-cyan-200/70">
                Request exit · {vaultTitle(selected)}
              </p>
              <label className="mt-3 block">
                <span className="text-[0.8rem] text-slate-400">Share amount</span>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={shareAmount}
                    onChange={(event) => {
                      setShareAmount(event.target.value);
                      setPack(null);
                    }}
                    className="min-h-11 w-full rounded-xl border border-white/12 bg-black/25 px-3 font-mono text-[0.9rem] text-slate-100 outline-none focus:border-emerald-300/40"
                  />
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => {
                      setShareAmount(
                        humanFromBase(redeemableBase(selected), selected.shares.decimals),
                      );
                      setPack(null);
                    }}
                  >
                    Max
                  </button>
                </div>
              </label>
              <p className="m-0 mt-2 text-[0.76rem] text-slate-500">
                Max redeemable:{" "}
                {humanFromBase(redeemableBase(selected), selected.shares.decimals)} shares (~
                {stripUnit(selected.shareValueInAssets.display)} USDC).{" "}
                {settlementHint(selected.settlement)}
              </p>
              <button
                type="button"
                className={`${btnPrimary} mt-3 w-full sm:w-auto`}
                disabled={building || !shareAmount.trim()}
                onClick={() => void prepareRedeem()}
              >
                <IconWithdraw className="h-4 w-4 shrink-0" />
                {building && !pack ? "Preparing..." : "Prepare exit"}
              </button>

              {selected.settlement.startsWith("async") ? (
                <div className="mt-4 border-t border-white/8 pt-4">
                  <p className="m-0 text-[0.88rem] font-medium text-slate-200">
                    Optional claim fallback
                  </p>
                  <p className="m-0 mt-1 text-[0.78rem] text-slate-500">
                    IXS HYB ops: no separate claim - operator finalizes USDC to the receiver.
                    If MCP still exposes a claim path for this vault, check status or paste a
                    request id from the explorer / IXS UI.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button type="button" className={btnGhost} onClick={() => void checkRequests()}>
                      Check status
                    </button>
                    <input
                      type="text"
                      value={claimRequestId}
                      onChange={(event) => setClaimRequestId(event.target.value)}
                      placeholder="request id"
                      className="min-h-10 min-w-[10rem] flex-1 rounded-xl border border-white/12 bg-black/25 px-3 font-mono text-[0.84rem] text-slate-100 outline-none focus:border-emerald-300/40"
                    />
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={building || !claimRequestId.trim()}
                      onClick={() => void prepareClaim()}
                    >
                      Prepare claim
                    </button>
                  </div>
                  {statusNote ? (
                    <p className="m-0 mt-2 text-[0.8rem] text-amber-100/90" role="status">
                      {statusNote}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {pack ? (
            <ExitSignPanel
              pack={pack}
              onDone={() => {
                if (address) void loadPositions(address);
              }}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
