'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const HEADER = 56;
const HOLD = 0.6; // screens of extra scroll a section stays pinned while the next one (already right underneath it) rises over it
const GAP = 8; // px between one section and the next

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
      // How far the next section has risen over this one. Nothing fades while it just sits underneath; the fade only builds as you push it in.
      const covered = next?.dataset.stack ? clamp((el.getBoundingClientRect().top + el.offsetHeight - next.getBoundingClientRect().top) / el.offsetHeight) : 0;
      const out = clamp((covered - 0.1) / 0.9);
      // Eased, so the fade starts slow and silky: the section drifts up and back, dims into the dark and softens.
      const e = out * out * (3 - 2 * out);
      el.style.transform = out ? `translateY(${(-28 * e).toFixed(1)}px) scale(${1 - 0.08 * e})` : enter < 1 ? `translateY(${(1 - enter) * 40}px)` : '';
      el.style.filter = out ? `blur(${(e * 14).toFixed(1)}px) brightness(${(1 - 0.55 * e).toFixed(2)})` : '';
      el.style.opacity = String((0.2 + 0.8 * enter) * (1 - Math.pow(e, 1.4)));
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
      style={pinned ? { height: m.h + (m.last ? 0 : HOLD * m.vh), marginTop: first ? undefined : GAP - HOLD * m.vh, zIndex: z } : { zIndex: z }}
    >
      <section
        ref={ref}
        id={id}
        aria-labelledby={`${id}-h`}
        className="scroll-mt-28 origin-top will-change-[transform,filter,opacity]"
        style={reduce ? undefined : { position: 'sticky', top: m.top }}
      >
        <div className="mb-2 flex items-baseline sm:mb-4 gap-3 py-2">
          <span className="h-px w-8 self-center" style={{ background: accent }} />
          <h2 id={`${id}-h`} className="font-mono text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: accent }}>{title}</h2>
          <p className="hidden truncate text-sm text-neutral-500 sm:block">{subtitle}</p>
        </div>
        {children}
      </section>
    </div>
  );
}
