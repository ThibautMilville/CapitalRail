import Image from "next/image";

const PARTNERS = [
  {
    href: "https://www.ixs.finance",
    label: "IXS",
    markSrc: "/partners/ixs-mark.png",
    markAlt: "IXS logo",
    markWidth: 24,
    markHeight: 24,
    markClassName: "h-6 w-6",
    showLabel: true,
  },
  {
    href: "https://openserv.ai",
    label: "OpenServ",
    markSrc: "/partners/openserv-logo-white.svg",
    markAlt: "OpenServ logo",
    markWidth: 120,
    markHeight: 29,
    markClassName: "h-5 w-auto sm:h-[1.35rem]",
    showLabel: false,
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-emerald-200/10 pt-6 pb-2 sm:mt-12 sm:pt-7">
      <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 text-center sm:text-left">
          <p className="m-0 text-sm text-slate-400">&copy; 2026 CapitalRail</p>
          <p className="m-0 mt-1.5 font-mono text-[0.68rem] leading-relaxed text-slate-600">
            SERV Hackathon - IXS entry preflight
          </p>
        </div>

        <div className="flex flex-col items-center gap-2.5 sm:items-end">
          <p className="m-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-600">
            Partners
          </p>
          <nav
            className="flex flex-wrap items-center justify-center gap-2 sm:justify-end"
            aria-label="Partners"
          >
            {PARTNERS.map((partner) => (
              <a
                key={partner.href}
                href={partner.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={partner.label}
                className="group inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200/12 bg-white/[0.03] px-3 py-2 transition-[border-color,background-color,color] hover:border-emerald-200/28 hover:bg-white/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300/50"
              >
                <Image
                  src={partner.markSrc}
                  alt={partner.markAlt}
                  width={partner.markWidth}
                  height={partner.markHeight}
                  className={`${partner.markClassName} opacity-80 transition-opacity group-hover:opacity-100`}
                  unoptimized
                />
                {partner.showLabel ? (
                  <span className="font-mono text-[0.72rem] text-slate-400 transition-colors group-hover:text-emerald-200/90">
                    {partner.label}
                  </span>
                ) : null}
              </a>
            ))}
          </nav>
          <p className="m-0 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-slate-600">
            GO only when capacity is real
          </p>
        </div>
      </div>
    </footer>
  );
}
