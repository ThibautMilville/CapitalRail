"use client";

type JudgeDemoBarProps = {
  stage: 0 | 1 | 2 | 3;
  loading: boolean;
  onStart: () => void;
};

const STEPS = [
  "Check Avalanche: WAIT (deposit limit 0)",
  "Try BSC instead: GO",
  "Connect and sign the deposit steps",
];

export function JudgeDemoBar({ stage, loading, onStart }: JudgeDemoBarProps) {
  return (
    <section
      aria-label="Judge demo"
      className="flex flex-col gap-3 rounded-2xl border border-cyan-200/25 bg-cyan-200/[0.04] p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4"
    >
      <div className="min-w-0">
        <p className="m-0 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-cyan-200/80">
          Judge demo
        </p>
        <ol className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0 sm:flex-row sm:flex-wrap sm:gap-x-4">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className={`text-[0.8rem] ${
                index < stage
                  ? "text-emerald-200"
                  : index === stage
                    ? "font-semibold text-slate-100"
                    : "text-slate-500"
              }`}
            >
              {index < stage ? "✓ " : `${index + 1}. `}
              {step}
            </li>
          ))}
        </ol>
      </div>
      {stage === 0 ? (
        <button
          type="button"
          onClick={onStart}
          disabled={loading}
          className="min-h-11 shrink-0 cursor-pointer rounded-xl border border-cyan-200/40 bg-cyan-200/[0.12] px-4 py-2 text-[0.85rem] font-semibold text-cyan-50 transition-[filter,opacity] touch-manipulation hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Checking..." : "Start demo"}
        </button>
      ) : null}
    </section>
  );
}
