'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const HEADER = 56;
const BUDGET = 2.2; // extra scroll (in screen heights) a section stays pinned for
const OVERLAP = 0.9; // how early (in screen heights) the next section starts rising over the pinned one

const shown = (el: Element | null): HTMLElement | null => {
  while (el && !(el as HTMLElement).getClientRects().length) el = el.nextElementSibling;
  return el as HTMLElement | null;
};

/**
 * A homepage section with heavy-pin stacking. Its wrapper is taller than the section by BUDGET screens, so the section
 * waits in place (sticky) while you keep scrolling; during that time the next section rises over it, fading in, while
 * this one stays put and sinks back — shrinking, blurring and fading. Styles are written straight to the element (no
 * re-renders) and only transform/filter/opacity change, so it stays smooth on phones.
 */
export function HubSection({ id, title, subtitle, accent, z, first, className = '', children }: { id: string; title: string; subtitle: string; accent: string; z: number; first?: boolean; className?: string; children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [m, setM] = useState({ top: HEADER + 8, h: 0, vh: 800, last: false });
  useEffect(() => {
    const el = ref.current, w = wrap.current;
    if (!el || !w || reduce) return;
    // A section taller than the screen scrolls normally until its bottom is in view, then holds there.
    const fit = () => setM({ top: Math.min(HEADER + 8, window.innerHeight - el.offsetHeight - 16), h: el.offsetHeight, vh: window.innerHeight, last: !shown(w.nextElementSibling)?.dataset.stack });
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    let raf = 0;
    const paint = () => {
      raf = 0;
      const vh = window.innerHeight;
      const clamp = (x: number) => Math.min(1, Math.max(0, x));
      const enter = first ? 1 : clamp((vh - w.getBoundingClientRect().top) / (vh * 0.6));
      const next = shown(w.nextElementSibling);
      const out = next?.dataset.stack ? clamp((vh - next.getBoundingClientRect().top) / (vh * 0.9)) : 0;
      el.style.transform = out ? `scale(${1 - 0.1 * out})` : enter < 1 ? `translateY(${(1 - enter) * 40}px)` : '';
      el.style.filter = out ? `blur(${(out * 10).toFixed(1)}px)` : '';
      el.style.opacity = String((0.2 + 0.8 * enter) * (1 - out));
      el.style.pointerEvents = out > 0.9 ? 'none' : '';
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', on, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, [reduce, first]);
  const pinned = !reduce && m.h > 0;
  return (
    <div
      ref={wrap}
      data-stack="1"
      className={`relative ${className}`}
      style={pinned ? { height: m.h + (m.last ? 0 : BUDGET * m.vh), marginTop: first ? undefined : -OVERLAP * m.vh, zIndex: z } : { zIndex: z }}
    >
      <section
        ref={ref}
        id={id}
        aria-labelledby={`${id}-h`}
        className="scroll-mt-28 origin-top will-change-[transform,filter,opacity]"
        style={reduce ? undefined : { position: 'sticky', top: m.top }}
      >
        <div className="mb-4 flex items-baseline gap-3 py-2">
          <span className="h-px w-8 self-center" style={{ background: accent }} />
          <h2 id={`${id}-h`} className="font-mono text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: accent }}>{title}</h2>
          <p className="hidden truncate text-sm text-neutral-500 sm:block">{subtitle}</p>
        </div>
        {children}
      </section>
    </div>
  );
}
