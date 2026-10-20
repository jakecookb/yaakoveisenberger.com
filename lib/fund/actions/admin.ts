'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { authorizeAdminAction } from '../auth';
import { createFundServiceClient } from '../supabase/server';
import { isServiceRoleConfigured, SITE_URL } from '../env';
import type { z } from 'zod';
import {
  CampaignSchema,
  DonationOverrideSchema,
  MemberSchema,
  OrganizationSchema,
  RESERVED_SLUGS,
  firstIssue,
} from '../validation';
import { dbError, fail, ok } from './shared';
import type { ActionResult, CampaignStatus } from '../types';

export async function saveOrganization(input: z.input<typeof OrganizationSchema>): Promise<ActionResult> {
  const auth = await authorizeAdminAction();
  if ('error' in auth) return fail(auth.error);
  const parsed = OrganizationSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, ...row } = parsed.data;
  const db = auth.session.supabase;
  const { error } = id
    ? await db.from('fund_organizations').update(row).eq('id', id)
    : await db.from('fund_organizations').insert(row);
  if (error) return dbError(error);
  refresh();
  return ok(id ? 'Organization updated' : 'Organization created');
}

/** Adds a staff member; sends a Supabase invite email when they don't have an account yet. */
export async function addOrgMember(input: z.input<typeof MemberSchema>): Promise<ActionResult> {
  const auth = await authorizeAdminAction();
  if ('error' in auth) return fail(auth.error);
  const parsed = MemberSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { orgId, email, role } = parsed.data;

  const { error } = await auth.session.supabase
    .from('fund_org_members')
    .upsert({ org_id: orgId, email, role }, { onConflict: 'org_id,email' });
  if (error) return dbError(error);

  let message = `${email} added as ${role}.`;
  if (isServiceRoleConfigured()) {
    const h = await headers();
    const origin = h.get('origin') ?? SITE_URL;
    const { error: inviteError } = await createFundServiceClient().auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/fund/auth/callback?next=/fund/portal`,
    });
    // "already registered" is expected for existing users: their membership links on next sign-in.
    message += inviteError ? ' They can sign in at /fund/login.' : ' An invitation email was sent.';
  }
  refresh();
  return ok(message);
}

export async function removeOrgMember(memberId: string): Promise<ActionResult> {
  const auth = await authorizeAdminAction();
  if ('error' in auth) return fail(auth.error);
  const { error } = await auth.session.supabase.from('fund_org_members').delete().eq('id', memberId);
  if (error) return dbError(error);
  refresh();
  return ok('Member removed');
}

export async function saveCampaign(input: z.input<typeof CampaignSchema>): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await authorizeAdminAction();
  if ('error' in auth) return fail(auth.error);
  const parsed = CampaignSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, ...row } = parsed.data;
  const db = auth.session.supabase;
  const payload = { ...row, starts_at: new Date(row.starts_at).toISOString(), ends_at: new Date(row.ends_at).toISOString() };
  const { data, error } = id
    ? await db.from('fund_campaigns').update(payload).eq('id', id).select('id, slug').single()
    : await db.from('fund_campaigns').insert(payload).select('id, slug').single();
  if (error) return dbError(error);
  refresh();
  return { ok: true, data: data as { id: string; slug: string }, message: id ? 'Campaign saved' : 'Campaign created' };
}

export async function setCampaignStatus(campaignId: string, status: CampaignStatus): Promise<ActionResult> {
  const auth = await authorizeAdminAction();
  if ('error' in auth) return fail(auth.error);
  const { error } = await auth.session.supabase.from('fund_campaigns').update({ status }).eq('id', campaignId);
  if (error) return dbError(error);
  refresh();
  return ok(`Campaign ${status === 'active' ? 'approved & live' : status.replace('_', ' ')}`);
}

export async function checkSlugAvailability(slug: string, excludeId?: string): Promise<{ available: boolean; reason?: string }> {
  const auth = await authorizeAdminAction();
  if ('error' in auth) return { available: false, reason: auth.error };
  const s = slug.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/.test(s)) return { available: false, reason: 'Invalid format' };
  if (RESERVED_SLUGS.has(s)) return { available: false, reason: 'Reserved' };
  let q = auth.session.supabase.from('fund_campaigns').select('id').eq('slug', s);
  if (excludeId) q = q.neq('id', excludeId);
  const { data } = await q.maybeSingle();
  return data ? { available: false, reason: 'Already in use' } : { available: true };
}

export async function deleteCampaign(campaignId: string): Promise<ActionResult> {
  const auth = await authorizeAdminAction();
  if ('error' in auth) return fail(auth.error);
  const { error } = await auth.session.supabase.from('fund_campaigns').delete().eq('id', campaignId);
  if (error) return error.code === '23503' ? fail('Campaigns with donations cannot be deleted — archive it instead.') : dbError(error);
  refresh();
  return ok('Campaign deleted');
}

/** Manual override of any donation (status, amount, flag). The DB re-settles totals and audits the change. */
export async function overrideDonation(input: z.input<typeof DonationOverrideSchema>): Promise<ActionResult> {
  const auth = await authorizeAdminAction();
  if ('error' in auth) return fail(auth.error);
  const parsed = DonationOverrideSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, ...rest } = parsed.data;
  const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  if (!Object.keys(patch).length) return fail('Nothing to change');
  const { error } = await auth.session.supabase.from('fund_donations').update(patch).eq('id', id);
  if (error) return dbError(error);
  refresh();
  return ok('Donation updated');
}

export async function blockIp(ip: string, reason: string, hours: number | null): Promise<ActionResult> {
  const auth = await authorizeAdminAction();
  if ('error' in auth) return fail(auth.error);
  if (!/^[0-9a-fA-F:.]{3,45}(\/\d{1,3})?$/.test(ip.trim())) return fail('Invalid IP address');
  const { error } = await auth.session.supabase.from('fund_flagged_ips').upsert(
    {
      ip: ip.trim(),
      reason: reason.trim() || 'Blocked by admin',
      is_blocked: true,
      expires_at: hours ? new Date(Date.now() + hours * 3_600_000).toISOString() : null,
    },
    { onConflict: 'ip' },
  );
  if (error) return dbError(error);
  refresh();
  return ok(`${ip} blocked`);
}

export async function unblockIp(ip: string): Promise<ActionResult> {
  const auth = await authorizeAdminAction();
  if ('error' in auth) return fail(auth.error);
  const { error } = await auth.session.supabase.from('fund_flagged_ips').delete().eq('ip', ip);
  if (error) return dbError(error);
  refresh();
  return ok(`${ip} unblocked`);
}

export async function recalculateCampaign(campaignId: string): Promise<ActionResult> {
  const auth = await authorizeAdminAction();
  if ('error' in auth) return fail(auth.error);
  const { error } = await auth.session.supabase.rpc('fund_recalculate_campaign', { p_campaign_id: campaignId });
  if (error) return dbError(error);
  refresh();
  return ok('Totals recalculated from the donation ledger');
}
