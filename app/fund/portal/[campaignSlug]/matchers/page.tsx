import { getCampaignAccess } from '@/lib/fund/auth';
import { formatMoney, multiplierLabel } from '@/lib/fund/format';
import type { MatcherRow } from '@/lib/fund/types';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { MatcherManager } from '@/components/fund/portal/matcher-manager';
import { StatTile } from '@/components/fund/ui/stat';

export const metadata = { title: 'Matchers' };

export default async function PortalMatchers({ params }: PageProps<'/fund/portal/[campaignSlug]/matchers'>) {
  const { campaignSlug } = await params;
  const { supabase, campaign, canManage } = await getCampaignAccess(campaignSlug);
  const [{ data }, { data: totals }] = await Promise.all([
    supabase.from('fund_matchers').select('*').eq('campaign_id', campaign.id).order('priority').order('created_at'),
    supabase.rpc('fund_campaign_totals', { p_campaign_id: campaign.id }),
  ]);
  const matchers = (data ?? []) as MatcherRow[];
  const t = totals as { match_remaining_cents: number; current_ratio: number | null; server_time: string } | null;
  const collected = matchers.filter((m) => m.pledge_status === 'collected').reduce((s, m) => s + m.pledge_cents, 0);
  const pledged = matchers.reduce((s, m) => s + m.pledge_cents, 0);
  return (
    <>
      <PageHeader title="Matching" subtitle="Enter offline pledges and set multiplier ratios. Pools draw down automatically in tier order as gifts arrive." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile emphasis label="Matching right now" value={t?.current_ratio ? multiplierLabel(t.current_ratio) : 'Off'} sub={t?.current_ratio ? `$1 becomes $${1 + Number(t.current_ratio)}` : 'Add or resume a matcher'} />
        <StatTile label="Remaining match balance" value={formatMoney(t?.match_remaining_cents ?? 0, campaign.currency, { cents: false })} />
        <StatTile label="Pledges collected" value={formatMoney(collected)} sub={`of ${formatMoney(pledged)} pledged`} />
      </div>
      <MatcherManager campaignId={campaign.id} matchers={matchers} canManage={canManage} now={Date.parse(t?.server_time ?? new Date(0).toISOString())} />
    </>
  );
}
