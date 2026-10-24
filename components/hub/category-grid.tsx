'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { directoryColumns, gridClass } from '@/lib/site/hub';
import type { CardView } from '@/lib/site/settings';
import { CategoryCard, type AccessInfo } from './category-card';

// Cards rise into place once, as their section scrolls into view (a little before the edge, so nothing pops).
const REVEAL_VIEWPORT = { once: true, amount: 0.15, margin: '0px 0px -8% 0px' } as const;

// One status request per page load, shared by every grid on the page.
let statusReq: Promise<Record<string, AccessInfo> | null> | null = null;
const loadStatus = () =>
  (statusReq ??= fetch('/api/access/status?all=1', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { states: Record<string, AccessInfo> } | null) => d?.states ?? null)
    .catch(() => null));

/** Four labelled columns split by crisp lines (phone: one full-width box per line). `cols` pins the admin preview size. */
export function Directory({ cards, cols, render }: { cards: CardView[]; cols?: 1 | 2 | 4; render: (c: CardView) => React.ReactNode }) {
  const outer = cols === 1 ? 'grid-cols-1 gap-6' : cols ? 'grid-cols-4 gap-0 divide-x divide-white/25' : 'grid-cols-1 gap-6 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-white/25';
  const pad = cols === 1 ? '' : cols ? 'px-4 first:pl-0 last:pr-0' : 'lg:px-4 lg:first:pl-0 lg:last:pr-0';
  const inner = cols === 1 ? 'grid-cols-1' : cols ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3 lg:grid-cols-1';
  return (
    <div className={`grid ${outer}`}>
      {directoryColumns(cards).map((col) => (
        <div key={col.title} className={pad}>
          <p className="mb-3 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500"><span className="size-1 rounded-full bg-[#c8a96a]" />{col.title}</p>
          <span aria-hidden className="mb-3 block h-px bg-gradient-to-r from-[#c8a96a]/60 via-white/20 to-transparent" />
          <ul className={`grid ${inner} gap-2.5 sm:gap-3`}>{col.cards.map(render)}</ul>
        </div>
      ))}
    </div>
  );
}

/** `news`: one card per line below 768px. `directory`: the four-column layout. */
export function CategoryGrid({ cards, liveCampaigns, news, directory }: { cards: CardView[]; liveCampaigns?: number; news?: boolean; directory?: boolean }) {
  const reduce = useReducedMotion();
  const [states, setStates] = useState<Record<string, AccessInfo>>({});
  const anyLocked = cards.some((c) => c.locked);

  // Label each locked box with this visitor's own status (Private / Pending / Approved / Declined).
  useEffect(() => {
    if (!anyLocked) return;
    let alive = true;
    loadStatus().then((s) => { if (alive && s) setStates(s); });
    return () => { alive = false; };
  }, [anyLocked]);

  const card = (c: CardView, plain?: boolean) => (
    <CategoryCard key={c.id} category={c} single={news} plain={plain} liveCount={c.id === 'fund' ? liveCampaigns : undefined} access={states[c.id]} onModalClose={() => { statusReq = null; loadStatus().then((s) => s && setStates(s)); }} />
  );
  if (directory) return <motion.div initial={reduce ? false : 'hidden'} whileInView="show" viewport={REVEAL_VIEWPORT} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}><Directory cards={cards} render={(c) => card(c, true)} /></motion.div>;
  return (
    <motion.ul
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={REVEAL_VIEWPORT}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } } }}
      className={`grid grid-flow-dense ${gridClass(Boolean(news))}`}
    >
      {cards.map((c) => card(c))}
    </motion.ul>
  );
}
