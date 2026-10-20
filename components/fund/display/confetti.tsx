'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLORS = ['#facc15', '#f472b6', '#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#ffffff'];

/** GPU-only confetti burst (transforms + opacity). Re-key it to fire again. */
export function Confetti({ pieces = 70, seed = 1 }: { pieces?: number; seed?: number }) {
  const parts = useMemo(() => {
    // Deterministic hash noise (no mutation, no Math.random during render).
    const noise = (n: number) => {
      const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return Array.from({ length: pieces }, (_, i) => {
      const r = (k: number) => noise(i * 8 + k);
      return {
        i,
        x: r(1) * 100,
        drift: (r(2) - 0.5) * 30,
        delay: r(3) * 0.6,
        duration: 2.6 + r(4) * 1.8,
        rotate: (r(5) - 0.5) * 900,
        size: 0.7 + r(6) * 0.9,
        color: COLORS[Math.floor(r(7) * COLORS.length)]!,
        round: r(8) > 0.6,
      };
    });
  }, [pieces, seed]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {parts.map((p) => (
        <motion.span
          key={p.i}
          className="absolute top-0 block"
          style={{ left: `${p.x}%`, width: `${p.size}em`, height: `${p.size * (p.round ? 1 : 0.45)}em`, background: p.color, borderRadius: p.round ? '9999px' : '2px' }}
          initial={{ y: '-10vh', x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', x: `${p.drift}vw`, rotate: p.rotate, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}
