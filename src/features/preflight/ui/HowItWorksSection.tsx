type Step = {
  title: string;
  body: string;
  tag: string;
};

const STEPS: Step[] = [
  {
    title: "Describe your intent",
    body: "Type what you want to deposit in your own words (amount, chain, KYC, withdrawal speed), or edit your rules by hand.",
    tag: "Chat",
  },
  {
    title: "SERV turns it into your rules",
    body: "SERV Reasoning turns your sentence into typed rules validated against a schema. You see what was understood and can edit it.",
    tag: "SERV",
  },
  {
    title: "Scan the live IXS vaults",
    body: "CapitalRail reads the 4 live IX High Yield Bond USDC vaults on BSC and Avalanche through the IXS REST API and MCP tools: access mode, deposit limit, whitelist status and settlement mode.",
    tag: "IXS REST + MCP",
  },
  {
    title: "Rules are code, judgment is SERV",
    body: "Code applies the hard rules (chain, capacity, KYC, withdrawal speed, balance) and sets GO / WAIT / NO-GO. SERV Reasoning then writes fact-grounded risk notes, cross-checks the rules, ranks the vaults that pass and independently verifies the memo. Every step is schema-validated and traced.",
    tag: "Code + SERV Reasoning",
  },
  {
    title: "Code-level safety override",
    body: "Deterministic checks run again after the model. A vault with a deposit limit of 0 or an unmet whitelist can never be selected, whatever the model says. SERV can veto an entry, never unlock one.",
    tag: "Guardrail",
  },
  {
    title: "Review and sign yourself",
    body: "Only on GO, and only for your connected wallet, IXS tools build unsigned approve + deposit steps. You sign them in order in your own wallet. Nothing is signed server-side.",
    tag: "Deposit steps",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="scroll-mt-24 rounded-2xl border border-emerald-200/15 bg-[#06171e]/80 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-5 md:p-6"
    >
      <p className="section-kicker m-0">How it works</p>
      <h2
        id="how-title"
        className="m-0 mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-100 sm:text-xl"
      >
        From a sentence to signable deposit steps, in six checked steps
      </h2>
      <p className="m-0 mt-1.5 max-w-prose text-[0.85rem] leading-snug text-slate-400">
        CapitalRail is a preflight: it answers &quot;can I actually enter this
        vault right now?&quot; before any capital moves.
      </p>

      <ol className="m-0 mt-5 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="relative flex flex-col rounded-xl border border-cyan-100/10 bg-white/[0.02] px-3.5 py-3.5 transition-colors duration-200 hover:border-emerald-200/25"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-emerald-200/30 bg-emerald-200/[0.08] font-mono text-[0.72rem] font-semibold text-emerald-100">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="truncate rounded border border-cyan-200/20 px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-cyan-200/75">
                {step.tag}
              </span>
            </div>
            <h3 className="m-0 mt-3 text-[0.98rem] font-medium tracking-[-0.02em] text-slate-100">
              {step.title}
            </h3>
            <p className="m-0 mt-1.5 text-[0.8rem] leading-snug text-slate-400">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
