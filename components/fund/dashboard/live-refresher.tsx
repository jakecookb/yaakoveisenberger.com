'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getFundBrowserClient } from '@/lib/fund/supabase/browser';

/**
 * Re-renders the current server page when rows change. Uses Supabase Realtime
 * postgres_changes (RLS-filtered: you only receive rows you're allowed to read),
 * or the public broadcast topic for a campaign, plus a slow polling fallback.
 */
export function LiveRefresher({ tables = [], campaignId, pollSeconds = 30 }: { tables?: string[]; campaignId?: string; pollSeconds?: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<'live' | 'connecting' | 'polling'>('connecting');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableKey = tables.join(',');

  useEffect(() => {
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 900);
    };
    const supabase = getFundBrowserClient();
    const poll = setInterval(() => document.visibilityState === 'visible' && router.refresh(), pollSeconds * 1000);
    if (!supabase) {
      const t = setTimeout(() => setStatus('polling'), 0);
      return () => {
        clearTimeout(t);
        clearInterval(poll);
      };
    }
    const channel = supabase.channel(campaignId ? `campaign_donations_${campaignId}` : `fund-admin-${tableKey}`);
    if (campaignId) {
      channel.on('broadcast', { event: 'donation' }, refresh).on('broadcast', { event: 'refresh' }, refresh);
    }
    for (const table of tableKey ? tableKey.split(',') : []) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    }
    channel.subscribe((s) => setStatus(s === 'SUBSCRIBED' ? 'live' : s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' ? 'polling' : 'connecting'));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [router, campaignId, tableKey, pollSeconds]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
      <span className={`fund-live-dot size-2 rounded-full ${status === 'live' ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden />
      {status === 'live' ? 'Live' : status === 'polling' ? `Auto-refresh ${pollSeconds}s` : 'Connecting…'}
    </span>
  );
}
