'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trophy, Heart, Zap } from 'lucide-react';
import { formatMoney, formatMoneyCompact, ratioLabel, timeAgo } from '@/lib/fund/format';
import type { PublicCampaign } from '@/lib/fund/types';

type PanelId = 'teams' | 'donors' | 'matchers';
const TITLES: Record<PanelId, { label: string; icon: React.ReactNode }> = {
  teams: { label: 'Top teams', icon: <Trophy className="size-[1em] text-amber-300" /> },
  donors: { label: 'Recent donors', icon: <Heart className="size-[1em] text-pink-300" /> },
  matchers: { label: 'Our matchers', icon: <Zap className="size-[1em] text-yellow-300" /> },
};
const ROWS = 7;

/** Rotates between leaderboards on a fixed-height card — content swaps, the box never moves. */
export function SidePanel({ data, now, rotateSeconds = 12 }: { data: PublicCampaign; now: number; rotateSeconds?: number }) {
  const panels = useMemo(() => {
    const p: PanelId[] = [];
    if (data.teams.length) p.push('teams');
    p.push('donors');
    if (data.matchers.length) p.push('matchers');
    return p;
  }, [data.teams.length, data.matchers.length]);
  const [index, setIndex] = useState(0);
  const active = panels[index % panels.length]!;
  const currency = data.campaign.currency;

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % panels.length), rotateSeconds * 1000);
    return () => clearInterval(id);
  }, [panels.length, rotateSeconds]);

  const maxTeam = Math.max(1, ...data.teams.map((t) => t.raised_cents));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2em] bg-white/[0.06] ring-1 ring-white/10">
      <div className="flex items-center justify-between px-[2em] pb-[1em] pt-[1.8em]">
        <p className="flex items-center gap-[0.5em] text-[2.1em] font-semibold">
          {TITLES[active].icon}
          {TITLES[active].label}
        </p>
        <div className="flex gap-[0.6em]">
          {panels.map((p, i) => (
            <span key={p} className={`h-[0.7em] rounded-full transition-all duration-500 ${i === index % panels.length ? 'w-[2.4em] bg-white' : 'w-[0.7em] bg-white/30'}`} />
          ))}
        </div>
      </div>
      <div className="mx-[2em] h-[0.25em] overflow-hidden rounded-full bg-white/10">
        <div key={index} className="h-full rounded-full bg-white/60" style={{ animation: `fund-panel-timer ${rotateSeconds}s linear forwards` }} />
      </div>
      <div className="relative min-h-0 flex-1 px-[2em] py-[1.2em]">
        <AnimatePresence mode="wait">
          <motion.ul key={active} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.45 }} className="flex h-full flex-col justify-start gap-[0.9em]">
            {active === 'teams' &&
              data.teams.slice(0, ROWS).map((t, i) => (
                <li key={t.id} className="text-[1.75em]">
                  <div className="flex items-baseline justify-between gap-[0.6em]">
                    <span className="flex min-w-0 items-baseline gap-[0.6em]">
                      <span className={`w-[1.2em] text-right font-bold ${i < 3 ? 'text-amber-300' : 'text-white/50'}`}>{i + 1}</span>
                      <span className="truncate font-medium">{t.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold">{formatMoneyCompact(t.raised_cents, currency)}</span>
                  </div>
                  <div className="ml-[1.8em] mt-[0.35em] h-[0.4em] overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-white/80 transition-[width] duration-1000" style={{ width: `${(t.goal_cents ? Math.min(1, t.raised_cents / t.goal_cents) : t.raised_cents / maxTeam) * 100}%` }} />
                  </div>
                </li>
              ))}
            {active === 'donors' &&
              data.recent.slice(0, ROWS).map((d) => (
                <li key={d.id} className="flex items-baseline justify-between gap-[0.6em] border-b border-white/10 pb-[0.5em] text-[1.75em] last:border-0">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="block truncate text-[0.7em] text-white/55">{d.team_name ?? 'General'} · {timeAgo(d.created_at, now)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold">{formatMoney(d.amount_cents, currency)}</span>
                    {d.matched_cents > 0 && <span className="block text-[0.7em] text-emerald-300">→ {formatMoney(d.amount_cents + d.matched_cents, currency)}</span>}
                  </span>
                </li>
              ))}
            {active === 'matchers' &&
              data.matchers.slice(0, ROWS).map((m) => (
                <li key={m.id} className="text-[1.75em]">
                  <div className="flex items-baseline justify-between gap-[0.6em]">
                    <span className="truncate font-medium">{m.name}</span>
                    <span className="shrink-0 rounded-full bg-white/15 px-[0.5em] text-[0.75em] font-semibold">{ratioLabel(m.ratio)}</span>
                  </div>
                  <div className="mt-[0.35em] h-[0.4em] overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-yellow-300 transition-[width] duration-1000" style={{ width: `${(m.matched_cents / m.pledge_cents) * 100}%` }} />
                  </div>
                  <p className="mt-[0.25em] text-[0.7em] text-white/55">
                    {m.remaining_cents > 0 ? `${formatMoneyCompact(m.remaining_cents, currency)} left of ${formatMoneyCompact(m.pledge_cents, currency)}` : 'Fully matched — thank you!'}
                  </p>
                </li>
              ))}
          </motion.ul>
        </AnimatePresence>
      </div>
    </div>
  );
}
