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

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    document.documentElement.classList.add("cr-intro-done");
    document.body.classList.remove("cr-intro-active");
    setPhase((current) => (current === "done" ? current : "exiting"));
  }, []);

  useEffect(() => {
    if (reducedMotion === null) return;
    if (reducedMotion) {
      completedRef.current = true;
      document.documentElement.classList.add("cr-intro-done");
      document.body.classList.remove("cr-intro-active");
      return;
    }
    if (!completedRef.current) {
      document.body.classList.add("cr-intro-active");
    }
  }, [reducedMotion]);

  useEffect(() => {
    if (phase !== "playing") return;
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
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4 3.5 9 8l-5 4.5M10.5 3.5v9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
