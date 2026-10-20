import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createFundServerClient, createFundServiceClient } from './supabase/server';
import { isServiceRoleConfigured, isSupabaseConfigured, serverEnv } from './env';
import type { CampaignRow } from './types';

export interface FundSession {
  supabase: SupabaseClient;
  user: User;
  isPlatformAdmin: boolean;
}

/** Promotes emails listed in FUND_PLATFORM_ADMIN_EMAILS — no SQL needed to create the first admin. */
async function bootstrapAdmin(user: User) {
  const emails = serverEnv().platformAdminEmails;
  if (!user.email || !emails.includes(user.email.toLowerCase()) || !isServiceRoleConfigured()) return false;
  const { error } = await createFundServiceClient()
    .from('fund_platform_admins')
    .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
  return !error;
}

export const getFundSession = cache(async (): Promise<FundSession | null> => {
  if (!isSupabaseConfigured) return null; // /fund/login renders the setup screen
  const supabase = await createFundServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let { data: isPlatformAdmin } = await supabase.rpc('fund_is_platform_admin');
  if (!isPlatformAdmin && (await bootstrapAdmin(user))) isPlatformAdmin = true;
  return { supabase, user, isPlatformAdmin: Boolean(isPlatformAdmin) };
});

export async function requireFundSession(next: string): Promise<FundSession> {
  const session = await getFundSession();
  if (!session) redirect(`/fund/login?next=${encodeURIComponent(next)}`);
  return session;
}

export async function requirePlatformAdmin(next = '/fund/admin'): Promise<FundSession> {
  const session = await requireFundSession(next);
  if (!session.isPlatformAdmin) redirect('/fund/portal?error=admin_only');
  return session;
}

export interface CampaignAccess extends FundSession {
  campaign: CampaignRow;
  role: 'admin' | 'owner' | 'manager' | 'viewer';
  canManage: boolean;
}

export const getCampaignAccess = cache(async (slug: string): Promise<CampaignAccess> => {
  const session = await requireFundSession(`/fund/portal/${slug}`);
  const { supabase, user, isPlatformAdmin } = session;
  await supabase.rpc('fund_claim_invites');

  const { data: campaign } = await supabase.from('fund_campaigns').select('*').eq('slug', slug).maybeSingle<CampaignRow>();
  if (!campaign) notFound();

  let role: CampaignAccess['role'] = 'admin';
  if (!isPlatformAdmin) {
    const { data: member } = await supabase
      .from('fund_org_members')
      .select('role')
      .eq('org_id', campaign.org_id)
      .eq('user_id', user.id)
      .maybeSingle<{ role: 'owner' | 'manager' | 'viewer' }>();
    if (!member) notFound();
    role = member.role;
  }
  return { ...session, campaign, role, canManage: role !== 'viewer' };
});

/** For server actions: same checks, but returns an error instead of redirecting. */
type Authorized = { error: string } | { session: FundSession };

export async function authorizeCampaignAction(campaignId: string, write = true): Promise<Authorized> {
  const session = await getFundSession();
  if (!session) return { error: 'Please sign in again.' };
  const { data: allowed } = await session.supabase.rpc(write ? 'fund_can_manage_campaign' : 'fund_can_view_campaign', {
    p_campaign_id: campaignId,
  });
  if (!allowed) return { error: 'You do not have access to this campaign.' };
  return { session };
}

/** Platform admins, or owners/managers of the organization (Stripe onboarding). */
export async function authorizeOrgAction(orgId: string): Promise<Authorized> {
  const session = await getFundSession();
  if (!session) return { error: 'Please sign in again.' };
  if (session.isPlatformAdmin) return { session };
  const { data } = await session.supabase
    .from('fund_org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', session.user.id)
    .in('role', ['owner', 'manager'])
    .maybeSingle();
  if (!data) return { error: 'You do not have access to this organization.' };
  return { session };
}

export async function authorizeAdminAction(): Promise<Authorized> {
  const session = await getFundSession();
  if (!session?.isPlatformAdmin) return { error: 'Platform admin access required.' };
  return { session };
}
