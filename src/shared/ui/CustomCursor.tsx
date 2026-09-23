"use client";

import { useEffect, useRef, useState } from "react";

/** Interactive targets that trigger the hover (scale / ring) state. */
const INTERACTIVE_SELECTOR =
  "a, button, [role='button'], summary, label, select, [data-cursor='interactive']";

/** Keep the system text caret on editable fields. */
const TEXT_FIELD_SELECTOR = "input, textarea, [contenteditable='true']";

type CursorMode = "default" | "hover" | "text";

/**
 * Soft emerald/teal cursor for fine pointers only.
 * Disabled on coarse pointers (touch) to avoid UX issues.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const mode = useRef<CursorMode>("default");
  const visible = useRef(false);
  const reducedMotion = useRef(false);
  const rafId = useRef(0);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const pointerMq = window.matchMedia("(pointer: fine)");
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncEnabled = () => {
      setEnabled(pointerMq.matches);
      reducedMotion.current = motionMq.matches;
    };

    syncEnabled();
    pointerMq.addEventListener("change", syncEnabled);
    motionMq.addEventListener("change", syncEnabled);
    return () => {
      pointerMq.removeEventListener("change", syncEnabled);
      motionMq.removeEventListener("change", syncEnabled);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    if (!enabled) {
      root.classList.remove("cr-cursor-active", "cr-cursor-text");
      return;
    }

    root.classList.add("cr-cursor-active");

    const resolveMode = (target: EventTarget | null): CursorMode => {
      if (!(target instanceof Element)) return "default";
      if (target.closest(TEXT_FIELD_SELECTOR)) return "text";
      if (target.closest(INTERACTIVE_SELECTOR)) return "hover";
      return "default";
    };

    const applyModeClass = (next: CursorMode) => {
      if (next === "text") {
        root.classList.add("cr-cursor-text");
      } else {
        root.classList.remove("cr-cursor-text");
      }
    };

    const onMove = (event: MouseEvent) => {
      pos.current.x = event.clientX;
      pos.current.y = event.clientY;
      visible.current = true;

      const next = resolveMode(event.target);
      if (next !== mode.current) {
        mode.current = next;
        applyModeClass(next);
      }
    };

    const onOver = (event: MouseEvent) => {
      const next = resolveMode(event.target);
      if (next !== mode.current) {
        mode.current = next;
        applyModeClass(next);
      }
    };

    const onLeaveWindow = () => {
      visible.current = false;
    };

    const tick = () => {
      const lerp = reducedMotion.current ? 1 : 0.16;
      ringPos.current.x += (pos.current.x - ringPos.current.x) * lerp;
      ringPos.current.y += (pos.current.y - ringPos.current.y) * lerp;

      const opacity = visible.current ? 1 : 0;
      const isHover = mode.current === "hover";
      const isText = mode.current === "text";
      const customOpacity = isText ? 0 : opacity;

      const dot = dotRef.current;
      const ring = ringRef.current;

      if (dot) {
        const dotScale = isHover ? 0.55 : 1;
        dot.style.opacity = String(customOpacity);
        dot.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%) scale(${dotScale})`;
      }

      if (ring) {
        const ringScale = isHover ? 1.55 : 1;
        ring.style.opacity = String(customOpacity * (isHover ? 0.95 : 0.5));
        ring.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0) translate(-50%, -50%) scale(${ringScale})`;
        ring.dataset.hover = isHover ? "true" : "false";
      }

      rafId.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeaveWindow);
    rafId.current = requestAnimationFrame(tick);

    return () => {
      root.classList.remove("cr-cursor-active", "cr-cursor-text");
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.documentElement.removeEventListener("mouseleave", onLeaveWindow);
      cancelAnimationFrame(rafId.current);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="cr-cursor" aria-hidden="true">
      <div ref={ringRef} className="cr-cursor-ring" />
      <div ref={dotRef} className="cr-cursor-dot" />
    </div>
  );
}
