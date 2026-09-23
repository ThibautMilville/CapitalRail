"use client";

import { useState, type ReactNode } from "react";
import { useAccount, useConfig, useSendTransaction, useSwitchChain } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import type { PreflightResponse } from "@/features/preflight/lib/types";
import { formatUsdc } from "@/features/preflight/lib/verdict";
import type { TxStep } from "@/shared/ixs/types";
import { IconDeposit, IconShieldCheck, IconWallet } from "@/shared/ui/icons";
import { useToast } from "@/shared/ui/Toast";
import { chainLabel, explorerName, explorerTxUrl } from "@/shared/wallet/chains";

type SignPanelProps = {
  result: PreflightResponse;
  amount: string;
  loading: boolean;
  connecting: boolean;
  onConnect: () => void;
  onDone?: () => void;
};

type StepState = "idle" | "wallet" | "confirming" | "done";

type Position = { shares: string; shareValueInAssets: string };

const btnPrimary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200/40 bg-emerald-300/[0.16] px-4 py-2 text-[0.88rem] font-semibold text-emerald-50 transition-[filter,opacity] touch-manipulation hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45";

function stepCopy(step: TxStep, amount: string, chain: string) {
  if (step.type.includes("approve")) {
    return {
      title: "Allow the vault to use your USDC",
      body: `Approves exactly ${amount} USDC for this vault. No funds move yet.`,
      action: `Approve ${amount} USDC`,
      kind: "approve" as const,
    };
  }
  if (step.type.includes("deposit")) {
    return {
      title: `Deposit into the ${chain} vault`,
      body: `Sends ${amount} USDC and returns vault shares to your wallet.`,
      action: `Deposit ${amount} USDC`,
      kind: "deposit" as const,
    };
  }
  return {
    title: step.type,
    body: step.description ?? "",
    action: "Sign",
    kind: "sign" as const,
  };
}

