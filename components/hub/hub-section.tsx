'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const HEADER = 56;

/**
 * A homepage section with its label.
 * Stacking: once a section has scrolled fully into view it stays put (sticky) while the next section slides up over it;
 * meanwhile it sinks back — shrinking, blurring and fading — and normal scrolling carries on once it's covered.
 * Transform/filter/opacity only, written straight to the element (no re-renders), so it stays smooth on phones.
 */
export function HubSection({ id, title, subtitle, accent, z, children }: { id: string; title: string; subtitle: string; accent: string; z: number; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [top, setTop] = useState(HEADER + 8);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    // A section taller than the screen scrolls normally until its bottom is in view, then holds there.
    const fit = () => setTop(Math.min(HEADER + 8, window.innerHeight - el.offsetHeight - 16));
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    let raf = 0;
    const paint = () => {
      raf = 0;
      const next = el.nextElementSibling as HTMLElement | null;
      if (!next) return;
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh - next.getBoundingClientRect().top) / (vh * 0.85)));
      el.style.transform = p ? `scale(${1 - 0.08 * p})` : '';
      el.style.filter = p ? `blur(${(p * 8).toFixed(1)}px)` : '';
      el.style.opacity = String(1 - p);
      el.style.pointerEvents = p > 0.9 ? 'none' : '';
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', on, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, [reduce]);
  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={`${id}-h`}
      className="scroll-mt-28 origin-top will-change-[transform,filter,opacity]"
      style={reduce ? undefined : { position: 'sticky', top, zIndex: z }}
    >      <div className="mb-4 flex items-baseline gap-3 py-2">
        <span className="h-px w-8 self-center" style={{ background: accent }} />
        <h2 id={`${id}-h`} className="font-mono text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: accent }}>{title}</h2>
        <p className="hidden truncate text-sm text-neutral-500 sm:block">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
