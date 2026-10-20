import Link from 'next/link';
import { requirePlatformAdmin } from '@/lib/fund/auth';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { CampaignForm } from '@/components/fund/admin/campaign-form';

export const metadata = { title: 'New campaign' };

export default async function NewCampaign() {
  const { supabase } = await requirePlatformAdmin('/fund/admin/campaigns/new');
  const { data: orgs } = await supabase.from('fund_organizations').select('id, name, platform_fee_bps').order('name');
  return (
    <>
      <PageHeader
        title="New campaign"
        subtitle={orgs?.length ? 'Starts as a draft unless you set it live.' : <>Create a nonprofit first under <Link className="underline" href="/fund/admin/organizations">Nonprofits &amp; Stripe</Link>.</>}
      />
      <CampaignForm mode="admin" organizations={orgs ?? []} />
    </>
  );
}
