"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

function subscribeNoop() {
  return () => {};
}

export type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  delay: number;
};

type ToastContextValue = {
  notify: (type: ToastType, message: string, delayMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

const progressTone: Record<ToastType, string> = {
  success: "bg-gradient-to-r from-emerald-300/45 to-emerald-300",
  error: "bg-gradient-to-r from-rose-500/45 to-rose-500",
  info: "bg-gradient-to-r from-cyan-300/45 to-cyan-300",
};

function IconSuccess() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.2 8.1 L7.1 10 L10.8 5.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconError() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.8 5.8 L10.2 10.2 M10.2 5.8 L5.8 10.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 7.2 V11.2 M8 5.2 V5.35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ToastCard({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);

  const close = useCallback(() => {
    setExiting(true);
    window.setTimeout(() => onClose(item.id), 220);
  }, [item.id, onClose]);

  useEffect(() => {
    const timer = window.setTimeout(close, item.delay);
    return () => window.clearTimeout(timer);
  }, [close, item.delay]);

  const tone =
    item.type === "success"
      ? "border-emerald-300/30 bg-[#06251f]/95 text-emerald-100"
      : item.type === "error"
        ? "border-rose-300/30 bg-[#2a0f14]/95 text-rose-100"
        : "border-cyan-200/25 bg-[#031017]/95 text-cyan-50";

  return (
    <div
      className={`pointer-events-auto relative w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border px-3.5 py-3 shadow-2xl shadow-black/40 backdrop-blur-md transition ${tone} ${
        exiting ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"
      }`}
      role="status"
    >
      <div className="flex items-start gap-2.5">
        {item.type === "success" ? (
          <IconSuccess />
        ) : item.type === "error" ? (
          <IconError />
        ) : (
          <IconInfo />
        )}
        <p className="min-w-0 flex-1 text-sm leading-5">{item.message}</p>
        <button
          type="button"
          aria-label="Dismiss"
          className="cursor-pointer rounded-lg p-1 text-current/60 hover:bg-white/10 hover:text-current"
          onClick={close}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" aria-hidden>
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
        className={`toast-progress absolute bottom-0 left-0 h-0.5 w-full origin-left ${progressTone[item.type]}`}
        style={{ animationDuration: `${item.delay}ms` }}
        aria-hidden
      />
    </div>
  );
}

/** Cloak-style toast stack (top-right). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const notify = useCallback((type: ToastType, message: string, delayMs = 4200) => {
    const id = crypto.randomUUID();
    setItems((current) => [...current, { id, type, message, delay: delayMs }]);
  }, []);

  const onClose = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const contextValue = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {mounted
        ? createPortal(
            <div className="pointer-events-none fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[100010] flex flex-col gap-2 sm:right-4">
              {items.map((item) => (
                <ToastCard key={item.id} item={item} onClose={onClose} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}
