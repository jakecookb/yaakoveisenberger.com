'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getFundBrowserClient } from '@/lib/fund/supabase/browser';
import { isSupabaseConfigured } from '@/lib/fund/env';
import { previewMatch } from '@/lib/fund/matching';
import { simulateDemoDonation } from '@/lib/fund/demo';
import type { CampaignTotals, DonationBroadcast, PublicCampaign, PublicDonation, RefreshBroadcast } from '@/lib/fund/types';

export type LiveConnection = 'connecting' | 'live' | 'reconnecting' | 'polling' | 'demo';

type Action =
  | { type: 'donation'; payload: DonationBroadcast }
  | { type: 'snapshot'; payload: PublicCampaign }
  | { type: 'totals'; payload: CampaignTotals };

const FEED_LIMIT = 60;
const TOP_LIMIT = 12;

const newer = (a: CampaignTotals, b: CampaignTotals) => Date.parse(a.server_time) >= Date.parse(b.server_time);

function mergeFeed(a: PublicDonation[], b: PublicDonation[]) {
  const seen = new Map<string, PublicDonation>();
  for (const d of [...a, ...b]) if (!seen.has(d.id)) seen.set(d.id, d);
  return [...seen.values()].sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at)).slice(0, FEED_LIMIT);
}

function reducer(state: PublicCampaign, action: Action): PublicCampaign {
  switch (action.type) {
    case 'donation': {
      const { donation, totals, team, ambassador } = action.payload;
      if (state.recent.some((d) => d.id === donation.id)) return state;

      // Optimistically draw the match pools down (mirrors the SQL waterfall); the next
      // snapshot replaces these with exact database values.
      const { tiers } = previewMatch(donation.amount_cents, state.matchers, new Date(donation.created_at));
      const matchers = tiers.length
        ? state.matchers.map((m) => {
            const t = tiers.find((x) => x.matcherId === m.id);
            if (!t) return m;
            const matched = Math.min(m.pledge_cents, m.matched_cents + t.matchCents);
            return { ...m, matched_cents: matched, remaining_cents: m.pledge_cents - matched, is_live: matched < m.pledge_cents && m.is_live };
          })
        : state.matchers;

      const teams = team
        ? state.teams.map((t) => (t.id === team.id ? { ...t, raised_cents: team.raised_cents, donation_count: team.donation_count } : t)).sort((a, b) => b.raised_cents - a.raised_cents)
        : state.teams;
      const ambassadors = ambassador
        ? state.ambassadors.map((a) => (a.id === ambassador.id ? { ...a, raised_cents: ambassador.raised_cents, donation_count: ambassador.donation_count } : a)).sort((a, b) => b.raised_cents - a.raised_cents)
        : state.ambassadors;

      const top =
        state.top.length < TOP_LIMIT || donation.amount_cents > (state.top.at(-1)?.amount_cents ?? 0)
          ? [...state.top, donation].sort((a, b) => b.amount_cents - a.amount_cents).slice(0, TOP_LIMIT)
          : state.top;

      return {
        ...state,
        totals: newer(totals, state.totals) ? totals : state.totals,
        recent: [donation, ...state.recent].slice(0, FEED_LIMIT),
        top,
        matchers,
        teams,
        ambassadors,
      };
    }
    case 'snapshot': {
      const snap = action.payload;
      return {
        ...snap,
        totals: newer(snap.totals, state.totals) ? snap.totals : state.totals,
        recent: mergeFeed(snap.recent, state.recent),
        demo: state.demo,
      };
    }
    case 'totals':
      return newer(action.payload, state.totals) ? { ...state, totals: action.payload } : state;
  }
}

interface Options {
  onDonation?: (donation: PublicDonation, payload: DonationBroadcast) => void;
  /** Big screens resync more eagerly and never stop polling. */
  aggressive?: boolean;
}

/**
 * Live campaign state. Subscribes to the Supabase Realtime broadcast topic
 * `campaign_donations_<campaignId>`, applies donation deltas instantly, and
 * resyncs full snapshots (CDN-cached) on reconnect, on refresh events, when the
 * tab becomes visible and on a slow heartbeat — so multi-hour sessions self-heal.
 */
