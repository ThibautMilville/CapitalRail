import {
  PRODUCT_FACTS,
  type AgentAnswerOutput,
  type AgentContext,
  type AgentRail,
} from "./agent-schema";

type Patch = NonNullable<AgentAnswerOutput["suggestedAction"]>["mandatePatch"];

const EMPTY_PATCH: Patch = {
  allowKyc: null,
  requireSyncSettlement: null,
  preferredChainId: null,
  amount: null,
};

const REASON_TEXT: Record<string, string> = {
  DEPOSIT_LIMIT_ZERO: "deposit capacity is 0 right now",
  WHITELIST_REQUIRED: "it needs whitelist/KYC for this wallet",
  SETTLEMENT_ASYNC_UNSUPPORTED_BY_MANDATE:
    "it settles async (ERC-7540) while the mandate requires sync",
  CHAIN_MISMATCH: "it is outside the chosen chain",
  BUILD_FAILED: "the deposit build failed",
  INSUFFICIENT_BALANCE: "the wallet holds less USDC than the amount",
  OK: "it is eligible but ranked lower",
};

const CHAIN_ALIASES: { chainId: number; pattern: RegExp }[] = [
  { chainId: 43114, pattern: /\bavax\b|\bavalanche\b/i },
  { chainId: 56, pattern: /\bbsc\b|\bbnb\b|\bbinance\b/i },
];

function reasonText(code: string): string {
  return REASON_TEXT[code] ?? code.toLowerCase().replace(/_/g, " ");
}

/** IXS rails share a product name, so label them by chain, settlement and access. */
function railLabel(rail: AgentRail): string {
  return `${rail.chainName} ${rail.settlement} ${rail.requiresWhitelist ? "whitelist" : "open-access"} rail`;
}

function railFact(rail: AgentRail): { vaultId: string; fact: string } {
  return {
    vaultId: rail.vaultId,
    fact: `${railLabel(rail)}: status=${rail.status}, reasonCodes=${rail.reasonCodes.join("|") || "none"}`,
  };
}

/** Every blocking reason for a rail: scan codes plus mandate conflicts. */
function blockingCodes(rail: AgentRail, context: AgentContext): string[] {
  const codes = rail.reasonCodes.filter((code) => code !== "OK");
  if (context.mandate.requireSyncSettlement && rail.settlement !== "sync") {
    codes.push("SETTLEMENT_ASYNC_UNSUPPORTED_BY_MANDATE");
  }
  if (codes.length === 0) {
    codes.push(rejectionFor(context, rail.vaultId)?.reasonCode ?? "OK");
  }
  return [...new Set(codes)];
}

function joinReasons(codes: string[]): string {
  const texts = codes.map(reasonText);
  return texts.length > 1
    ? `${texts.slice(0, -1).join(", ")} and ${texts[texts.length - 1]}`
    : (texts[0] ?? "");
}

function rejectionFor(context: AgentContext, vaultId: string) {
  return context.decision.rejected.find((item) => item.vaultId === vaultId);
}

function selectedRail(context: AgentContext) {
  return context.rails.find(
    (rail) => rail.vaultId === context.decision.selectedVaultId,
  );
}

function rerun(patch: Partial<Patch>): AgentAnswerOutput["suggestedAction"] {
  return { type: "rerun", mandatePatch: { ...EMPTY_PATCH, ...patch } };
}

