'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize, Zap } from 'lucide-react';
import { formatMoney, multiplierLabel, ratioLabel } from '@/lib/fund/format';
import { currentMatcher } from '@/lib/fund/matching';
import type { DonationBroadcast, PublicCampaign, PublicDonation } from '@/lib/fund/types';
import { useCampaignLive, useServerNow } from '../hooks/use-campaign-live';
import { AnimatedCount, AnimatedMoney } from '../ui/animated-number';
import { campaignPhase, splitDuration } from '@/lib/fund/time';
import { RollingCounter } from './rolling-counter';
import { ProgressRail } from './progress-rail';
import { SidePanel } from './side-panel';
import { Splash, type SplashItem } from './splash';

const MILESTONES = [0.25, 0.5, 0.75, 1];
const QUEUE_LIMIT = 12;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * Full-viewport event scoreboard. Everything is sized in `em` off a vmin-based
 * root font size, so the same layout fills 1080p and 4K screens exactly. Only
 * transforms/opacity animate, the grid never reflows, and all queues are capped
 * so it can run for many hours unattended.
 */
export function DisplayBoard({ initial, siteUrl, bigGiftCents = 100_000 }: { initial: PublicCampaign; siteUrl: string; bigGiftCents?: number }) {
  const [queue, setQueue] = useState<SplashItem[]>([]);
  const [current, setCurrent] = useState<SplashItem | null>(null);
  const lastPct = useRef(initial.totals.total_cents / initial.totals.goal_cents);
  const lastTotal = useRef(initial.totals.total_cents);

  const enqueue = useCallback((items: SplashItem[], priority = false) => {
    setQueue((q) => {
      let next = priority ? [...items, ...q] : [...q, ...items];
      // Under heavy volume drop the oldest small gifts first so the screen never lags behind.
      while (next.length > QUEUE_LIMIT) {
        const idx = next.findIndex((x) => x.kind === 'donation' && !x.big);
        next = idx >= 0 ? next.filter((_, i) => i !== idx) : next.slice(1);
      }
      return next;
    });
  }, []);

  const onDonation = useCallback(
    (d: PublicDonation, payload: DonationBroadcast) => {
      const milestones: SplashItem[] = [];
      const goal = payload.totals.goal_cents;
      const pct = payload.totals.total_cents / goal;
      for (const m of MILESTONES) {
        if (lastPct.current < m && pct >= m) {
          milestones.push({
            kind: 'milestone',
            key: `m-${m}-${d.id}`,
            label: m === 1 ? 'GOAL REACHED!' : `${m * 100}% of goal!`,
            sub: `${formatMoney(payload.totals.total_cents, initial.campaign.currency)} raised — thank you!`,
          });
        }
      }
      const bonus = payload.totals.bonus_goal_cents;
      if (bonus && lastTotal.current < bonus && payload.totals.total_cents >= bonus) {
        milestones.push({ kind: 'milestone', key: `bonus-${d.id}`, label: 'BONUS GOAL REACHED!', sub: 'You did it. Incredible.' });
      }
      lastPct.current = Math.max(lastPct.current, pct);
      lastTotal.current = Math.max(lastTotal.current, payload.totals.total_cents);
      enqueue([{ kind: 'donation', key: d.id, donation: d, big: d.amount_cents >= bigGiftCents }]);
      if (milestones.length) enqueue(milestones, true);
    },
    [enqueue, bigGiftCents, initial.campaign.currency],
  );

  const { data, connection } = useCampaignLive(initial, { onDonation, aggressive: true });
  const now = useServerNow(initial.server_time);
  const { campaign, totals, organization } = data;
  const currency = campaign.currency;

  // Splash scheduler: one at a time, shorter dwell when the queue is backed up.
  useEffect(() => {
    if (current) {
      const dwell = current.kind === 'milestone' ? 6500 : current.big ? 5500 : queue.length > 4 ? 2300 : 3800;
      const t = setTimeout(() => setCurrent(null), dwell);
      return () => clearTimeout(t);
    }
    if (!queue.length) return;
    const t = setTimeout(() => {
      setCurrent(queue[0]!);
      setQueue((q) => q.slice(1));
    }, 350);
    return () => clearTimeout(t);
  }, [current, queue]);

  // Keep the screen awake and lock the page (no scrollbars, no site chrome).
  useEffect(() => {
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        lock = null;
      }
    };
    void request();
    const onVisible = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      root.style.overflow = prevOverflow;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, []);

  // Cursor auto-hide + keyboard shortcuts (F = fullscreen, T = test popup).
  const [cursor, setCursor] = useState(false);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showCursor = () => {
    setCursor(true);
    if (cursorTimer.current) clearTimeout(cursorTimer.current);
    cursorTimer.current = setTimeout(() => setCursor(false), 2500);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 't' || e.key === 'T') {
        enqueue([
          {
            kind: 'donation',
            key: `test-${Date.now()}`,
            big: e.shiftKey,
            donation: { id: 'test', name: 'Test Donor', is_anonymous: false, amount_cents: e.shiftKey ? 180000 : 18000, matched_cents: e.shiftKey ? 540000 : 54000, message: 'This is a test popup', team_id: null, team_name: null, ambassador_id: null, ambassador_name: null, offline: false, created_at: new Date().toISOString() },
          },
        ]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enqueue]);

  const { phase, target } = campaignPhase(now, campaign.starts_at, campaign.ends_at);
  const left = splitDuration(target - now);
  const live = currentMatcher(data.matchers, new Date(now));
  const pct = totals.total_cents / totals.goal_cents;
  const donateUrl = `${siteUrl}/fund/${campaign.slug}`;
  const shortUrl = donateUrl.replace(/^https?:\/\//, '');
  const settings = campaign.display_settings ?? {};

  return (
    <div
      className={`fund-display fund-theme fixed inset-0 z-[9999] overflow-hidden bg-slate-950 text-white ${cursor ? 'show-cursor' : ''}`}
      style={{
        '--fund-accent': campaign.theme_color,
        backgroundImage:
          'radial-gradient(80vmax 60vmax at 0% 0%, color-mix(in oklab, var(--fund-accent) 55%, transparent), transparent 70%), radial-gradient(70vmax 50vmax at 100% 100%, color-mix(in oklab, var(--fund-accent) 35%, transparent), transparent 70%)',
      } as React.CSSProperties}
      onMouseMove={showCursor}
    >
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-[2.5em] p-[3.5em]">
        {/* header */}
        <header className="flex items-center justify-between gap-[3em]">
          <div className="flex min-w-0 items-center gap-[1.6em]">
            {(campaign.logo_url || organization.logo_url) && (
              <img src={(campaign.logo_url || organization.logo_url)!} alt="" className="size-[6em] shrink-0 rounded-[1.2em] bg-white object-contain p-[0.4em]" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[1.9em] font-medium text-white/65">{organization.name}</p>
              <h1 className="truncate text-[3.6em] font-bold leading-tight tracking-tight">{settings.headline || campaign.title}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-[2.5em]">
            <span className="flex items-center gap-[0.6em] rounded-full bg-white/10 px-[1.1em] py-[0.45em] text-[1.6em] font-semibold ring-1 ring-white/15">
              <span className={`fund-live-dot size-[0.65em] rounded-full ${connection === 'live' ? 'bg-emerald-400' : connection === 'demo' ? 'bg-amber-400' : 'bg-slate-400'}`} />
              {connection === 'live' ? 'LIVE' : connection === 'demo' ? 'DEMO' : 'SYNCING'}
            </span>
            <div className="text-right">
              <p className="text-[1.5em] uppercase tracking-[0.25em] text-white/55">{phase === 'upcoming' ? 'Starts in' : phase === 'live' ? 'Time left' : 'Final total'}</p>
              {phase !== 'ended' ? (
                <p className="fund-tabular text-[3.6em] font-bold leading-none">
                  {left.days > 0 && <>{left.days}<span className="text-[0.55em] text-white/60">d </span></>}
                  {pad(left.hours)}:{pad(left.minutes)}:{pad(left.seconds)}
                </p>
              ) : (
                <p className="text-[3.2em] font-bold leading-none">Thank you!</p>
              )}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_42em] gap-[3em]">
          {/* main scoreboard */}
          <section className="flex min-h-0 flex-col justify-center">
            <p className="text-[2.2em] font-semibold uppercase tracking-[0.35em] text-white/60">Total raised</p>
            <RollingCounter cents={totals.total_cents} currency={currency} className="mt-[0.1em] text-[15.5em] font-black leading-none tracking-tight" />
            <p className="mt-[0.4em] text-[2.6em] text-white/75">
              of <span className="font-semibold text-white">{formatMoney(totals.goal_cents, currency)}</span> goal ·{' '}
              <span className="font-semibold text-white">{Math.floor(pct * 100)}%</span>
            </p>
            <div className="mt-[2.4em]">
              <ProgressRail totalCents={totals.total_cents} goalCents={totals.goal_cents} bonusGoalCents={totals.bonus_goal_cents} currency={currency} />
            </div>
            <dl className="mt-[2.6em] grid grid-cols-4 gap-[1.6em]">
              {[
                { label: 'Donors', value: <AnimatedCount value={totals.donation_count} /> },
                { label: 'Matched', value: <AnimatedMoney cents={totals.matched_cents} currency={currency} /> },
                { label: 'Current match', value: live ? multiplierLabel(live.ratio) : '—' },
                { label: 'Match funds left', value: <AnimatedMoney cents={totals.match_remaining_cents} currency={currency} /> },
              ].map((s) => (
                <div key={s.label} className="rounded-[1.6em] bg-white/[0.06] px-[1.6em] py-[1.3em] ring-1 ring-white/10">
                  <dt className="text-[1.5em] text-white/60">{s.label}</dt>
                  <dd className="mt-[0.15em] truncate text-[3.2em] font-bold leading-tight">{s.value}</dd>
                </div>
              ))}
            </dl>
            {live && phase === 'live' && (
              <p
                className={`mt-[2.2em] flex items-center gap-[0.6em] self-start rounded-full bg-[var(--fund-accent)] px-[1.2em] py-[0.5em] text-[2.2em] font-semibold shadow-lg transition-opacity duration-300 ${current?.kind === 'donation' && !current.big ? 'opacity-0' : 'opacity-100'}`}
              >
                <Zap className="size-[1em] text-yellow-300" />
                {ratioLabel(live.ratio)} right now · {live.name}
              </p>
            )}
          </section>

          {/* rotating panel + QR */}
          <aside className="flex min-h-0 flex-col gap-[2em]">
            <div className="min-h-0 flex-1">
              <SidePanel data={data} now={now} rotateSeconds={settings.rotate_seconds ?? 12} />
            </div>
            {settings.show_qr !== false && (
              <div className="flex shrink-0 items-center gap-[1.8em] rounded-[2em] bg-white p-[1.4em] text-slate-900">
                <QRCodeSVG value={`${donateUrl}?utm_source=bigscreen&utm_medium=qr`} size={256} level="M" marginSize={0} className="size-[13em] shrink-0" title="Scan to donate" />
                <div className="min-w-0">
                  <p className="text-[2.4em] font-bold leading-tight">Scan to donate</p>
                  <p className="mt-[0.3em] break-all text-[1.45em] text-slate-500">{shortUrl}</p>
                  {settings.ticker_message && <p className="mt-[0.5em] text-[1.45em] font-medium text-slate-700">{settings.ticker_message}</p>}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <Splash item={current} currency={currency} />

      <button
        onClick={toggleFullscreen}
        className={`absolute bottom-[1.5em] right-[1.5em] z-50 flex items-center gap-[0.5em] rounded-full bg-white/10 px-[1em] py-[0.5em] text-[1.3em] ring-1 ring-white/20 transition-opacity ${cursor ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <Maximize className="size-[1em]" /> Fullscreen (F) · Test popup (T)
      </button>
    </div>
  );
}
