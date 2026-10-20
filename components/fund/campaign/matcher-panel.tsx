'use client';

import { Zap, Clock } from 'lucide-react';
import { formatMoney, formatMoneyCompact, multiplierLabel, ratioLabel } from '@/lib/fund/format';
import { currentMatcher } from '@/lib/fund/matching';
import type { CampaignTotals, PublicMatcher } from '@/lib/fund/types';
import { Card, Badge } from '../ui/primitives';
import { Meter } from '../ui/stat';
import { Avatar } from './avatar';
import { splitDuration } from '@/lib/fund/time';

function matcherState(m: PublicMatcher, now: number) {
  if (m.status === 'paused') return { label: 'Paused', tone: 'neutral' as const };
  if (m.remaining_cents <= 0) return { label: 'Fully matched', tone: 'neutral' as const };
  if (m.ends_at && Date.parse(m.ends_at) <= now) return { label: 'Ended', tone: 'neutral' as const };
  if (m.starts_at && Date.parse(m.starts_at) > now) return { label: 'Upcoming', tone: 'info' as const };
  return { label: 'Matching now', tone: 'success' as const };
}

export function MatcherPanel({ matchers, totals, now, currency }: { matchers: PublicMatcher[]; totals: CampaignTotals; now: number; currency: string }) {
  const live = currentMatcher(matchers, new Date(now));
  const ratio = live?.ratio ?? null;
  const pledged = matchers.filter((m) => m.status === 'active').reduce((s, m) => s + m.pledge_cents, 0);
  const remaining = Math.max(0, totals.match_remaining_cents);
  const windowLeft = live?.ends_at ? splitDuration(Date.parse(live.ends_at) - now) : null;

  if (!matchers.length) return null;
  return (
    <Card className="overflow-hidden">
      <div className="bg-[var(--fund-accent-deep)] px-5 py-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/70">{ratio ? 'Every gift is matched' : 'Match status'}</p>
            <p className="mt-0.5 text-2xl font-semibold">{ratio ? ratioLabel(ratio) : 'Match funds used'}</p>
          </div>
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <span className="text-2xl font-bold">{multiplierLabel(ratio)}</span>
          </div>
        </div>
        {live && (
          <div className="mt-3 space-y-1 text-sm text-white/80">
            <p className="flex items-center gap-1.5">
              <Zap className="size-4 shrink-0 text-amber-300" aria-hidden />
              <span className="min-w-0 truncate">
                Now drawing from <span className="font-medium text-white">{live.name}</span>
              </span>
            </p>
            {windowLeft && (
              <p className="flex items-center gap-1.5 text-xs text-white/70">
                <Clock className="size-3.5 shrink-0" aria-hidden />
                This match window closes in {windowLeft.days > 0 ? `${windowLeft.days}d ` : ''}
                {windowLeft.hours}h {windowLeft.minutes}m
              </p>
            )}
          </div>
        )}
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-white/70">
            <span>{formatMoney(remaining, currency, { cents: false })} match funds remaining</span>
            <span>of {formatMoneyCompact(pledged, currency)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${pledged ? (remaining / pledged) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {matchers.map((m) => {
          const state = matcherState(m, now);
          return (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3.5">
              <Avatar name={m.name} src={m.logo_url} accent />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{m.name}</p>
                  <Badge tone="accent">{ratioLabel(m.ratio)}</Badge>
                </div>
                <Meter value={m.matched_cents} max={m.pledge_cents} height="h-1.5" className="mt-2" label={`${m.name} pool used`} />
                <div className="mt-1 flex justify-between text-xs text-slate-500">
                  <span>{formatMoneyCompact(m.matched_cents, currency)} of {formatMoneyCompact(m.pledge_cents, currency)} matched</span>
                  <Badge tone={state.tone} dot className="!px-1.5 !py-0 text-[11px]">{state.label}</Badge>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
