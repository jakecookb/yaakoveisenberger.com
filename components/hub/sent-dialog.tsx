'use client';

import Image from 'next/image';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MailCheck, X } from 'lucide-react';
import logo from '@/public/images/home/logo-hd.png';

const noop = () => () => {};

/** The "check your inbox" confirmation: logo on glass, the address the link went to, and what happens next. */
export function SentDialog({ email, emailed, onClose }: { email?: string; emailed: boolean; onClose: () => void }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const btn = useRef<HTMLButtonElement>(null);
  const open = Boolean(email);
  useEffect(() => {
    if (!open) return;
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={onClose}>
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sent-title"
            aria-describedby="sent-desc"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-neutral-900 p-8 text-center ring-1 ring-white/10 shadow-[0_40px_120px_-40px_rgba(200,169,106,0.6)]"
          >
            <div className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-[radial-gradient(closest-side,rgba(200,169,106,0.35),transparent)]" aria-hidden />
            <button type="button" aria-label="Close" onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-500 transition hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
            <div className="relative mx-auto w-fit">
              <motion.div initial={{ rotate: -6, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.05 }} className="rounded-[1.6rem] bg-white/5 p-1.5 ring-1 ring-white/20 backdrop-blur">
                <Image src={logo} alt="Yaakov Eisenberger" width={88} height={88} className="size-22 rounded-[1.3rem]" />
              </motion.div>
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.25 }} className="absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full bg-[#c8a96a] text-neutral-950 ring-4 ring-neutral-900">
                <MailCheck className="size-4.5" />
              </motion.span>
            </div>
            <p className="relative mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-[#c8a96a]">yaakoveisenberger.com</p>
            <h2 id="sent-title" className="relative mt-2 text-xl font-semibold text-white">{emailed ? 'Check your inbox' : 'Request received'}</h2>
            <p id="sent-desc" className="relative mt-3 text-sm leading-relaxed text-neutral-300">
              {emailed ? (<>A sign-in link has been sent to <b className="text-white [overflow-wrap:anywhere]">{email}</b>.</>) : (<>Thanks — your request is in. We couldn’t send the email to <b className="text-white [overflow-wrap:anywhere]">{email}</b> just now, so keep this browser handy: it opens here once approved.</>)}
            </p>
            {emailed && <p className="relative mt-2 text-xs leading-relaxed text-neutral-500">Open it on any device to sign in. It works for 24 hours — check spam if you don’t see it.</p>}
            <button ref={btn} type="button" onClick={onClose} className="relative mt-7 h-11 w-full rounded-full bg-[#c8a96a] font-semibold text-neutral-950 transition hover:bg-[#d8bc82]">Got it</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
