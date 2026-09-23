"use client";

import { useEffect, useRef, useState } from "react";
import { CapitalRailMark } from "@/shared/ui/CapitalRailMark";

export type SiteHeaderLink = {
  href: string;
  label: string;
};

export type SiteHeaderStatus = {
  tone: "ok" | "warn" | "pending";
  label: string;
};

export type SiteHeaderWallet = {
  address: string | null;
  connecting: boolean;
  networkLabel: string | null;
  wrongNetwork: boolean;
};

type SiteHeaderProps = {
  links: SiteHeaderLink[];
  status: SiteHeaderStatus;
  wallet: SiteHeaderWallet;
  onConnect: () => void;
  onDisconnect: () => void;
  onSwitchNetwork: () => void;
};

const statusDot: Record<SiteHeaderStatus["tone"], string> = {
  ok: "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.7)]",
  warn: "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.6)]",
  pending: "bg-slate-500 animate-pulse",
};

const menuItem =
  "flex min-h-10 w-full cursor-pointer items-center rounded-lg px-3 text-left text-[0.84rem] text-slate-200 transition-colors hover:bg-white/5 hover:text-white";

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function SiteHeader({
  links,
  status,
  wallet,
  onConnect,
  onDisconnect,
  onSwitchNetwork,
}: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const walletRef = useOutsideClose(walletOpen, () => setWalletOpen(false));
  const navRef = useOutsideClose(navOpen, () => setNavOpen(false));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const connected = Boolean(wallet.address);
  const short = wallet.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 md:px-6">
      <div
        className={`mx-auto flex h-14 max-w-[1052px] items-center gap-2 rounded-2xl border px-2.5 transition-all duration-300 sm:h-[3.75rem] sm:gap-3 sm:px-3 ${
          scrolled
            ? "border-cyan-100/18 bg-[#031016]/72 shadow-[0_14px_50px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
            : "border-cyan-100/12 bg-[#031016]/38 shadow-[0_8px_30px_rgba(0,0,0,0.16)] backdrop-blur-lg"
        }`}
      >
        <a
          href="#top"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          <CapitalRailMark className="h-8 w-8" />
          <span className="hidden text-lg font-semibold tracking-[-0.03em] text-white min-[400px]:inline">
            CapitalRail
          </span>
        </a>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex"
          aria-label="Primary"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          <span
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[0.68rem] text-slate-400 lg:inline-flex"
            title={status.label}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot[status.tone]}`} />
            {status.label}
          </span>

          <div ref={walletRef} className="relative">
            <button
              type="button"
              onClick={() => (connected ? setWalletOpen((v) => !v) : onConnect())}
              disabled={wallet.connecting}
              aria-haspopup={connected ? "menu" : undefined}
              aria-expanded={connected ? walletOpen : undefined}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 font-mono text-[0.74rem] font-medium transition-[filter,border-color,background-color] touch-manipulation disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 ${
                wallet.wrongNetwork
                  ? "border-amber-200/45 bg-amber-200/[0.1] text-amber-100"
                  : connected
                    ? "border-emerald-200/15 bg-white/[0.04] text-slate-200 hover:border-emerald-200/30"
                    : "border-emerald-200/30 bg-emerald-200/[0.12] text-emerald-100 hover:brightness-110"
              }`}
            >
              {connected ? (
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${wallet.wrongNetwork ? "bg-amber-300" : "bg-emerald-300"}`}
                />
              ) : null}
              {wallet.connecting
                ? "Connecting..."
                : wallet.wrongNetwork
                  ? "Wrong network"
                  : (short ?? (
                      <>
                        Connect<span className="hidden sm:inline"> wallet</span>
                      </>
                    ))}
            </button>
            {connected && walletOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+0.5rem)] w-60 rounded-xl border border-emerald-200/20 bg-[#06171e]/97 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl"
              >
                <div className="px-3 py-2">
                  <p className="m-0 break-all font-mono text-[0.72rem] text-slate-300">{wallet.address}</p>
                  <p className={`m-0 mt-1 text-[0.74rem] ${wallet.wrongNetwork ? "text-amber-200" : "text-slate-500"}`}>
                    {wallet.wrongNetwork
                      ? "Unsupported network - IXS vaults live on BSC and Avalanche"
                      : `Network: ${wallet.networkLabel ?? "unknown"}`}
                  </p>
                </div>
                {wallet.wrongNetwork ? (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItem}
                    onClick={() => {
                      setWalletOpen(false);
                      onSwitchNetwork();
                    }}
                  >
                    Switch to BSC
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className={`${menuItem} text-rose-200`}
                  onClick={() => {
                    setWalletOpen(false);
                    onDisconnect();
                  }}
                >
                  Disconnect
                </button>
              </div>
            ) : null}
          </div>

          <div ref={navRef} className="relative md:hidden">
            <button
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              aria-label={navOpen ? "Close menu" : "Open menu"}
              aria-expanded={navOpen}
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 touch-manipulation"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                {navOpen ? (
                  <path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                ) : (
                  <path d="M2.5 4.5 H13.5 M2.5 8 H13.5 M2.5 11.5 H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                )}
              </svg>
            </button>
            {navOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] w-56 rounded-xl border border-emerald-200/20 bg-[#06171e]/97 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                {links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className={menuItem}
                    onClick={() => setNavOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
                <p className="m-0 flex items-center gap-2 px-3 py-2 font-mono text-[0.68rem] text-slate-500">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot[status.tone]}`} />
                  {status.label}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
