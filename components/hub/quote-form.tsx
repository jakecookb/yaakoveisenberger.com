'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, LoaderCircle, MessageSquareQuote, Send, X } from 'lucide-react';
import { requestQuote } from '@/app/quote-actions';

export const QUOTE_CATEGORIES = [['fishboards', 'Fish Boards'], ['meatboards', 'Meat Boards'], ['events', 'Events'], ['photography', 'Photography']] as const;
const f = 'h-12 w-full rounded-xl bg-neutral-950 px-4 text-base text-white ring-1 ring-white/15 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-[var(--accent)] sm:text-sm';
const noop = () => () => {};

/** "Request a Quote" button that opens the quote form in a modal, with the category pre-filled. */
export function QuoteButton({ category, accent }: { category: string; accent: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string>();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('busy'); setError(undefined);
    const res = await requestQuote(Object.fromEntries(new FormData(e.currentTarget))).catch(() => ({ ok: false, error: 'Something went wrong — please try again.' }));
    if (res.ok) setState('done'); else { setState('idle'); setError(res.error); }
  }
  const close = () => { setOpen(false); if (state === 'done') setState('idle'); };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ background: accent }} className="mx-auto mt-6 inline-flex h-12 items-center gap-2 rounded-full px-6 font-semibold text-neutral-950 transition hover:brightness-110 active:scale-[0.98]">
        <MessageSquareQuote className="size-5" /> Request a Quote
      </button>
      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
              <motion.div
                role="dialog" aria-modal="true" aria-labelledby="quote-h" onClick={(e) => e.stopPropagation()}
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                style={{ '--accent': accent } as React.CSSProperties}
                className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-neutral-900 p-5 text-left ring-1 ring-white/10 sm:rounded-3xl sm:p-6"
              >
                <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white"><X className="size-5" /></button>
                {state === 'done' ? (
                  <div className="py-8 text-center" role="status">
                    <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="size-7" /></span>
                    <h2 className="mt-4 text-xl font-semibold text-white">Request sent!</h2>
                    <p className="mt-2 text-sm text-neutral-400">A confirmation is on its way to your inbox — I’ll reply with pricing soon.</p>
                    <button type="button" onClick={close} className="mt-6 h-11 rounded-full bg-white px-6 font-semibold text-neutral-950">Done</button>
                  </div>
                ) : (
                  <form onSubmit={submit} className="space-y-3">
                    <h2 id="quote-h" className="pr-10 text-xl font-semibold text-white">Request a Quote</h2>
                    <input name="name" required maxLength={80} autoComplete="name" placeholder="Full name" aria-label="Full name" className={f} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="Email address" aria-label="Email address" className={f} />
                      <input name="phone" type="tel" required maxLength={25} autoComplete="tel" placeholder="Phone number" aria-label="Phone number" className={f} />
                    </div>
                    <label className="block text-xs text-neutral-400">Category
                      <select name="board" defaultValue={category} className={`${f} mt-1`}>{QUOTE_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs text-neutral-400">Event / delivery date<input name="date" type="date" className={`${f} mt-1 [color-scheme:dark]`} /></label>
                      <label className="block text-xs text-neutral-400">Guests / event size<input name="guests" type="number" min={1} max={5000} inputMode="numeric" placeholder="Optional" className={`${f} mt-1`} /></label>
                    </div>
                    <textarea name="message" required rows={4} maxLength={2000} placeholder="What exactly are you looking for?" aria-label="What exactly are you looking for?" className={`${f} h-auto py-3`} />
                    <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                    <button disabled={state === 'busy'} style={{ background: accent }} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold text-neutral-950 disabled:opacity-60">
                      {state === 'busy' ? <><LoaderCircle className="size-4 animate-spin" /> Sending…</> : <><Send className="size-4" /> Send request</>}
                    </button>
                  </form>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
