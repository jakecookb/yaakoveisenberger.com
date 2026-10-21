'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { ICONS, type IconKey } from '@/data/icons';

export interface DrawerItem { id: string; title: string; href: string; iconKey: IconKey; accent: string; external?: boolean; group: 'news' | 'productivity' | 'personal' }
const noop = () => () => {};
const GROUPS = [{ id: 'news', label: 'News' }, { id: 'productivity', label: 'Productivity' }, { id: 'personal', label: 'Personal' }] as const;

/** Top-left ☰ button: slides out a drawer with every section, grouped. */
export function NavDrawer({ items }: { items: DrawerItem[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const btn = useRef<HTMLButtonElement>(null);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) { setLastPath(path); setOpen(false); } // close after navigating
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);
  return (
    <>
      <button ref={btn} type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="-ml-1.5 rounded-lg p-1.5 text-neutral-300 transition hover:bg-white/10 hover:text-white"><Menu className="size-5" /></button>
      {/* In a portal: the header's blur would otherwise trap the fixed drawer inside the header. */}
      {mounted && createPortal(<AnimatePresence>
        {open && (
          <>
            <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" aria-hidden />
            <motion.nav
              key="drawer" aria-label="All sections" role="dialog" aria-modal="true"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-[61] flex w-80 max-w-[85vw] flex-col overflow-y-auto bg-neutral-950/95 p-5 ring-1 ring-white/10 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-white"><ArrowLeft className="size-4" /> Hub</Link>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" autoFocus className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white"><X className="size-5" /></button>
              </div>
              {GROUPS.map((g) => (
                <section key={g.id} className="mt-6">
                  <h2 className="px-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-500">{g.label}</h2>
                  <ul className="mt-2 space-y-0.5">
                    {items.filter((i) => i.group === g.id).map((i) => {
                      const Icon = ICONS[i.iconKey];
                      const cls = `flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition ${path === i.href ? 'bg-white/10 text-white' : 'text-neutral-300 hover:bg-white/5 hover:text-white'}`;
                      const inner = <><span className="flex size-7 items-center justify-center rounded-lg text-neutral-950" style={{ background: i.accent }}><Icon className="size-4" /></span>{i.title}</>;
                      return <li key={i.id}>{i.external ? <a href={i.href} className={cls}>{inner}</a> : <Link href={i.href} className={cls}>{inner}</Link>}</li>;
                    })}
                  </ul>
                </section>
              ))}
            </motion.nav>
          </>
        )}
      </AnimatePresence>, document.body)}
    </>
  );
}

/** "← Return to Main Page" on every page except the hub itself, so nobody gets stuck. */
export function BackBar() {
  const path = usePathname();
  if (path === '/') return null;
  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-sm text-neutral-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"><ArrowLeft className="size-4" /> Return to Main Page</Link>
    </div>
  );
}
