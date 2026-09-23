"use client";

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
} from "react";
import type {
  AgentContext,
  AgentResponse,
  MandatePatch,
} from "@/features/agent/lib/agent-schema";
import { CapitalRailMark } from "@/shared/ui/CapitalRailMark";
import { IconRefresh, IconSend } from "@/shared/ui/icons";
import { useToast } from "@/shared/ui/Toast";

type AgentMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "agent";
      text: string;
      response?: AgentResponse;
      snapshotHash: string | null;
      applied?: boolean;
    };

export type AgentWidgetHandle = {
  /** Open the panel, optionally asking a question right away. */
  open: (question?: string) => void;
};

type AgentWidgetProps = {
  ref?: Ref<AgentWidgetHandle>;
  context: AgentContext | null;
  busy: boolean;
  onApplyPatch: (patch: MandatePatch) => void;
  /** Before any verdict, free text is treated as a new request. Returns a short reply. */
  onIntentText: (text: string) => Promise<string>;
};

const SUGGESTIONS: Record<"none" | "go" | "blocked", string[]> = {
  none: [
    "100 USDC on BSC, no KYC",
    "How does CapitalRail work?",
    "Which chains are supported?",
  ],
  go: ["What are the risks before I sign?", "Why this vault?", "Why were the other vaults rejected?"],
  blocked: ["Why not Avalanche?", "What would change the decision?", "What if I allow KYC?"],
};

const TEASERS: Record<"none" | "go" | "blocked", string[]> = {
  none: [
    "Not sure where to start? Tell me what you want to deposit.",
    "I check live IXS vaults before you sign anything.",
  ],
  go: ["Questions before you sign?", "Ask me why this vault was picked."],
  blocked: ["Want to know why? Ask me.", "Ask me what would change the decision."],
};

const TEASER_FIRST_DELAY_MS = 7000;
const TEASER_INTERVAL_MS = 30000;
const TEASER_VISIBLE_MS = 5500;
const TEASER_MAX_DISMISSALS = 2;
const TEASER_DISMISSED_KEY = "cr-agent-teaser-dismissed";
const AGENT_OPENED_KEY = "cr-agent-opened";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Private mode: the teaser simply keeps its in-memory state.
  }
}

function teaserStopped(): boolean {
  return (
    readSession(AGENT_OPENED_KEY) === "1" ||
    Number(readSession(TEASER_DISMISSED_KEY) ?? "0") >= TEASER_MAX_DISMISSALS
  );
}

const MOBILE_MAX_WIDTH = 639;
/** Elements the teaser must never cover on small screens (composer, rules chips, sign step). */
const AVOID_SELECTOR = "[data-agent-avoid], #sign";

function isMobileViewport(): boolean {
  return window.innerWidth <= MOBILE_MAX_WIDTH;
}

/** Free text that reads like a deposit request (vs a general question). */
export function looksLikeDepositRequest(text: string): boolean {
  const trimmed = text.trim();
  if (/\d/.test(trimmed)) return true;
  return (
    /\b(deposit|invest|put|allocate|enter|park)\b/i.test(trimmed) &&
    !/^(what|how|why|who|which|when|is|are|does|do|can you explain)\b/i.test(trimmed)
  );
}

function phaseOf(context: AgentContext | null): "none" | "go" | "blocked" {
  if (!context) return "none";
  return context.decision.decision === "GO" ? "go" : "blocked";
}

function describePatch(patch: MandatePatch): string {
  const parts: string[] = [];
  if (patch.amount) parts.push(`${patch.amount} USDC`);
  if (patch.allowKyc !== undefined) parts.push(patch.allowKyc ? "KYC vaults ok" : "no KYC");
  if (patch.requireSyncSettlement !== undefined) {
    parts.push(patch.requireSyncSettlement ? "instant withdrawals only" : "delayed withdrawals ok");
  }
  if (patch.preferredChainId !== undefined) {
    parts.push(
      patch.preferredChainId === "56"
        ? "BSC"
        : patch.preferredChainId === "43114"
          ? "Avalanche"
          : "any chain",
    );
  }
  return parts.join(" · ");
}

