import { requirePlatformAdmin } from '@/lib/fund/auth';
import { isServiceRoleConfigured, isStripeServerConfigured } from '@/lib/fund/env';
import type { OrganizationRow } from '@/lib/fund/types';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { OrganizationManager, type OrgWithMembers } from '@/components/fund/admin/org-manager';

export const metadata = { title: 'Nonprofits & Stripe' };

export default async function Organizations({ searchParams }: PageProps<'/fund/admin/organizations'>) {
  const { supabase } = await requirePlatformAdmin('/fund/admin/organizations');
  const sp = await searchParams;
  const [{ data: orgs }, { data: members }, { data: campaigns }] = await Promise.all([
    supabase.from('fund_organizations').select('*').order('created_at', { ascending: false }),
    supabase.from('fund_org_members').select('id, org_id, email, role, user_id').order('created_at'),
    supabase.from('fund_campaigns').select('org_id'),
  ]);
  const list: OrgWithMembers[] = ((orgs ?? []) as OrganizationRow[]).map((o) => ({
    ...o,
    members: (members ?? []).filter((m) => m.org_id === o.id),
    campaign_count: (campaigns ?? []).filter((c) => c.org_id === o.id).length,
  }));
  const flash = sp.stripe === 'connected' ? 'Stripe account connected — online giving is enabled.' : sp.stripe === 'updated' ? 'Stripe onboarding saved. Stripe may still be reviewing the account.' : sp.stripe === 'error' ? 'Stripe returned an error. Try again.' : null;
  return (
    <>
      <PageHeader title="Nonprofits & Stripe Connect" subtitle="Each nonprofit gets a Stripe Express account. Donations settle to it directly; the platform fee is split out automatically." />
      {flash && <p className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">{flash}</p>}
      <OrganizationManager orgs={list} stripeReady={isStripeServerConfigured() && isServiceRoleConfigured()} />
    </>
  );
}
