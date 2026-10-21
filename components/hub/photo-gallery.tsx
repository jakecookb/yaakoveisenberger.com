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
  // The wheel turns slowly by itself (looping back to the start), pausing while someone hovers or touches it.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const tick = () => {
      const t = track.current;
      if (t && !paused.current && open === null) {
        t.scrollLeft += 0.4;
        if (t.scrollLeft + t.clientWidth >= t.scrollWidth - 1) t.scrollLeft = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open]);
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
        onPointerEnter={() => (paused.current = true)} onPointerLeave={() => (paused.current = false)}
        onTouchStart={() => (paused.current = true)} onTouchEnd={() => setTimeout(() => (paused.current = false), 2500)}
        className="flex gap-5 overflow-x-auto px-[8%] py-8 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)] [scrollbar-width:none]"
      >
        {photos.map((p, i) => (
          <figure key={p.id} className="photo-float w-64 shrink-0 sm:w-80" style={{ animationDelay: `${(i % 5) * -1.3}s` }}>
            <button type="button" onClick={() => setOpen(i)} className="group block w-full overflow-hidden rounded-[2rem] bg-neutral-900 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/15 transition duration-500 hover:scale-[1.04] hover:ring-white/40 focus-visible:ring-2 focus-visible:ring-[#c8a96a]">
              <img src={p.src} alt={p.caption} loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover transition-opacity duration-700" />
            </button>
            {p.caption && <figcaption className="mt-3 px-2 text-center text-sm text-neutral-400">{p.caption}</figcaption>}
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
