'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { BoardBuilder } from './board-builder';

// Where the board builder lives on the page. Big screens: right on the page, under the photos. Phones: the page stays
// photos-first and a "Customize your fish board" button opens the builder full-screen. The "Design your own" button at the
// top links to #builder, which opens the sheet on a phone (or scrolls to the builder on a big screen).

const WIDE = '(min-width: 1024px)';

export function BoardLauncher({ accent }: { accent: string }) {
  const [wide, setWide] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // "#builder" (the top button, or a shared link) opens the sheet on a phone.
  useEffect(() => {
    if (wide !== false) return;
    const check = () => {
      if (location.hash !== '#builder') return;
      setOpen(true);
      history.replaceState(null, '', location.pathname + location.search); // so tapping the button again works too
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, [wide]);

  const sheetOpen = open && wide === false;
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [sheetOpen]);

  if (wide) return <BoardBuilder accent={accent} />;

  return (
    <>
      <div id="builder" className="mt-12 scroll-mt-20 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="group flex w-full items-center gap-4 rounded-3xl p-4 text-left ring-1 ring-white/10 transition active:scale-[0.99]" style={{ background: `linear-gradient(135deg, ${accent}26, #111 60%)` }}>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-neutral-950" style={{ background: accent }}><Sparkles className="size-6" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-white">Customize your fish board</span>
            <span className="block text-sm text-neutral-400">Pick your fish & toppings and see it live</span>
          </span>
          <span className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-neutral-950" style={{ background: accent }}>Open</span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog" aria-modal="true" aria-label="Design your own fish board"
            className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-neutral-950 text-left"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-neutral-950/95 px-4 backdrop-blur">
              <p className="font-semibold text-white">Design your fish board</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full bg-white/10 p-2 text-white active:bg-white/20"><X className="size-5" /></button>
            </div>
            <div className="px-4 pb-10">
              <BoardBuilder accent={accent} inSheet />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