function answerChain(context: AgentContext, chainId: number): AgentAnswerOutput {
  const rails = context.rails.filter((rail) => rail.chainId === chainId);
  const chainName = rails[0]?.chainName ?? (chainId === 56 ? "BSC" : "Avalanche");
  if (rails.length === 0) {
    return {
      answer: `The last scan returned no ${chainName} rail, so CapitalRail cannot route there.`,
      citedFacts: [],
      suggestedAction: null,
    };
  }

  const { mandate } = context;
  const selected = rails.find(
    (rail) => rail.vaultId === context.decision.selectedVaultId,
  );
  if (selected) {
    return {
      answer: `${chainName} is selected: the ${railLabel(selected)} is open and inside the mandate. ${context.decision.rationale}`,
      citedFacts: [railFact(selected)],
      suggestedAction: null,
    };
  }

  const reasons = rails.map((rail) => ({
    rail,
    codes: blockingCodes(rail, context),
  }));
  const sentence = reasons
    .map(({ rail, codes }) => `The ${railLabel(rail)} is not used because ${joinReasons(codes)}`)
    .join(". ");

  const chainPatch = chainId === 56 ? "56" : "43114";
  const all = (code: string) => reasons.every((item) => item.codes.includes(code));
  const some = (code: string) => reasons.some((item) => item.codes.includes(code));
  let suggestedAction: AgentAnswerOutput["suggestedAction"] = null;
  let hint = "";
  if (all("DEPOSIT_LIMIT_ZERO")) {
    hint = ` No mandate change can open ${chainName} while capacity is 0; rerun the preflight later.`;
  } else if (some("SETTLEMENT_ASYNC_UNSUPPORTED_BY_MANDATE") && mandate.requireSyncSettlement) {
    suggestedAction = rerun({ requireSyncSettlement: false, preferredChainId: chainPatch });
    hint = " You can rerun with async settlement allowed.";
  } else if (some("WHITELIST_REQUIRED") && !mandate.allowKyc) {
    suggestedAction = rerun({ allowKyc: true, preferredChainId: chainPatch });
    hint = " Allowing KYC only helps once this wallet is whitelisted.";
  } else if (some("CHAIN_MISMATCH") || some("OK")) {
    suggestedAction = rerun({ preferredChainId: chainPatch });
    hint = ` You can rerun preferring ${chainName}.`;
  }

  return {
    answer: `${sentence}.${hint}`,
    citedFacts: rails.slice(0, 5).map(railFact),
    suggestedAction,
  };
}

function answerKyc(context: AgentContext): AgentAnswerOutput {
  const gated = context.rails.filter((rail) => rail.requiresWhitelist);
  if (gated.length === 0) {
    return {
      answer: "No rail in the last scan requires KYC/whitelist, so allowing KYC would not change the decision.",
      citedFacts: [],
      suggestedAction: null,
    };
  }

  const whitelisted = gated.filter((rail) => rail.whitelistOk === true);
  const base = `${gated.length} rail(s) require whitelist/KYC; this wallet is whitelisted on ${whitelisted.length}.`;
  if (context.mandate.allowKyc) {
    return {
      answer: `${base} KYC is already allowed in the mandate; non-whitelisted rails stay gated until IXS onboarding is complete.`,
      citedFacts: gated.slice(0, 5).map(railFact),
      suggestedAction: null,
    };
  }

  return {
    answer: `${base} ${whitelisted.length > 0 ? "Allowing KYC would make the whitelisted rail(s) eligible." : "Allowing KYC keeps them gated until this wallet completes IXS whitelist onboarding, but you can rerun to compare."}`,
    citedFacts: gated.slice(0, 5).map(railFact),
    suggestedAction: rerun({ allowKyc: true }),
  };
}

function answerSettlement(context: AgentContext): AgentAnswerOutput {
  const asyncRails = context.rails.filter((rail) => rail.settlement !== "sync");
  if (asyncRails.length === 0) {
    return {
      answer: "Every rail in the last scan settles sync, so the settlement constraint does not filter anything.",
      citedFacts: [],
      suggestedAction: null,
    };
  }

  if (!context.mandate.requireSyncSettlement) {
    return {
      answer: `Async settlement is already allowed. ${asyncRails.length} rail(s) settle via ERC-7540 request/claim, meaning shares arrive after a later claim step.`,
      citedFacts: asyncRails.slice(0, 5).map(railFact),
      suggestedAction: rerun({ requireSyncSettlement: true }),
    };
  }

  return {
    answer: `The mandate requires sync settlement, so ${asyncRails.length} async ERC-7540 rail(s) are filtered out. Allowing async means a request now and a claim later.`,
    citedFacts: asyncRails.slice(0, 5).map(railFact),
    suggestedAction: rerun({ requireSyncSettlement: false }),
  };
}

