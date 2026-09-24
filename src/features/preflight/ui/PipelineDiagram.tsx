"use client";

import {
  useId,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import type { PreflightResponse } from "@/features/preflight/lib/types";
import { chainLabel } from "@/shared/wallet/chains";

type PipelineDiagramProps = {
  loading?: boolean;
  result?: PreflightResponse | null;
  /** Softer shell when nested inside another bordered panel. */
  embedded?: boolean;
  /** Override the default "How this check ran" heading. */
  title?: string;
};

type StageId = "intent" | "mandate" | "scan" | "decide" | "attest";

type DiagramRect = { x: number; y: number; w: number; h: number };

const NODE: Record<StageId, DiagramRect> = {
  intent: { x: 28, y: 52, w: 76, h: 52 },
  mandate: { x: 156, y: 52, w: 76, h: 52 },
  scan: { x: 284, y: 52, w: 76, h: 52 },
  decide: { x: 412, y: 52, w: 76, h: 52 },
  attest: { x: 540, y: 52, w: 76, h: 52 },
};

const STAGES: { id: StageId; label: string; sub: string }[] = [
  { id: "intent", label: "Intent", sub: "you" },
  { id: "mandate", label: "Rules", sub: "yours" },
  { id: "scan", label: "Scan", sub: "IXS vaults" },
  { id: "decide", label: "SERV", sub: "decide" },
  { id: "attest", label: "Attest", sub: "deposit" },
];

const EDGE_PAIRS: [StageId, StageId][] = [
  ["intent", "mandate"],
  ["mandate", "scan"],
  ["scan", "decide"],
  ["decide", "attest"],
];

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function readReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function center(rect: DiagramRect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function right(rect: DiagramRect) {
  return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
}

function left(rect: DiagramRect) {
  return { x: rect.x, y: rect.y + rect.h / 2 };
}

function arrowHead(x1: number, y1: number, x2: number, y2: number, size = 5) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a1 = angle - Math.PI / 7;
  const a2 = angle + Math.PI / 7;
  return `${x2},${y2} ${x2 - size * Math.cos(a1)},${y2 - size * Math.sin(a1)} ${x2 - size * Math.cos(a2)},${y2 - size * Math.sin(a2)}`;
}

function stageActive(
  id: StageId,
  loading: boolean,
  result: PreflightResponse | null | undefined,
): boolean {
  if (!loading && !result) {
    return id === "intent" || id === "mandate";
  }
  if (loading && !result) {
    return id === "scan" || id === "decide";
  }
  if (loading && result) {
    return id === "decide" || id === "attest";
  }
  if (result) {
    if (result.decision === "GO") return id === "attest";
    return id === "decide";
  }
  return false;
}

export function PipelineDiagram({
  loading,
  result,
  embedded = false,
  title = "How this check ran",
}: PipelineDiagramProps) {
  const uid = useId().replace(/:/g, "");
  const gradId = `cr-diagram-grad-${uid}`;
  const glowId = `cr-diagram-glow-${uid}`;
  const hubId = `cr-diagram-hub-${uid}`;
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => true,
  );

  const isGo = result?.decision === "GO";
  const isBlockedDecision = Boolean(result && result.decision !== "GO");
  const flowBusy = Boolean(loading || result);
  const showPulses = flowBusy && !reduceMotion;

  const openRails =
    result?.rails.filter((rail) => rail.status === "open") ?? [];
  const blockedRails =
    result?.rails.filter((rail) => rail.status !== "open") ?? [];
  const selected = result?.rails.find(
    (rail) => rail.vaultId === result.selectedVaultId,
  );

  const flowPath = STAGES.map((stage, index) => {
    const c = center(NODE[stage.id]);
    return `${index === 0 ? "M" : "L"}${c.x},${c.y}`;
  }).join(" ");

  const decideC = center(NODE.decide);
  const openPath = `M${decideC.x},${NODE.decide.y + NODE.decide.h} C${decideC.x},${158} 150,158 138,184`;
  const blockedPath = `M${decideC.x},${NODE.decide.y + NODE.decide.h} C${decideC.x},${158} 490,158 502,184`;

  const openTitle = selected
    ? `${chainLabel(selected.chainId)} ${selected.symbol}`
    : openRails[0]
      ? `${chainLabel(openRails[0].chainId)} open`
      : loading
        ? "Scanning..."
        : "Awaiting scan";

  const openSub = result
    ? isGo
      ? "GO - deposit steps ready"
      : `${result.decision} - nothing unsafe prepared`
    : "CapitalRail path";

  const blockedTitle = blockedRails.length
    ? `${blockedRails.length} blocked / gated`
    : loading
      ? "Checking vaults..."
      : "No blockers yet";

  const blockedSub = blockedRails.some((r) =>
    r.reasonCodes.includes("DEPOSIT_LIMIT_ZERO"),
  )
    ? "incl. AVAX MCP limit 0 (NAV stale)"
    : "Naive AVAX path fails here";

  return (
    <section
      className={
        embedded
          ? "cr-diagram-shell"
          : "cr-diagram-shell rounded-2xl border border-emerald-200/20 bg-[#06171e]/85 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5"
      }
      aria-label="CapitalRail pipeline diagram"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="m-0 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-cyan-200/70">
            Pipeline
          </p>
          <h2 className="page-header-accent-text m-0 mt-1 text-lg font-semibold tracking-[-0.02em] normal-case sm:text-xl">
            {title}
          </h2>
        </div>
        <span
          className={`font-mono text-[0.65rem] uppercase tracking-[0.1em] ${
            isGo
              ? "text-emerald-300/80"
              : isBlockedDecision
                ? "text-rose-300/70"
                : loading
                  ? "text-cyan-300/70"
                  : "text-slate-500"
          }`}
        >
          {loading
            ? "Live scan..."
            : result
              ? `Result ${result.decision}`
              : "Idle"}
        </span>
      </div>

      {/* Desktop / tablet horizontal schema - scales, no page scroll */}
      <div className="hidden overflow-hidden sm:block">
        <svg
          className="cr-diagram-svg mx-auto block h-auto w-full max-w-[900px]"
          viewBox="0 0 644 288"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <linearGradient
              id={gradId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#5beebe" />
              <stop offset="100%" stopColor="#75d9e7" />
            </linearGradient>
            <filter
              id={glowId}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id={hubId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(91,238,190,0.18)" />
              <stop offset="100%" stopColor="rgba(91,238,190,0)" />
            </radialGradient>
          </defs>

          {/* Soft lane backdrop */}
          <rect
            className="cr-diagram-lane"
            x="12"
            y="30"
            width="620"
            height="98"
            rx="16"
          />
          <text className="cr-diagram-zone-label" x="32" y="46">
            Check lane
          </text>

          {/* SERV hub rings */}
          <circle
            className="cr-diagram-hub-ring"
            cx={decideC.x}
            cy={decideC.y}
            r="44"
          />
          <circle
            className="cr-diagram-hub-ring cr-diagram-hub-ring-delayed"
            cx={decideC.x}
            cy={decideC.y}
            r="56"
          />
          <circle
            cx={decideC.x}
            cy={decideC.y}
            r="38"
            fill={`url(#${hubId})`}
          />

          {/* Edges */}
          {EDGE_PAIRS.map(([fromId, toId], index) => {
            const from = right(NODE[fromId]);
            const to = left(NODE[toId]);
            const path = `M${from.x},${from.y} L${to.x},${to.y}`;
            return (
              <g
                key={`${fromId}-${toId}`}
                className="cr-diagram-edge-group"
                style={{ "--diagram-delay": `${index * 0.18}s` } as CSSProperties}
              >
                <line
                  className="cr-diagram-edge"
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                />
                <polygon
                  className="cr-diagram-arrow"
                  points={arrowHead(from.x, from.y, to.x, to.y)}
                />
                {showPulses ? (
                  <circle
                    className="cr-diagram-pulse"
                    r="3.2"
                    filter={`url(#${glowId})`}
                  >
                    <animateMotion
                      dur={loading ? "2.2s" : "3.6s"}
                      repeatCount="indefinite"
                      begin={`${index * 0.35}s`}
                      path={path}
                    />
                  </circle>
                ) : null}
              </g>
            );
          })}

          {/* Full-lane pulse */}
          {showPulses ? (
            <circle
              className="cr-diagram-pulse cr-diagram-pulse-strong"
              r="4"
              filter={`url(#${glowId})`}
            >
              <animateMotion
                dur={loading ? "2.8s" : "4.4s"}
                repeatCount="indefinite"
                path={flowPath}
              />
            </circle>
          ) : null}

          {/* Nodes */}
          {STAGES.map((stage, index) => {
            const rect = NODE[stage.id];
            const active = stageActive(stage.id, Boolean(loading), result);
            const c = center(rect);
            return (
              <g
                key={stage.id}
                className="cr-diagram-node"
                style={
                  { "--diagram-delay": `${0.06 + index * 0.07}s` } as CSSProperties
                }
              >
                <rect
                  className={
                    active
                      ? "cr-diagram-node-box cr-diagram-node-box-active"
                      : "cr-diagram-node-box"
                  }
                  style={
                    active
                      ? ({ stroke: `url(#${gradId})` } as CSSProperties)
                      : undefined
                  }
                  x={rect.x}
                  y={rect.y}
                  width={rect.w}
                  height={rect.h}
                  rx={12}
                />
                <text
                  className="cr-diagram-node-label"
                  x={c.x}
                  y={c.y - 4}
                  textAnchor="middle"
                >
                  {stage.label}
                </text>
                <text
                  className="cr-diagram-node-sub"
                  x={c.x}
                  y={c.y + 12}
                  textAnchor="middle"
                >
                  {stage.sub}
                </text>
              </g>
            );
          })}

          {/* Branch curves from SERV */}
          <path
            className={
              isGo
                ? "cr-diagram-branch cr-diagram-branch-ok"
                : "cr-diagram-branch"
            }
            d={openPath}
            fill="none"
          />
          <path
            className={
              isBlockedDecision
                ? "cr-diagram-branch cr-diagram-branch-bad"
                : "cr-diagram-branch"
            }
            d={blockedPath}
            fill="none"
          />

          {showPulses && (loading || isGo) && (
            <circle
              className="cr-diagram-pulse"
              r="3"
              filter={`url(#${glowId})`}
            >
              <animateMotion
                dur="3s"
                repeatCount="indefinite"
                path={openPath}
              />
            </circle>
          )}
          {showPulses && (loading || isBlockedDecision) && (
            <circle className="cr-diagram-pulse-bad" r="3">
              <animateMotion
                dur="3.2s"
                repeatCount="indefinite"
                path={blockedPath}
              />
            </circle>
          )}

          {/* Outcome panels */}
          <g
            className="cr-diagram-node"
            style={{ "--diagram-delay": "0.42s" } as CSSProperties}
          >
            <rect
              className={
                isGo
                  ? "cr-diagram-zone cr-diagram-zone-ok"
                  : "cr-diagram-zone"
              }
              x="28"
              y="184"
              width="220"
              height="72"
              rx="14"
            />
            <text className="cr-diagram-zone-label" x="138" y="202" textAnchor="middle">
              Open path
            </text>
            <text className="cr-diagram-outcome" x="138" y="224" textAnchor="middle">
              {openTitle}
            </text>
            <text
              className="cr-diagram-outcome-sub"
              x="138"
              y="240"
              textAnchor="middle"
            >
              {openSub}
            </text>
          </g>

          <g
            className="cr-diagram-node"
            style={{ "--diagram-delay": "0.5s" } as CSSProperties}
          >
            <rect
              className={
                isBlockedDecision || blockedRails.length > 0
                  ? "cr-diagram-zone cr-diagram-zone-blocked"
                  : "cr-diagram-zone"
              }
              x="396"
              y="184"
              width="220"
              height="72"
              rx="14"
            />
            <text className="cr-diagram-zone-label" x="506" y="202" textAnchor="middle">
              Blocked vaults
            </text>
            <text className="cr-diagram-outcome" x="506" y="224" textAnchor="middle">
              {blockedTitle}
            </text>
            <text
              className="cr-diagram-outcome-sub"
              x="506"
              y="240"
              textAnchor="middle"
            >
              {blockedSub}
            </text>
          </g>

          {/* Step chips */}
          <g className="cr-diagram-chip" style={{ "--diagram-delay": "0.55s" } as CSSProperties}>
            <rect className="cr-diagram-chip-box" x="70" y="266" width="110" height="16" rx="8" />
            <text className="cr-diagram-chip-label" x="125" y="277" textAnchor="middle">
              1. Map intent
            </text>
          </g>
          <g className="cr-diagram-chip" style={{ "--diagram-delay": "0.62s" } as CSSProperties}>
            <rect className="cr-diagram-chip-box" x="267" y="266" width="110" height="16" rx="8" />
            <text className="cr-diagram-chip-label" x="322" y="277" textAnchor="middle">
              2. Scan IXS
            </text>
          </g>
          <g className="cr-diagram-chip" style={{ "--diagram-delay": "0.69s" } as CSSProperties}>
            <rect
              className={
                isGo
                  ? "cr-diagram-chip-box cr-diagram-chip-box-ok"
                  : "cr-diagram-chip-box"
              }
              x="464"
              y="266"
              width="110"
              height="16"
              rx="8"
            />
            <text className="cr-diagram-chip-label" x="519" y="277" textAnchor="middle">
              3. Pack on GO
            </text>
          </g>
        </svg>
      </div>

      {/* Mobile stacked schema */}
      <div className="sm:hidden">
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {STAGES.map((stage, index) => {
            const active = stageActive(stage.id, Boolean(loading), result);
            return (
              <li key={stage.id} className="relative">
                {index < STAGES.length - 1 ? (
                  <span
                    className="cr-diagram-mobile-rail absolute left-[15px] top-[46px] h-[calc(100%+4px)] w-px"
                    aria-hidden
                  />
                ) : null}
                <div
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    active
                      ? "border-emerald-300/40 bg-emerald-400/10"
                      : "border-emerald-200/15 bg-[#031017]/80"
                  }`}
                >
                  <span
                    className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full font-mono text-[0.65rem] font-semibold ${
                      active
                        ? "bg-emerald-400/20 text-emerald-200"
                        : "bg-slate-800/80 text-slate-400"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-semibold text-slate-100">
                      {stage.label}
                    </p>
                    <p className="m-0 font-mono text-[0.68rem] text-slate-500">
                      {stage.sub}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <div
            className={`rounded-xl border px-3 py-2.5 ${
              isGo
                ? "border-emerald-300/35 bg-emerald-400/10"
                : "border-emerald-200/15 bg-[#031017]/70"
            }`}
          >
            <p className="m-0 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-500">
              Open path
            </p>
            <p className="m-0 mt-1 text-sm font-semibold text-slate-100">
              {openTitle}
            </p>
            <p className="m-0 mt-0.5 font-mono text-[0.68rem] text-slate-500">
              {openSub}
            </p>
          </div>
          <div
            className={`rounded-xl border px-3 py-2.5 ${
              isBlockedDecision || blockedRails.length > 0
                ? "border-rose-400/30 bg-rose-500/10"
                : "border-emerald-200/15 bg-[#031017]/70"
            }`}
          >
            <p className="m-0 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-500">
              Blocked vaults
            </p>
            <p className="m-0 mt-1 text-sm font-semibold text-slate-100">
              {blockedTitle}
            </p>
            <p className="m-0 mt-0.5 font-mono text-[0.68rem] text-slate-500">
              {blockedSub}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
