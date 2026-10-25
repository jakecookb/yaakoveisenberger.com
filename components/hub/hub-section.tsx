'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const HEADER = 56;
const GAP = 28; // px of breathing room between one section and the next
// Every section gets exactly the same two beats, in screens of scroll: it sits still (the pause), then the next one rises over it.
const PAUSE = 0.7;
const RISE = 0.9;
const SLACK = 0.3; // extra screens a section stays pinned past both beats, so the hand-over never races the wrapper's end

const shown = (el: Element | null): HTMLElement | null => {
  while (el && !(el as HTMLElement).getClientRects().length) el = el.nextElementSibling;
  return el as HTMLElement | null;
};
const shownBefore = (el: Element | null): HTMLElement | null => {
  while (el && !(el as HTMLElement).getClientRects().length) el = el.previousElementSibling;
  return el as HTMLElement | null;
};
const ease = (x: number) => x * x * (3 - 2 * x);

/**
 * A homepage section with heavy-pin stacking. Each section sits flush under the one above (a small gap), faded and blurred;
 * once the one above is pinned it waits for PAUSE of scroll, then rises over it across RISE of scroll, coming into focus
 * as it lands while the one it covers blurs, dims and fades away. Only the section being revealed is ever sharp. Every
 * section uses the same distances, so the rhythm is even. Styles are written straight to the element (no re-renders) and
 * only transform/filter/opacity change, so it stays smooth on phones.
 */
export function HubSection({ id, title, subtitle, accent, z, first, className = '', children }: { id: string; title: string; subtitle: string; accent: string; z: number; first?: boolean; className?: string; children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [m, setM] = useState({ top: HEADER + 8, h: 0, vh: 800, last: false, mt: 0 });
  useEffect(() => {
    const el = ref.current, w = wrap.current;
    if (!el || !w || reduce) return;
    const aboveEl = () => shownBefore(w.previousElementSibling)?.querySelector('section') ?? null;
    // A section taller than the screen scrolls normally until its bottom is in view, then holds there. The pull-up margin makes
    // this section pin exactly PAUSE + RISE screens after the one above, whatever either one's height.
    const fit = () => {
      const vh = window.innerHeight, above = aboveEl();
      setM({
        top: Math.min(HEADER + 8, vh - el.offsetHeight - 16), h: el.offsetHeight, vh,
        last: !shown(w.nextElementSibling)?.dataset.stack,
        mt: above ? (PAUSE + RISE) * vh - (above.offsetHeight + (PAUSE + RISE + SLACK) * vh) : 0,
      });
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const a0 = aboveEl();
    if (a0) ro.observe(a0);
    window.addEventListener('resize', fit);
    let raf = 0;
    const paint = () => {
      raf = 0;
      const vh = window.innerHeight;
      const clamp = (x: number) => Math.min(1, Math.max(0, x));
      const pinTop = Math.min(HEADER + 8, vh - el.offsetHeight - 16);
      const wr = w.getBoundingClientRect();
      // Layout position of the (sticky) section before any transform of ours.
      const layoutTop = Math.min(Math.max(pinTop, wr.top), wr.bottom - el.offsetHeight);
      // As the incoming section: flush under the one above, still, until that one is pinned and the pause is scrolled through.
      let lift = 0, reveal = 1;
      const above = aboveEl();
      if (above && !first) {
        const aw = above.parentElement!.getBoundingClientRect();
        const abovePin = Math.min(HEADER + 8, vh - above.offsetHeight - 16);
        const scrolled = abovePin - aw.top; // px since the section above pinned
        const p = ease(clamp((scrolled - PAUSE * vh) / (RISE * vh)));
        // Where the section above sits by layout alone (its own fade transform must not feed back into this).
        const aboveTop = Math.min(Math.max(abovePin, aw.top), aw.bottom - above.offsetHeight);
        const start = aboveTop + above.offsetHeight + GAP;
        const curTop = start - (start - pinTop) * p;
        lift = p >= 1 ? 0 : layoutTop - curTop; // once risen, the section is left to the wrapper's own sticky behaviour
        reveal = p;
      }
      // As the section being covered: fade and blur out once the next one actually rises over it. The next one's position is worked
      // out from scroll (same formula it uses itself), never read back from its element, so the two can't lag a frame behind each other.
      const nextEl = shown(w.nextElementSibling)?.querySelector('section');
      let covered = 0;
      if (nextEl) {
        const nextPin = Math.min(HEADER + 8, vh - nextEl.offsetHeight - 16);
        const pNext = ease(clamp((pinTop - wr.top - PAUSE * vh) / (RISE * vh)));
        const heldTop = Math.max(pinTop, wr.top); // where it sits while pinned, ignoring the wrapper's end carrying it away
        const start = heldTop + el.offsetHeight + GAP;
        covered = pNext >= 1 ? 1 : clamp((heldTop + el.offsetHeight - (start - (start - nextPin) * pNext)) / el.offsetHeight);
      }
      const out = covered >= 1 ? 1 : ease(clamp((covered - 0.05) / 0.6));
      // Sharpness: 0 while waiting (or leaving), 1 only once the section is fully revealed.
      const sharp = reveal * (1 - out);
      el.style.transform = lift || out ? `translateY(${(-lift - 22 * out).toFixed(1)}px) scale(${1 - 0.06 * out})` : '';
      el.style.filter = sharp < 1 ? `blur(${((1 - sharp) * 14).toFixed(1)}px) brightness(${(1 - 0.6 * (1 - sharp)).toFixed(2)})` : '';
      el.style.opacity = String((0.16 + 0.84 * reveal) * (1 - Math.pow(out, 0.8)));
      el.style.pointerEvents = sharp < 0.6 ? 'none' : '';
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(paint); };
    fit();
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
      style={pinned ? { height: m.h + (m.last ? PAUSE : PAUSE + RISE + SLACK) * m.vh, marginTop: first ? undefined : m.mt, zIndex: z } : { zIndex: z }}
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
