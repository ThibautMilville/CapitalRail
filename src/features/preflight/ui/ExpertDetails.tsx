"use client";

import { useState, type ReactNode } from "react";
import type { PreflightResponse } from "@/features/preflight/lib/types";
import { ContrastPanel } from "@/features/preflight/ui/ContrastPanel";
import { EvidenceBoard } from "@/features/preflight/ui/EvidenceBoard";
import { PipelineDiagram } from "@/features/preflight/ui/PipelineDiagram";
import { RailBoard } from "@/features/preflight/ui/RailBoard";
import { ReasoningTrace } from "@/features/preflight/ui/ReasoningTrace";
import type { ReasoningStepTrace } from "@/shared/serv/trace-types";

export type ExpertTab = "trace" | "vaults" | "evidence" | "contrast" | "pipeline" | "proof";

const TABS: { id: ExpertTab; label: string }[] = [
  { id: "trace", label: "SERV trace" },
  { id: "vaults", label: "All vaults" },
  { id: "evidence", label: "Evidence" },
  { id: "contrast", label: "Naive agent vs CapitalRail" },
  { id: "pipeline", label: "Pipeline" },
  { id: "proof", label: "Memo & proof" },
];

type ExpertDetailsProps = {
  open: boolean;
  onToggle: () => void;
  tab: ExpertTab;
  onTabChange: (tab: ExpertTab) => void;
  result: PreflightResponse;
  traceSteps: ReasoningStepTrace[];
  loading: boolean;
};

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="text-slate-100">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="font-mono text-[0.78em] text-cyan-100/90">{part.slice(1, -1)}</code>;
    }
    if (part.length > 2 && part.startsWith("_") && part.endsWith("_")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

/** Minimal renderer for the model memo: headings, bullets, bold, code. */
function MemoText({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-1.5 text-[0.86rem] leading-relaxed text-slate-300">
      {markdown.split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("#")) {
          return (
            <p key={index} className="m-0 pt-1 font-semibold text-slate-100">
              {inline(trimmed.replace(/^#+\s*/, ""))}
            </p>
          );
        }
        if (/^[-*]\s/.test(trimmed)) {
          return (
            <p key={index} className="m-0 pl-3 before:mr-2 before:content-['-']">
              {inline(trimmed.slice(2))}
            </p>
          );
        }
        return <p key={index} className="m-0">{inline(trimmed)}</p>;
      })}
    </div>
  );
}

export function ExpertDetails({
  open,
  onToggle,
  tab,
  onTabChange,
  result,
  traceSteps,
  loading,
}: ExpertDetailsProps) {
  const [copied, setCopied] = useState(false);

  return (
    <section
      id="experts"
      className="scroll-mt-28 rounded-2xl border border-emerald-200/12 bg-[#041219]/80 backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="experts-panel"
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left touch-manipulation sm:px-5"
      >
        <span className="min-w-0">
          <span className="block text-[0.95rem] font-semibold text-slate-100">
            Details for experts
          </span>
          <span className="block text-[0.76rem] text-slate-500">
            SERV reasoning trace, every vault, raw evidence, naive agent comparison
          </span>
        </span>
        <span
          aria-hidden
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-emerald-200/20 text-emerald-200 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path d="M2 4.5 L6 8.5 L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open ? (
        <div id="experts-panel" className="border-t border-emerald-200/10 p-3 sm:p-4">
          <div
            role="tablist"
            aria-label="Expert details"
            className="scrollbar-thin -mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1"
          >
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => onTabChange(item.id)}
                className={`min-h-9 shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-[0.8rem] transition-colors touch-manipulation ${
                  tab === item.id
                    ? "bg-emerald-200/[0.12] font-semibold text-emerald-100"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === "trace" ? (
              <ReasoningTrace
                steps={traceSteps}
                guard={result.trace.guard}
                disagreements={result.disagreements ?? []}
              />
            ) : null}
            {tab === "vaults" ? (
              <RailBoard rails={result.rails} selectedVaultId={result.selectedVaultId} />
            ) : null}
            {tab === "evidence" ? <EvidenceBoard result={result} /> : null}
            {tab === "contrast" ? (
              <ContrastPanel
                rails={result.rails}
                decision={result.decision}
                selectedVaultId={result.selectedVaultId}
              />
            ) : null}
            {tab === "pipeline" ? <PipelineDiagram loading={loading} result={result} /> : null}
            {tab === "proof" ? (
              <div className="space-y-3 rounded-2xl border border-emerald-200/15 bg-[#06171e]/85 p-4 sm:p-5">
                <div>
                  <p className="m-0 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-cyan-200/70">
                    Decision memo ({result.reasoning === "serv" ? "SERV" : "fallback"}) · {result.decision}
                  </p>
                  <div className="mt-2">
                    <MemoText markdown={result.memoMarkdown} />
                  </div>
                </div>
                {result.userNextSteps.length > 0 ? (
                  <div>
                    <p className="m-0 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-cyan-200/70">
                      Next steps
                    </p>
                    <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
                      {result.userNextSteps.map((step) => (
                        <li
                          key={step}
                          className="flex gap-2 text-[0.86rem] leading-snug text-slate-300"
                        >
                          <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200/50" aria-hidden />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <p className="m-0 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-cyan-200/70">
                    Snapshot proof
                  </p>
                  <p className="m-0 mt-1.5 text-[0.8rem] text-slate-400">
                    SHA-256 of the scanned vault facts and your rules. Same
                    inputs, same hash.
                  </p>
                  <p className="m-0 mt-1.5 break-all font-mono text-[0.72rem] text-slate-300">
                    {result.snapshotHash}
                  </p>
                  <p className="m-0 mt-1 font-mono text-[0.68rem] text-slate-500">
                    attested {result.attestedAt}
                    {result.preview ? " · preview (demo wallet)" : ` · wallet ${result.walletAddress}`}
                  </p>
                  <button
                    type="button"
                    className="mt-2 cursor-pointer text-[0.76rem] text-cyan-200/80 hover:text-cyan-100"
                    onClick={() => {
                      void navigator.clipboard.writeText(result.snapshotHash).then(() => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1500);
                      });
                    }}
                  >
                    {copied ? "Copied" : "Copy hash"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
