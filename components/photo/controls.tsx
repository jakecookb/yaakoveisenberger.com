'use client';

import { useEffect, useRef, useState } from 'react';
import { sampleCurve } from '@/lib/photo/curves';
import type { Histogram } from '@/lib/photo/engine';
import type { CurveChannel, Point } from '@/lib/photo/params';

export const ACCENT = '#fda4af';

/** A labelled slider. Double-click (or double-tap) the label or value to reset it. */
export function Slider({ label, value, min, max, step = 1, def = 0, unit = '', onChange, onStart, onEnd, gradient }: {
  label: string; value: number; min: number; max: number; step?: number; def?: number; unit?: string;
  onChange: (v: number) => void; onStart: () => void; onEnd: () => void; gradient?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const zero = ((def - min) / (max - min)) * 100;
  const shown = step < 1 ? value.toFixed(2) : String(Math.round(value));
  const reset = () => { onStart(); onChange(def); onEnd(); };
  return (
    <div className="group/s">
      <div className="flex items-center justify-between text-xs">
        <button type="button" onDoubleClick={reset} className="font-medium text-neutral-300" title="Double-click to reset">{label}</button>
        <button type="button" onDoubleClick={reset} className={`tabular-nums ${value !== def ? 'text-white' : 'text-neutral-500'}`} title="Double-click to reset">{value > 0 && min < 0 ? '+' : ''}{shown}{unit}</button>
      </div>
      <div className="relative mt-1.5 h-5">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" style={gradient ? { background: gradient } : undefined} />
        {!gradient && <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ left: `${Math.min(pct, zero)}%`, width: `${Math.abs(pct - zero)}%`, background: ACCENT }} />}
        <input
          type="range" min={min} max={max} step={step} value={value} aria-label={label}
          onPointerDown={onStart} onPointerUp={onEnd} onKeyDown={onStart} onKeyUp={onEnd} onBlur={onEnd}
          onChange={(e) => onChange(Number(e.target.value))}
          className="photo-range absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}

/** Live histogram: red, green and blue overlaid, with luminance in white. */
export function HistogramView({ h }: { h: Histogram | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth * dpr;
    const H = c.clientHeight * dpr;
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    if (!h) return;
    const draw = (a: Uint32Array, color: string) => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i < 256; i++) ctx.lineTo((i / 255) * W, H - Math.min(1, a[i] / h.max) * H * 0.95);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    ctx.globalCompositeOperation = 'lighter';
    draw(h.r, 'rgba(239,68,68,0.55)');
    draw(h.g, 'rgba(34,197,94,0.55)');
    draw(h.b, 'rgba(59,130,246,0.6)');
    ctx.globalCompositeOperation = 'source-over';
    draw(h.l, 'rgba(255,255,255,0.12)');
  }, [h]);
  return <canvas ref={ref} className="h-20 w-full rounded-xl bg-neutral-950/80 ring-1 ring-white/10" aria-label="Histogram" role="img" />;
}

const CH_COLOR: Record<CurveChannel, string> = { master: '#f5f5f5', r: '#ef4444', g: '#22c55e', b: '#3b82f6' };

