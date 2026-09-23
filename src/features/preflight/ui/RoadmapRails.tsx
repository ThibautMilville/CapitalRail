"use client";

import { useToast } from "@/shared/ui/Toast";

type RoadmapTeaser = {
  id: string;
  name: string;
  category: string;
  blurb: string;
  /** Substrings matched against live vault names - hide teaser if already listed. */
  liveNameHints: string[];
};

/**
 * IXS marketing products not yet on Agent Rail.
 * Do not invent vault IDs, APY, or TVL. Never wire deposit here.
 * High Yield Bond variants are already live (IXHYB / ixv1) - do not teaser them.
 */
const ROADMAP_TEASERS: RoadmapTeaser[] = [
  {
    id: "private-credit",
    name: "Private Credit",
    category: "Credit",
    blurb:
      "IXS marketing product. CapitalRail will check fit, capacity and withdrawals once IXS Agent Rail lists it.",
    liveNameHints: ["private credit"],
  },
  {
    id: "btc-real-yield",
    name: "BTC Real Yield",
    category: "BTC",
    blurb:
      "IXS marketing product. CapitalRail will gate deposits only when IXS exposes an executable vault - no invented IDs.",
    liveNameHints: ["btc real yield", "bitcoin real yield"],
  },
];

type RoadmapRailsProps = {
  /** Live vault display names from the current scan - used to avoid duplicating live products. */
  liveRailNames?: string[];
};

function isAlreadyLive(teaser: RoadmapTeaser, liveNames: string[]): boolean {
  const haystack = liveNames.map((name) => name.toLowerCase());
  return teaser.liveNameHints.some((hint) =>
    haystack.some((name) => name.includes(hint)),
  );
}

const TOAST_MSG =
  "Not on Agent Rail yet - CapitalRail will gate these when live";

export function RoadmapRails({ liveRailNames = [] }: RoadmapRailsProps) {
  const { notify } = useToast();

  const teasers = ROADMAP_TEASERS.filter(
    (teaser) => !isAlreadyLive(teaser, liveRailNames),
  );

  if (!teasers.length) return null;

  const onTeaserActivate = () => {
    notify("info", TOAST_MSG, 4200);
  };

  return (
    <section
      id="roadmap-rails"
      aria-label="Coming next on IXS"
      className="rounded-2xl border border-dashed border-slate-500/35 bg-[#041018]/70 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">
          Roadmap
        </p>
        <span className="rounded border border-amber-200/35 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide text-amber-200/90">
          Coming soon
        </span>
      </div>
      <h2 className="m-0 mt-1 mb-1.5 text-lg font-semibold tracking-[-0.02em] text-slate-200 sm:text-xl">
        Coming next on IXS
      </h2>
      <p className="m-0 mb-4 max-w-prose text-[0.82rem] leading-snug text-slate-500">
        Not executable via Agent Rail yet. These are IXS marketing products -
        CapitalRail will check them when IXS exposes vaults. No APY, TVL, or
        deposit actions here.
      </p>

      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {teasers.map((teaser) => (
          <li key={teaser.id}>
            <button
              type="button"
              onClick={onTeaserActivate}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onTeaserActivate();
                }
              }}
              className="group flex w-full cursor-pointer flex-col rounded-xl border border-slate-500/25 bg-white/[0.02] px-3.5 py-3.5 text-left transition-[border-color,background-color] duration-200 touch-manipulation hover:border-amber-200/30 hover:bg-amber-200/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/50"
              aria-label={`${teaser.name} - Coming soon, not executable via Agent Rail yet`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-amber-200/40 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide text-amber-200/85">
                  Coming soon
                </span>
                <span className="font-mono text-[0.68rem] uppercase tracking-wider text-slate-600">
                  {teaser.category}
                </span>
              </div>
              <span className="mt-2 text-[0.98rem] font-medium tracking-[-0.02em] text-slate-200 group-hover:text-[#f5fbfd]">
                {teaser.name}
              </span>
              <span className="mt-1.5 text-[0.78rem] leading-snug text-slate-500">
                {teaser.blurb}
              </span>
              <span className="mt-3 font-mono text-[0.68rem] text-slate-600">
                Not executable via Agent Rail yet
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
