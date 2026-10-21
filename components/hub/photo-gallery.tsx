'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface GalleryPhoto {
  id: string;
  src: string;
  caption: string;
}

/** Responsive photo grid with a keyboard-friendly lightbox. */
export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const drag = useRef<{ x: number; left: number; moved: boolean; v: number; t: number } | null>(null);
  const momentum = useRef(0);
  // Turns by itself (looping), faster than before; drag, flick, or use the scroll wheel to spin it yourself.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const tick = () => {
      const t = track.current;
      if (t && open === null && !drag.current) {
        const auto = reduce || paused.current ? 0 : 1.1;
        t.scrollLeft += auto + momentum.current;
        momentum.current *= 0.94;
        if (Math.abs(momentum.current) < 0.05) momentum.current = 0;
        if (t.scrollLeft + t.clientWidth >= t.scrollWidth - 1 && momentum.current >= 0) t.scrollLeft = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const t = track.current;
    // Mouse wheel spins the strip sideways while the pointer is over it (it lets go at either end).
    const wheel = (e: WheelEvent) => {
      if (!t || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      const atEnd = (e.deltaY > 0 && t.scrollLeft + t.clientWidth >= t.scrollWidth - 1) || (e.deltaY < 0 && t.scrollLeft <= 0);
      if (atEnd) return;
      e.preventDefault();
      momentum.current += e.deltaY * 0.08;
    };
    t?.addEventListener('wheel', wheel, { passive: false });
    return () => { cancelAnimationFrame(raf); t?.removeEventListener('wheel', wheel); };
  }, [open]);
  const onDown = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse') return; drag.current = { x: e.clientX, left: track.current!.scrollLeft, moved: false, v: 0, t: performance.now() }; };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    const next = d.left - (e.clientX - d.x);
    d.v = (track.current!.scrollLeft - next) / Math.max(1, now - d.t) * -16;
    d.t = now;
    if (Math.abs(e.clientX - d.x) > 4) d.moved = true;
    track.current!.scrollLeft = next;
  };
  const onUp = () => { const d = drag.current; if (d) { momentum.current = d.v; setTimeout(() => { drag.current = null; }, 0); } };
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, step]);

  if (!photos.length) return null;
  const current = open === null ? null : photos[open];

  return (
    <>
      {/* Bubbly floating carousel: rounded photos drift gently on a slowly turning track with faded edges. */}
      <div
        ref={track}
        onPointerEnter={() => (paused.current = true)} onPointerLeave={() => { paused.current = false; onUp(); }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onTouchStart={() => (paused.current = true)} onTouchEnd={() => setTimeout(() => (paused.current = false), 2000)}
        className="flex cursor-grab select-none gap-3 overflow-x-auto px-[6%] py-4 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] [scrollbar-width:none] active:cursor-grabbing"
      >
        {photos.map((p, i) => (
          <figure key={p.id} className="photo-float w-36 shrink-0 sm:w-44" style={{ animationDelay: `${(i % 5) * -0.9}s` }}>
            <button type="button" onClick={(e) => { if (drag.current?.moved) { e.preventDefault(); return; } setOpen(i); }} draggable={false} className="group block w-full overflow-hidden rounded-[1.4rem] bg-neutral-900 shadow-[0_14px_30px_-14px_rgba(0,0,0,0.9)] ring-1 ring-white/15 transition duration-300 hover:scale-[1.06] hover:ring-white/40 focus-visible:ring-2 focus-visible:ring-[#c8a96a]">
              <img src={p.src} alt={p.caption} loading={i < 6 ? 'eager' : 'lazy'} decoding="async" draggable={false} className="aspect-square w-full object-cover" />
            </button>
            {p.caption && <figcaption className="mt-1.5 truncate px-1 text-center text-xs text-neutral-500">{p.caption}</figcaption>}
          </figure>
        ))}
      </div>
      <AnimatePresence>
        {current && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Photo viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={close}
          >
            <img src={current.src} alt={current.caption} className="max-h-[85vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
            {current.caption && <p className="absolute inset-x-0 bottom-6 px-6 text-center text-sm text-neutral-200">{current.caption}</p>}
            <button type="button" aria-label="Close" onClick={close} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="size-5" /></button>
            {photos.length > 1 && (
              <>
                <button type="button" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); step(-1); }} className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronLeft className="size-6" /></button>
                <button type="button" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); step(1); }} className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronRight className="size-6" /></button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