function answerRejected(context: AgentContext): AgentAnswerOutput {
  const rejected = context.decision.rejected.filter((item) => item.reasonCode !== "OK");
  if (rejected.length === 0) {
    return {
      answer: "No rail was rejected for a blocking reason in the last preflight.",
      citedFacts: [],
      suggestedAction: null,
    };
  }

  const rails = new Map(context.rails.map((rail) => [rail.vaultId, rail]));
  return {
    answer: rejected
      .slice(0, 4)
      .map((item) => {
        const rail = rails.get(item.vaultId);
        return rail
          ? `${railLabel(rail)}: ${joinReasons(blockingCodes(rail, context))}`
          : `${item.vaultId}: ${reasonText(item.reasonCode)}`;
      })
      .join(". ")
      .concat("."),
    citedFacts: rejected.slice(0, 5).map((item) => ({
      vaultId: item.vaultId,
      fact: `${item.reasonCode} - ${item.explanation}`,
    })),
    suggestedAction: null,
  };
}

function answerSigning(context: AgentContext): AgentAnswerOutput {
  const selected = selectedRail(context);
  return {
    answer: context.decision.txPackReady && selected
      ? `CapitalRail never signs. The unsigned approve + deposit pack for the ${railLabel(selected)} is in the Transaction pack section; review it and sign in your own wallet.`
      : `CapitalRail never signs, and no transaction pack was built because the decision is ${context.decision.decision}. Change the mandate or wait for capacity, then rerun.`,
    citedFacts: selected ? [railFact(selected)] : [],
    suggestedAction: null,
  };
}

function answerAmount(context: AgentContext, amount: string): AgentAnswerOutput {
  if (amount === context.mandate.amount) {
    return {
      answer: `The last preflight already used ${amount} USDC.`,
      citedFacts: [],
      suggestedAction: null,
    };
  }
  return {
    answer: `Deposit capacity and build checks depend on the amount, so ${amount} USDC needs a fresh preflight instead of a guess.`,
    citedFacts: [],
    suggestedAction: rerun({ amount }),
  };
}

function answerSummary(context: AgentContext): AgentAnswerOutput {
  const selected = selectedRail(context);
  const blocking = context.decision.rejected.filter((item) => item.reasonCode !== "OK");
  const verification =
    context.decision.verification.verdict === "pass"
      ? "Verification passed."
      : `Verification failed: ${context.decision.verification.issues.map((item) => item.issue).join(" ")}`;
  return {
    answer: `Decision ${context.decision.decision}${selected ? ` on the ${railLabel(selected)}` : ""}. ${context.decision.rationale} ${blocking.length} rail(s) blocked. ${verification}`,
    citedFacts: selected ? [railFact(selected)] : context.rails.slice(0, 3).map(railFact),
    suggestedAction: null,
  };
}

const OFFER_CHECK =
  'Want me to check? Tell me an amount and a chain, like "100 USDC on BSC, no KYC".';

type GeneralTopic = { pattern: RegExp; answer: string; fact: string };

const GENERAL_TOPICS: GeneralTopic[] = [
  {
    pattern: /\bsign|private key|custody|hold (my )?funds|safe|trust/i,
    answer:
      "CapitalRail never signs and never holds funds. On GO it prepares unsigned approve + deposit steps for your own wallet, and you review and sign them yourself.",
    fact: PRODUCT_FACTS.howItWorks[3],
  },
  {
    pattern: /\bkyc\b|whitelist|onboard/i,
    answer: `${PRODUCT_FACTS.kyc} If you allow KYC vaults, CapitalRail also checks whether your wallet is already whitelisted.`,
    fact: PRODUCT_FACTS.kyc,
  },
  {
    pattern: /\bchain|network|bsc|bnb|avalanche|avax/i,
    answer: `IXS vaults are checked on ${PRODUCT_FACTS.chains.join(" and ")}. The chain you choose is a hard rule; "Any chain" lets CapitalRail compare both.`,
    fact: PRODUCT_FACTS.chains.join(", "),
  },
  {
    pattern: /\bwithdraw|sync|async|7540|instant|delayed|claim/i,
    answer: `${PRODUCT_FACTS.withdrawals} If you need instant exits, say "instant withdrawals only" and delayed vaults are filtered out.`,
    fact: PRODUCT_FACTS.withdrawals,
  },
  {
    pattern: /\bwait\b|no-go|nogo|\bgo\b|decision|verdict/i,
    answer: `GO means ${PRODUCT_FACTS.decisions.GO}. WAIT means ${PRODUCT_FACTS.decisions.WAIT}. NO-GO means ${PRODUCT_FACTS.decisions["NO-GO"]}.`,
    fact: "GO / WAIT / NO-GO",
  },
  {
    pattern: /\bserv\b|\bai\b|model|reasoning|llm/i,
    answer:
      "Rules are code, judgment is SERV: code enforces chain, capacity, KYC, withdrawal speed and balance, while SERV Reasoning writes fact-grounded risk notes, cross-checks the rules, ranks the eligible vaults and independently verifies the memo. SERV can veto an entry, never unlock one.",
    fact: PRODUCT_FACTS.howItWorks[2],
  },
  {
    pattern: /\bhow\b|work|step|process/i,
    answer: PRODUCT_FACTS.howItWorks.join(" "),
    fact: PRODUCT_FACTS.howItWorks[1],
  },
  {
    pattern: /\bapy|yield|return|advice|should i/i,
    answer: `CapitalRail does not quote yields and does not give advice: it checks whether an entry can really go through and what it implies. ${PRODUCT_FACTS.notAdvice}`,
    fact: PRODUCT_FACTS.notAdvice,
  },
];

