import { getCampaignAccess } from '@/lib/fund/auth';
import type { OrganizationRow } from '@/lib/fund/types';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { CampaignForm } from '@/components/fund/admin/campaign-form';
import { StripeConnectButtons, StripeStatusBadge } from '@/components/fund/admin/org-manager';
import { Card, CardHeader } from '@/components/fund/ui/primitives';

export const metadata = { title: 'Settings' };

export default async function PortalSettings({ params, searchParams }: PageProps<'/fund/portal/[campaignSlug]/settings'>) {
  const { campaignSlug } = await params;
  const sp = await searchParams;
  const { supabase, campaign, canManage, role } = await getCampaignAccess(campaignSlug);
  const { data: org } = await supabase.from('fund_organizations').select('*').eq('id', campaign.org_id).maybeSingle<OrganizationRow>();
  const next = `/fund/portal/${campaign.slug}/settings`;
  return (
    <>
      <PageHeader title="Campaign settings" subtitle="Story, goal, schedule, giving options and big-screen display." />
      {sp.stripe && <p className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">{sp.stripe === 'connected' ? 'Stripe connected — online giving is on.' : sp.stripe === 'error' ? 'Stripe returned an error. Try again.' : 'Stripe onboarding saved. Stripe may still be reviewing your account.'}</p>}
      {org && (
        <Card className="mb-6">
          <CardHeader title="Payouts (Stripe Connect)" description={`Donations settle directly to ${org.name}'s Stripe account; the platform fee (${(campaign.platform_fee_bps ?? org.platform_fee_bps) / 100}%) is deducted automatically.`} action={<StripeStatusBadge org={org} />} />
          <div className="p-5">{canManage && (role === 'owner' || role === 'manager' || role === 'admin') ? <StripeConnectButtons org={org} next={next} /> : <p className="text-sm text-slate-500">Ask an owner or manager to manage payouts.</p>}</div>
        </Card>
      )}
      {canManage ? <CampaignForm mode={role === 'admin' ? 'admin' : 'manager'} campaign={campaign} organizations={org ? [{ id: org.id, name: org.name, platform_fee_bps: org.platform_fee_bps }] : []} /> : <p className="text-sm text-slate-500">You have view-only access.</p>}
    </>
  );
}
