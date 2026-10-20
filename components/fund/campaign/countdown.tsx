'use client';

import { campaignPhase, splitDuration } from '@/lib/fund/time';
import { cn } from '../ui/cn';

export { campaignPhase, splitDuration };

export function Countdown({ now, startsAt, endsAt, tone = 'light', className }: { now: number; startsAt: string; endsAt: string; tone?: 'light' | 'dark'; className?: string }) {
  const { phase, target } = campaignPhase(now, startsAt, endsAt);
  if (phase === 'ended') {
    return <p className={cn('text-sm font-medium', tone === 'dark' ? 'text-white/80' : 'text-slate-600', className)}>This campaign has ended — thank you!</p>;
  }
  const d = splitDuration(target - now);
  const units = [
    ['days', d.days],
    ['hrs', d.hours],
    ['min', d.minutes],
    ['sec', d.seconds],
  ] as const;
  return (
    <div className={className}>
      <p className={cn('mb-2 text-xs font-medium uppercase tracking-wider', tone === 'dark' ? 'text-white/70' : 'text-slate-500')}>
        {phase === 'upcoming' ? 'Starts in' : 'Time remaining'}
      </p>
      <div className="flex gap-2" role="timer" aria-live="off">
        {units.map(([label, value]) => (
          <div
            key={label}
            className={cn(
              'flex min-w-14 flex-col items-center rounded-xl px-2 py-2',
              tone === 'dark' ? 'bg-white/10 text-white ring-1 ring-white/15' : 'bg-slate-100 text-slate-900',
            )}
          >
            <span className="fund-tabular text-xl font-semibold leading-none">{String(value).padStart(2, '0')}</span>
            <span className={cn('mt-1 text-[11px]', tone === 'dark' ? 'text-white/60' : 'text-slate-500')}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
