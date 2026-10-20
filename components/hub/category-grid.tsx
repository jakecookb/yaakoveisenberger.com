'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { CardView } from '@/lib/site/settings';
import { CategoryCard } from './category-card';

export function CategoryGrid({ cards, liveCampaigns }: { cards: CardView[]; liveCampaigns?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.ul
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4"
    >
      {cards.map((c) => (
        <CategoryCard key={c.id} category={c} liveCount={c.id === 'fund' ? liveCampaigns : undefined} />
      ))}
    </motion.ul>
  );
}
