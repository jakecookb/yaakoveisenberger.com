import { getCampaignAccess } from '@/lib/fund/auth';
import type { AmbassadorRow, OutreachRow } from '@/lib/fund/types';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { OutreachLog } from '@/components/fund/portal/outreach-log';

export const metadata = { title: 'Donor outreach' };

export default async function PortalOutreach({ params }: PageProps<'/fund/portal/[campaignSlug]/outreach'>) {
  const { campaignSlug } = await params;
  const { supabase, campaign, canManage } = await getCampaignAccess(campaignSlug);
  const [{ data: logs }, { data: ambassadors }, { data: totals }] = await Promise.all([
    supabase.from('fund_outreach_logs').select('*').eq('campaign_id', campaign.id).order('created_at', { ascending: false }).limit(500),
    supabase.from('fund_ambassadors').select('*').eq('campaign_id', campaign.id).order('name'),
    supabase.rpc('fund_campaign_totals', { p_campaign_id: campaign.id }),
  ]);
  const now = Date.parse((totals as { server_time?: string } | null)?.server_time ?? campaign.ends_at);
  return (
    <>
      <PageHeader title="Donor outreach" subtitle="Log calls, texts and visits; schedule follow-ups." />
      <OutreachLog campaignId={campaign.id} logs={(logs ?? []) as OutreachRow[]} ambassadors={(ambassadors ?? []) as AmbassadorRow[]} canManage={canManage} now={now} />
    </>
  );
}
