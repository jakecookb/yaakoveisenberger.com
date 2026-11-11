'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface GalleryPhoto {
  id: string;
  src: string;
  caption: string;
}

interface Item { photo: GalleryPhoto; index: number }

/**
 * One looping strip of photos that turns by itself in `dir` (1 = left, -1 = right). The photos are listed twice and the strip
 * jumps back by exactly one copy's width when it runs out, so it never visibly restarts. Drag (mouse) or flick it to spin it.
 */
function Row({ items, dir, lightboxOpen, onOpen }: { items: Item[]; dir: 1 | -1; lightboxOpen: boolean; onOpen: (i: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const drag = useRef<{ x: number; left: number; moved: boolean; v: number; t: number } | null>(null);
  const momentum = useRef(0);
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const half = () => t.scrollWidth / 2;
    if (dir === -1) t.scrollLeft = half(); // the opposite row starts at the far end so it has room to travel right
    let raf = 0;
    const tick = () => {
      if (!lightboxOpen && !drag.current) {
        const auto = reduce || paused.current ? 0 : 0.9 * dir;
        t.scrollLeft += auto + momentum.current;
        momentum.current *= 0.94;
        if (Math.abs(momentum.current) < 0.05) momentum.current = 0;
      }
      const h = half();
      if (h > 0) { if (t.scrollLeft >= h) t.scrollLeft -= h; else if (t.scrollLeft <= 0) t.scrollLeft += h; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dir, lightboxOpen]);
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
  const doubled = [...items, ...items];
  return (
    <div
      ref={track}
      onPointerEnter={() => (paused.current = true)} onPointerLeave={() => { paused.current = false; onUp(); }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
      onTouchStart={() => (paused.current = true)} onTouchEnd={() => setTimeout(() => (paused.current = false), 2000)}
      className="flex cursor-grab select-none overflow-x-auto py-2 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] [scrollbar-width:none] active:cursor-grabbing"
    >
      {doubled.map(({ photo: p, index }, k) => (
        <figure key={`${p.id}-${k}`} aria-hidden={k >= items.length} className="photo-float mr-3 w-40 shrink-0 sm:w-56" style={{ animationDelay: `${(k % 5) * -0.9}s` }}>
          <button type="button" tabIndex={k >= items.length ? -1 : 0} onClick={(e) => { if (drag.current?.moved) { e.preventDefault(); return; } onOpen(index); }} draggable={false} className="group block w-full overflow-hidden rounded-[1.3rem] bg-neutral-900 shadow-[0_14px_30px_-14px_rgba(0,0,0,0.9)] ring-1 ring-white/15 transition duration-300 hover:scale-[1.04] hover:ring-white/40 focus-visible:ring-2 focus-visible:ring-[#c8a96a]">
            <Image src={p.src} alt={p.caption} width={500} height={500} unoptimized loading="lazy" draggable={false} className="aspect-square w-full object-cover" />
          </button>
          {p.caption && <figcaption className="mt-1.5 truncate px-1 text-center text-xs text-neutral-500">{p.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

/** Three rows of photos drifting in alternating directions, so a lot of the gallery is on screen at once; click one to open the viewer. */
export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
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

  // Deal the photos out across three rows; each row is topped up to at least six so it is wider than the screen. With only a few
  // photos every row shows them all, each row starting from a different one so the rows don't look identical.
  const fill = (list: Item[]) => (list.length === 0 ? list : Array.from({ length: Math.max(list.length, 6) }, (_, k) => list[k % list.length]));
  const all: Item[] = photos.map((photo, index) => ({ photo, index }));
  const rows = [0, 1, 2].map((r) => fill(photos.length > 5 ? all.filter((_, i) => i % 3 === r) : [...all.slice(r % all.length), ...all.slice(0, r % all.length)]));
  if (!photos.length) return null;
  const current = open === null ? null : photos[open];

  return (
    <>
      <div className="space-y-1">
        {rows.map((items, r) => <Row key={r} items={items} dir={r % 2 === 0 ? 1 : -1} lightboxOpen={open !== null} onOpen={setOpen} />)}
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
