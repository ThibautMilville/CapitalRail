"use client";

import { useState } from "react";
import type { MandateValues } from "@/features/preflight/lib/mandate";

type RulesEditorProps = {
  value: MandateValues;
  onChange: (next: MandateValues) => void;
  disabled?: boolean;
};

const CHAINS: { id: MandateValues["preferredChainId"]; label: string }[] = [
  { id: "", label: "Any chain" },
  { id: "56", label: "BSC" },
  { id: "43114", label: "Avalanche" },
];

const segBase =
  "min-h-10 flex-1 cursor-pointer rounded-lg px-3 py-2 text-[0.8rem] font-medium transition-[background-color,color] touch-manipulation disabled:cursor-not-allowed disabled:opacity-50";

function AmountField({
  amount,
  onCommit,
  disabled,
}: {
  amount: string;
  onCommit: (next: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(amount);
  const valid = /^\d+(\.\d+)?$/.test(draft) && Number(draft) > 0;

  const commit = () => {
    if (valid && draft !== amount) onCommit(draft);
    if (!valid) setDraft(amount);
  };

  return (
    <label className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200/15 bg-black/25 px-3 focus-within:border-emerald-200/35">
      <span className="text-[0.8rem] text-slate-400">Amount</span>
      <input
        className="w-full min-w-0 border-0 bg-transparent text-right font-mono text-[0.95rem] text-[#f5fbfd] outline-none"
        value={draft}
        onChange={(event) => setDraft(event.target.value.trim())}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        inputMode="decimal"
        aria-label="Amount in USDC"
        aria-invalid={!valid}
        disabled={disabled}
      />
      <span className="font-mono text-[0.75rem] text-slate-500">USDC</span>
    </label>
  );
}

function Toggle({
  checked,
  label,
  hint,
  onToggle,
  disabled,
}: {
  checked: boolean;
  label: string;
  hint: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      disabled={disabled}
      className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-emerald-200/12 bg-white/[0.02] px-3 py-2 text-left transition-[border-color] touch-manipulation hover:border-emerald-200/25 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-[0.85rem] text-slate-200">{label}</span>
        <span className="block text-[0.72rem] text-slate-500">{hint}</span>
      </span>
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked
            ? "border-emerald-300/50 bg-emerald-300/30"
            : "border-slate-500/40 bg-slate-700/40"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-[left] ${
            checked ? "left-[1.1rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function RulesEditor({ value, onChange, disabled }: RulesEditorProps) {
  const update = (patch: Partial<MandateValues>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <AmountField
        key={value.amount}
        amount={value.amount}
        onCommit={(amount) => update({ amount })}
        disabled={disabled}
      />
      <div
        role="radiogroup"
        aria-label="Chain"
        className="flex gap-1 rounded-xl border border-emerald-200/12 bg-black/20 p-1"
      >
        {CHAINS.map((chain) => {
          const active = value.preferredChainId === chain.id;
          return (
            <button
              key={chain.label}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => update({ preferredChainId: chain.id })}
              className={`${segBase} ${
                active
                  ? "bg-emerald-200/[0.14] text-emerald-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {chain.label}
            </button>
          );
        })}
      </div>
      <Toggle
        checked={value.requireSyncSettlement}
        label="Instant withdrawals only"
        hint="Skip vaults that settle later (ERC-7540 requests)"
        onToggle={() =>
          update({ requireSyncSettlement: !value.requireSyncSettlement })
        }
        disabled={disabled}
      />
      <Toggle
        checked={value.allowKyc}
        label="Allow KYC vaults"
        hint="Only if you can complete whitelist onboarding"
        onToggle={() => update({ allowKyc: !value.allowKyc })}
        disabled={disabled}
      />
    </div>
  );
}
