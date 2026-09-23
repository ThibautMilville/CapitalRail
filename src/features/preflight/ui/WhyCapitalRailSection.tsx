type TrustPoint = {
  title: string;
  body: string;
};

const TRUST_POINTS: TrustPoint[] = [
  {
    title: "No custody",
    body: "SERV and CapitalRail never hold funds. They read public vault data and return a decision.",
  },
  {
    title: "Nothing signed server-side",
    body: "Deposit steps are unsigned and built for your connected wallet only. Only you can sign, after review.",
  },
  {
    title: "Attested snapshot",
    body: "Each decision carries a snapshot hash and an attestation time, so you know exactly which IXS state it was based on.",
  },
  {
    title: "Refuses instead of guessing",
    body: "If capacity is not real, CapitalRail says WAIT or NO-GO and explains why, rather than proposing a transaction that will fail.",
  },
];

export function WhyCapitalRailSection() {
  return (
    <section
      id="why"
      aria-labelledby="why-title"
      className="scroll-mt-24 rounded-2xl border border-cyan-100/12 bg-[#06171e]/80 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-5 md:p-6"
    >
      <p className="section-kicker m-0">Why CapitalRail</p>
      <h2
        id="why-title"
        className="m-0 mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-100 sm:text-xl"
      >
        A naive agent would deposit. CapitalRail checks first.
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border border-rose-300/20 bg-rose-300/[0.04] p-3.5 sm:p-4">
          <p className="m-0 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-rose-200/80">
            The failure case
          </p>
          <p className="m-0 mt-2 text-[0.85rem] leading-relaxed text-slate-300">
            The Avalanche IX High Yield Bond USDC vault is listed as open, but
            its deposit limit is{" "}
            <span className="font-mono text-rose-200">0</span>. An agent that
            only reads &quot;open&quot; would build a deposit that fails or gets
            stuck.
          </p>
          <p className="m-0 mt-2 text-[0.85rem] leading-relaxed text-slate-300">
            CapitalRail reads the real capacity, flags{" "}
            <span className="font-mono text-[0.78rem] text-amber-200">
              DEPOSIT_LIMIT_ZERO
            </span>
            , and refuses that rail. A code-level override enforces it even if
            the model disagrees.
          </p>
        </div>

        <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          {TRUST_POINTS.map((point) => (
            <li
              key={point.title}
              className="rounded-xl border border-emerald-200/12 bg-white/[0.02] px-3.5 py-3"
            >
              <p className="m-0 flex items-center gap-2 text-[0.9rem] font-medium tracking-[-0.01em] text-slate-100">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.6)]"
                />
                {point.title}
              </p>
              <p className="m-0 mt-1 text-[0.78rem] leading-snug text-slate-400">
                {point.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
