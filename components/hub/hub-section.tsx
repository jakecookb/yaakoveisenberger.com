'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { SectionRevealed } from './reveal-context';

const HEADER = 56;
const GAP = 0; // sections sit flush: the next one waits directly under the current one, no space between them
// Every section gets exactly the same two beats, in screens of scroll: it sits still (the pause), then the next one rises over it.
const PAUSE = 0.3;
const RISE = 0.6;
const SLACK = 0.15; // extra screens a section stays pinned past both beats, so the hand-over never races the wrapper's end

const shown = (el: Element | null): HTMLElement | null => {
  while (el && !(el as HTMLElement).getClientRects().length) el = el.nextElementSibling;
  return el as HTMLElement | null;
};
const shownBefore = (el: Element | null): HTMLElement | null => {
  while (el && !(el as HTMLElement).getClientRects().length) el = el.previousElementSibling;
  return el as HTMLElement | null;
};
// Phone browsers grow and shrink the viewport as their toolbar hides; treat that as noise so layouts don't jump mid-scroll.
const stable = { w: 0, h: 0 };
const viewH = () => {
  if (!stable.h || window.innerWidth !== stable.w || Math.abs(window.innerHeight - stable.h) > 200) { stable.w = window.innerWidth; stable.h = window.innerHeight; }
  return stable.h;
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
  const [m, setM] = useState({ h: 0, vh: 800, ov: 0, last: false, mt: 0 });
  const [revealed, setRevealed] = useState(Boolean(first) || Boolean(reduce));
  useEffect(() => {
    const el = ref.current, w = wrap.current;
    if (!el || !w || reduce) return;
    const aboveEl = () => shownBefore(w.previousElementSibling)?.querySelector('section') ?? null;
    // Sections always pin by their top. One taller than the screen overflows by `ov`: once pinned, its content scrolls up through that
    // distance (so every card is reachable and it's read from the top), and only then does the pause begin. The pull-up margin makes
    // this section pin exactly PAUSE + RISE screens (+ the above's overflow) after the one above, whatever either one's height.
    const fit = () => {
      const vh = viewH(), above = aboveEl();
      setM({
        h: el.offsetHeight, vh, ov: !shown(w.nextElementSibling)?.dataset.stack ? 0 : Math.max(0, el.offsetHeight - (vh - HEADER - 8 - 16)),
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
      const vh = viewH();
      const clamp = (x: number) => Math.min(1, Math.max(0, x));
      const pinTop = HEADER + 8;
      // The last section never pins or scrolls its content through: it just scrolls away into the footer, with no empty gap left behind.
      const ov = shown(w.nextElementSibling)?.dataset.stack ? Math.max(0, el.offsetHeight - (vh - pinTop - 16)) : 0;
      const wr = w.getBoundingClientRect();
      // How far an over-tall section's content has scrolled up since it pinned.
      const shift = ov ? Math.min(ov, Math.max(0, pinTop - wr.top)) : 0;
      // Layout position of the (sticky) section before any transform of ours.
      const layoutTop = Math.min(Math.max(pinTop, wr.top), wr.bottom - el.offsetHeight);
      // As the incoming section: flush under the one above, still, until that one is pinned and the pause is scrolled through.
      let lift = 0, reveal = 1;
      const above = aboveEl();
      if (above && !first) {
        const aw = above.parentElement!.getBoundingClientRect();
        const aboveOv = Math.max(0, above.offsetHeight - (vh - pinTop - 16));
        const scrolled = pinTop - aw.top; // px since the section above pinned
        const p = ease(clamp((scrolled - aboveOv - PAUSE * vh) / (RISE * vh)));
        // Where the section above sits by layout alone (its own fade transform must not feed back into this), after its content scrolled through.
        const aboveTop = Math.min(Math.max(pinTop, aw.top), aw.bottom - above.offsetHeight) - Math.min(aboveOv, Math.max(0, scrolled));
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
        const nextPin = pinTop;
        const pNext = ease(clamp((pinTop - wr.top - ov - PAUSE * vh) / (RISE * vh)));
        const heldTop = Math.max(pinTop, wr.top) - shift; // where it sits while pinned, ignoring the wrapper's end carrying it away
        const start = heldTop + el.offsetHeight + GAP;
        covered = pNext >= 1 ? 1 : clamp((heldTop + el.offsetHeight - (start - (start - nextPin) * pNext)) / el.offsetHeight);
      }
      const out = covered >= 1 ? 1 : ease(clamp((covered - 0.05) / 0.6));
      // Sharpness: 0 while waiting (or leaving), 1 only once the section is fully revealed.
      const sharp = reveal * (1 - out);
      if (reveal > 0.3) setRevealed(true); // its cards pop in as the section comes into focus (a no-op once true)
      // Entrance, mask-style: the section settles up from slightly small while a curtain lifts off its top edge. Clearing the mask once
      // it lands keeps hover glows from being clipped.
      const settle = 0.95 + 0.05 * reveal;
      el.style.transform = lift || shift || out || reveal < 1 ? `translateY(${(-lift - shift - 90 * out).toFixed(1)}px) scale(${((1 - 0.06 * out) * settle).toFixed(4)})` : '';
      el.style.setProperty('--p', reveal.toFixed(3));
      // Waiting below, a section is softened but still legible (so the gap reads as the next section, not empty space); leaving, it blurs out fully.
      el.style.filter = sharp < 1 ? `blur(${((1 - reveal) * 6 + out * 14).toFixed(1)}px) brightness(${Math.max(0.3, 1 - 0.3 * (1 - reveal) - 0.6 * out).toFixed(2)})` : '';
      el.style.opacity = String((0.4 + 0.6 * reveal) * (1 - Math.pow(out, 0.8)));
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
      style={pinned ? { height: m.h + m.ov + (m.last ? 0 : PAUSE + RISE + SLACK) * m.vh, marginTop: first ? undefined : m.mt, zIndex: z } : { zIndex: z }}
    >
      <SectionRevealed.Provider value={revealed}>
      <section
        ref={ref}
        id={id}
        aria-labelledby={`${id}-h`}
        className="scroll-mt-28 origin-top will-change-[transform,filter,opacity]"
        style={reduce ? undefined : { position: 'sticky', top: HEADER + 8 }}
      >
        <div className="relative mb-2 flex items-baseline gap-3 py-2 sm:mb-4">
          <span className="h-px w-8 origin-left self-center" style={{ background: accent, transform: reduce ? undefined : 'scaleX(var(--p, 1))' }} />
          {/* The title is cut from a mask line by line, darkroom-style: it rises into place as the section lands. */}
          <span className="overflow-hidden">
            <h2 id={`${id}-h`} className="font-mono text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: accent, transform: reduce ? undefined : 'translateY(calc((1 - var(--p, 1)) * 110%))' }}>{title}</h2>
          </span>
          <p className="hidden truncate text-sm text-neutral-500 sm:block" style={{ opacity: reduce ? undefined : 'var(--p, 1)' }}>{subtitle}</p>
          {/* A hairline rule under the header that draws across with the reveal. */}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px origin-left bg-gradient-to-r from-white/25 to-transparent" style={{ transform: reduce ? undefined : 'scaleX(var(--p, 1))' }} />
        </div>
        {children}
      </section>
      </SectionRevealed.Provider>
    </div>
  );
}
