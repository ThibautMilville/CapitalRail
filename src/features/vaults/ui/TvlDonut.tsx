"use client";

type Slice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type TvlDonutProps = {
  slices: Slice[];
  title: string;
  centerLabel: string;
  centerValue: string;
};

const COLORS = ["#5beebd", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#34d399"];

export function buildVaultSlices(
  items: { id: string; label: string; totalAssets: string | null }[],
): Slice[] {
  return items
    .map((item, index) => {
      const value = Number.parseFloat(item.totalAssets ?? "");
      return {
        id: item.id,
        label: item.label,
        value: Number.isFinite(value) && value > 0 ? value : 0,
        color: COLORS[index % COLORS.length],
      };
    })
    .filter((s) => s.value > 0);
}

export function buildChainSlices(
  items: { chainLabel: string; totalAssets: string | null }[],
): Slice[] {
  const byChain = new Map<string, number>();
  for (const item of items) {
    const value = Number.parseFloat(item.totalAssets ?? "");
    if (!Number.isFinite(value) || value <= 0) continue;
    byChain.set(item.chainLabel, (byChain.get(item.chainLabel) ?? 0) + value);
  }
  return [...byChain.entries()].map(([label, value], index) => ({
    id: label,
    label,
    value,
    color: COLORS[index % COLORS.length],
  }));
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function buildArcs(slices: Slice[], total: number) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  let angle = -Math.PI / 2;
  return slices.map((slice) => {
    const sweep = (slice.value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return { ...slice, d: arcPath(cx, cy, r, start, end - 0.001), size, cx, cy };
  });
}

export function TvlDonut({ slices, title, centerLabel, centerValue }: TvlDonutProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0 || slices.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200/15 bg-[#06171e]/80 p-4 sm:p-5">
        <p className="m-0 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-cyan-200/70">
          {title}
        </p>
        <p className="m-0 mt-3 text-[0.9rem] text-slate-400">
          No live totalAssets to chart yet.
        </p>
      </div>
    );
  }

  const arcs = buildArcs(slices, total);
  const size = 160;

  return (
    <div className="rounded-2xl border border-emerald-200/15 bg-[#06171e]/80 p-4 sm:p-5">
      <p className="m-0 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-cyan-200/70">
        {title}
      </p>
      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
            {arcs.map((arc) => (
              <path
                key={arc.id}
                d={arc.d}
                fill="none"
                stroke={arc.color}
                strokeWidth={18}
                strokeLinecap="butt"
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="m-0 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-500">
              {centerLabel}
            </p>
            <p className="m-0 mt-0.5 font-mono text-[0.85rem] font-semibold text-emerald-100">
              {centerValue}
            </p>
          </div>
        </div>
        <ul className="m-0 flex w-full list-none flex-col gap-2 p-0">
          {slices.map((slice) => {
            const pct = ((slice.value / total) * 100).toFixed(1);
            return (
              <li key={slice.id} className="flex items-center gap-2 text-[0.82rem]">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: slice.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-slate-300">{slice.label}</span>
                <span className="shrink-0 font-mono text-slate-400">
                  {slice.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} · {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="m-0 mt-3 font-mono text-[0.65rem] text-slate-600">
        Live totalAssets from IXS vault_get - not APY.
      </p>
    </div>
  );
}
