'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from './cn';

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  labelledBy,
  hideClose,
  themeColor,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  labelledBy?: string;
  hideClose?: boolean;
  /** Campaign accent; the portal renders outside the themed subtree. */
  themeColor?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>('[autofocus], input, button, select, textarea')?.focus(), 50);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            style={themeColor ? ({ '--fund-accent': themeColor } as React.CSSProperties) : undefined}
            className={cn(
              'fund-root fund-theme relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl',
              size === 'sm' && 'sm:max-w-md',
              size === 'md' && 'sm:max-w-lg',
              size === 'lg' && 'sm:max-w-2xl',
              size === 'xl' && 'sm:max-w-4xl',
            )}
          >
            {(title || !hideClose) && (
              <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
                <div id={labelledBy} className="min-w-0 text-base font-semibold text-slate-900">{title}</div>
                {!hideClose && (
                  <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                    <X className="size-5" />
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
