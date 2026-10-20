import 'server-only';
import { getStripe, accountStatus } from './stripe';
import { createFundServiceClient } from './supabase/server';
import { serverEnv } from './env';
import type { OrganizationRow } from './types';

export function safeNext(next: string | null | undefined, fallback = '/fund/admin/organizations') {
  return next && next.startsWith('/fund/') && !next.startsWith('//') ? next : fallback;
}

async function loadOrg(orgId: string) {
  const { data } = await createFundServiceClient().from('fund_organizations').select('*').eq('id', orgId).maybeSingle<OrganizationRow>();
  return data;
}

/** Creates the Express account on first use, then a fresh onboarding link. */
export async function createOnboardingLink(orgId: string, origin: string, next: string) {
  const org = await loadOrg(orgId);
  if (!org) throw new Error('Organization not found');
  const stripe = getStripe();
  let accountId = org.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create(
      {
        type: 'express',
        country: serverEnv().stripeCountry,
        email: org.contact_email ?? undefined,
        business_type: 'non_profit',
        business_profile: {
          name: org.name,
          mcc: '8398', // Charitable and social service organizations
          product_description: 'Charitable donations collected through yaakoveisenberger.com/fund',
          ...(org.website_url ? { url: org.website_url } : {}),
        },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { org_id: org.id, org_slug: org.slug },
      },
      { idempotencyKey: `fund-org-account-${org.id}` },
    );
    accountId = account.id;
    await createFundServiceClient().from('fund_organizations').update(accountStatus(account)).eq('id', org.id);
  }

  const qs = new URLSearchParams({ org: org.id, next });
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${origin}/api/fund/stripe/refresh?${qs}`,
    return_url: `${origin}/api/fund/stripe/return?${qs}`,
  });
  return link.url;
}

export async function syncAccount(orgId: string) {
  const org = await loadOrg(orgId);
  if (!org?.stripe_account_id) return null;
  const account = await getStripe().accounts.retrieve(org.stripe_account_id);
  const status = accountStatus(account);
  await createFundServiceClient().from('fund_organizations').update(status).eq('id', org.id);
  return status;
}

export async function createDashboardLink(orgId: string) {
  const org = await loadOrg(orgId);
  if (!org?.stripe_account_id) throw new Error('This organization has not started Stripe onboarding');
  const link = await getStripe().accounts.createLoginLink(org.stripe_account_id);
  return link.url;
}
