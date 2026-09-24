"use client";

import { useState, type ReactNode } from "react";
import { useAccount, useConfig, useSendTransaction, useSwitchChain } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import type { ExitTxPack } from "@/features/exit/lib/types";
import type { TxStep } from "@/shared/ixs/types";
import { IconWithdraw } from "@/shared/ui/icons";
import { useToast } from "@/shared/ui/Toast";
import { chainLabel, explorerName, explorerTxUrl } from "@/shared/wallet/chains";

type ExitSignPanelProps = {
  pack: ExitTxPack;
  onDone?: () => void;
};

type StepState = "idle" | "wallet" | "confirming" | "done";

const btnPrimary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200/40 bg-emerald-300/[0.16] px-4 py-2 text-[0.88rem] font-semibold text-emerald-50 transition-[filter,opacity] touch-manipulation hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45";

function stepCopy(step: TxStep, pack: ExitTxPack) {
  if (step.type.includes("redeem") || pack.kind === "redeem") {
    return {
      title: pack.needsClaim
        ? "Request your exit"
        : "Request redemption",
      body:
        step.description ??
        (pack.needsClaim
          ? "Queues your shares for redemption. MCP exposed a claim path for this vault; prefer waiting for operator finalization when IXS marks USDC claimable."
          : "Queues your shares for redemption. Per IXS HYB ops there is no separate claim step - the operator finalizes and USDC goes to the receiver (against the next daily cutoff)."),
      action: pack.kind === "claim" ? "Claim USDC" : "Request exit",
    };
  }
  if (step.type.includes("claim") || pack.kind === "claim") {
    return {
      title: "Claim your USDC",
      body: step.description ?? "Pulls the settled assets into your wallet.",
      action: "Claim USDC",
    };
  }
  return {
    title: step.type,
    body: step.description ?? "",
    action: "Sign",
  };
}

export function ExitSignPanel({ pack, onDone }: ExitSignPanelProps) {
  const { address, chainId } = useAccount();
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { notify } = useToast();
  const [states, setStates] = useState<Record<number, StepState>>({});
  const [hashes, setHashes] = useState<Record<number, `0x${string}`>>({});
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const walletMatches =
    Boolean(address) &&
    address!.toLowerCase() === pack.ownerAddress.toLowerCase();
  const chain = chainLabel(pack.chainId);
  const steps = pack.steps;
  const allDone = steps.length > 0 && steps.every((_, index) => states[index] === "done");
  const busy = Object.values(states).some((s) => s === "wallet" || s === "confirming");
  const wrongChain = chainId !== pack.chainId;

  const shell = (children: ReactNode) => (
    <section className="rounded-xl border border-emerald-200/20 bg-white/[0.02] p-3.5 sm:p-4">
      <p className="m-0 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-cyan-200/70">
        Sign
      </p>
      <h3 className="m-0 mt-1 text-[1.05rem] font-semibold text-[#f5fbfd]">
        {pack.kind === "claim" ? "Claim USDC" : "Review & sign exit"}
      </h3>
      {children}
      <p className="m-0 mt-3 text-[0.74rem] text-slate-500">
        Nothing is signed without you. CapitalRail never holds funds.
      </p>
    </section>
  );

  if (!walletMatches) {
    return shell(
      <p className="m-0 mt-2 text-[0.9rem] text-slate-300">
        Connect the wallet that holds these shares to sign.
      </p>,
    );
  }

  const sign = async (index: number) => {
    const step = steps[index];
    if (!step) return;
    setError(null);
    try {
      if (wrongChain) await switchChainAsync({ chainId: pack.chainId });
      setStates((prev) => ({ ...prev, [index]: "wallet" }));
      const hash = await sendTransactionAsync({
        to: step.tx.to,
        data: step.tx.data,
        value: BigInt(step.tx.value ?? "0"),
        chainId: pack.chainId,
      });
      setHashes((prev) => ({ ...prev, [index]: hash }));
      setStates((prev) => ({ ...prev, [index]: "confirming" }));
      const receipt = await waitForTransactionReceipt(config, {
        hash,
        chainId: pack.chainId as 56 | 43114,
      });
      if (receipt.status !== "success") throw new Error("Transaction reverted onchain");
      setStates((prev) => ({ ...prev, [index]: "done" }));
      if (index === steps.length - 1) {
        notify(
          "success",
          pack.kind === "claim"
            ? `Claim confirmed on ${chain}`
            : `Exit requested on ${chain}`,
        );
        onDone?.();
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
        <p className="m-0 text-[1.05rem] font-semibold text-emerald-100">
          {pack.kind === "claim"
            ? "Done. USDC should be in your wallet."
            : pack.needsClaim
              ? "Exit requested. Claim when IXS marks it ready."
              : "Exit requested. USDC returns after the vault redemption cycle."}
        </p>
        <ul className="m-0 mt-3 list-none space-y-1 p-0">
          {steps.map((step, index) => {
            const hash = hashes[index];
            const url = hash ? explorerTxUrl(pack.chainId, hash) : null;
            return url ? (
              <li key={`${step.type}-${index}`}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[0.84rem] text-cyan-200 underline-offset-2 hover:underline"
                >
                  View on {explorerName(pack.chainId)}
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
        Sign in your wallet
        {wrongChain ? ` (switch to ${chain} first)` : ""}.
      </p>
      <ol className="m-0 mt-3 list-none space-y-2.5 p-0">
        {steps.map((step, index) => {
          const copyText = stepCopy(step, pack);
          const state = states[index] ?? "idle";
          const unlocked = steps.slice(0, index).every((_, i) => states[i] === "done");
          const hash = hashes[index];
          const url = hash ? explorerTxUrl(pack.chainId, hash) : null;
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
                            {explorerName(pack.chainId)}
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
                      <IconWithdraw className="h-4 w-4 shrink-0" />
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
