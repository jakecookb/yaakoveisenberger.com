'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { LockedGate } from './locked-gate';

const noop = () => () => {};

/**
 * Pop-up shown over the hub when someone clicks a locked box. It asks for their name; once the owner approves,
 * it continues into the box by itself. Rendered in a portal because cards use transforms (which would break `fixed`).
 */
export function AccessModal({ open, onClose, title, accent, categoryId, continueHref }: { open: boolean; onClose: () => void; title: string; accent: string; categoryId: string; continueHref: string }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${title} is private`}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button ref={closeRef} type="button" aria-label="Close" onClick={onClose} className="absolute -top-3 -right-3 z-10 rounded-full bg-neutral-800 p-2 text-neutral-300 ring-1 ring-white/15 hover:bg-neutral-700 hover:text-white">
              <X className="size-4" />
            </button>
            <p className="mb-3 text-center text-sm font-medium text-neutral-300">{title}</p>
            <LockedGate categoryId={categoryId} accent={accent} continueHref={continueHref} className="" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
