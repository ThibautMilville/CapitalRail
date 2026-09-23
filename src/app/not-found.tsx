import Link from "next/link";
import { CapitalRailMark } from "@/shared/ui/CapitalRailMark";
import { BrandGlowTitle } from "@/shared/ui/GlowTitle";
import { SiteFooter } from "@/shared/ui/SiteFooter";

const btnPrimary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200/35 bg-emerald-300/[0.14] px-4 py-2.5 text-[0.9rem] font-semibold text-emerald-50 transition-[filter] touch-manipulation hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300/50";

const btnGhost =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-[0.88rem] font-medium text-slate-200 transition-colors touch-manipulation hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300/40";

/**
 * Root App Router 404. Renders inside the root layout (Geist fonts, navy shell).
 * `global-not-found` is experimental and only needed with multiple root layouts - skipped.
 * `data-cr-skip-intro` skips the Three.js OpeningIntro on this page.
 */
export default function NotFound() {
  return (
    <div
      data-cr-skip-intro
      className="relative flex min-h-[100dvh] flex-1 flex-col"
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#02090d]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_22%,rgba(21,125,116,0.14),transparent_38%),radial-gradient(circle_at_18%_78%,rgba(56,160,180,0.08),transparent_42%),linear-gradient(180deg,#02090d_0%,#06171e_55%,#02090d_100%)]" />
      </div>

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col justify-center px-3 py-16 sm:px-4 md:px-6">
        <p className="section-kicker m-0">404</p>
        <div className="mt-3 flex min-w-0 items-center gap-3 sm:gap-4">
          <CapitalRailMark className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
          <h1 className="m-0 min-w-0 text-[clamp(1.85rem,7vw,3.2rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
            <BrandGlowTitle lead="Capital" accent="Rail" />
          </h1>
        </div>

        <h2 className="mt-6 m-0 text-[clamp(1.35rem,4.2vw,1.85rem)] font-semibold tracking-[-0.03em] text-[#f5fbfd]">
          Page not found
        </h2>
        <p className="mt-2 max-w-md text-[0.95rem] leading-relaxed text-slate-400 sm:text-[1.02rem]">
          This route is not on the rail. Head home to check an IXS entry, or open
          vaults and the agent API docs.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-2.5 sm:gap-3">
          <Link href="/" className={btnPrimary}>
            Back to home
          </Link>
          <Link href="/vaults" className={btnGhost}>
            Vaults
          </Link>
          <Link href="/#agents" className={btnGhost}>
            For agents
          </Link>
        </div>
      </main>

      <div className="mx-auto w-full max-w-[1100px] px-3 pb-6 sm:px-4 md:px-6">
        <SiteFooter />
      </div>
    </div>
  );
}
