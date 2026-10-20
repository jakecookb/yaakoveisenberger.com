'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { formatMoneyCompact } from '@/lib/fund/format';

/** Fill color steps through the milestones: 25% → 50% → 75% → 100% (gold). */
export function milestoneColor(pct: number) {
  if (pct >= 1) return '#facc15';
  if (pct >= 0.75) return '#fb923c';
  if (pct >= 0.5) return '#c084fc';
  if (pct >= 0.25) return '#2dd4bf';
  return '#38bdf8';
}

export function ProgressRail({ totalCents, goalCents, bonusGoalCents, currency }: { totalCents: number; goalCents: number; bonusGoalCents: number | null; currency: string }) {
  const reduce = useReducedMotion();
  const inBonus = totalCents >= goalCents && Boolean(bonusGoalCents);
  const target = inBonus ? bonusGoalCents! : goalCents;
  const pct = Math.min(1, totalCents / target);
  const goalPct = totalCents / goalCents;
  const color = milestoneColor(goalPct);
  const marks = inBonus ? [goalCents / target, 1] : [0.25, 0.5, 0.75, 1];

  return (
    <div>
      <div className="relative h-[3.4em] overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
        <motion.div
          className="fund-shimmer relative h-full overflow-hidden rounded-full"
          initial={false}
          animate={{ width: `${Math.max(pct * 100, 1.5)}%`, backgroundColor: color, boxShadow: `0 0 3em ${color}66` }}
          transition={reduce ? { duration: 0 } : { width: { type: 'spring', stiffness: 30, damping: 16 }, backgroundColor: { duration: 1.2 }, boxShadow: { duration: 1.2 } }}
        />
        {marks.slice(0, -1).map((m) => (
          <span key={m} className="absolute inset-y-0 w-[0.25em] bg-slate-950/40" style={{ left: `${m * 100}%` }} />
        ))}
      </div>
      <div className="relative mt-[0.9em] h-[2.2em] text-[1.5em] text-white/60">
        {marks.map((m) => {
          const reached = pct >= m - 1e-9;
          const label = inBonus ? (m === 1 ? `Bonus ${formatMoneyCompact(target, currency)}` : `Goal ✓`) : m === 1 ? `Goal ${formatMoneyCompact(goalCents, currency)}` : `${m * 100}%`;
          return (
            <span
              key={m}
              className={`absolute top-0 whitespace-nowrap font-medium transition-colors duration-700 ${reached ? 'text-white' : ''}`}
              style={m === 1 ? { right: 0 } : { left: `${m * 100}%`, transform: 'translateX(-50%)' }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
