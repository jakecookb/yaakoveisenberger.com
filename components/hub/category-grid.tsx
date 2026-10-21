'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { CardView } from '@/lib/site/settings';
import { CategoryCard, type AccessInfo } from './category-card';

/** `fullOnPhone`: one card per line below 640px (the News section). */
export function CategoryGrid({ cards, liveCampaigns, fullOnPhone }: { cards: CardView[]; liveCampaigns?: number; fullOnPhone?: boolean }) {
  const reduce = useReducedMotion();
  const [states, setStates] = useState<Record<string, AccessInfo>>({});
  const [tick, setTick] = useState(0);
  const anyLocked = cards.some((c) => c.locked);

  // Label each locked box with this visitor's own status (Private / Pending / Approved / Declined).
  useEffect(() => {
    if (!anyLocked) return;
    let alive = true;
    (async () => {
      const res = await fetch('/api/access/status?all=1', { cache: 'no-store' }).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { states: Record<string, AccessInfo> }) : null;
      if (alive && data) setStates(data.states);
    })();
    const onFocus = () => setTick((n) => n + 1);
    window.addEventListener('focus', onFocus);
    return () => { alive = false; window.removeEventListener('focus', onFocus); };
  }, [anyLocked, tick]);

  return (
    <motion.ul
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } }}
      className={`grid grid-flow-dense ${fullOnPhone ? 'grid-cols-1' : 'grid-cols-2'} gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-2 xl:grid-cols-3`}
    >
      {cards.map((c) => (
        <CategoryCard key={c.id} category={c} liveCount={c.id === 'fund' ? liveCampaigns : undefined} access={states[c.id]} onModalClose={() => setTick((n) => n + 1)} />
      ))}
    </motion.ul>
  );
}
