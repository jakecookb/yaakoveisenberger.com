'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { CardView } from '@/lib/site/settings';
import { CategoryCard, type AccessInfo } from './category-card';

// One status request per page load, shared by every grid on the page.
let statusReq: Promise<Record<string, AccessInfo> | null> | null = null;
const loadStatus = () =>
  (statusReq ??= fetch('/api/access/status?all=1', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { states: Record<string, AccessInfo> } | null) => d?.states ?? null)
    .catch(() => null));

/** `fullOnPhone`: one card per line below 640px (the News section). */
export function CategoryGrid({ cards, liveCampaigns, fullOnPhone }: { cards: CardView[]; liveCampaigns?: number; fullOnPhone?: boolean }) {
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

  return (
    <motion.ul
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } }}
      className={`grid grid-flow-dense ${fullOnPhone ? 'grid-cols-1' : 'grid-cols-2'} gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-2 xl:grid-cols-3`}
    >
      {cards.map((c) => (
        <CategoryCard key={c.id} category={c} liveCount={c.id === 'fund' ? liveCampaigns : undefined} access={states[c.id]} onModalClose={() => { statusReq = null; loadStatus().then((s) => s && setStates(s)); }} />
      ))}
    </motion.ul>
  );
}
