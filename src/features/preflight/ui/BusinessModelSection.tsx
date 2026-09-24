type Offer = {
  title: string;
  who: string;
  body: string;
  pricing: string;
};

const OFFERS: Offer[] = [
  {
    title: "Preflight API",
    who: "AI agents and wallets",
    body: "One POST /api/preflight call before any deposit returns GO / WAIT / NO-GO, reasons, risk notes and an unsigned tx pack. Agents stop sending transactions that fail.",
    pricing: "Free tier, then pay-per-check",
  },
  {
    title: "\"Can I enter?\" widget + blocked-demand dashboard",
    who: "RWA issuers such as IXS",
    body: "A white-label widget for vault pages, plus a dashboard of demand blocked by capacity, KYC or withdrawal rules, so the issuer sees which limit to raise or which onboarding to push.",
    pricing: "Monthly license per issuer",
  },
  {
    title: "Capacity alerts",
    who: "Allocators on WAIT",
    body: "When a vault that fits your rules reports MCP deposit limit 0 (often NAV stale - not closed forever), get notified when build succeeds again, with a fresh preflight attached.",
    pricing: "Subscription",
  },
  {
    title: "Referral on validated deposits",
    who: "Partner vaults",
    body: "A routing fee only on deposits that passed the preflight and settled on-chain.",
    pricing: "Subject to an agreement with IXS",
  },
];

export type InstanceStatsView = {
  failedDepositsAvoided: number;
  preflights: number;
  startedAt: string;
};

type BusinessModelSectionProps = {
  stats: InstanceStatsView | null;
};

function formatSince(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BusinessModelSection({ stats }: BusinessModelSectionProps) {
  return (
    <section
      id="business"
      aria-labelledby="business-title"
      className="scroll-mt-24 rounded-2xl border border-cyan-100/12 bg-[#06171e]/80 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-5 md:p-6"
    >
      <p className="section-kicker m-0">Business model</p>
      <h2
        id="business-title"
        className="m-0 mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-100 sm:text-xl"
      >
        Every failed deposit avoided is worth something.
      </h2>
      <div
        className="mt-3 w-full rounded-xl border border-emerald-200/15 bg-emerald-200/[0.04] px-3.5 py-2"
        aria-live="polite"
      >
        <p className="m-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-emerald-200/70">
          Failed deposits avoided on this instance
        </p>
        <p className="m-0 mt-0.5 text-[1.35rem] font-semibold leading-none text-emerald-100">
          {stats ? stats.failedDepositsAvoided.toLocaleString("en-US") : "-"}
        </p>
        <p className="m-0 mt-1 font-mono text-[0.62rem] text-slate-500">
          {stats
            ? `WAIT + NO-GO served, out of ${stats.preflights} checks since server start (${formatSince(stats.startedAt)})`
            : "Real count from this server, since start"}
        </p>
      </div>

      <ul className="m-0 mt-4 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2">
        {OFFERS.map((offer, index) => (
          <li
            key={offer.title}
            className="flex flex-col rounded-xl border border-emerald-200/12 bg-white/[0.02] px-3.5 py-3"
          >
            <p className="m-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-cyan-200/70">
              {index + 1} · {offer.who}
            </p>
            <p className="m-0 mt-1 text-[0.92rem] font-medium tracking-[-0.01em] text-slate-100">
              {offer.title}
            </p>
            <p className="m-0 mt-1 flex-1 text-[0.8rem] leading-snug text-slate-400">
              {offer.body}
            </p>
            <p className="m-0 mt-2 text-[0.74rem] font-medium text-emerald-200/85">
              {offer.pricing}
            </p>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-3 text-[0.72rem] text-slate-500">
        Pricing models, not live revenue. The counter above only counts real
        results served by this server; it resets on restart.
      </p>
    </section>
  );
}
