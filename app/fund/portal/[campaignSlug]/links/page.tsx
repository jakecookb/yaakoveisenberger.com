import { getCampaignAccess } from '@/lib/fund/auth';
import type { AmbassadorRow, LinkRow, TeamRow } from '@/lib/fund/types';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { LinkGenerator } from '@/components/fund/portal/link-generator';

export const metadata = { title: 'Links' };

export default async function PortalLinks({ params }: PageProps<'/fund/portal/[campaignSlug]/links'>) {
  const { campaignSlug } = await params;
  const { supabase, campaign, canManage } = await getCampaignAccess(campaignSlug);
  const [{ data: links }, { data: teams }, { data: ambassadors }] = await Promise.all([
    supabase.from('fund_links').select('*').eq('campaign_id', campaign.id).order('created_at', { ascending: false }),
    supabase.from('fund_teams').select('*').eq('campaign_id', campaign.id).order('name'),
    supabase.from('fund_ambassadors').select('*').eq('campaign_id', campaign.id).order('name'),
  ]);
  return (
    <>
      <PageHeader title="Links & QR codes" subtitle="Share pre-filled donation links per team, ambassador, amount or channel." />
      <LinkGenerator campaignId={campaign.id} slug={campaign.slug} links={(links ?? []) as LinkRow[]} teams={(teams ?? []) as TeamRow[]} ambassadors={(ambassadors ?? []) as AmbassadorRow[]} canManage={canManage} />
    </>
  );
}
