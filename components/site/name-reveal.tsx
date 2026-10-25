'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import wordmark from '@/public/images/home/wordmark-white.png';

/**
 * The big name at the very foot of the page. It sits fixed to the bottom of the screen and only shows through this
 * clipped window, so it is uncovered as you pull past the end; the name itself fades and rises into place as it does.
 */
export function NameReveal() {
  const win = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = win.current, n = name.current;
    if (!w || !n || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const r = w.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / r.height)); // 0 = just entering, 1 = fully uncovered
      const e = p * p * (3 - 2 * p);
      n.style.opacity = e.toFixed(3);
      n.style.transform = `translateY(${((1 - e) * 24).toFixed(1)}px)`;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div ref={win} aria-hidden className="relative h-[max(22svh,9rem)] [clip-path:inset(0)]">
      <div className="fixed inset-x-0 bottom-0 flex h-[max(22svh,9rem)] items-end justify-center bg-neutral-950 px-[5vw] pb-[4svh]">
        <div ref={name} className="relative w-full will-change-[opacity,transform]">
          <span className="mb-4 block h-px w-full bg-gradient-to-r from-transparent via-[#c8a96a] to-transparent" />
          <Image src={wordmark} alt="" className="h-auto w-full" />
        </div>
        {/* Black fades on either side, so the name melts into the page. */}
        <span className="pointer-events-none absolute inset-y-0 left-0 w-[22%] bg-gradient-to-r from-neutral-950 via-neutral-950/70 to-transparent" />
        <span className="pointer-events-none absolute inset-y-0 right-0 w-[22%] bg-gradient-to-l from-neutral-950 via-neutral-950/70 to-transparent" />
      </div>
    </div>
  );
}
