'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Trophy, Users } from 'lucide-react';
import { formatMoney, formatNumber } from '@/lib/fund/format';
import type { PublicAmbassador, PublicTeam } from '@/lib/fund/types';
import { Card, EmptyState } from '../ui/primitives';
import { Meter } from '../ui/stat';
import { cn } from '../ui/cn';
import { Avatar } from './avatar';

type Row = { id: string; name: string; sub: string | null; avatar: string | null; raised: number; goal: number | null; count: number };

export function Leaderboards({
  teams,
  ambassadors,
  currency,
  onDonate,
}: {
  teams: PublicTeam[];
  ambassadors: PublicAmbassador[];
  currency: string;
  onDonate: (target: { teamId?: string; ambassadorId?: string }) => void;
}) {
  const [tab, setTab] = useState<'teams' | 'ambassadors'>(teams.length ? 'teams' : 'ambassadors');
  const [query, setQuery] = useState('');
  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);

  const rows: Row[] = useMemo(() => {
    const base =
      tab === 'teams'
        ? teams.map((t) => ({ id: t.id, name: t.name, sub: t.captain_name ? `Captain ${t.captain_name}` : null, avatar: t.avatar_url, raised: t.raised_cents, goal: t.goal_cents, count: t.donation_count }))
        : ambassadors.map((a) => ({ id: a.id, name: a.name, sub: a.team_id ? (teamName.get(a.team_id) ?? null) : null, avatar: a.avatar_url, raised: a.raised_cents, goal: a.goal_cents, count: a.donation_count }));
    const q = query.trim().toLowerCase();
    return base.sort((a, b) => b.raised - a.raised).filter((r) => !q || r.name.toLowerCase().includes(q) || r.sub?.toLowerCase().includes(q));
  }, [tab, teams, ambassadors, query, teamName]);

  if (!teams.length && !ambassadors.length) return null;
  const total = tab === 'teams' ? teams.length : ambassadors.length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Trophy className="size-4 text-amber-500" aria-hidden /> Leaderboard
        </h2>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm" role="tablist">
          {teams.length > 0 && (
            <button role="tab" aria-selected={tab === 'teams'} onClick={() => setTab('teams')} className={cn('rounded-md px-3 py-1 transition', tab === 'teams' ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500')}>
              Teams ({teams.length})
            </button>
          )}
          {ambassadors.length > 0 && (
            <button role="tab" aria-selected={tab === 'ambassadors'} onClick={() => setTab('ambassadors')} className={cn('rounded-md px-3 py-1 transition', tab === 'ambassadors' ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500')}>
              Ambassadors ({ambassadors.length})
            </button>
          )}
        </div>
      </div>
      {total > 6 && (
        <div className="relative border-b border-slate-100 px-5 py-2.5">
          <Search className="pointer-events-none absolute left-8 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${tab}`}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:border-[var(--fund-accent)] focus:outline-none"
            aria-label={`Search ${tab}`}
          />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} title="No matches" />
      ) : (
        <ol className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <motion.li key={r.id} layout="position" transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="flex items-center gap-3 px-5 py-3.5">
              <span className={cn('w-6 shrink-0 text-center text-sm font-semibold', i < 3 ? 'text-amber-600' : 'text-slate-400')}>{i + 1}</span>
              <Avatar name={r.name} src={r.avatar} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-slate-900">{r.name}</p>
                  <p className="shrink-0 text-sm font-semibold text-slate-900">{formatMoney(r.raised, currency)}</p>
                </div>
                {r.goal ? <Meter value={r.raised} max={r.goal} height="h-1.5" className="mt-1.5" label={`${r.name} progress`} /> : null}
                <p className="mt-1 text-xs text-slate-500">
                  {r.sub ? `${r.sub} · ` : ''}
                  {formatNumber(r.count)} {r.count === 1 ? 'donor' : 'donors'}
                  {r.goal ? ` · ${Math.floor((r.raised / r.goal) * 100)}% of ${formatMoney(r.goal, currency)}` : ''}
                </p>
              </div>
              <button
                onClick={() => onDonate(tab === 'teams' ? { teamId: r.id } : { ambassadorId: r.id })}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-[var(--fund-accent)] hover:text-[var(--fund-accent-strong)]"
              >
                Donate
              </button>
            </motion.li>
          ))}
        </ol>
      )}
    </Card>
  );
}
