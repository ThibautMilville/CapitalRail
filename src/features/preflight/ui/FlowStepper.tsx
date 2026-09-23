"use client";

export type FlowStep = 0 | 1 | 2 | 3;

const STEPS = ["Tell us", "We check", "Decision", "Review & sign"] as const;

type FlowStepperProps = {
  current: FlowStep;
  done?: boolean;
};

export function FlowStepper({ current, done }: FlowStepperProps) {
  return (
    <ol
      className="m-0 grid list-none grid-cols-4 gap-1.5 p-0 sm:gap-2"
      aria-label="Progress"
    >
      {STEPS.map((label, index) => {
        const isCurrent = index === current && !done;
        const isDone = done || index < current;
        return (
          <li
            key={label}
            aria-current={isCurrent ? "step" : undefined}
            className="min-w-0"
          >
            <div
              className={`h-1 rounded-full transition-colors duration-500 ${
                isCurrent
                  ? "bg-gradient-to-r from-emerald-300 to-cyan-300"
                  : isDone
                    ? "bg-emerald-300/50"
                    : "bg-white/10"
              }`}
            />
            <div className="mt-2 flex min-w-0 items-center gap-1.5">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[0.62rem] ${
                  isCurrent
                    ? "border-emerald-300/70 bg-emerald-300/20 text-emerald-100"
                    : isDone
                      ? "border-emerald-300/40 text-emerald-200/80"
                      : "border-white/15 text-slate-500"
                }`}
                aria-hidden
              >
                {isDone && !isCurrent ? "✓" : index + 1}
              </span>
              <span
                className={`truncate text-[0.7rem] sm:text-[0.8rem] ${
                  isCurrent
                    ? "font-semibold text-slate-100"
                    : isDone
                      ? "text-slate-300"
                      : "text-slate-500"
                }`}
              >
                {label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
