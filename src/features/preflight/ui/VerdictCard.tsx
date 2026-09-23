"use client";

import { preflightCurl } from "@/features/preflight/lib/api-snippet";
import type { MandateValues } from "@/features/preflight/lib/mandate";
import type { PreflightResponse } from "@/features/preflight/lib/types";
import {
  buildVerdict,
  type VerdictAction,
} from "@/features/preflight/lib/verdict";
import { IconCopy, IconRefresh, IconSpark } from "@/shared/ui/icons";
import { useToast } from "@/shared/ui/Toast";

type VerdictCardProps = {
  result: PreflightResponse;
  mandate: MandateValues;
  loading: boolean;
  onAction: (action: VerdictAction) => void;
  onAskWhy: () => void;
  onShowReasoning: () => void;
  /** Action id to spotlight (judge demo). */
  spotlightActionId?: string | null;
};

const TONE = {
  go: {
    badge: "border-emerald-300/60 bg-emerald-300/15 text-emerald-200",
    ring: "border-emerald-300/35 shadow-[0_0_0_1px_rgba(110,231,183,0.12),0_18px_48px_rgba(0,0,0,0.28)]",
    dot: "bg-emerald-300",
    label: "GO",
  },
  wait: {
    badge: "border-amber-200/60 bg-amber-200/10 text-amber-100",
    ring: "border-amber-200/30",
    dot: "bg-amber-200",
    label: "WAIT",
  },
  nogo: {
    badge: "border-rose-300/60 bg-rose-300/10 text-rose-200",
    ring: "border-rose-300/30",
    dot: "bg-rose-300",
    label: "NO-GO",
  },
} as const;

const btnPrimary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200/40 bg-emerald-300/[0.16] px-4 py-2 text-[0.86rem] font-semibold text-emerald-50 transition-[filter,opacity] touch-manipulation hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200/15 bg-white/[0.03] px-4 py-2 text-[0.84rem] text-slate-200 transition-[border-color] touch-manipulation hover:border-emerald-200/35 disabled:cursor-not-allowed disabled:opacity-50";
const linkBtn =
  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-1 text-[0.8rem] font-medium text-cyan-200/80 underline-offset-2 touch-manipulation hover:text-cyan-100 hover:underline";

const SEVERITY_DOT = {
  info: "bg-cyan-200/70",
  caution: "bg-amber-200",
  high: "bg-rose-300",
} as const;

export function VerdictCard({
  result,
  mandate,
  loading,
  onAction,
  onAskWhy,
  onShowReasoning,
  spotlightActionId,
}: VerdictCardProps) {
  const view = buildVerdict(result, mandate);
  const tone = TONE[view.tone];
  const { notify } = useToast();
  const focusId = result.selectedVaultId;
  const riskNotes = (result.riskNotes ?? [])
    .filter((note) =>
      focusId ? note.vaultId === focusId : note.severity !== "info",
    )
    .slice(0, 3);

  const copyApiCall = () => {
    const snippet = preflightCurl(mandate, window.location.origin);
    void navigator.clipboard
      .writeText(snippet)
      .then(() =>
        notify(
          "success",
          "API call copied - paste in a terminal or agent. See #agents / openapi.yaml.",
        ),
      )
      .catch(() => notify("error", "Could not copy to the clipboard."));
  };

  return (
    <section
      id="verdict"
      aria-live="polite"
      aria-busy={loading}
      className={`relative scroll-mt-28 rounded-2xl border bg-[#06171e]/90 p-4 backdrop-blur-xl transition-opacity sm:p-5 ${tone.ring} ${loading ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.72rem] font-semibold tracking-wide ${tone.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
          {tone.label}
        </span>
        <button
          type="button"
          onClick={onShowReasoning}
          className="rounded-full border border-emerald-200/20 px-2.5 py-0.5 font-mono text-[0.64rem] tracking-[0.02em] text-emerald-200/75 transition-colors hover:border-emerald-200/40 hover:text-white"
          title="Rules are code, judgment is SERV. Open the reasoning trace"
        >
          Powered by SERV Reasoning
        </button>
        {result.trace.guard.applied ? (
          <span className="rounded-full border border-rose-300/30 px-2.5 py-0.5 font-mono text-[0.66rem] text-rose-200/90">
            Safety override applied
          </span>
        ) : null}
        {loading ? (
          <span className="font-mono text-[0.68rem] text-cyan-200/80">Updating...</span>
        ) : null}
      </div>

      <h2 className="m-0 mt-3 text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] text-[#f5fbfd] sm:text-[1.8rem]">
        {view.headline}
      </h2>
      <p className="m-0 mt-1.5 text-[0.95rem] leading-snug text-slate-300">
        {view.summary}
      </p>

      {view.reasons.length > 0 ? (
        <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
          {view.reasons.map((reason) => (
            <li key={reason} className="flex gap-2 text-[0.88rem] leading-snug text-slate-400">
              <span className={`mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot} opacity-70`} aria-hidden />
              {reason}
            </li>
          ))}
        </ul>
      ) : null}

      {riskNotes.length > 0 ? (
        <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
          <p className="m-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
            Worth knowing
          </p>
          <ul className="m-0 mt-1.5 list-none space-y-1 p-0">
            {riskNotes.map((note) => (
              <li
                key={`${note.vaultId ?? "all"}-${note.category}-${note.note}`}
                className="flex gap-2 text-[0.82rem] leading-snug text-slate-300"
              >
                <span
                  className={`mt-[0.42rem] h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[note.severity]}`}
                  aria-hidden
                />
                <span>
                  {note.note}
                  <span className="sr-only"> ({note.severity})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.preview && view.tone === "go" ? (
        <p className="m-0 mt-3 rounded-xl border border-cyan-200/15 bg-cyan-200/[0.04] px-3 py-2 text-[0.8rem] text-cyan-100/85">
          Preview with public data. Connect your wallet for a personal check
          (balance and whitelist) before anything is prepared.
        </p>
      ) : null}

      {view.actions.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {view.actions.map((action) => {
            const primary = "primary" in action && action.primary;
            const spotlight = spotlightActionId === action.id;
            const showIcon = primary || action.kind === "recheck";
            return (
              <button
                key={action.id}
                type="button"
                disabled={loading}
                onClick={() => onAction(action)}
                className={`${primary ? btnPrimary : btnSecondary} ${spotlight ? "cr-spotlight" : ""}`}
              >
                {showIcon ? (
                  action.kind === "recheck" ? (
                    <IconRefresh className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <IconSpark className="h-3.5 w-3.5 shrink-0" />
                  )
                ) : null}
                {action.label}
                {action.kind === "notify" ? (
                  <span className="ml-0.5 rounded border border-amber-200/35 px-1 font-mono text-[0.6rem] uppercase text-amber-200/90">
                    Soon
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" className={linkBtn} onClick={onAskWhy}>
          Why this decision?
        </button>
        <button type="button" className={linkBtn} onClick={onShowReasoning}>
          Show reasoning
        </button>
        <button
          type="button"
          className={linkBtn}
          onClick={copyApiCall}
          title="Copy curl for POST /api/preflight (OpenAPI /openapi.yaml, section #agents)"
        >
          <IconCopy className="h-3.5 w-3.5 shrink-0" />
          Copy as API call
        </button>
      </div>
    </section>
  );
}
