'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { formatMoney, multiplierLabel } from '@/lib/fund/format';
import type { PublicDonation } from '@/lib/fund/types';
import { Confetti } from './confetti';

export type SplashItem =
  | { kind: 'donation'; key: string; donation: PublicDonation; big: boolean }
  | { kind: 'milestone'; key: string; label: string; sub: string };

/** Center-stage popup for big gifts and milestones; lower-third banner for everything else. */
export function Splash({ item, currency }: { item: SplashItem | null; currency: string }) {
  const center = item && (item.kind === 'milestone' || item.big);
  return (
    <>
      <AnimatePresence>
        {item && center && (
          <motion.div key={item.key} className="absolute inset-0 z-40 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
            <Confetti seed={item.key.length + item.key.charCodeAt(item.key.length - 1)} pieces={item.kind === 'milestone' ? 110 : 70} />
            <motion.div
              className="relative mx-[6em] max-w-[110em] rounded-[3em] bg-white px-[6em] py-[4.5em] text-center text-slate-900 shadow-2xl"
              initial={{ scale: 0.6, y: 60 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: -30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            >
              {item.kind === 'milestone' ? (
                <>
                  <p className="text-[3em] font-semibold uppercase tracking-[0.2em] text-[var(--fund-accent)]">Milestone</p>
                  <p className="mt-[0.2em] text-[8em] font-black leading-none tracking-tight">{item.label}</p>
                  <p className="mt-[0.6em] text-[3em] text-slate-600">{item.sub}</p>
                </>
              ) : (
                <>
                  <p className="text-[6.5em] font-black leading-[1.05] tracking-tight">
                    {item.donation.name} donated <span className="text-[var(--fund-accent)]">{formatMoney(item.donation.amount_cents, currency)}</span>!
                  </p>
                  {item.donation.matched_cents > 0 && (
                    <p className="mt-[0.5em] text-[3.6em] font-semibold text-emerald-600">
                      Matched {multiplierLabel(item.donation.matched_cents / item.donation.amount_cents)} → {formatMoney(item.donation.amount_cents + item.donation.matched_cents, currency)} impact
                    </p>
                  )}
                  {(item.donation.team_name || item.donation.message) && (
                    <p className="mx-auto mt-[0.8em] max-w-[34em] text-[2.6em] text-slate-500">
                      {item.donation.team_name && <span className="font-medium text-slate-700">{item.donation.team_name}</span>}
                      {item.donation.team_name && item.donation.message && ' · '}
                      {item.donation.message && <span className="italic">“{item.donation.message.slice(0, 140)}”</span>}
                    </p>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {item && !center && item.kind === 'donation' && (
          <motion.div
            key={item.key}
            className="absolute bottom-[3em] left-[3em] z-30 flex max-w-[95em] items-center gap-[2em] rounded-[2em] bg-white py-[1.6em] pl-[1.8em] pr-[3em] text-slate-900 shadow-2xl"
            initial={{ y: '140%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '140%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <span className="flex size-[5.5em] shrink-0 items-center justify-center rounded-[1.4em] bg-[var(--fund-accent)] text-[1em] text-white">
              <span className="text-[2.6em] font-black">{item.donation.matched_cents > 0 ? multiplierLabel(item.donation.matched_cents / item.donation.amount_cents) : '♥'}</span>
            </span>
            <div className="min-w-0">
              <p className="truncate text-[3.4em] font-bold leading-tight">
                {item.donation.name} donated {formatMoney(item.donation.amount_cents, currency)}!
              </p>
              <p className="truncate text-[2em] text-slate-500">
                {item.donation.matched_cents > 0 ? `Matched to ${formatMoney(item.donation.amount_cents + item.donation.matched_cents, currency)}` : 'Thank you!'}
                {item.donation.team_name ? ` · ${item.donation.team_name}` : ''}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
