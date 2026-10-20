'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, MonitorPlay, ShieldCheck, Users } from 'lucide-react';
import { getFundBrowserClient } from '@/lib/fund/supabase/browser';
import { formatMoney, formatNumber, multiplierLabel, ratioLabel, timeAgo } from '@/lib/fund/format';
import { currentMatcher } from '@/lib/fund/matching';
import type { PublicCampaign, PublicDonation } from '@/lib/fund/types';
import { useCampaignLive, useServerNow, type LiveConnection } from '../hooks/use-campaign-live';
import { AnimatedMoney } from '../ui/animated-number';
import { Button, Card } from '../ui/primitives';
import { Thermometer } from './thermometer';
import { Countdown } from './countdown';
import { campaignPhase } from '@/lib/fund/time';
import { MatcherPanel } from './matcher-panel';
import { DonorFeed } from './donor-feed';
import { Leaderboards } from './leaderboards';
import { ShareButtons } from './share-buttons';
import { CheckoutModal, type CheckoutPreset, type FeeConfig } from './checkout/checkout-modal';

export interface CampaignUrlParams {
  amountCents?: number;
  teamSlug?: string;
  ambassadorCode?: string;
  linkId?: string;
  openCheckout?: boolean;
  completed?: boolean;
}

function LiveIndicator({ connection }: { connection: LiveConnection }) {
  const label = { live: 'Live', demo: 'Demo · simulated', connecting: 'Connecting…', reconnecting: 'Reconnecting…', polling: 'Auto-updating' }[connection];
  const color = connection === 'live' ? 'bg-emerald-400' : connection === 'demo' ? 'bg-amber-400' : 'bg-slate-400';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/20">
      <span className={`fund-live-dot size-2 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  );
}

function VideoEmbed({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  const src = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
  if (!src) return null;
  return (
    <div className="aspect-video overflow-hidden rounded-xl bg-slate-900">
      <iframe src={src} title="Campaign video" className="size-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
    </div>
  );
}

export function CampaignExperience({
  initial,
  feeConfig,
  paymentsEnabled,
  siteUrl,
  params,
}: {
  initial: PublicCampaign;
  feeConfig: FeeConfig;
  paymentsEnabled: boolean;
  siteUrl: string;
  params: CampaignUrlParams;
}) {
  const [pulse, setPulse] = useState<PublicDonation | null>(null);
  const onDonation = useCallback((d: PublicDonation) => setPulse(d), []);
  const { data, connection, applyDonation } = useCampaignLive(initial, { onDonation });
  const now = useServerNow(initial.server_time);
  const { campaign, totals, organization } = data;
  const currency = campaign.currency;

  const teamFromUrl = params.teamSlug ? data.teams.find((t) => t.slug === params.teamSlug) : undefined;
  const ambassadorFromUrl = params.ambassadorCode ? data.ambassadors.find((a) => a.code === params.ambassadorCode) : undefined;
  const basePreset: CheckoutPreset = useMemo(
    () => ({ amountCents: params.amountCents, teamId: teamFromUrl?.id ?? null, ambassadorId: ambassadorFromUrl?.id ?? null, linkId: params.linkId ?? null }),
    [params.amountCents, params.linkId, teamFromUrl?.id, ambassadorFromUrl?.id],
  );
  const [checkout, setCheckout] = useState<{ open: boolean; preset: CheckoutPreset }>({ open: Boolean(params.openCheckout), preset: basePreset });
  const [returned, setReturned] = useState(Boolean(params.completed));

  const openCheckout = useCallback((extra: Partial<CheckoutPreset> = {}) => setCheckout({ open: true, preset: { ...basePreset, ...extra } }), [basePreset]);

  useEffect(() => {
    if (!pulse) return;
    const t = setTimeout(() => setPulse(null), 4500);
    return () => clearTimeout(t);
  }, [pulse]);

  // Count one page view per browser session (feeds the portal's conversion rate).
  useEffect(() => {
    if (data.demo) return;
    const key = `fund:viewed:${campaign.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      return;
    }
    void getFundBrowserClient()?.rpc('fund_track_page_view', { p_campaign_id: campaign.id });
  }, [campaign.id, data.demo]);

  const { phase } = campaignPhase(now, campaign.starts_at, campaign.ends_at);
  const canGive = phase === 'live' && campaign.status === 'active';
  const live = currentMatcher(data.matchers, new Date(now));
  const shareUrl = `${siteUrl}/fund/${campaign.slug}${ambassadorFromUrl ? `?ref=${ambassadorFromUrl.code}` : ''}`;
  const paragraphs = (campaign.description ?? '').split(/\n{2,}/).filter(Boolean);
  const heroBg = campaign.hero_image_url
    ? { backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.55), rgba(2,6,23,.85)), url(${JSON.stringify(campaign.hero_image_url)})` }
    : undefined;

  return (
    <div className="fund-theme min-h-screen pb-24 lg:pb-0" style={{ '--fund-accent': campaign.theme_color } as React.CSSProperties}>
      {/* ------------------------------------------------------------ hero */}
      <section
        className="relative overflow-hidden bg-[var(--fund-accent-deep)] bg-cover bg-center text-white"
        style={heroBg ?? { backgroundImage: 'radial-gradient(1200px 500px at 15% -10%, color-mix(in oklab, var(--fund-accent) 70%, transparent), transparent), radial-gradient(900px 500px at 100% 0%, color-mix(in oklab, var(--fund-accent) 40%, transparent), transparent)' }}
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12 lg:pb-16 lg:pt-10">
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              {organization.logo_url ? <img src={organization.logo_url} alt="" className="size-8 rounded-lg bg-white object-contain p-0.5" /> : null}
              <span className="text-sm font-medium text-white/85">{organization.name}</span>
              <LiveIndicator connection={connection} />
              {campaign.status === 'paused' && <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-medium text-amber-200 ring-1 ring-amber-300/30">Paused</span>}
              {!['active', 'paused', 'completed'].includes(campaign.status) && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">Preview · {campaign.status.replace('_', ' ')}</span>
              )}
            </div>
            <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl">{campaign.title}</h1>
            {campaign.tagline && <p className="mt-4 max-w-xl text-pretty text-lg text-white/80">{campaign.tagline}</p>}
            {live && canGive && (
              <div className="mt-6 inline-flex max-w-max items-center gap-3 rounded-2xl bg-white/10 py-2 pl-2 pr-4 ring-1 ring-white/20 backdrop-blur">
                <span className="flex size-11 items-center justify-center rounded-xl bg-white text-lg font-bold text-[var(--fund-accent-strong)]">{multiplierLabel(live.ratio)}</span>
                <span className="text-sm">
                  <span className="block font-semibold">{ratioLabel(live.ratio)} matching is live</span>
                  <span className="text-white/75">{formatMoney(totals.match_remaining_cents, currency, { cents: false })} in match funds left</span>
                </span>
              </div>
            )}
            <Countdown now={now} startsAt={campaign.starts_at} endsAt={campaign.ends_at} tone="dark" className="mt-8" />
            {teamFromUrl && <p className="mt-6 text-sm text-white/80">You&apos;re supporting <span className="font-semibold text-white">{teamFromUrl.name}</span></p>}
            {ambassadorFromUrl && <p className="mt-2 text-sm text-white/80">Invited by <span className="font-semibold text-white">{ambassadorFromUrl.name}</span></p>}
          </div>

          <Card className="self-start p-5 text-slate-900 shadow-xl sm:p-7">
            <p className="text-sm font-medium text-slate-500">Raised so far</p>
            <AnimatedMoney cents={totals.total_cents} currency={currency} className="mt-1 block text-5xl font-bold tracking-tight sm:text-6xl" />
            <p className="mt-1 text-sm text-slate-500">
              of {formatMoney(totals.goal_cents, currency, { cents: false })} goal
              {totals.matched_cents > 0 && <> · includes {formatMoney(totals.matched_cents, currency, { cents: false })} in matching</>}
            </p>
            <Thermometer totalCents={totals.total_cents} goalCents={totals.goal_cents} bonusGoalCents={totals.bonus_goal_cents} currency={currency} className="mt-6" />
            <dl className="mt-6 grid grid-cols-3 divide-x divide-slate-100 rounded-2xl bg-slate-50 py-3 text-center">
              <div>
                <dt className="text-xs text-slate-500">Donors</dt>
                <dd className="mt-0.5 font-semibold">{formatNumber(totals.donation_count)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Matched</dt>
                <dd className="mt-0.5 font-semibold">{formatMoney(totals.matched_cents, currency, { cents: false })}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Match</dt>
                <dd className="mt-0.5 font-semibold">{multiplierLabel(live?.ratio)}</dd>
              </div>
            </dl>
            <Button size="lg" className="mt-6 w-full text-lg" disabled={!canGive} onClick={() => openCheckout()}>
              <Heart className="size-5" aria-hidden />
              {canGive ? 'Donate now' : phase === 'upcoming' ? 'Opens soon' : 'Campaign closed'}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="size-3.5" aria-hidden /> Secure checkout · Stripe · Apple Pay · Google Pay
            </p>
          </Card>
        </div>
      </section>

      {/* ------------------------------------------------------------ body */}
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-12">
        <div className="space-y-6">
          {(paragraphs.length > 0 || campaign.video_url) && (
            <Card className="p-5 sm:p-7">
              <h2 className="text-lg font-semibold">About this campaign</h2>
              {campaign.video_url && <div className="mt-4"><VideoEmbed url={campaign.video_url} /></div>}
              <div className="fund-prose mt-4 text-[15px] leading-relaxed text-slate-700">
                {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              </div>
              {organization.ein && <p className="mt-6 text-xs text-slate-500">{organization.name} · EIN {organization.ein}. Donations may be tax-deductible as allowed by law.</p>}
            </Card>
          )}
          <Leaderboards teams={data.teams} ambassadors={data.ambassadors} currency={currency} onDonate={(t) => openCheckout({ teamId: t.teamId ?? null, ambassadorId: t.ambassadorId ?? null })} />
          <Card className="p-5 sm:p-7">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="size-5 text-slate-400" aria-hidden /> Spread the word</h2>
            <p className="mt-1 text-sm text-slate-600">Every share brings in more matched gifts.</p>
            <ShareButtons url={shareUrl} title={campaign.title} className="mt-4" />
            <a href={`/fund/display/${campaign.slug}`} target="_blank" rel="noopener" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--fund-accent-strong)] hover:underline">
              <MonitorPlay className="size-4" aria-hidden /> Open the live event big screen
            </a>
          </Card>
        </div>
        <aside className="space-y-6">
          <MatcherPanel matchers={data.matchers} totals={totals} now={now} currency={currency} />
          <DonorFeed recent={data.recent} top={data.top} now={now} currency={currency} donationCount={totals.donation_count} />
        </aside>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        Powered by yaakoveisenberger.com/fund · Payments processed securely by Stripe
      </footer>

      {/* ------------------------------------------------------------ mobile donate bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <AnimatedMoney cents={totals.total_cents} currency={currency} className="block text-lg font-bold leading-tight" />
            <p className="truncate text-xs text-slate-500">{Math.floor((totals.total_cents / totals.goal_cents) * 100)}% of {formatMoney(totals.goal_cents, currency, { cents: false })}</p>
          </div>
          <Button size="lg" disabled={!canGive} onClick={() => openCheckout()}>
            <Heart className="size-4" aria-hidden /> Donate
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------ live pulse */}
      <div className="pointer-events-none fixed bottom-24 left-4 z-30 lg:bottom-6" aria-live="polite">
        <AnimatePresence>
          {pulse && (
            <motion.div
              key={pulse.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex max-w-xs items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--fund-accent-soft)]">
                <Heart className="size-4 text-[var(--fund-accent)]" aria-hidden />
              </span>
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{pulse.name}</span> gave {formatMoney(pulse.amount_cents, currency)}
                {pulse.matched_cents > 0 && <> → <span className="font-semibold text-[var(--fund-accent-strong)]">{formatMoney(pulse.amount_cents + pulse.matched_cents, currency)}</span></>}
                <span className="block text-xs text-slate-400">{timeAgo(pulse.created_at, now)}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CheckoutModal
        open={checkout.open}
        onClose={() => setCheckout((c) => ({ ...c, open: false }))}
        data={data}
        preset={checkout.preset}
        feeConfig={feeConfig}
        paymentsEnabled={paymentsEnabled}
        onDemoDonation={applyDonation}
        now={now}
      />

      {returned && (
        <div className="fixed inset-x-0 top-4 z-50 mx-auto w-[calc(100%-2rem)] max-w-md">
          <Card className="flex items-start gap-3 p-4 shadow-xl">
            <Heart className="mt-0.5 size-5 text-[var(--fund-accent)]" aria-hidden />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Thank you for your donation!</p>
              <p className="text-slate-600">Your payment is confirmed or processing — it will appear on the donor wall momentarily.</p>
            </div>
            <button className="text-sm text-slate-500 hover:text-slate-800" onClick={() => setReturned(false)}>Close</button>
          </Card>
        </div>
      )}
    </div>
  );
}
