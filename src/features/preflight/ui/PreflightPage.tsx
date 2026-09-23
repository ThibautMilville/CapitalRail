"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import type {
  AgentContext,
  MandatePatch,
} from "@/features/agent/lib/agent-schema";
import {
  AgentWidget,
  type AgentWidgetHandle,
} from "@/features/agent/ui/AgentWidget";
import { preflightRequestBody } from "@/features/preflight/lib/api-snippet";
import type { ParsedIntent } from "@/features/preflight/lib/intent-schema";
import {
  INITIAL_MANDATE,
  mandateKey,
  type MandateValues,
} from "@/features/preflight/lib/mandate";
import { requestIntent } from "@/features/preflight/lib/request-intent";
import type { PreflightResponse } from "@/features/preflight/lib/types";
import type { VerdictAction } from "@/features/preflight/lib/verdict";
import {
  BusinessModelSection,
  type InstanceStatsView,
} from "@/features/preflight/ui/BusinessModelSection";
import { CheckingPanel } from "@/features/preflight/ui/CheckingPanel";
import {
  ExpertDetails,
  type ExpertTab,
} from "@/features/preflight/ui/ExpertDetails";
import { FaqSection } from "@/features/preflight/ui/FaqSection";
import { FlowStepper, type FlowStep } from "@/features/preflight/ui/FlowStepper";
import { HowItWorksSection } from "@/features/preflight/ui/HowItWorksSection";
import { IntentComposer } from "@/features/preflight/ui/IntentComposer";
import { JudgeDemoBar } from "@/features/preflight/ui/JudgeDemoBar";
import { PipelineDiagram } from "@/features/preflight/ui/PipelineDiagram";
import { RoadmapRails } from "@/features/preflight/ui/RoadmapRails";
import { SignPanel } from "@/features/preflight/ui/SignPanel";
import { VerdictCard } from "@/features/preflight/ui/VerdictCard";
import { WhyCapitalRailSection } from "@/features/preflight/ui/WhyCapitalRailSection";
import type { ReasoningStepTrace } from "@/shared/serv/trace-types";
import { CapitalRailMark } from "@/shared/ui/CapitalRailMark";
import { BrandGlowTitle } from "@/shared/ui/GlowTitle";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader, type SiteHeaderStatus } from "@/shared/ui/SiteHeader";
import { useToast } from "@/shared/ui/Toast";
import { SUPPORTED_CHAIN_IDS, chainLabel } from "@/shared/wallet/chains";
import { DEMO_WALLET_ADDRESS } from "@/shared/wallet/demo-wallet";

type HealthState = {
  ok: boolean;
  vaultCount?: number;
  servConfigured?: boolean;
};

const HEADER_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#business", label: "Business" },
  { href: "#faq", label: "FAQ" },
];

const DEMO_AVALANCHE: Omit<MandateValues, "walletAddress"> = {
  amount: "1",
  allowKyc: false,
  requireSyncSettlement: false,
  preferredChainId: "43114",
};

function subscribeNoop() {
  return () => {};
}

function readJudgeMode() {
  return new URLSearchParams(window.location.search).get("judge") === "1";
}

function intentToMandate(
  intent: ParsedIntent,
  walletAddress: string,
): MandateValues {
  return {
    walletAddress,
    amount: intent.amount,
    allowKyc: intent.allowKyc,
    requireSyncSettlement: intent.requireSyncSettlement,
    preferredChainId: intent.preferredChainId ?? "",
  };
}

function buildAgentContext(
  result: PreflightResponse,
  mandate: MandateValues,
): AgentContext {
  return {
    mandate,
    decision: {
      decision: result.decision,
      selectedVaultId: result.selectedVaultId,
      rationale: result.rationale,
      rejected: result.rejected,
      verification: result.verification,
      txPackReady: Boolean(result.txPack),
      preview: result.preview,
    },
    riskNotes: (result.riskNotes ?? []).slice(0, 24).map((note) => ({
      vaultId: note.vaultId,
      category: note.category,
      severity: note.severity,
      note: note.note,
    })),
    intentReading: result.intentReading?.slice(0, 500),
    rails: result.rails.map((rail) => ({
      vaultId: rail.vaultId,
      name: rail.name,
      chainId: rail.chainId,
      chainName: rail.chainName,
      settlement: rail.settlement,
      status: rail.status,
      requiresWhitelist: rail.requiresWhitelist,
      whitelistOk: rail.whitelistOk,
      depositBuildOk: rail.depositBuildOk,
      depositBuildError: rail.depositBuildError?.slice(0, 600) ?? null,
      reasonCodes: rail.reasonCodes,
    })),
    traceSummary: result.trace.steps.map((step) => ({
      id: step.id,
      source: step.source,
      model: step.model,
      ok: step.ok,
      durationMs: step.durationMs,
    })),
    snapshotHash: result.snapshotHash,
  };
}