function traceMeta(response: AgentResponse): string {
  const { trace } = response;
  const tokens =
    trace.promptTokens == null && trace.completionTokens == null
      ? null
      : (trace.promptTokens ?? 0) + (trace.completionTokens ?? 0);
  return [
    trace.source === "serv" ? `SERV ${trace.model}` : "Fallback",
    `${trace.durationMs} ms`,
    tokens == null ? null : `${tokens} tok`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function AgentWidget({
  ref,
  context,
  busy,
  onApplyPatch,
  onIntentText,
}: AgentWidgetProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [teaser, setTeaser] = useState<string | null>(null);
  const [teaserVisible, setTeaserVisible] = useState(false);
  const [avoidInView, setAvoidInView] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const avoidInViewRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef(context);
  const teaserIndexRef = useRef(0);
  const teaserTimersRef = useRef<number[]>([]);
  const titleId = useId();
  const panelId = useId();
  const { notify } = useToast();
  const phase = phaseOf(context);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  const clearTeaserTimers = useCallback(() => {
    teaserTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    teaserTimersRef.current = [];
  }, []);

  const hideTeaser = useCallback(() => {
    clearTeaserTimers();
    setTeaserVisible(false);
    teaserTimersRef.current.push(window.setTimeout(() => setTeaser(null), 320));
  }, [clearTeaserTimers]);

  useEffect(() => {
    if (open) return;

    const runCycle = () => {
      if (teaserStopped() || document.visibilityState !== "visible") return;
      if (!document.documentElement.classList.contains("cr-intro-done")) return;
      if (avoidInViewRef.current) return;
      const texts = TEASERS[phaseOf(contextRef.current)];
      const text = texts[teaserIndexRef.current % texts.length];
      teaserIndexRef.current += 1;
      clearTeaserTimers();
      setTeaser(text);
      teaserTimersRef.current.push(
        window.setTimeout(() => setTeaserVisible(true), 40),
        window.setTimeout(() => {
          setTeaserVisible(false);
          teaserTimersRef.current.push(window.setTimeout(() => setTeaser(null), 320));
        }, TEASER_VISIBLE_MS),
      );
    };

    let interval: number | undefined;
    const first = window.setTimeout(() => {
      runCycle();
      interval = window.setInterval(runCycle, TEASER_INTERVAL_MS);
    }, TEASER_FIRST_DELAY_MS);

    return () => {
      window.clearTimeout(first);
      if (interval) window.clearInterval(interval);
      clearTeaserTimers();
    };
  }, [open, clearTeaserTimers]);

  // On mobile, hide the teaser while the composer, rules chips or sign step are on screen.
  useEffect(() => {
    const visible = new Set<Element>();
    const update = () => {
      const blocked = isMobileViewport() && visible.size > 0;
      avoidInViewRef.current = blocked;
      setAvoidInView(blocked);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      update();
    });
    const observed = new Set<Element>();
    const scan = () => {
      document.querySelectorAll(AVOID_SELECTOR).forEach((node) => {
        if (observed.has(node)) return;
        observed.add(node);
        observer.observe(node);
      });
      for (const node of observed) {
        if (!node.isConnected) {
          observer.unobserve(node);
          observed.delete(node);
          visible.delete(node);
        }
      }
      update();
    };
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // Keep the composer above the on-screen keyboard (mobile browsers with visualViewport).
  useEffect(() => {
    const panel = panelRef.current;
    const viewport = window.visualViewport;
    if (!open || !panel || !viewport) return;
    const sync = () => {
      const keyboard = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      panel.style.setProperty("--cr-vvh", `${viewport.height}px`);
      panel.style.setProperty("--cr-kb", `${keyboard}px`);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      panel.style.removeProperty("--cr-vvh");
      panel.style.removeProperty("--cr-kb");
    };
  }, [open]);

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || pending) return;

      setInput("");
      setPending(true);
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", text: question },
      ]);

      const current = contextRef.current;
      try {
        if (!current && looksLikeDepositRequest(question)) {
          const reply = await onIntentText(question);
          setMessages((prev) => [
            ...prev,
            { id: `a-${Date.now()}`, role: "agent", text: reply, snapshotHash: null },
          ]);
          return;
        }

        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, context: current ?? null }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            response.status === 429
              ? (data.error ?? "Too many requests - please wait a moment.")
              : (data.error ?? "Agent request failed"),
          );
        }

        const answer = data as AgentResponse;
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "agent",
            text: answer.answer,
            response: answer,
            snapshotHash: current?.snapshotHash ?? null,
          },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Agent request failed";
        notify("error", message);
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "agent",
            text: `Could not answer: ${message}`,
            snapshotHash: current?.snapshotHash ?? null,
          },
        ]);
      } finally {
        setPending(false);
      }
    },
    [pending, notify, onIntentText],
  );

  const openPanel = useCallback(
    (question?: string) => {
      writeSession(AGENT_OPENED_KEY, "1");
      hideTeaser();
      setOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 60);
      if (question) void ask(question);
    },
    [ask, hideTeaser],
  );

  const closePanel = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  useImperativeHandle(ref, () => ({ open: openPanel }), [openPanel]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closePanel]);

  useEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages, pending, open]);

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const dismissTeaser = () => {
    writeSession(
      TEASER_DISMISSED_KEY,
      String(Number(readSession(TEASER_DISMISSED_KEY) ?? "0") + 1),
    );
    hideTeaser();
  };

  const applyAction = (messageId: string, patch: MandatePatch) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId && msg.role === "agent"
          ? { ...msg, applied: true }
          : msg,
      ),
    );
    onApplyPatch(patch);
  };

  const intro = context
    ? `Ask me anything about this ${context.decision.decision} decision. I only read the last check, and I never sign anything.`
    : "Tell me what you want to deposit, in your own words, and I check the live IXS vaults for you. You can also ask me how CapitalRail works, about KYC or supported chains.";

  return (
    <>
      <div
        className={`cr-agent-backdrop ${open ? "is-open" : ""}`}
        onClick={closePanel}
        aria-hidden
      />

      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
        onKeyDown={onPanelKeyDown}
        className={`cr-agent-panel overflow-hidden rounded-2xl border border-emerald-200/25 bg-[#06171e] shadow-[0_24px_60px_rgba(0,0,0,0.5)] ${open ? "is-open" : ""}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-emerald-200/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <CapitalRailMark className="h-8 w-8 shrink-0" title="" aria-hidden />
            <div className="min-w-0">
              <h2
                id={titleId}
                className="page-header-accent-text m-0 text-base font-semibold normal-case"
              >
                Ask CapitalRail
              </h2>
              <p className="m-0 mt-0.5 truncate text-[0.72rem] text-slate-500">
                {context
                  ? `About your ${context.decision.decision} decision · ${context.rails.length} vaults checked`
                  : "No check yet - ask a question or describe a deposit"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Close agent"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div
          ref={listRef}
          className="cr-agent-messages scrollbar-thin space-y-2.5 px-4 py-3"
          aria-live="polite"
        >
          <div className="mr-auto max-w-[95%] rounded-xl bg-white/[0.04] px-3 py-2 text-sm leading-snug text-slate-300">
            {intro}
          </div>

          {messages.map((msg) =>
            msg.role === "user" ? (
              <div
                key={msg.id}
                className="ml-auto w-fit max-w-[90%] break-words rounded-xl bg-emerald-200/[0.1] px-3 py-2 text-sm leading-snug text-emerald-50"
              >
                {msg.text}
              </div>
            ) : (
              <div
                key={msg.id}
                className="mr-auto max-w-[95%] break-words rounded-xl bg-white/[0.04] px-3 py-2 text-sm leading-snug text-slate-300"
              >
                <p className="m-0 whitespace-pre-wrap">{msg.text}</p>
                {msg.response && msg.response.citedFacts.length > 0 ? (
                  <ul className="m-0 mt-2 list-none space-y-1 border-l border-cyan-200/20 p-0 pl-2">
                    {msg.response.citedFacts.map((fact) => (
                      <li
                        key={`${fact.vaultId ?? "global"}-${fact.fact}`}
                        className="font-mono text-[0.64rem] leading-relaxed text-slate-500"
                      >
                        {fact.fact}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {msg.response?.suggestedAction ? (
                  <button
                    type="button"
                    disabled={busy || msg.applied}
                    onClick={() =>
                      applyAction(
                        msg.id,
                        msg.response!.suggestedAction!.mandatePatch,
                      )
                    }
                    className="mt-2 inline-flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-emerald-200/30 bg-emerald-200/[0.1] px-3 py-1.5 text-left text-[0.76rem] text-emerald-100 transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {!msg.applied ? (
                      <IconRefresh className="h-3.5 w-3.5 shrink-0" />
                    ) : null}
                    {msg.applied
                      ? "Applied - checking again"
                      : `Apply and re-check: ${describePatch(msg.response.suggestedAction.mandatePatch)}`}
                  </button>
                ) : null}
                {msg.response ? (
                  <p className="m-0 mt-1.5 font-mono text-[0.6rem] text-slate-600">
                    {traceMeta(msg.response)}
                    {context && msg.snapshotHash && msg.snapshotHash !== context.snapshotHash
                      ? " · earlier check"
                      : ""}
                  </p>
                ) : null}
              </div>
            ),
          )}

          {pending ? (
            <p className="m-0 font-mono text-[0.7rem] text-cyan-200/70">
              {context ? "Reading the decision..." : "Reading your request..."}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-emerald-200/10 px-4 py-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS[phase].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={pending || busy}
                onClick={() => void ask(suggestion)}
                className="min-h-8 max-w-full cursor-pointer break-words rounded-full border border-emerald-200/15 bg-white/[0.03] px-2.5 py-1 text-[0.72rem] text-slate-300 transition-[border-color,color] hover:border-emerald-200/30 hover:text-white disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={500}
              placeholder={context ? "Ask about the decision..." : "e.g. 100 USDC on BSC, or a question"}
              aria-label={context ? "Question about the decision" : "What do you want to deposit?"}
              className="min-h-10 min-w-0 flex-1 rounded-xl border border-emerald-200/15 bg-black/25 px-3 py-2 text-sm text-[#f5fbfd] outline-none transition-[border-color] placeholder:text-slate-600 focus:border-emerald-200/35"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-200/30 bg-emerald-200/[0.12] px-3.5 text-[0.8rem] font-medium text-emerald-100 transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconSend className="h-3.5 w-3.5 shrink-0" />
              {context ? "Ask" : "Send"}
            </button>
          </form>
        </div>
      </div>

      {teaser && !open && !avoidInView ? (
        <div
          className={`cr-agent-teaser ${teaserVisible ? "is-visible" : ""}`}
          role="status"
        >
          <button
            type="button"
            className="cr-agent-teaser-body"
            onClick={() => openPanel()}
          >
            {teaser}
          </button>
          <button
            type="button"
            className="cr-agent-teaser-close"
            onClick={dismissTeaser}
            aria-label="Dismiss hint"
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        onClick={open ? closePanel : () => openPanel()}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close Ask CapitalRail" : "Ask CapitalRail"}
        title="Ask CapitalRail"
        className={`cr-agent-launcher ${open ? "is-open" : ""} ${context && !open ? "has-context" : ""}`}
      >
        <span className="cr-agent-launcher-ring" aria-hidden />
        <span className="cr-agent-launcher-icon" aria-hidden>
          <CapitalRailMark className="cr-agent-launcher-mark" title="" />
          <svg className="cr-agent-launcher-close" viewBox="0 0 20 20" fill="none">
            <path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        {context && !open ? <span className="cr-agent-launcher-dot" aria-hidden /> : null}
      </button>
    </>
  );
}
