'use client';

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

// The little show when an ingredient is picked: the whole thing (an onion, a mango…) pops up over the board, a knife chops
// through it, it falls apart into pieces, and the pieces drop onto the board — where its new band fades in.
// Fish get sliced into strips instead of diced.

const DURATION = 1.35;

export interface Chop { id: number; src: string; label: string; kind: 'dice' | 'slice' }

export function ChopFX({ chop, onDone }: { chop: Chop; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, DURATION * 1000);
    return () => clearTimeout(t);
  }, [chop.id, onDone]);

  const cols = chop.kind === 'dice' ? 6 : 7;
  const rows = chop.kind === 'dice' ? 6 : 1;
  // Where each piece lands: spread over the board, a little random so it reads as tossed on, not stamped.
  const pieces = useMemo(() => {
    let a = chop.id * 9301 + 49297;
    const rand = () => ((a = (a * 233280 + 12345) % 2147483647) / 2147483647);
    return Array.from({ length: cols * rows }, (_, i) => i).filter((i) => {
      // only the pieces inside the round "whole ingredient" (dice) — the corners were never there
      if (rows === 1) return true;
      const cx = (i % cols) + 0.5 - cols / 2, cy = Math.floor(i / cols) + 0.5 - rows / 2;
      return Math.hypot(cx, cy) <= cols / 2;
    }).map((i) => ({
      i, c: i % cols, r: Math.floor(i / cols),
      jx: (rand() - 0.5) * 18, jy: (rand() - 0.5) * 18, rot: (rand() - 0.5) * 70,
      dx: (rand() - 0.5) * 380, dy: (rand() - 0.3) * 190, delay: rand() * 0.12,
    }));
  }, [chop.id, cols, rows]);

  const S = 168; // px: size of the whole ingredient on screen
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-hidden>
      <motion.div className="absolute inset-0 bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: DURATION, times: [0, 0.15, 0.7, 1] }} />
      <div className="relative" style={{ width: S, height: S }}>
        {pieces.map((p) => (
          <motion.div
            key={p.i}
            className="absolute bg-cover"
            style={{
              left: (p.c * S) / cols, top: (p.r * S) / rows, width: S / cols + 0.5, height: S / rows + 0.5,
              backgroundImage: `url(${chop.src})`, backgroundSize: `${S}px ${S}px`, backgroundPosition: `${(-p.c * S) / cols}px ${(-p.r * S) / rows}px`,
              borderRadius: chop.kind === 'dice' ? 3 : 2,
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: [0, 1, 1, 1, 0],
              scale: [0.6, 1, 1, chop.kind === 'dice' ? 0.86 : 0.94, 0.35],
              x: [0, 0, 0, p.jx, p.dx],
              y: [0, 0, 0, p.jy, p.dy],
              rotate: [0, 0, 0, p.rot * 0.3, p.rot],
            }}
            transition={{ duration: DURATION - p.delay, delay: p.delay, times: [0, 0.18, 0.5, 0.62, 1], ease: 'easeInOut' }}
          />
        ))}
        {/* the whole ingredient's round outline, gone once it's cut */}
        <motion.div className="absolute inset-0 rounded-full ring-4 ring-white/70" style={{ boxShadow: '0 20px 50px -10px rgba(0,0,0,.7)' }} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 1.05] }} transition={{ duration: DURATION * 0.55, times: [0, 0.3, 0.8, 1] }} />
        {/* knife: three quick chops */}
        <motion.svg viewBox="0 0 120 30" className="absolute left-1/2 top-1/2 w-56 -translate-x-1/2 drop-shadow-xl" initial={{ opacity: 0, y: -140 }} animate={{ opacity: [0, 1, 1, 1, 1, 1, 1, 0], y: [-140, 10, -60, 10, -60, 10, -50, -140], x: [-30, -30, 0, 0, 30, 30, 30, 30], rotate: [-8, -8, -4, -4, 0, 0, 0, 0] }} transition={{ duration: DURATION * 0.62, delay: DURATION * 0.15, ease: 'easeInOut' }}>
          <defs><linearGradient id="fb-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f5f7fa" /><stop offset="1" stopColor="#9aa3ad" /></linearGradient></defs>
          <path d="M4 18 L78 9 Q86 8 86 14 L86 22 L10 22 Q2 22 4 18Z" fill="url(#fb-blade)" stroke="#6b7480" strokeWidth=".8" />
          <rect x="86" y="10" width="32" height="12" rx="4" fill="#2b1d14" />
          <circle cx="96" cy="16" r="1.4" fill="#c9b79c" /><circle cx="108" cy="16" r="1.4" fill="#c9b79c" />
        </motion.svg>
      </div>
      <motion.p className="absolute bottom-4 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur" initial={{ opacity: 0, y: 8 }} animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, 0] }} transition={{ duration: DURATION, times: [0, 0.15, 0.8, 1] }}>
        {chop.kind === 'dice' ? `Dicing ${chop.label.toLowerCase()}…` : `Slicing ${chop.label.toLowerCase()}…`}
      </motion.p>
    </div>
  );
}
