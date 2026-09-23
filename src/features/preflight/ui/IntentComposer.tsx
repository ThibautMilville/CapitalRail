"use client";

import { useState } from "react";
import type { ParsedIntent } from "@/features/preflight/lib/intent-schema";
import {
  describeRules,
  type MandateValues,
} from "@/features/preflight/lib/mandate";
import { requestIntent } from "@/features/preflight/lib/request-intent";
import { RulesEditor } from "@/features/preflight/ui/RulesEditor";
import { IconSearch } from "@/shared/ui/icons";
import { useToast } from "@/shared/ui/Toast";

type IntentComposerProps = {
  mandate: MandateValues;
  hasResult: boolean;
  loading: boolean;
  /** Set once free text was turned into rules. */
  understood: boolean;
  onIntentReady: (intent: ParsedIntent) => void;
  onRulesChange: (next: MandateValues) => void;
  onCheck: () => void;
};

const EXAMPLES = [
  "500 USDC, no KYC, instant withdrawals",
  "100 USDC on Avalanche, delayed withdrawals ok",
  "Small test deposit on BSC",
];

const btnPrimary =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200/40 bg-emerald-300/[0.16] px-5 py-2.5 text-[0.92rem] font-semibold text-emerald-50 shadow-[0_0_24px_rgba(91,238,190,0.12)] transition-[filter,opacity] touch-manipulation hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

export function IntentComposer({
  mandate,
  hasResult,
  loading,
  understood,
  onIntentReady,
  onRulesChange,
  onCheck,
}: IntentComposerProps) {
  const [input, setInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [editing, setEditing] = useState(false);
  const { notify } = useToast();
  const busy = parsing || loading;

  const submit = async (raw: string) => {
    const message = raw.trim();
    if (busy) return;
    if (!message) {
      onCheck();
      return;
    }

    setParsing(true);
    try {
      const intent = await requestIntent(message);
      setInput("");
      onIntentReady(intent);
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "Could not read your request",
      );
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-[1.2rem] font-semibold tracking-[-0.02em] text-[#f5fbfd] sm:text-[1.35rem]">
          {hasResult ? "Change your request" : "Where do you want to put your USDC?"}
        </h2>
        <p className="m-0 mt-1 text-[0.88rem] text-slate-400">
          Say it in your own words. We check live IXS vaults before you sign
          anything.
        </p>
      </div>

      <form
        data-agent-avoid
        className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(input);
        }}
      >
        <input
          id="intent-input"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-emerald-200/20 bg-black/30 px-3.5 py-2.5 text-[0.95rem] text-[#f5fbfd] outline-none transition-[border-color] placeholder:text-slate-500 focus:border-emerald-200/45"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={500}
          placeholder="e.g. 500 USDC, no KYC, instant withdrawals"
          disabled={busy}
          aria-label="What do you want to deposit?"
        />
        <button type="submit" className={btnPrimary} disabled={busy}>
          <IconSearch className="h-4 w-4 shrink-0" />
          {parsing ? "Reading..." : loading ? "Checking..." : "Check my entry"}
        </button>
      </form>

      {!hasResult ? (
        <div data-agent-avoid className="flex flex-wrap gap-2">
          <span className="self-center text-[0.75rem] text-slate-500">Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="min-h-9 cursor-pointer rounded-full border border-emerald-200/15 bg-white/[0.03] px-3 py-1.5 text-[0.78rem] text-slate-300 transition-[border-color,color] touch-manipulation hover:border-emerald-200/35 hover:text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void submit(example)}
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}

      <div data-agent-avoid className="rounded-xl border border-emerald-200/10 bg-white/[0.02] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-[0.75rem] text-slate-500">
            {understood ? "We understood:" : "Your rules:"}
          </span>
          {describeRules(mandate).map((rule) => (
            <span
              key={rule}
              className="rounded-full border border-emerald-200/20 bg-emerald-200/[0.06] px-2.5 py-0.5 text-[0.75rem] text-emerald-100/90"
            >
              {rule}
            </span>
          ))}
          <button
            type="button"
            className="ml-auto min-h-8 cursor-pointer rounded-lg px-2 text-[0.78rem] font-medium text-cyan-200/80 underline-offset-2 touch-manipulation hover:text-cyan-100 hover:underline"
            onClick={() => setEditing((value) => !value)}
            aria-expanded={editing}
            aria-controls="rules-editor"
          >
            {editing ? "Done" : "Edit rules"}
          </button>
        </div>
        {editing ? (
          <div id="rules-editor" className="mt-3">
            <RulesEditor value={mandate} onChange={onRulesChange} disabled={parsing} />
            <p className="m-0 mt-2 text-[0.72rem] text-slate-500">
              {hasResult
                ? "Changes re-check the vaults automatically."
                : "Press Check my entry when you are ready."}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
