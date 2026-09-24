"use client";

import {
  ANTHROPIC_TOOLS_JSON,
  CAPITALRAIL_LIVE_BASE,
  INTENT_CURL,
  MCP_CURSOR_CONFIG,
  OPENAI_TOOLS_JSON,
  OPENAPI_PATH,
  PREFLIGHT_CURL,
} from "@/features/preflight/lib/agent-api-docs";
import { IconCopy } from "@/shared/ui/icons";
import { useToast } from "@/shared/ui/Toast";

const linkBtn =
  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-1 text-[0.8rem] font-medium text-cyan-200/80 underline-offset-2 touch-manipulation hover:text-cyan-100 hover:underline";

const copyBtn =
  "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200/20 bg-white/[0.03] px-2.5 py-1 font-mono text-[0.68rem] text-emerald-100/90 transition-colors touch-manipulation hover:border-emerald-200/40 hover:text-white";

function CopyBlock({
  title,
  subtitle,
  code,
  label,
}: {
  title: string;
  subtitle?: string;
  code: string;
  label: string;
}) {
  const { notify } = useToast();
  const copy = () => {
    void navigator.clipboard
      .writeText(code)
      .then(() => notify("success", `${label} copied.`))
      .catch(() => notify("error", "Could not copy to the clipboard."));
  };

  return (
    <div className="rounded-xl border border-emerald-200/12 bg-white/[0.02] p-3 sm:p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="m-0 text-[0.88rem] font-medium tracking-[-0.01em] text-slate-100">
            {title}
          </p>
          {subtitle ? (
            <p className="m-0 mt-0.5 text-[0.72rem] text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <button type="button" className={copyBtn} onClick={copy}>
          <IconCopy className="h-3 w-3 shrink-0" />
          Copy
        </button>
      </div>
      <pre className="m-0 mt-2.5 max-h-52 overflow-auto rounded-lg border border-white/6 bg-[#020b10]/70 p-2.5 font-mono text-[0.68rem] leading-relaxed text-slate-300 whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}

export function ForAgentsSection() {
  const openapiHref = OPENAPI_PATH;
  const liveOpenapi = `${CAPITALRAIL_LIVE_BASE}${OPENAPI_PATH}`;

  return (
    <section
      id="agents"
      aria-labelledby="agents-title"
      className="scroll-mt-24 rounded-2xl border border-cyan-100/12 bg-[#06171e]/80 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-5 md:p-6"
    >
      <p className="section-kicker m-0">For agents</p>
      <h2
        id="agents-title"
        className="m-0 mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-100 sm:text-xl"
      >
        Call CapitalRail before you allocate.
      </h2>
      <p className="m-0 mt-2 max-w-3xl text-[0.88rem] leading-relaxed text-slate-400">
        CapitalRail is a <span className="text-slate-200">preflight gatekeeper</span>,
        not a desk. Other agents POST here before sending capital to IXS vaults.
        Humans use the guided flow above; agents use the same REST surface (and
        optional MCP) to get GO / WAIT / NO-GO with reasons - then only act on GO.
        MCP deposit limit 0 may mean NAV staleness (not permanently closed); still
        treat it as WAIT until build succeeds. Async HYB rails settle against a
        daily 5:00 PM SGT cutoff.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl border border-cyan-200/15 bg-cyan-200/[0.03] px-3.5 py-3">
          <p className="m-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-cyan-200/75">
            Agents
          </p>
          <p className="m-0 mt-1.5 text-[0.82rem] leading-snug text-slate-300">
            Parse intent → run preflight → respect WAIT / NO-GO. Unsigned tx pack
            only on GO with a real wallet. Preview wallet{" "}
            <span className="font-mono text-[0.72rem] text-cyan-100/90">
              0x...0001
            </span>{" "}
            for public data.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200/12 bg-white/[0.02] px-3.5 py-3">
          <p className="m-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-emerald-200/70">
            Humans
          </p>
          <p className="m-0 mt-1.5 text-[0.82rem] leading-snug text-slate-300">
            Tell us → We check → Decision → Review &amp; sign in the browser.
            Same checks; the UI adds one-click fixes and wallet signing.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        <a
          href={openapiHref}
          className={linkBtn}
          target="_blank"
          rel="noreferrer"
        >
          OpenAPI 3 spec
        </a>
        <a
          href={liveOpenapi}
          className={linkBtn}
          target="_blank"
          rel="noreferrer"
        >
          Live: capitalrail.ozc.fr/openapi.yaml
        </a>
        <p className="m-0 font-mono text-[0.68rem] text-slate-500">
          Set <span className="text-slate-400">$BASE_URL</span> ={" "}
          <span className="text-slate-400">{CAPITALRAIL_LIVE_BASE}</span> (or your host)
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.03] px-3.5 py-2.5">
        <p className="m-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-amber-200/75">
          Security notes
        </p>
        <ul className="m-0 mt-1.5 list-none space-y-1 p-0 text-[0.78rem] leading-snug text-slate-400">
          <li>No API auth today - rate limited per IP (preflight 6/min, intent 10/min, shared expensive 12/min).</li>
          <li>Browser cross-site Origin is blocked; curl / server-to-server / MCP (no Origin) are allowed.</li>
          <li>429 returns code RATE_LIMITED with Retry-After. Do not weaken limits from agents.</li>
          <li>Never force a deposit when preflight returns WAIT / DEPOSIT_LIMIT_ZERO - limit 0 can mean NAV stale; CapitalRail waits for a successful MCP build.</li>
        </ul>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <CopyBlock
          title="curl: POST /api/preflight"
          subtitle="Replace $BASE_URL with your host"
          code={PREFLIGHT_CURL}
          label="Preflight curl"
        />
        <CopyBlock
          title="curl: POST /api/intent"
          subtitle="Free text → mandate"
          code={INTENT_CURL}
          label="Intent curl"
        />
        <CopyBlock
          title="OpenAI-compatible tools"
          subtitle="capitalrail_intent + capitalrail_preflight"
          code={OPENAI_TOOLS_JSON}
          label="OpenAI tools JSON"
        />
        <CopyBlock
          title="Anthropic-style tools"
          subtitle="Same two tools, input_schema form"
          code={ANTHROPIC_TOOLS_JSON}
          label="Anthropic tools JSON"
        />
      </div>

      <div className="mt-2.5">
        <CopyBlock
          title="Cursor MCP config"
          subtitle="npm run mcp · env CAPITALRAIL_BASE_URL"
          code={MCP_CURSOR_CONFIG}
          label="MCP config"
        />
      </div>
    </section>
  );
}
