'use client';

import { forwardRef, memo, useId, type PointerEvent as RPointerEvent } from 'react';
import { AMOUNTS, BOARDS, FISH, TOPPINGS, type Design, type Fish, type Garnish, type Placed, type Topping } from '@/lib/fishboard/model';

// Draws a fish board from a design using real photos: every fish row and topping band is a strip cut from photos of
// Yaakov's own boards (public/fishboard), made seamless and repeated along the row; garnishes are photo cut-outs.
// Everything is seeded, so the same design always gives the same picture (and the emailed picture matches the screen).

export const VIEW_W = 1000;
export const VIEW_H = 680;
export const tex = (name: string, ext = 'jpg') => `/fishboard/${name}.${ext}`;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (n: number) => Math.round(n * 10) / 10;

interface Rect { x: number; y: number; w: number; h: number }

export function boardRect(size: Design['size']): Rect {
  return size === 'large' ? { x: 40, y: 54, w: 920, h: 592 } : { x: 180, y: 120, w: 640, h: 440 };
}

interface Lane { kind: 'fish' | 'top'; at: number; t: number; i: number }

/** Splits a span into fish rows and topping bands at the board's fish-to-topping ratio. */
function makeLanes(span: number, band: number, ratio: number, bands: boolean): Lane[] {
  const out: Lane[] = [];
  if (bands) {
    const n = Math.max(2, Math.round((span + band) / (ratio * band + band)));
    const k = span / (n * ratio * band + (n - 1) * band);
    let at = 0;
    for (let i = 0; i < n; i++) {
      out.push({ kind: 'fish', at, t: ratio * band * k, i });
      at += ratio * band * k;
      if (i < n - 1) { out.push({ kind: 'top', at, t: band * k, i }); at += band * k; }
    }
  } else {
    const n = Math.max(2, Math.round(span / (ratio * band)));
    for (let i = 0; i < n; i++) out.push({ kind: 'fish', at: (span / n) * i, t: span / n, i });
  }
  return out;
}

/** One photo strip repeated along a row. */
function Strip({ src, w, h, y, t, len, seed }: { src: string; w: number; h: number; y: number; t: number; len: number; seed: number }) {
  const tw = (t * w) / h;
  const tiles = [];
  for (let x = -rng(seed)() * tw, n = 0; x < len; x += tw, n++) tiles.push(<image key={n} href={src} x={r1(x)} y={r1(y)} width={r1(tw + 0.6)} height={r1(t)} preserveAspectRatio="none" />);
  return <>{tiles}</>;
}

// Fish rows are drawn a touch taller than their lane and toppings a touch wider than theirs, so they tuck into each other
// the way a packed board does instead of meeting at a ruler-straight line.
const FishRow = memo(function FishRow({ fish, y, t, len, seed }: { fish: Fish; y: number; t: number; len: number; seed: number }) {
  const f = FISH[fish];
  return <g className="fb-in"><Strip src={tex(f.tex)} w={f.w} h={160} y={y - t * 0.03} t={t * 1.06} len={len} seed={seed} /></g>;
});

/**
 * A topping band, piled like the real thing: the photo strip is shown through a soft mask whose edges wander in and out,
 * with a few pieces spilling onto the fish beside it — never a ruler-straight line.
 */
