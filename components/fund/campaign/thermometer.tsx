'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { formatMoney } from '@/lib/fund/format';
import { cn } from '../ui/cn';

/**
 * Progress thermometer. Scales to the main goal; once that's reached and a bonus
 * goal exists, rescales to the bonus goal (the classic "bonus round").
 */
export function Thermometer({
  totalCents,
  goalCents,
  bonusGoalCents,
  currency = 'usd',
  className,
  compact,
}: {
  totalCents: number;
  goalCents: number;
  bonusGoalCents?: number | null;
  currency?: string;
  className?: string;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const inBonus = totalCents >= goalCents && Boolean(bonusGoalCents);
  const target = inBonus ? bonusGoalCents! : goalCents;
  const pct = target > 0 ? Math.min(1, totalCents / target) : 0;
  const pctOfGoal = goalCents > 0 ? totalCents / goalCents : 0;

  return (
    <div className={className}>
      <div className="flex items-center" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={totalCents} aria-label="Campaign progress">
        <div className={cn('relative z-10 -mr-3 shrink-0 rounded-full bg-[var(--fund-accent)] ring-4 ring-white', compact ? 'size-6' : 'size-8')} aria-hidden />
        <div className={cn('relative flex-1 overflow-hidden rounded-full bg-[var(--fund-accent-track)]', compact ? 'h-3' : 'h-4')}>
          <motion.div
            className="fund-shimmer relative h-full overflow-hidden rounded-full bg-[var(--fund-accent)]"
            initial={false}
            animate={{ width: `${Math.max(pct * 100, pct > 0 ? 2 : 0)}%` }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 45, damping: 18 }}
          />
          {[0.25, 0.5, 0.75].map((m) => (
            <span key={m} className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: `${m * 100}%` }} aria-hidden />
          ))}
        </div>
      </div>
      {!compact && (
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-900">{Math.floor(pctOfGoal * 100)}% of goal</span>
          <span className="text-slate-500">
            {inBonus ? 'Bonus goal ' : 'Goal '}
            <span className="font-medium text-slate-700">{formatMoney(target, currency)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
