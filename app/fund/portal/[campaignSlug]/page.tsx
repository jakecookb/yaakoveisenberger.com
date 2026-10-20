import Link from 'next/link';
import { Banknote, Clock, Handshake, Percent, Target, Users } from 'lucide-react';
import { getCampaignAccess } from '@/lib/fund/auth';
import { formatMoney, formatNumber, formatPercent, multiplierLabel, timeAgo } from '@/lib/fund/format';
import type { CampaignDashboard, DonationRow } from '@/lib/fund/types';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { LiveRefresher } from '@/components/fund/dashboard/live-refresher';
import { CampaignStatusActions } from '@/components/fund/admin/campaign-actions';
import { HourlyChart } from '@/components/fund/portal/hourly-chart';
import { Card, CardHeader, StatusBadge } from '@/components/fund/ui/primitives';
import { Meter, StatTile } from '@/components/fund/ui/stat';
import { splitDuration } from '@/lib/fund/time';

export const metadata = { title: 'Campaign dashboard' };

export default async function PortalOverview({ params }: PageProps<'/fund/portal/[campaignSlug]'>) {
  const { campaignSlug } = await params;
  const { supabase, campaign, canManage, role } = await getCampaignAccess(campaignSlug);
  const [{ data: dash }, { data: recent }] = await Promise.all([
    supabase.rpc('fund_campaign_dashboard', { p_campaign_id: campaign.id }),
    supabase.from('fund_donations').select('*').eq('campaign_id', campaign.id).eq('status', 'succeeded').order('succeeded_at', { ascending: false }).limit(10),
  ]);
  const d = dash as CampaignDashboard | null;
  const totals = d?.totals;
  const now = Date.parse(totals?.server_time ?? campaign.ends_at);
  const ended = now >= Date.parse(campaign.ends_at);
  const upcoming = now < Date.parse(campaign.starts_at);
  const left = splitDuration(Date.parse(upcoming ? campaign.starts_at : campaign.ends_at) - now);
  const total = totals?.total_cents ?? 0;

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{campaign.title} <StatusBadge status={campaign.status} /></span>}
        subtitle={<>yaakoveisenberger.com/fund/{campaign.slug} · your role: {role}</>}
        actions={
          <>
            <LiveRefresher campaignId={campaign.id} pollSeconds={45} />
            {canManage && <CampaignStatusActions campaignId={campaign.id} status={campaign.status} approved={Boolean(campaign.approved_at)} mode={role === 'admin' ? 'admin' : 'manager'} />}
          </>
        }
      />
      {campaign.status === 'draft' && <p className="mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">This campaign is a draft. Set it up, then submit it for review — the platform team will publish it.</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile emphasis label="Live money raised" value={formatMoney(total, campaign.currency, { cents: false })} sub={`${Math.floor((total / campaign.goal_cents) * 100)}% of ${formatMoney(campaign.goal_cents)} · ${formatMoney(totals?.matched_cents ?? 0)} matched`} icon={<Target className="size-5" />} />
        <StatTile label={upcoming ? 'Starts in' : 'Time remaining'} value={ended ? 'Ended' : `${left.days}d ${left.hours}h ${left.minutes}m`} sub={`Ends ${new Date(campaign.ends_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`} icon={<Clock className="size-5" />} />
        <StatTile label="Remaining match balance" value={formatMoney(totals?.match_remaining_cents ?? 0, campaign.currency, { cents: false })} sub={totals?.current_ratio ? `Matching at ${multiplierLabel(totals.current_ratio)} right now` : 'No live match pool'} icon={<Handshake className="size-5" />} />
        <StatTile label="Conversion rate" value={formatPercent(d?.visit_conversion)} sub={`${formatNumber(d?.page_views ?? 0)} visits · checkout ${formatPercent(d?.checkout_conversion)} of ${formatNumber(d?.checkout_starts ?? 0)} started`} icon={<Percent className="size-5" />} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatTile label="Donors" value={formatNumber(d?.unique_donors ?? 0)} sub={`${formatNumber(totals?.donation_count ?? 0)} gifts`} icon={<Users className="size-5" />} />
        <StatTile label="Average gift" value={formatMoney(d?.average_gift_cents ?? 0, campaign.currency, { cents: false })} />
        <StatTile label="Offline gifts" value={formatMoney(Object.entries(d?.by_source ?? {}).filter(([k]) => k !== 'online').reduce((s, [, v]) => s + v.amount_cents, 0))} sub={canManage ? <Link className="hover:underline" href={`/fund/portal/${campaign.slug}/donations`}>Record cash / check / wire →</Link> : undefined} icon={<Banknote className="size-5" />} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Raised per hour" description="Gifts plus matching, last 48 hours" />
          <div className="p-5">
            <Meter value={total} max={campaign.goal_cents} label="Progress to goal" className="mb-5" />
            <HourlyChart points={d?.hourly ?? []} currency={campaign.currency} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Latest gifts" action={<Link href={`/fund/portal/${campaign.slug}/donations`} className="text-sm font-medium text-[var(--fund-accent-strong)] hover:underline">All</Link>} />
          <ul className="divide-y divide-slate-100">
            {((recent ?? []) as DonationRow[]).map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">{g.donor_name ?? 'Anonymous'}{g.is_anonymous ? ' (anon)' : ''}</span>
                  <span className="text-xs text-slate-500">{g.source} · {timeAgo(g.succeeded_at ?? g.created_at, now)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold">{formatMoney(g.amount_cents, g.currency)}</span>
                  {g.matched_cents > 0 && <span className="text-xs text-[var(--fund-accent-strong)]">+{formatMoney(g.matched_cents, g.currency)}</span>}
                </span>
              </li>
            ))}
            {!recent?.length && <li className="px-5 py-8 text-center text-sm text-slate-500">No gifts yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
