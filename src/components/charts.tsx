import { fmtMoney, fmtPct } from "@/lib/money";

/**
 * Hand-rolled SVG charts. They render on the server, carry no client JS, and
 * inherit theme colours from CSS variables so light/dark just works.
 */

type Point = { x: number; y: number; label?: string };

function pathFor(points: Point[], w: number, h: number, pad: number) {
  if (points.length === 0)
    return {
      d: "",
      area: "",
      zeroY: h - pad,
      scaleY: (value: number) => {
        void value;
        return h - pad;
      },
    };
  const ys = points.map((p) => p.y);
  const min = Math.min(0, ...ys);
  const max = Math.max(0, ...ys);
  const span = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const scaleX = (i: number) =>
    pad + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const scaleY = (v: number) => pad + innerH - ((v - min) / span) * innerH;

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(i)},${scaleY(p.y)}`).join(" ");
  const area = `${d} L${scaleX(points.length - 1)},${scaleY(0)} L${scaleX(0)},${scaleY(0)} Z`;
  return { d, area, zeroY: scaleY(0), scaleX, scaleY, min, max };
}

export function LineChart({
  points,
  height = 160,
  width = 640,
  format = "money",
  positiveTone = true,
}: {
  points: Point[];
  height?: number;
  width?: number;
  format?: "money" | "pct";
  positiveTone?: boolean;
}) {
  if (points.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-[var(--text-dim)]">No data yet.</div>;
  }

  const pad = 12;
  const { d, area, zeroY } = pathFor(points, width, height, pad);
  const last = points[points.length - 1].y;
  const stroke = !positiveTone
    ? "var(--accent)"
    : last >= 0
      ? "var(--up)"
      : "var(--down)";

  return (
    <div className="scroll-x px-3 py-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Trend ending at ${format === "money" ? fmtMoney(last) : fmtPct(last)}`}
        preserveAspectRatio="none"
      >
        <line
          x1={pad}
          x2={width - pad}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--border-strong)"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
        <path d={area} fill={stroke} opacity={0.1} />
        <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-[var(--text-faint)]">
        <span>{points[0].label ?? ""}</span>
        <span className="tabular font-medium text-[var(--text-dim)]">
          {format === "money" ? fmtMoney(last, { sign: true }) : fmtPct(last)}
        </span>
        <span>{points[points.length - 1].label ?? ""}</span>
      </div>
    </div>
  );
}

export function BarChart({
  bars,
  height = 150,
  format = "money",
}: {
  bars: { value: number; label?: string }[];
  height?: number;
  format?: "money" | "raw";
}) {
  if (bars.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-[var(--text-dim)]">No data yet.</div>;
  }
  const max = Math.max(...bars.map((b) => Math.abs(b.value)), 1);

  return (
    <div className="px-3 py-3">
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {bars.map((b, i) => (
          <div
            key={i}
            title={`${b.label ?? ""} ${format === "money" ? fmtMoney(b.value) : b.value}`}
            className="flex-1 rounded-t-sm bg-[var(--accent)] opacity-80 transition-opacity hover:opacity-100"
            style={{ height: `${Math.max(2, (Math.abs(b.value) / max) * 100)}%`, minWidth: 4 }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-[var(--text-faint)]">
        <span>{bars[0].label ?? ""}</span>
        <span>{bars[bars.length - 1].label ?? ""}</span>
      </div>
    </div>
  );
}

export function WinLossStrip({ results }: { results: number[] }) {
  const wins = results.filter((r) => r > 0).length;
  const losses = results.filter((r) => r < 0).length;
  return (
    <div className="px-4 py-3">
      <div className="flex gap-1">
        {results.map((r, i) => (
          <div
            key={i}
            className="h-7 flex-1 rounded-sm"
            style={{
              background:
                r > 0 ? "var(--up)" : r < 0 ? "var(--down)" : "var(--border-strong)",
              opacity: 0.85,
              minWidth: 6,
            }}
            title={fmtMoney(r, { sign: true })}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--text-dim)]">
        {wins} {wins === 1 ? "win" : "wins"} · {losses} {losses === 1 ? "loss" : "losses"}
      </p>
    </div>
  );
}

/** Small inline sparkline for table rows. */
export function Sparkline({ values, width = 72, height = 20 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-[var(--text-faint)]">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const rising = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} className="inline-block align-middle" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={rising ? "var(--up)" : "var(--down)"}
        strokeWidth={1.5}
      />
    </svg>
  );
}
