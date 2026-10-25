'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import wordmark from '@/public/images/home/wordmark-white.png';

/**
 * The big name at the very foot of the page. It sits fixed to the bottom of the screen and only shows through this
 * clipped window, so the page lifts like a curtain to uncover it. As it does, the name is unveiled in the manner of a
 * coachbuilder's showroom: a gold rule draws out from the centre, then the wordmark is wiped in from its base upward
 * while it settles from slightly large and soft into crisp focus.
 */
export function NameReveal() {
  const win = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLDivElement>(null);
  const rule = useRef<HTMLSpanElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = win.current, n = name.current, l = rule.current, m = mark.current;
    if (!w || !n || !l || !m || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const r = w.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / r.height)); // 0 = just entering, 1 = fully uncovered
      const out = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3); // decelerating, so it settles softly
      const line = out(p / 0.45); // the rule leads
      const body = out((p - 0.2) / 0.8); // the wordmark follows
      l.style.transform = `scaleX(${line.toFixed(3)})`;
      l.style.opacity = line.toFixed(3);
      n.style.opacity = Math.min(1, body * 1.6).toFixed(3);
      m.style.clipPath = `inset(${((1 - body) * 100).toFixed(1)}% 0 0 0)`;
      m.style.transform = `translateY(${((1 - body) * 36).toFixed(1)}px) scale(${(1 + (1 - body) * 0.06).toFixed(4)})`;
      m.style.filter = body < 1 ? `blur(${((1 - body) * 8).toFixed(1)}px)` : '';
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div ref={win} aria-hidden className="relative h-[6.5rem] sm:h-[max(15svh,9rem)] [clip-path:inset(0)]">
      <div className="fixed inset-x-0 bottom-0 flex h-[6.5rem] sm:h-[max(15svh,9rem)] items-end justify-center bg-neutral-950 px-[5vw] pb-5 sm:pb-[3svh]">
        <div ref={name} className="relative w-full will-change-[opacity,transform]">
          <span ref={rule} className="mb-4 block h-px w-full origin-center bg-gradient-to-r from-transparent via-[#c8a96a] to-transparent" />
          <div ref={mark} className="origin-bottom will-change-[transform,clip-path,filter]">
            <Image src={wordmark} alt="" className="h-auto w-full" />
          </div>
        </div>
        {/* Black fades on either side, so the name melts into the page. */}
        <span className="pointer-events-none absolute inset-y-0 left-0 w-[7%] sm:w-[22%] bg-gradient-to-r from-neutral-950 via-neutral-950/70 to-transparent" />
        <span className="pointer-events-none absolute inset-y-0 right-0 w-[7%] sm:w-[22%] bg-gradient-to-l from-neutral-950 via-neutral-950/70 to-transparent" />
      </div>
    </div>
  );
}
