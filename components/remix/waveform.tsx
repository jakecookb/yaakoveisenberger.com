'use client';

import { useEffect, useRef } from 'react';

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};

/**
 * One clip's waveform with draggable in/out handles, beat grid, cut markers and a playhead.
 * Click to move the playhead (and hear from there); drag a handle to trim. Handles snap to beats/markers when `snap`.
 */
export function Waveform({ peaks, duration, start, end, color, beats, markers, playhead, snap, onTrim, onTrimEnd, onSeek }: {
  peaks: Float32Array; duration: number; start: number; end: number; color: string; beats: number[]; markers: number[];
  playhead: number | null; snap: boolean; onTrim: (start: number, end: number) => void; onTrimEnd: () => void; onSeek: (t: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<'start' | 'end' | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(c.clientWidth * dpr));
    const H = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    const x = (t: number) => (t / duration) * W;
    // beat grid (every 4th beat brighter)
    beats.forEach((b, i) => { ctx.fillStyle = i % 4 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(Math.round(x(b)), 0, 1, H); });
    // waveform
    const mid = H / 2;
    for (let px = 0; px < W; px++) {
      const a = Math.floor((px / W) * peaks.length);
      const b = Math.max(a + 1, Math.floor(((px + 1) / W) * peaks.length));
      let m = 0;
      for (let i = a; i < b; i++) m = Math.max(m, peaks[i]);
      const t = (px / W) * duration;
      ctx.fillStyle = t >= start && t <= end ? color : 'rgba(163,163,163,0.25)';
      const h = Math.max(1, m * (H * 0.46));
      ctx.fillRect(px, mid - h, 1, h * 2);
    }
    // trimmed-away regions
    ctx.fillStyle = 'rgba(10,10,10,0.55)';
    ctx.fillRect(0, 0, x(start), H);
    ctx.fillRect(x(end), 0, W - x(end), H);
    // markers
    ctx.setLineDash([4 * dpr, 3 * dpr]);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = dpr;
    for (const m of markers) { ctx.beginPath(); ctx.moveTo(x(m), 0); ctx.lineTo(x(m), H); ctx.stroke(); }
    ctx.setLineDash([]);
    // handles
    for (const [t, side] of [[start, 1], [end, -1]] as const) {
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(Math.round(x(t)) - (side < 0 ? 2 * dpr : 0), 0, 2 * dpr, H);
      ctx.beginPath();
      const hx = x(t);
      ctx.moveTo(hx, 0); ctx.lineTo(hx + side * 10 * dpr, 0); ctx.lineTo(hx, 12 * dpr); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx, H); ctx.lineTo(hx + side * 10 * dpr, H); ctx.lineTo(hx, H - 12 * dpr); ctx.closePath(); ctx.fill();
    }
    if (playhead !== null) { ctx.fillStyle = '#22d3ee'; ctx.fillRect(Math.round(x(playhead)), 0, 2 * dpr, H); }
  }, [peaks, duration, start, end, color, beats, markers, playhead]);

  const timeAt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(duration, Math.max(0, ((e.clientX - r.left) / r.width) * duration));
  };
  const snapTo = (t: number, e: React.PointerEvent) => {
    if (!snap) return t;
    const r = ref.current!.getBoundingClientRect();
    const tol = (10 / r.width) * duration;
    let best = t, bd = tol;
    for (const p of [...markers, ...beats]) { const d = Math.abs(p - t); if (d < bd) { bd = d; best = p; } }
    void e;
    return best;
  };
  const down = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    const sx = (start / duration) * r.width;
    const ex = (end / duration) * r.width;
    const near = Math.min(Math.abs(px - sx), Math.abs(px - ex));
    if (near <= 14) {
      drag.current = Math.abs(px - sx) <= Math.abs(px - ex) ? 'start' : 'end';
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else onSeek(timeAt(e));
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const t = snapTo(timeAt(e), e);
    if (drag.current === 'start') onTrim(Math.min(t, end - 0.25), end);
    else onTrim(start, Math.max(t, start + 0.25));
  };
  const up = () => { if (drag.current) { drag.current = null; onTrimEnd(); } };

  return (
    <canvas
      ref={ref}
      className="h-24 w-full cursor-crosshair touch-none rounded-xl bg-neutral-950/80 ring-1 ring-white/10"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      role="img" aria-label={`Waveform, in ${fmtTime(start)}, out ${fmtTime(end)}`}
    />
  );
}
