'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HeartHandshake } from 'lucide-react';
import { formatMoney, timeAgo } from '@/lib/fund/format';
import type { PublicDonation } from '@/lib/fund/types';
import { Card, EmptyState } from '../ui/primitives';
import { cn } from '../ui/cn';
import { Avatar } from './avatar';

export function DonationRow({ d, now, currency, rank }: { d: PublicDonation; now: number; currency: string; rank?: number }) {
  return (
    <div className="flex gap-3 px-5 py-3.5">
      {rank ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">{rank}</span>
      ) : (
        <Avatar name={d.name} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-medium text-slate-900">{d.name}</p>
          <p className="shrink-0 text-sm font-semibold text-slate-900">{formatMoney(d.amount_cents, currency)}</p>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span className="truncate">
            {d.team_name ?? d.ambassador_name ?? (d.offline ? 'Offline gift' : 'General')}
            <span className="mx-1">·</span>
            <time dateTime={d.created_at}>{timeAgo(d.created_at, now)}</time>
          </span>
          {d.matched_cents > 0 && (
            <span className="shrink-0 font-medium text-[var(--fund-accent-strong)]">+{formatMoney(d.matched_cents, currency)} matched</span>
          )}
        </div>
        {d.message && <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm text-slate-600">“{d.message}”</p>}
      </div>
    </div>
  );
}

export function DonorFeed({ recent, top, now, currency, donationCount }: { recent: PublicDonation[]; top: PublicDonation[]; now: number; currency: string; donationCount: number }) {
  const [tab, setTab] = useState<'recent' | 'top'>('recent');
  const [limit, setLimit] = useState(12);
  const list = tab === 'recent' ? recent : top;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <h2 className="text-base font-semibold text-slate-900">
          Donors <span className="font-normal text-slate-500">({new Intl.NumberFormat('en-US').format(donationCount)})</span>
        </h2>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm" role="tablist">
          {(['recent', 'top'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn('rounded-md px-3 py-1 capitalize transition', tab === t ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<HeartHandshake className="size-8" />} title="Be the first to give" description="Your gift will appear here instantly." />
      ) : (
        <ul className="divide-y divide-slate-100">
          <AnimatePresence initial={false}>
            {list.slice(0, limit).map((d, i) => (
              <motion.li
                key={`${tab}-${d.id}`}
                layout="position"
                initial={{ opacity: 0, backgroundColor: 'var(--fund-accent-soft)' }}
                animate={{ opacity: 1, backgroundColor: 'rgba(255,255,255,0)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, backgroundColor: { duration: 2.5 } }}
              >
                <DonationRow d={d} now={now} currency={currency} rank={tab === 'top' ? i + 1 : undefined} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {list.length > limit && (
        <button onClick={() => setLimit((l) => l + 24)} className="w-full border-t border-slate-100 py-3 text-sm font-medium text-[var(--fund-accent-strong)] hover:bg-slate-50">
          Show more
        </button>
      )}
    </Card>
  );
}
