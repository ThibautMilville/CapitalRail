"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { mountIntroScene, type IntroSceneHandle } from "@/shared/ui/opening-intro-scene";

const INTRO_MS = 4400;
const EXIT_MS = 560;
const HARD_MAX_MS = 8500;
/** Matches `.cr-intro-name-text` sweep: 0.35s delay + 1.5s run */
const NAME_SWEEP_MS = 1850;
const NAME_HOLD_MS = 400;

type Phase = "checking" | "playing" | "exiting" | "done";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Unknown during SSR and hydration, so the first client render matches the server. */
function getServerReducedMotion(): boolean | null {
  return null;
}

function isLowPowerDevice(): boolean {
  if (typeof window === "undefined") return true;
  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const lowCpu =
    typeof navigator !== "undefined" &&
    typeof navigator.hardwareConcurrency === "number" &&
    navigator.hardwareConcurrency > 0 &&
    navigator.hardwareConcurrency <= 4;
  const saveData =
    typeof navigator !== "undefined" &&
    "connection" in navigator &&
    Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData,
    );
  return mobile || coarse || lowCpu || saveData;
}

export function OpeningIntro({ children }: { children: ReactNode }) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  );
  const [playPhase, setPhase] = useState<Exclude<Phase, "checking">>("playing");
  const phase: Phase =
    reducedMotion === null ? "checking" : reducedMotion ? "done" : playPhase;
  const [nameVisible, setNameVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<IntroSceneHandle | null>(null);
  const completedRef = useRef(false);

  const unlockScroll = useCallback(() => {
    document.documentElement.classList.remove("cr-intro-scroll-lock");
    document.body.classList.remove("cr-intro-active");
  }, []);

  /** Agent launcher / teaser may show only after overlay is fully gone. */
  const markChromeReady = useCallback(() => {
    document.documentElement.classList.add("cr-intro-chrome-ready");
  }, []);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    // Shell may fade in under the exiting overlay; agent chrome stays hidden
    // until phase === "done" (see cr-intro-chrome-ready).
    document.documentElement.classList.add("cr-intro-done");
    setPhase((current) => (current === "done" ? current : "exiting"));
  }, []);

  useEffect(() => {
    if (reducedMotion === null) return;
    if (reducedMotion) {
      completedRef.current = true;
      document.documentElement.classList.add("cr-intro-done");
      markChromeReady();
      unlockScroll();
      return;
    }
    if (!completedRef.current) {
      document.documentElement.classList.add("cr-intro-scroll-lock");
      document.body.classList.add("cr-intro-active");
    }
  }, [reducedMotion, unlockScroll, markChromeReady]);

  useEffect(() => {
    if (phase !== "done") return;
    unlockScroll();
    markChromeReady();
  }, [phase, unlockScroll, markChromeReady]);

  useEffect(() => {
    if (phase !== "playing") return;
    // 404 (and other light pages) set data-cr-skip-intro - skip Three.js intro.
    if (document.querySelector("[data-cr-skip-intro]")) {
      complete();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let holdTimer = 0;
    const hardTimer = window.setTimeout(() => {
      if (!cancelled) complete();
    }, HARD_MAX_MS);

    const lowPower = isLowPowerDevice();

    try {
      handleRef.current = mountIntroScene({
        canvas,
        durationMs: INTRO_MS,
        lowPower,
        onReveal: () => {
          if (cancelled) return;
          setNameVisible(true);
          holdTimer = window.setTimeout(() => {
            if (!cancelled) complete();
          }, NAME_SWEEP_MS + NAME_HOLD_MS);
        },
        onComplete: () => {},
      });
    } catch {
      complete();
    }

    return () => {
      cancelled = true;
      window.clearTimeout(hardTimer);
      window.clearTimeout(holdTimer);
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [phase, complete]);

  useEffect(() => {
    if (phase !== "exiting") return;
    const timer = window.setTimeout(() => setPhase("done"), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === "done" || phase === "checking") return;
    const blockScroll = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".cr-intro-skip, .cr-intro-overlay button")
      ) {
        return;
      }
      event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        complete();
      }
    };
    const opts: AddEventListenerOptions = { passive: false };
    window.addEventListener("wheel", blockScroll, opts);
    window.addEventListener("touchmove", blockScroll, opts);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", blockScroll, opts);
      window.removeEventListener("touchmove", blockScroll, opts);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, complete]);

  const showOverlay = phase === "playing" || phase === "exiting";

  return (
    <>
      {showOverlay ? (
        <div
          className={`cr-intro-overlay ${phase === "exiting" ? "is-exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="CapitalRail opening"
        >
          <canvas ref={canvasRef} className="cr-intro-canvas" />
          <p
            className={`cr-intro-name ${nameVisible ? "is-visible" : ""}`}
            aria-hidden={!nameVisible}
          >
            <span className="cr-intro-name-text">CapitalRail</span>
          </p>
          <button
            type="button"
            className="cr-intro-skip"
            onClick={complete}
            aria-label="Skip intro"
          >
            Skip
          </button>
        </div>
      ) : null}
      <div
        className={`cr-app-shell ${phase === "done" || phase === "exiting" ? "is-revealed" : ""}`}
      >
        {children}
      </div>
    </>
  );
}