const ToppingBand = memo(function ToppingBand({ top, y, t, len, seed, mid, feather }: { top: Topping; y: number; t: number; len: number; seed: number; mid: string; feather: string }) {
  const tp = TOPPINGS[top];
  const rand = rng(seed * 7 + 3);
  const step = Math.max(8, t * 0.45);
  const wob = () => (rand() - 0.5) * t * 0.22;
  const topPts: string[] = [], botPts: string[] = [];
  for (let x = -step; x <= len + step; x += step) {
    topPts.push(`${r1(x)} ${r1(y + t * 0.02 + wob())}`);
    botPts.unshift(`${r1(x)} ${r1(y + t * 0.98 + wob())}`);
  }
  const spills = Array.from({ length: Math.round(len / (t * 0.9)) }, (_, n) => {
    const above = rand() < 0.5;
    return <circle key={n} cx={r1(rand() * len)} cy={r1(above ? y - t * (0.02 + rand() * 0.12) : y + t * (1.02 + rand() * 0.12))} r={r1(t * (0.06 + rand() * 0.08))} fill="#fff" />;
  });
  return (
    <g className="fb-in">
      <mask id={mid} maskUnits="userSpaceOnUse" x={-20} y={r1(y - t)} width={r1(len + 40)} height={r1(t * 3)}>
        <g filter={`url(#${feather})`}>
          <path d={`M${topPts.join('L')}L${botPts.join('L')}Z`} fill="#fff" />
          {spills}
        </g>
      </mask>
      <g mask={`url(#${mid})`}><Strip src={tex(tp.tex)} w={tp.w} h={110} y={y - t * 0.3} t={t * 1.6} len={len} seed={seed} /></g>
    </g>
  );
});

export function GarnishArt({ g }: { g: Garnish }) {
  return <image href={tex(`g-${g}`, 'png')} x={-34} y={-34} width={68} height={68} />;
}

/* ---------- the whole board ---------- */

export interface BoardArtProps {
  design: Design;
  selected?: number | null;
  onBoardPointerDown?: (e: RPointerEvent<SVGSVGElement>) => void;
  onGarnishPointerDown?: (i: number, e: RPointerEvent<SVGGElement>) => void;
  className?: string;
}

