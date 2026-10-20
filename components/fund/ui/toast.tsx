'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';
interface Toast { id: number; tone: Tone; message: string }
interface ToastApi {
  toast: (message: string, tone?: Tone) => void;
  /** Convenience for server action results. */
  result: (res: { ok: boolean; message?: string; error?: string }, fallback?: string) => boolean;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message: string, tone: Tone = 'info') => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(
    () => ({
      toast,
      result: (res, fallback = 'Saved') => {
        if (res.ok) toast(res.message ?? fallback, 'success');
        else toast(res.error ?? 'Something went wrong', 'error');
        return res.ok;
      },
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2 px-4">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-lg"
              role={t.tone === 'error' ? 'alert' : 'status'}
            >
              {t.tone === 'success' ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              ) : t.tone === 'error' ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
              )}
              <p className="flex-1">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-700" aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