/** Draggable tone curve. Tap to add a point, drag to move it, double-tap a point to remove it. */
export function CurvesEditor({ curves, onChange, onStart, onEnd, hist }: {
  curves: Record<CurveChannel, Point[]>; onChange: (c: Record<CurveChannel, Point[]>) => void; onStart: () => void; onEnd: () => void; hist: Histogram | null;
}) {
  const [ch, setCh] = useState<CurveChannel>('master');
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  const pts = curves[ch];
  const lut = sampleCurve(pts);
  const path = Array.from({ length: 65 }, (_, i) => { const x = i / 64; return `${i ? 'L' : 'M'}${x * 100},${(1 - lut[Math.round(x * 255)]) * 100}`; }).join('');
  const histArr = hist ? { master: hist.l, r: hist.r, g: hist.g, b: hist.b }[ch] : null;
  const histPath = histArr && hist ? `M0,100 ${Array.from({ length: 64 }, (_, i) => { let v = 0; for (let k = 0; k < 4; k++) v = Math.max(v, histArr[i * 4 + k]); return `L${(i / 63) * 100},${100 - Math.min(1, v / hist.max) * 90}`; }).join(' ')} L100,100 Z` : '';

  const at = (e: React.PointerEvent): Point => {
    const r = svg.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))];
  };
  const set = (next: Point[]) => onChange({ ...curves, [ch]: next });

  const down = (e: React.PointerEvent) => {
    const p = at(e);
    let i = pts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.06);
    onStart();
    if (i < 0) {
      const next = [...pts, p].sort((a, b) => a[0] - b[0]);
      i = next.indexOf(p);
      set(next);
    }
    drag.current = i;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const i = drag.current;
    if (i === null) return;
    const p = at(e);
    const next = pts.map((q) => [...q] as Point);
    const lo = i === 0 ? 0 : next[i - 1][0] + 0.01;
    const hi = i === next.length - 1 ? 1 : next[i + 1][0] - 0.01;
    next[i] = [i === 0 || i === next.length - 1 ? Math.min(hi, Math.max(lo, p[0])) : Math.min(hi, Math.max(lo, p[0])), p[1]];
    set(next);
  };
  const up = () => { if (drag.current !== null) { drag.current = null; onEnd(); } };
  const remove = (i: number) => { if (i === 0 || i === pts.length - 1) return; onStart(); set(pts.filter((_, k) => k !== i)); onEnd(); };

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-300">Curves</span>
        <div className="flex gap-1">
          {(['master', 'r', 'g', 'b'] as CurveChannel[]).map((c) => (
            <button key={c} type="button" onClick={() => setCh(c)} aria-pressed={ch === c} className={`h-7 min-w-7 rounded-lg px-2 text-[11px] font-semibold uppercase ring-1 transition ${ch === c ? 'bg-white/10 text-white ring-white/30' : 'text-neutral-500 ring-white/10 hover:text-white'}`}>
              <span style={{ color: ch === c ? CH_COLOR[c] : undefined }}>{c === 'master' ? 'RGB' : c}</span>
            </button>
          ))}
          <button type="button" onClick={() => { onStart(); set([[0, 0], [1, 1]]); onEnd(); }} className="h-7 rounded-lg px-2 text-[11px] text-neutral-500 ring-1 ring-white/10 hover:text-white">Reset</button>
        </div>
      </div>
      <svg
        ref={svg} viewBox="0 0 100 100" preserveAspectRatio="none"
        className="mt-2 aspect-square w-full touch-none select-none rounded-xl bg-neutral-950/80 ring-1 ring-white/10"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        role="application" aria-label={`${ch === 'master' ? 'RGB' : ch.toUpperCase()} curve — tap to add a point, drag to move it, double-tap a point to remove it`}
      >
        {[25, 50, 75].map((v) => <g key={v} stroke="rgba(255,255,255,0.07)" strokeWidth="0.4"><line x1={v} y1="0" x2={v} y2="100" /><line x1="0" y1={v} x2="100" y2={v} /></g>)}
        {histPath && <path d={histPath} fill={ch === 'master' ? 'rgba(255,255,255,0.08)' : `${CH_COLOR[ch]}22`} />}
        <line x1="0" y1="100" x2="100" y2="0" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
        <path d={path} fill="none" stroke={CH_COLOR[ch]} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0] * 100} cy={(1 - p[1]) * 100} r="2.6" fill="#0a0a0a" stroke={CH_COLOR[ch]} strokeWidth="1.5" vectorEffect="non-scaling-stroke" onDoubleClick={() => remove(i)} />
        ))}
      </svg>
    </div>
  );
}