export function useCampaignLive(initial: PublicCampaign, { onDonation, aggressive }: Options = {}) {
  const [data, dispatch] = useReducer(reducer, initial);
  const [connection, setConnection] = useState<LiveConnection>(initial.demo ? 'demo' : isSupabaseConfigured ? 'connecting' : 'polling');
  const dataRef = useRef(data);
  const onDonationRef = useRef(onDonation);
  useEffect(() => {
    dataRef.current = data;
    onDonationRef.current = onDonation;
  });

  const resyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const slug = initial.campaign.slug;
  const campaignId = initial.campaign.id;

  const resync = useCallback(async () => {
    if (initial.demo || inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch(`/api/fund/campaigns/${slug}`, { cache: 'no-store' });
      if (res.ok) dispatch({ type: 'snapshot', payload: (await res.json()) as PublicCampaign });
    } catch {
      // network blip — the next heartbeat retries
    } finally {
      inflight.current = false;
    }
  }, [initial.demo, slug]);

  /** Debounced + jittered so thousands of screens don't resync in the same second. */
  const scheduleResync = useCallback(
    (minDelay: number, spread: number) => {
      if (resyncTimer.current) return;
      resyncTimer.current = setTimeout(() => {
        resyncTimer.current = null;
        void resync();
      }, minDelay + Math.random() * spread);
    },
    [resync],
  );

  const applyDonation = useCallback((payload: DonationBroadcast) => {
    if (dataRef.current.recent.some((d) => d.id === payload.donation.id)) return;
    dispatch({ type: 'donation', payload });
    onDonationRef.current?.(payload.donation, payload);
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (initial.demo) return;
    const supabase = getFundBrowserClient();
    if (!supabase) return; // no Realtime: the heartbeat below polls snapshots instead
    let everSubscribed = false;
    const channel = supabase
      .channel(`campaign_donations_${campaignId}`, { config: { broadcast: { self: false, ack: false } } })
      .on('broadcast', { event: 'donation' }, ({ payload }) => {
        applyDonation(payload as DonationBroadcast);
        scheduleResync(aggressive ? 8000 : 15000, 10000); // refresh exact pools/top lists, throttled
      })
      .on('broadcast', { event: 'refresh' }, ({ payload }) => {
        const p = payload as RefreshBroadcast;
        if (p?.totals) dispatch({ type: 'totals', payload: p.totals });
        scheduleResync(800, 3000);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('live');
          if (everSubscribed) scheduleResync(0, 2000); // catch up on anything missed while disconnected
          everSubscribed = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('reconnecting');
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [initial.demo, campaignId, applyDonation, scheduleResync, aggressive]);

  // Heartbeat resync: fast while disconnected, slow while live.
  useEffect(() => {
    if (initial.demo) return;
    const ms = connection === 'live' ? (aggressive ? 60_000 : 120_000) : 10_000;
    const id = setInterval(() => void resync(), ms);
    return () => clearInterval(id);
  }, [connection, initial.demo, resync, aggressive]);

  // Resync when a backgrounded tab comes back.
  useEffect(() => {
    if (initial.demo) return;
    const onVisible = () => document.visibilityState === 'visible' && scheduleResync(0, 1500);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [initial.demo, scheduleResync]);

  // Demo mode: simulated donations so the experience can be previewed without a backend.
  useEffect(() => {
    if (!initial.demo) return;
    let seq = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      applyDonation(simulateDemoDonation(dataRef.current, seq++));
      timer = setTimeout(tick, 3500 + Math.random() * 5000);
    };
    timer = setTimeout(tick, 2500);
    return () => clearTimeout(timer);
  }, [initial.demo, applyDonation]);

  useEffect(() => () => {
    if (resyncTimer.current) clearTimeout(resyncTimer.current);
  }, []);

  return { data, connection, applyDonation, resync };
}

/**
 * Ticking clock corrected for client/server skew (so every screen shows the same
 * countdown). The first render uses the server timestamp, so SSR and hydration match.
 */
export function useServerNow(serverTimeIso: string, intervalMs = 1000) {
  const serverMs = Date.parse(serverTimeIso);
  const [now, setNow] = useState(serverMs);
  useEffect(() => {
    const skew = serverMs - Date.now();
    const offset = Math.abs(skew) > 2000 ? skew : 0; // ignore SSR->hydration latency
    const tick = () => setNow(Date.now() + offset);
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [serverMs, intervalMs]);
  return now;
}
