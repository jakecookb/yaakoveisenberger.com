import { getCampaignAccess } from '@/lib/fund/auth';
import type { AmbassadorRow, TeamRow } from '@/lib/fund/types';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { TeamManager } from '@/components/fund/portal/team-manager';

export const metadata = { title: 'Teams & ambassadors' };

export default async function PortalTeams({ params }: PageProps<'/fund/portal/[campaignSlug]/teams'>) {
  const { campaignSlug } = await params;
  const { supabase, campaign, canManage } = await getCampaignAccess(campaignSlug);
  const [{ data: teams }, { data: ambassadors }] = await Promise.all([
    supabase.from('fund_teams').select('*').eq('campaign_id', campaign.id).order('raised_cents', { ascending: false }),
    supabase.from('fund_ambassadors').select('*').eq('campaign_id', campaign.id).order('raised_cents', { ascending: false }),
  ]);
  return (
    <>
      <PageHeader title="Teams & ambassadors" subtitle="Leaderboards update live on the campaign page and big screen." />
      <TeamManager campaignId={campaign.id} slug={campaign.slug} teams={(teams ?? []) as TeamRow[]} ambassadors={(ambassadors ?? []) as AmbassadorRow[]} canManage={canManage} />
    </>
  );
}
