import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/fund/auth';
import { formatMoney } from '@/lib/fund/format';
import type { CampaignRow } from '@/lib/fund/types';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { CampaignForm } from '@/components/fund/admin/campaign-form';
import { CampaignStatusActions } from '@/components/fund/admin/campaign-actions';
import { CampaignDangerZone } from '@/components/fund/admin/danger-zone';
import { StatusBadge } from '@/components/fund/ui/primitives';

export const metadata = { title: 'Edit campaign' };

export default async function EditCampaign({ params }: PageProps<'/fund/admin/campaigns/[id]'>) {
  const { id } = await params;
  const { supabase } = await requirePlatformAdmin(`/fund/admin/campaigns/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: campaign }, { data: orgs }] = await Promise.all([
    supabase.from('fund_campaigns').select('*').eq('id', id).maybeSingle<CampaignRow>(),
    supabase.from('fund_organizations').select('id, name, platform_fee_bps').order('name'),
  ]);
  if (!campaign) notFound();
  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3">{campaign.title} <StatusBadge status={campaign.status} /></span>}
        subtitle={
          <>
            {formatMoney(campaign.raised_cents + campaign.matched_cents)} raised of {formatMoney(campaign.goal_cents)} · {campaign.donation_count} gifts ·{' '}
            <Link className="font-medium text-[var(--fund-accent-strong)] hover:underline" href={`/fund/portal/${campaign.slug}`}>Open campaign portal →</Link>
          </>
        }
        actions={<CampaignStatusActions campaignId={campaign.id} status={campaign.status} size="md" />}
      />
      <CampaignForm mode="admin" campaign={campaign} organizations={orgs ?? []} />
      <div className="mt-6">
        <CampaignDangerZone campaignId={campaign.id} hasDonations={campaign.donation_count > 0} />
      </div>
    </>
  );
}