function short(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function SignPanel({
  result,
  amount,
  loading,
  connecting,
  onConnect,
  onDone,
}: SignPanelProps) {
  const { address, chainId } = useAccount();
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { notify } = useToast();
  const [states, setStates] = useState<Record<number, StepState>>({});
  const [hashes, setHashes] = useState<Record<number, `0x${string}`>>({});
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const txPack = result.txPack;
  const walletMatches =
    Boolean(address) &&
    address!.toLowerCase() === result.walletAddress.toLowerCase();
  const ready = walletMatches && !result.preview && !loading && Boolean(txPack);
  const chain = chainLabel(txPack?.chainId ?? 56);

  const shell = (children: ReactNode) => (
    <section
      id="sign"
      className="scroll-mt-28 rounded-2xl border border-emerald-200/20 bg-[#06171e]/90 p-4 backdrop-blur-xl sm:p-5"
    >
      <p className="m-0 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-cyan-200/70">
        Step 4
      </p>
      <h2 className="m-0 mt-1 text-[1.15rem] font-semibold tracking-[-0.02em] text-[#f5fbfd] sm:text-[1.3rem]">
        Review & sign
      </h2>
      {children}
      <p className="m-0 mt-4 text-[0.74rem] text-slate-500">
        Nothing is signed without you. CapitalRail never holds funds.
      </p>
    </section>
  );

  if (!address) {
    return shell(
      <>
        <p className="m-0 mt-2 text-[0.9rem] text-slate-300">
          Connect your wallet and we re-check with your real balance and
          whitelist status, then prepare the exact deposit steps.
        </p>
        <button
          type="button"
          className={`${btnPrimary} mt-3 w-full sm:w-auto`}
          onClick={onConnect}
          disabled={connecting}
        >
          <IconWallet className="h-4 w-4 shrink-0" />
          {connecting ? "Opening wallet..." : "Connect wallet to prepare your deposit"}
        </button>
      </>,
    );
  }

  if (!ready || !txPack) {
    return shell(
      <p className="m-0 mt-2 flex items-center gap-2 text-[0.9rem] text-slate-300" role="status">
        <span className="cr-check-spinner" aria-hidden />
        {loading || !walletMatches || result.preview
          ? `Re-checking for ${short(address)} and preparing your deposit steps...`
          : "Deposit steps are not available for this result. Re-check to try again."}
      </p>,
    );
  }

  const steps = txPack.steps;
  const allDone = steps.length > 0 && steps.every((_, index) => states[index] === "done");
  const busy = Object.values(states).some((s) => s === "wallet" || s === "confirming");
  const wrongChain = chainId !== txPack.chainId;

  const loadPosition = async () => {
    try {
      const params = new URLSearchParams({ vaultId: txPack.vault.id, wallet: address });
      const response = await fetch(`/api/position?${params}`);
      if (response.ok) setPosition((await response.json()) as Position);
    } catch {
      // Position is informative only.
    }
  };

  const sign = async (index: number) => {
    const step = steps[index];
    if (!step || !ready) return;
    setError(null);
    try {
      if (wrongChain) await switchChainAsync({ chainId: txPack.chainId });
      setStates((prev) => ({ ...prev, [index]: "wallet" }));
      const hash = await sendTransactionAsync({
        to: step.tx.to,
        data: step.tx.data,
        value: BigInt(step.tx.value ?? "0"),
        chainId: txPack.chainId,
      });
      setHashes((prev) => ({ ...prev, [index]: hash }));
      setStates((prev) => ({ ...prev, [index]: "confirming" }));
      const receipt = await waitForTransactionReceipt(config, {
        hash,
        chainId: txPack.chainId as 56 | 43114,
      });
      if (receipt.status !== "success") throw new Error("Transaction reverted onchain");
      setStates((prev) => ({ ...prev, [index]: "done" }));
      if (index === steps.length - 1) {
        notify("success", `Deposit confirmed on ${chain}`);
        onDone?.();
        void loadPosition();
      }
    } catch (err) {
      setStates((prev) => ({ ...prev, [index]: "idle" }));
      const message = err instanceof Error ? err.message.split("\n")[0] : "Wallet transaction failed";
      setError(message);
    }
  };

  const copy = async (index: number, data: string) => {
    try {
      await navigator.clipboard.writeText(data);
      setCopied(index);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      notify("error", "Could not copy calldata");
    }
  };

  if (allDone) {
    return shell(
      <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-300/[0.06] p-4">
        <p className="m-0 text-[1.15rem] font-semibold text-emerald-100">
          Done. You deposited {amount} USDC.
        </p>
        <p className="m-0 mt-1 text-[0.88rem] text-slate-300">
          Your shares are in your wallet on {chain}.
          {position
            ? ` Position: ${formatUsdc(position.shares) ?? position.shares} shares (about ${formatUsdc(position.shareValueInAssets) ?? position.shareValueInAssets} USDC).`
            : ""}
        </p>
        <ul className="m-0 mt-3 list-none space-y-1 p-0">
          {steps.map((step, index) => {
            const hash = hashes[index];
            const url = hash ? explorerTxUrl(txPack.chainId, hash) : null;
            return url ? (
              <li key={`${step.type}-${index}`}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[0.84rem] text-cyan-200 underline-offset-2 hover:underline"
                >
                  View {stepCopy(step, amount, chain).action.split(" ")[0].toLowerCase()} on {explorerName(txPack.chainId)}
                </a>
              </li>
            ) : null;
          })}
        </ul>
      </div>,
    );
  }

  return shell(
    <>
      <p className="m-0 mt-2 text-[0.9rem] text-slate-300">
        Two quick signatures in your wallet, in this order.
        {wrongChain ? ` Your wallet will be asked to switch to ${chain} first.` : ""}
      </p>
      <ol className="m-0 mt-3 list-none space-y-2.5 p-0">
        {steps.map((step, index) => {
          const copyText = stepCopy(step, amount, chain);
          const state = states[index] ?? "idle";
          const unlocked = steps.slice(0, index).every((_, i) => states[i] === "done");
          const hash = hashes[index];
          const url = hash ? explorerTxUrl(txPack.chainId, hash) : null;
          return (
            <li
              key={`${step.type}-${index}`}
              className={`rounded-xl border p-3 transition-colors ${
                state === "done"
                  ? "border-emerald-300/30 bg-emerald-300/[0.05]"
                  : unlocked
                    ? "border-emerald-200/20 bg-white/[0.03]"
                    : "border-white/8 bg-white/[0.01] opacity-60"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-[0.72rem] ${
                    state === "done"
                      ? "border-emerald-300/60 bg-emerald-300/20 text-emerald-100"
                      : "border-emerald-200/25 text-slate-300"
                  }`}
                  aria-hidden
                >
                  {state === "done" ? "✓" : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[0.92rem] font-medium text-slate-100">{copyText.title}</p>
                  <p className="m-0 mt-0.5 text-[0.8rem] text-slate-400">{copyText.body}</p>
                  {state === "done" ? (
                    <p className="m-0 mt-2 text-[0.8rem] text-emerald-200">
                      Confirmed
                      {url ? (
                        <>
                          {" - "}
                          <a href={url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                            {explorerName(txPack.chainId)}
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : (
                    <button
                      type="button"
                      className={`${btnPrimary} mt-2.5 w-full sm:w-auto`}
                      disabled={!unlocked || busy}
                      onClick={() => void sign(index)}
                    >
                      {copyText.kind === "approve" ? (
                        <IconShieldCheck className="h-4 w-4 shrink-0" />
                      ) : copyText.kind === "deposit" ? (
                        <IconDeposit className="h-4 w-4 shrink-0" />
                      ) : (
                        <IconWallet className="h-4 w-4 shrink-0" />
                      )}
                      {state === "wallet"
                        ? "Confirm in your wallet..."
                        : state === "confirming"
                          ? "Waiting for confirmation..."
                          : unlocked
                            ? copyText.action
                            : `${copyText.action} (after step ${index})`}
                    </button>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer select-none text-[0.72rem] text-slate-500 hover:text-slate-300">
                      Transaction details
                    </summary>
                    <div className="mt-1.5 break-all font-mono text-[0.68rem] text-slate-400">
                      <div>to: {step.tx.to}</div>
                      <div>data: {step.tx.data.slice(0, 74)}...</div>
                      <button
                        type="button"
                        className="mt-1 cursor-pointer text-cyan-200/80 hover:text-cyan-100"
                        onClick={() => void copy(index, step.tx.data)}
                      >
                        {copied === index ? "Copied" : "Copy calldata"}
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {error ? (
        <p className="m-0 mt-3 break-words text-[0.82rem] text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </>,
  );
}