/** No preflight yet: answer from static product facts and offer a check. */
function answerGeneral(question: string): AgentAnswerOutput {
  const topic = GENERAL_TOPICS.find((item) => item.pattern.test(question));
  return {
    answer: `${topic?.answer ?? PRODUCT_FACTS.whatItIs} ${OFFER_CHECK}`,
    citedFacts: [{ vaultId: null, fact: topic?.fact ?? PRODUCT_FACTS.whatItIs }],
    suggestedAction: null,
  };
}

function answerRisks(context: AgentContext): AgentAnswerOutput {
  const notes = context.riskNotes ?? [];
  const focusId = context.decision.selectedVaultId;
  const relevant = (focusId ? notes.filter((note) => note.vaultId === focusId) : notes)
    .slice(0, 4);
  if (relevant.length === 0) {
    return {
      answer:
        "The last check produced no specific risk note for this vault. Still review the chain, the amount and the withdrawal mode before signing.",
      citedFacts: [],
      suggestedAction: null,
    };
  }
  return {
    answer: relevant.map((note) => note.note).join(" "),
    citedFacts: relevant.map((note) => ({
      vaultId: note.vaultId,
      fact: `${note.category} (${note.severity})`,
    })),
    suggestedAction: null,
  };
}

/** Deterministic keyword router used when SERV is unavailable. */
export function fallbackAgentAnswer(
  question: string,
  context: AgentContext | null,
): AgentAnswerOutput {
  if (!context) return answerGeneral(question);

  const lower = question.toLowerCase();

  if (/\brisk|worth knowing|before i sign|careful|danger|safe\b/i.test(lower)) {
    return answerRisks(context);
  }

  if (/\bsign|signature|private key|execute|send (the )?t(x|ransaction)|deposit (it|now|for me)/i.test(lower)) {
    return answerSigning(context);
  }

  const chain = CHAIN_ALIASES.find((item) => item.pattern.test(lower));
  if (chain) return answerChain(context, chain.chainId);

  if (/\bkyc\b|whitelist|onboard/i.test(lower)) return answerKyc(context);

  if (/\basync\b|\bsync\b|settlement|7540|claim/i.test(lower)) {
    return answerSettlement(context);
  }

  const amount = lower.match(/(\d+(?:\.\d+)?)\s*(?:usdc|usd|\$)/i)?.[1]
    ?? (/\bamount|what if\b/i.test(lower) ? lower.match(/\b(\d+(?:\.\d+)?)\b/)?.[1] : undefined);
  if (amount) return answerAmount(context, amount);

  if (/\bwhy\b|reject|blocked|not\b|fail/i.test(lower)) {
    return context.decision.decision === "GO" && /\bwhy (this|go|selected)\b/i.test(lower)
      ? answerSummary(context)
      : answerRejected(context);
  }

  return answerSummary(context);
}
