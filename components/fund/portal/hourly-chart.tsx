'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney, formatMoneyCompact } from '@/lib/fund/format';

interface Point { hour: string; amount_cents: number; count: number }

const H = 180;
const PAD = { top: 12, right: 8, bottom: 22, left: 44 };

function niceMax(v: number) {
  if (v <= 0) return 100_00;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * exp;
}

/** Single-series column chart: impact (gifts + match) per hour, last 48h. Hover for exact values. */
export function HourlyChart({ points, currency = 'usd', hours = 48 }: { points: Point[]; currency?: string; hours?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(720);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const series = useMemo(() => {
    const byHour = new Map(points.map((p) => [new Date(p.hour).getTime(), p]));
    const end = new Date();
    end.setMinutes(0, 0, 0);
    return Array.from({ length: hours }, (_, i) => {
      const t = end.getTime() - (hours - 1 - i) * 3_600_000;
      const p = byHour.get(t);
      return { t, amount: p?.amount_cents ?? 0, count: p?.count ?? 0 };
    });
  }, [points, hours]);

  const max = niceMax(Math.max(...series.map((s) => s.amount)));
  const innerW = Math.max(100, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / series.length;
  const bar = Math.min(24, Math.max(2, slot - 2));
  const ticks = [0, max / 2, max];
  const active = hover != null ? series[hover] : null;

  return (
    <div className="relative" ref={box}>
      <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`Raised per hour, last ${hours} hours`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => {
          const y = PAD.top + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMoneyCompact(t, currency)}
              </text>
            </g>
          );
        })}
        {series.map((s, i) => {
          const h = (s.amount / max) * innerH;
          const x = PAD.left + i * slot + (slot - bar) / 2;
          const y = PAD.top + innerH - h;
          const r = Math.min(4, bar / 2, h);
          return (
            <g key={s.t} onMouseEnter={() => setHover(i)}>
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${PAD.top + innerH} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + bar - r},${y} Q${x + bar},${y} ${x + bar},${y + r} L${x + bar},${PAD.top + innerH} Z`}
                  fill="var(--fund-accent)"
                  opacity={hover == null || hover === i ? 1 : 0.45}
                />
              )}
            </g>
          );
        })}
        {[0, Math.floor(series.length / 2), series.length - 1].map((i) => (
          <text key={i} x={PAD.left + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="fill-slate-400 text-[11px]">
            {new Date(series[i]!.t).toLocaleTimeString('en-US', { hour: 'numeric' })}
          </text>
        ))}
      </svg>
      {active && hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(width - 70, Math.max(70, PAD.left + hover * slot + slot / 2)) }}
        >
          <p className="font-medium text-slate-900">{formatMoney(active.amount, currency)}</p>
          <p className="text-slate-500">{active.count} gifts · {new Date(active.t).toLocaleString('en-US', { weekday: 'short', hour: 'numeric' })}</p>
        </div>
      )}
    </div>
  );
}