function scrollToId(id: string) {
  window.requestAnimationFrame(() => {
    const node = document.getElementById(id);
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.top < 80 || rect.top > window.innerHeight * 0.6) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

export function PreflightPage() {
  const [mandate, setMandate] = useState<MandateValues>(INITIAL_MANDATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreflightResponse | null>(null);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [stats, setStats] = useState<InstanceStatsView | null>(null);
  const [resultMandate, setResultMandate] = useState<MandateValues | null>(null);
  const [intentTrace, setIntentTrace] = useState<ReasoningStepTrace | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [expertsOverride, setExpertsOverride] = useState<boolean | null>(null);
  const [expertTab, setExpertTab] = useState<ExpertTab>("trace");
  const [depositDone, setDepositDone] = useState(false);
  const [demoStage, setDemoStage] = useState<0 | 1 | 2 | 3>(0);

  const judge = useSyncExternalStore(subscribeNoop, readJudgeMode, () => false);
  const expertsOpen = expertsOverride ?? judge;

  const agentRef = useRef<AgentWidgetHandle>(null);
  const pendingIntentTraceRef = useRef<ReasoningStepTrace | null>(null);
  const prevDecisionRef = useRef<PreflightResponse["decision"] | null>(null);
  const mandateRef = useRef(mandate);
  const judgeRef = useRef(judge);
  /** Mandate key of the latest started run; null until the first explicit run. */
  const lastRunKeyRef = useRef<string | null>(null);
  const runIdRef = useRef(0);

  const { address, isConnected, chainId, status: accountStatus } = useAccount();
  const { connect, connectors, isPending: connecting, error: connectError } =
    useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { notify } = useToast();
  /** True only after the user clicks Connect in this page session. */
  const userInitiatedConnectRef = useRef(false);
  const [syncedAddress, setSyncedAddress] = useState<string | null>(null);

  if (isConnected && address && address !== syncedAddress) {
    setSyncedAddress(address);
    setMandate((current) => ({ ...current, walletAddress: address }));
  } else if (!isConnected && syncedAddress) {
    setSyncedAddress(null);
    setMandate((current) => ({ ...current, walletAddress: DEMO_WALLET_ADDRESS }));
  }

  useEffect(() => {
    mandateRef.current = mandate;
  }, [mandate]);

  useEffect(() => {
    judgeRef.current = judge;
  }, [judge]);

  useEffect(() => {
    void fetch("/api/health")
      .then((response) => response.json())
      .then((data) =>
        setHealth({
          ok: Boolean(data.ok),
          vaultCount: data.ixs?.vaultCount,
          servConfigured: data.serv?.configured,
        }),
      )
      .catch(() => setHealth({ ok: false }));
  }, []);

  const refreshStats = useCallback(() => {
    void fetch("/api/stats")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: InstanceStatsView | null) => {
        if (data) setStats(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    // Ignore reconnect/connect in-flight; only act on settled status.
    if (accountStatus === "reconnecting" || accountStatus === "connecting") {
      return;
    }

    // Toast only after an explicit Connect click in this session (never on reload).
    if (
      userInitiatedConnectRef.current &&
      isConnected &&
      address
    ) {
      notify(
        "success",
        `Wallet connected - ${address.slice(0, 6)}...${address.slice(-4)}`,
      );
      userInitiatedConnectRef.current = false;
    }
  }, [accountStatus, isConnected, address, notify]);

  useEffect(() => {
    if (connectError) {
      userInitiatedConnectRef.current = false;
      notify("error", connectError.message || "Wallet connect failed");
    }
  }, [connectError, notify]);

  const onConnect = useCallback(() => {
    const hasInjected =
      typeof window !== "undefined" &&
      Boolean((window as Window & { ethereum?: unknown }).ethereum);
    const connector = hasInjected
      ? connectors.find((item) => item.id === "injected")
      : connectors.find((item) => item.id === "walletConnect");
    if (!connector) {
      notify(
        "error",
        "No wallet found. Install MetaMask or open this page in your wallet app.",
      );
      return;
    }
    userInitiatedConnectRef.current = true;
    connect({ connector });
  }, [connect, connectors, notify]);

  const runPreflight = useCallback(
    async (
      values: MandateValues = mandateRef.current,
      options: { forceRescan?: boolean; reveal?: boolean } = {},
    ) => {
      lastRunKeyRef.current = mandateKey(values);
      const runId = ++runIdRef.current;
      setLoading(true);
      setError(null);
      if (options.reveal) scrollToId("flow");

      try {
        const response = await fetch("/api/preflight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            preflightRequestBody(values, options.forceRescan === true),
          ),
        });

        const data = await response.json();
        if (runId !== runIdRef.current) return null;
        if (!response.ok) {
          throw new Error(data.error ?? "The check failed");
        }

        const next = data as PreflightResponse;
        const prev = prevDecisionRef.current;
        if (prev && prev !== next.decision) {
          notify("info", `Decision updated: ${prev} -> ${next.decision}`);
        }
        prevDecisionRef.current = next.decision;
        refreshStats();
        setResult(next);
        setResultMandate(values);
        setDepositDone(false);
        setIntentTrace(pendingIntentTraceRef.current);
        pendingIntentTraceRef.current = null;

        if (judgeRef.current) {
          setDemoStage((stage) => {
            if (stage === 0 && next.decision === "WAIT" && values.preferredChainId === "43114") return 1;
            if (stage === 1 && next.decision === "GO") return 2;
            return stage;
          });
        }
        if (options.reveal) scrollToId("verdict");
        return next;
      } catch (err) {
        if (runId !== runIdRef.current) return null;
        const message = err instanceof Error ? err.message : "The check failed";
        setError(message);
        notify("error", message);
        return null;
      } finally {
        if (runId === runIdRef.current) setLoading(false);
      }
    },
    [notify, refreshStats],
  );

  // Once a check has run, each real change of the rules (debounced) triggers
  // exactly one re-check. Runs never re-arm this effect.
  useEffect(() => {
    const key = mandateKey(mandate);
    if (lastRunKeyRef.current === null || key === lastRunKeyRef.current) {
      return;
    }

    const handle = window.setTimeout(() => {
      if (key === lastRunKeyRef.current) return;
      void runPreflight(mandate, { forceRescan: false });
    }, 350);

    return () => window.clearTimeout(handle);
  }, [mandate, runPreflight]);

  const onIntentReady = useCallback(
    (intent: ParsedIntent) => {
      const next = intentToMandate(intent, mandateRef.current.walletAddress);
      pendingIntentTraceRef.current = intent.trace;
      setUnderstood(true);
      setMandate(next);
      void runPreflight(next, { forceRescan: true, reveal: true });
    },
    [runPreflight],
  );

  const onAgentIntent = useCallback(
    async (text: string) => {
      const intent = await requestIntent(text);
      onIntentReady(intent);
      return `Got it: ${intent.summary} I am checking the live IXS vaults now - the decision appears on the page.`;
    },
    [onIntentReady],
  );

  const applyPatch = useCallback(
    (patch: MandatePatch) => {
      const next = { ...mandateRef.current, ...patch };
      setMandate(next);
      void runPreflight(next, { forceRescan: false, reveal: true });
    },
    [runPreflight],
  );

  const onCheckEntry = useCallback(
    () => void runPreflight(mandateRef.current, { forceRescan: true, reveal: true }),
    [runPreflight],
  );

  const onVerdictAction = useCallback(
    (action: VerdictAction) => {
      if (action.kind === "patch") applyPatch(action.patch);
      else if (action.kind === "recheck") onCheckEntry();
      else notify("info", "Capacity alerts are coming soon. Re-check anytime.");
    },
    [applyPatch, onCheckEntry, notify],
  );

  const onStartDemo = useCallback(() => {
    const next = { ...mandateRef.current, ...DEMO_AVALANCHE };
    setMandate(next);
    void runPreflight(next, { forceRescan: true, reveal: true });
  }, [runPreflight]);

  const showReasoning = useCallback(() => {
    setExpertsOverride(true);
    setExpertTab("trace");
    window.requestAnimationFrame(() =>
      document.getElementById("experts")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, []);

  const agentContext = useMemo(
    () =>
      result && resultMandate ? buildAgentContext(result, resultMandate) : null,
    [result, resultMandate],
  );

  const traceSteps = useMemo(
    () =>
      result
        ? [...(intentTrace ? [intentTrace] : []), ...result.trace.steps]
        : [],
    [result, intentTrace],
  );

  const headerStatus: SiteHeaderStatus = !health
    ? { tone: "pending", label: "Checking IXS" }
    : health.ok
      ? {
          tone: "ok",
          label: `IXS live - ${health.vaultCount ?? "?"} vaults`,
        }
      : { tone: "warn", label: "IXS unreachable" };

  const walletConnected = Boolean(isConnected && address);
  const wrongNetwork =
    walletConnected && chainId != null && !SUPPORTED_CHAIN_IDS.includes(chainId);

  const step: FlowStep = loading
    ? 1
    : result
      ? result.decision === "GO"
        ? 3
        : 2
      : 0;

  return (
    <div id="top" className="relative min-h-dvh overflow-x-hidden">
      <SiteHeader
        links={HEADER_LINKS}
        status={headerStatus}
        wallet={{
          address: walletConnected ? (address ?? null) : null,
          connecting,
          networkLabel: chainId != null ? chainLabel(chainId) : null,
          wrongNetwork,
        }}
        onConnect={onConnect}
        onDisconnect={() => disconnect()}
        onSwitchNetwork={() => switchChain({ chainId: 56 })}
      />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#02090d]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(21,125,116,0.12),transparent_36%),linear-gradient(180deg,#02090d_0%,#031017_72%,#02090d_100%)]" />
      </div>

      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-3 pb-28 pt-24 sm:gap-6 sm:px-4 sm:pb-12 sm:pt-28 md:px-6">
        <header className="relative min-w-0">
          <p className="section-kicker m-0 max-w-full">
            SERV Hackathon - RWA Vaults - IXS
          </p>
          <div className="mt-3 flex min-w-0 items-center gap-3 sm:gap-4">
            <CapitalRailMark className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
            <h1 className="m-0 min-w-0 text-[clamp(1.85rem,7vw,3.4rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
              <BrandGlowTitle lead="Capital" accent="Rail" />
            </h1>
          </div>
          <p className="mt-3 w-full max-w-none text-[0.95rem] leading-snug text-slate-400 sm:text-[1.02rem]">
            Check if you can really enter an IXS vault before you sign
            anything. GO only when deposit capacity is real.{" "}
            <a
              href="#how"
              className="whitespace-nowrap text-cyan-200/80 underline-offset-2 hover:text-cyan-100 hover:underline"
            >
              How it works
            </a>
          </p>
        </header>

        {judge ? (
          <JudgeDemoBar stage={depositDone && demoStage === 2 ? 3 : demoStage} loading={loading} onStart={onStartDemo} />
        ) : null}

        <section
          id="flow"
          aria-label="Check my entry"
          className="scroll-mt-24 rounded-2xl border border-emerald-200/20 bg-[#06171e]/85 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5"
        >
          <FlowStepper current={step} done={depositDone} />
          <div className="mt-5">
            <IntentComposer
              mandate={mandate}
              hasResult={Boolean(result)}
              loading={loading}
              understood={understood}
              onIntentReady={onIntentReady}
              onRulesChange={setMandate}
              onCheck={onCheckEntry}
            />
          </div>
          {loading && !result ? (
            <div className="mt-5 border-t border-emerald-200/10 pt-5">
              <CheckingPanel
                vaultCount={health?.vaultCount}
                servConfigured={health?.servConfigured}
              />
              <div className="mt-5">
                <PipelineDiagram
                  loading
                  result={null}
                  embedded
                  title="Live check in progress"
                />
              </div>
            </div>
          ) : null}
          {error ? (
            <p className="m-0 mt-4 text-sm text-rose-300" role="alert">
              {error} -{" "}
              <button
                type="button"
                className="cursor-pointer text-rose-200 underline underline-offset-2"
                onClick={onCheckEntry}
              >
                try again
              </button>
            </p>
          ) : null}
        </section>

        {result && resultMandate ? (
          <>
            <div id="pipeline-diagram" className="scroll-mt-24">
              <PipelineDiagram
                loading={loading}
                result={result}
                title={
                  loading ? "Re-checking the live rails" : "How this check ran"
                }
              />
            </div>
            <VerdictCard
              result={result}
              mandate={resultMandate}
              loading={loading}
              onAction={onVerdictAction}
              onAskWhy={() =>
                agentRef.current?.open(
                  result.decision === "GO"
                    ? "Why this vault?"
                    : "Why this decision, and what would change it?",
                )
              }
              onShowReasoning={showReasoning}
              spotlightActionId={judge && demoStage === 1 ? "try-other-chain" : null}
            />
            {result.decision === "GO" ? (
              <SignPanel
                key={`${result.snapshotHash}-${address ?? "none"}`}
                result={result}
                amount={resultMandate.amount}
                loading={loading}
                connecting={connecting}
                onConnect={onConnect}
                onDone={() => setDepositDone(true)}
              />
            ) : null}
            <ExpertDetails
              open={expertsOpen}
              onToggle={() => setExpertsOverride(!expertsOpen)}
              tab={expertTab}
              onTabChange={setExpertTab}
              result={result}
              traceSteps={traceSteps}
              loading={loading}
            />
            <RoadmapRails liveRailNames={result.rails.map((rail) => rail.name)} />
          </>
        ) : null}

        <HowItWorksSection />
        <WhyCapitalRailSection />
        <BusinessModelSection stats={stats} />
        <FaqSection />

        <SiteFooter />
      </main>

      <AgentWidget
        ref={agentRef}
        context={agentContext}
        busy={loading}
        onApplyPatch={applyPatch}
        onIntentText={onAgentIntent}
      />
    </div>
  );
}
