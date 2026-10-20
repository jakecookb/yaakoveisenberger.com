'use client';

import { useCallback, useEffect, useState } from 'react';
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
      <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {photos.map((p, i) => (
          <li key={p.id} className="mb-4 break-inside-avoid">
            <button type="button" onClick={() => setOpen(i)} className="group block w-full overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/10 transition hover:ring-white/30 focus-visible:ring-2 focus-visible:ring-[#c8a96a]">
              <img src={p.src} alt={p.caption} loading="lazy" decoding="async" className="w-full transition duration-500 group-hover:scale-[1.02]" />
            </button>
            {p.caption && <p className="mt-2 px-1 text-sm text-neutral-400">{p.caption}</p>}
          </li>
        ))}
      </ul>
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
