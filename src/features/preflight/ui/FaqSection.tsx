"use client";

import { useId, useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is CapitalRail?",
    answer:
      "An entry preflight agent for IXS vaults. Before any capital moves, it scans the live IXS vaults, decides GO / WAIT / NO-GO with explicit reasons, and only prepares unsigned transactions when capacity is real.",
  },
  {
    question: "What is SERV Reasoning and why not just an LLM?",
    answer:
      "Rules are code, judgment is SERV. Deterministic code enforces the hard rules; SERV Reasoning does what code cannot: read your intent, write risk notes grounded in the IXS facts (delayed exits, maturity, small vault size, KYC onboarding), rank the vaults that pass, write the memo and challenge the result as an independent verifier. Each step has a strict JSON schema, is validated and traced, and disagreements with the rules are shown, not hidden.",
  },
  {
    question: "Does CapitalRail custody my funds?",
    answer:
      "No. Neither CapitalRail nor SERV ever holds funds or keys, and nothing is signed server-side. The app only reads public vault data and returns a decision plus unsigned deposit steps.",
  },
  {
    question: "Why was Avalanche refused, and what does WAIT mean?",
    answer:
      "The open Avalanche vault currently has a deposit limit of 0, so a deposit cannot go through. When no vault fits but capacity may come back on your chosen chain, the decision is WAIT. NO-GO means no vault fits your rules for other reasons (for example whitelist, withdrawal speed or balance).",
  },
  {
    question: "What does KYC / whitelist mean here?",
    answer:
      "Some IXS vaults only accept whitelisted wallets, which requires completing the issuer's KYC onboarding. If \"Allow KYC vaults\" is off, CapitalRail excludes whitelist-only vaults unless your wallet is already whitelisted.",
  },
  {
    question: "Which chains and assets are supported?",
    answer:
      "The 4 live IX High Yield Bond USDC vaults exposed by IXS: an open and a whitelist vault on BSC, and an open and a whitelist vault on Avalanche. Other IXS products appear as roadmap items only, with no deposit action.",
  },
  {
    question: "What are the deposit steps and how do I sign them?",
    answer:
      "On GO with a connected wallet, IXS tools build two unsigned transactions for the selected vault: approve, then deposit. You sign them in that order in your own wallet, and get an explorer link once confirmed. CapitalRail never broadcasts anything for you.",
  },
  {
    question: "Is this financial advice?",
    answer:
      "No. CapitalRail is a preflight check on vault access and capacity, not an investment recommendation. Decisions can be wrong or become stale as on-chain state changes, so always review the evidence and the transactions before signing.",
  },
];

export function FaqSection() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-24 rounded-2xl border border-emerald-200/15 bg-[#06171e]/80 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-5 md:p-6"
    >
      <p className="section-kicker m-0">FAQ</p>
      <h2
        id="faq-title"
        className="m-0 mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-100 sm:text-xl"
      >
        Frequently asked questions
      </h2>

      <ul className="m-0 mt-4 list-none divide-y divide-cyan-100/10 overflow-hidden rounded-xl border border-cyan-100/10 bg-white/[0.015] p-0">
        {FAQ_ITEMS.map((item, index) => {
          const open = openIndex === index;
          const buttonId = `${baseId}-q${index}`;
          const panelId = `${baseId}-a${index}`;
          return (
            <li key={item.question}>
              <h3 className="m-0">
                <button
                  id={buttonId}
                  type="button"
                  onClick={() => setOpenIndex(open ? null : index)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-3.5 py-3 text-left text-[0.9rem] font-medium tracking-[-0.01em] text-slate-200 transition-colors touch-manipulation hover:bg-white/[0.03] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-300/60 sm:px-4"
                >
                  <span>{item.question}</span>
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border font-mono text-sm transition-[transform,border-color,color] duration-300 motion-reduce:transition-none ${
                      open
                        ? "rotate-45 border-emerald-200/40 text-emerald-200"
                        : "border-cyan-100/15 text-cyan-200/70"
                    }`}
                  >
                    +
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                aria-hidden={!open}
                className={`how-it-works-collapse ${open ? "is-open" : ""}`}
              >
                <div className="how-it-works-collapse-inner">
                  <p className="m-0 px-3.5 pb-4 text-[0.84rem] leading-relaxed text-slate-400 sm:px-4">
                    {item.answer}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