export const BoardArt = forwardRef<SVGSVGElement, BoardArtProps>(function BoardArt({ design: d, selected, onBoardPointerDown, onGarnishPointerDown, className }, ref) {
  const ids = useId().replace(/[^a-zA-Z0-9]/g, '') + '-';
  const B = BOARDS[d.board];
  const outer = boardRect(d.size);
  const rim = 26;
  const frame: Rect = { x: outer.x + rim, y: outer.y + rim, w: outer.w - rim * 2, h: outer.h - rim * 2 };
  const borderW = d.border === 'none' ? 0 : 30;
  const C: Rect = borderW ? { x: frame.x + borderW, y: frame.y + borderW, w: frame.w - borderW * 2, h: frame.h - borderW * 2 } : frame;

  const band = d.size === 'large' ? 30 : 32;
  // Yaakov's boards run about 2 parts fish to 1 part onion; more fish makes the rows wider.
  const ratio = 2 * AMOUNTS[d.amount].fish;
  const bands = d.placement === 'bands';
  // Lanes are drawn as horizontal strips in their own space, then turned to run across, up, or on the diagonal.
  const space = d.layout === 'rows' ? { len: C.w, span: C.h, tf: `translate(${C.x} ${C.y})` }
    : d.layout === 'strips' ? { len: C.h, span: C.w, tf: `translate(${C.x} ${C.y + C.h}) rotate(-90)` }
    : (() => { const L = Math.hypot(C.w, C.h); return { len: L, span: L, tf: `translate(${C.x + C.w / 2} ${C.y + C.h / 2}) rotate(-32) translate(${-L / 2} ${-L / 2})` }; })();
  const lanes = makeLanes(space.span, band, ratio, bands);
  const key = `${d.size}${d.amount}${d.layout}${d.placement}${d.border}`;

  // Salt & cracked pepper: a fixed, fine scatter over the food.
  const sp = rng(77);
  const specks = d.saltPepper ? Array.from({ length: Math.round((C.w * C.h) / 1100) }, (_, n) => {
    const x = C.x + sp() * C.w, y = C.y + sp() * C.h, salt = sp() < 0.3;
    return salt ? <rect key={n} x={r1(x)} y={r1(y)} width={1.6} height={1.6} fill="#fff" opacity={0.8} /> : <circle key={n} cx={r1(x)} cy={r1(y)} r={r1(0.5 + sp() * 0.9)} fill="#17110d" opacity={0.8} />;
  }) : null;

  const grain = rng(d.board.length * 13);
  const msgTex = d.messageStyle === 'pomegranate' ? TOPPINGS.pomegranate : d.messageStyle === 'herbs' ? TOPPINGS.herbs : TOPPINGS.onion;
  const msgStroke = d.messageStyle === 'pomegranate' ? '#3d0410' : d.messageStyle === 'herbs' ? '#173a0b' : '#6b6250';
  const msgSize = Math.min(C.h * 0.3, (C.w * 0.84) / Math.max(3, d.message.length * 0.8));

  return (
    <svg ref={ref} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={className} onPointerDown={onBoardPointerDown} role="img" aria-label="Preview of your fish board" xmlns="http://www.w3.org/2000/svg">
      <style>{`.fb-in{animation:fbIn .45s cubic-bezier(.2,.8,.2,1) both}@keyframes fbIn{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.fb-in{animation:none}}`}</style>
      <defs>
        <linearGradient id={`${ids}wood`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={B.a} /><stop offset="1" stopColor={B.b} /></linearGradient>
        <pattern id={`${ids}msg`} width={r1((msgTex.w * 40) / 110)} height="40" patternUnits="userSpaceOnUse"><image href={tex(msgTex.tex)} width={r1((msgTex.w * 40) / 110)} height="40" preserveAspectRatio="none" /></pattern>
        <filter id={`${ids}feather`} x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="1.6" /></filter>
        <filter id={`${ids}shadow`} x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#000" floodOpacity=".55" /></filter>
        <filter id={`${ids}soft`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity=".45" /></filter>
        <clipPath id={`${ids}food`}><rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={12} /></clipPath>
        <clipPath id={`${ids}inner`}><rect x={C.x} y={C.y} width={C.w} height={C.h} rx={8} /></clipPath>
      </defs>

      {/* board */}
      <g filter={`url(#${ids}shadow)`}>
        <rect x={outer.x} y={outer.y} width={outer.w} height={outer.h} rx={22} fill={`url(#${ids}wood)`} />
      </g>
      {d.board === 'pine' ? (
        // Pine planks: fine lengthwise grain, like the boards in Yaakov's photos.
        <g stroke={B.grain} strokeLinecap="round" fill="none">
          {Array.from({ length: Math.round(outer.w / 7) }, (_, k) => {
            const x = outer.x + 6 + k * 7 + grain() * 4;
            const wob = (grain() - 0.5) * 6;
            return <path key={k} d={`M${r1(x)} ${outer.y + 4}Q${r1(x + wob)} ${r1(outer.y + outer.h / 2)} ${r1(x)} ${outer.y + outer.h - 4}`} strokeWidth={r1(0.5 + grain() * 1.4)} opacity={r1(0.15 + grain() * 0.35)} />;
          })}
        </g>
      ) : (
        <g opacity={d.board === 'marble' ? 0.55 : 0.35} fill="none" stroke={B.grain} strokeLinecap="round">
          {Array.from({ length: d.board === 'marble' ? 6 : 16 }, (_, k) => {
            const y = outer.y + 10 + grain() * (outer.h - 20);
            const a = (grain() - 0.5) * 30;
            return <path key={k} d={`M${outer.x + 8} ${r1(y)}C${r1(outer.x + outer.w * 0.3)} ${r1(y + a)} ${r1(outer.x + outer.w * 0.6)} ${r1(y - a)} ${outer.x + outer.w - 8} ${r1(y + a / 2)}`} strokeWidth={d.board === 'marble' ? 1.4 : 1 + grain() * 1.5} />;
          })}
        </g>
      )}
      <rect x={outer.x + 1.5} y={outer.y + 1.5} width={outer.w - 3} height={outer.h - 3} rx={21} fill="none" stroke="#fff" strokeOpacity=".14" strokeWidth="3" />
      <rect x={frame.x - 3} y={frame.y - 3} width={frame.w + 6} height={frame.h + 6} rx={14} fill="#000" opacity=".14" />

      {/* food */}
      <g clipPath={`url(#${ids}food)`}>
        {borderW > 0 && d.border !== 'none' && (
          <g key={`b${key}${d.border}`}>
            <g transform={`translate(${frame.x} ${frame.y})`}><ToppingBand top={d.border} y={0} t={borderW} len={frame.w} seed={11} mid={`${ids}mb1`} feather={`${ids}feather`} /></g>
            <g transform={`translate(${frame.x} ${frame.y + frame.h - borderW})`}><ToppingBand top={d.border} y={0} t={borderW} len={frame.w} seed={12} mid={`${ids}mb2`} feather={`${ids}feather`} /></g>
            <g transform={`translate(${frame.x} ${frame.y + frame.h}) rotate(-90)`}><ToppingBand top={d.border} y={0} t={borderW} len={frame.h} seed={13} mid={`${ids}mb3`} feather={`${ids}feather`} /></g>
            <g transform={`translate(${frame.x + frame.w - borderW} ${frame.y + frame.h}) rotate(-90)`}><ToppingBand top={d.border} y={0} t={borderW} len={frame.h} seed={14} mid={`${ids}mb4`} feather={`${ids}feather`} /></g>
          </g>
        )}
        <g clipPath={`url(#${ids}inner)`}>
          <g transform={space.tf}>
            {lanes.filter((l) => l.kind === 'fish').map((l, n) => {
              const fish = d.fish[l.i % d.fish.length];
              return <g key={`${key}-f${n}-${fish}`}><FishRow fish={fish} y={l.at} t={l.t} len={space.len} seed={n * 101 + 7} /></g>;
            })}
            {lanes.map((l, n) => {
              const top = d.toppings[l.i % d.toppings.length];
              if (l.kind === 'top') return <g key={`${key}-t${n}-${top}`}><ToppingBand top={top} y={l.at} t={l.t} len={space.len} seed={n * 57 + 5} mid={`${ids}mt${n}`} feather={`${ids}feather`} /></g>;
              if (bands) return null;
              const lt = Math.max(10, l.t * 0.28);
              return <g key={`${key}-l${n}-${top}`}><ToppingBand top={top} y={l.at + l.t / 2 - lt / 2} t={lt} len={space.len} seed={n * 31 + 3} mid={`${ids}ml${n}`} feather={`${ids}feather`} /></g>;
            })}
          </g>
        </g>
        {specks && <g className="fb-in">{specks}</g>}
      </g>

      {/* message, "written" in a real topping */}
      {d.message && (
        <text x={VIEW_W / 2} y={outer.y + outer.h / 2 + msgSize * 0.34} textAnchor="middle" fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif" fontWeight={900} fontSize={r1(msgSize)} letterSpacing={2} fill={`url(#${ids}msg)`} stroke={msgStroke} strokeWidth={2} paintOrder="stroke" filter={`url(#${ids}soft)`}>
          {d.message}
        </text>
      )}

      {/* garnishes */}
      {d.garnishes.map((p: Placed, i) => (
        <g key={i} transform={`translate(${r1(p.x * VIEW_W)} ${r1(p.y * VIEW_H)}) rotate(${r1(p.r)}) scale(${p.s})`} filter={`url(#${ids}soft)`} onPointerDown={onGarnishPointerDown ? (e) => onGarnishPointerDown(i, e) : undefined} style={onGarnishPointerDown ? { cursor: 'grab' } : undefined}>
          <GarnishArt g={p.g} />
          {selected === i && <circle className="fb-ui" r={40} fill="none" stroke="#fff" strokeWidth={2} strokeDasharray="6 5" />}
        </g>
      ))}
    </svg>
  );
});
