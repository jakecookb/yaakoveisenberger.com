'use server';

import { refresh } from 'next/cache';
import type { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeCampaignAction } from '../auth';
import {
  AmbassadorSchema,
  CampaignSchema,
  LinkSchema,
  MatcherSchema,
  OfflineDonationSchema,
  OutreachSchema,
  TeamSchema,
  firstIssue,
} from '../validation';
import { dbError, fail, ok, randomCode } from './shared';
import type { ActionResult, CampaignStatus } from '../types';

// Every action re-checks access with fund_can_manage_campaign and then writes through the
// user's own Supabase session, so Row Level Security + guard triggers are the final authority.

async function guard(campaignId: string): Promise<{ error: ActionResult<never> } | { db: SupabaseClient }> {
  const auth = await authorizeCampaignAction(campaignId, true);
  if ('error' in auth) return { error: fail(auth.error) };
  return { db: auth.session.supabase };
}

// ---------------------------------------------------------------- matchers

export async function saveMatcher(input: z.input<typeof MatcherSchema>): Promise<ActionResult> {
  const parsed = MatcherSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, campaignId, ...row } = parsed.data;
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  if (row.starts_at && row.ends_at && Date.parse(row.ends_at) <= Date.parse(row.starts_at)) {
    return fail('Match window must end after it starts');
  }
  const { error } = id
    ? await g.db.from('fund_matchers').update(row).eq('id', id).eq('campaign_id', campaignId)
    : await g.db.from('fund_matchers').insert({ ...row, campaign_id: campaignId });
  if (error) return dbError(error);
  refresh();
  return ok(id ? 'Matcher updated' : 'Matcher added — the public page updates instantly');
}

export async function setMatcherStatus(campaignId: string, id: string, status: 'active' | 'paused'): Promise<ActionResult> {
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  const { error } = await g.db.from('fund_matchers').update({ status }).eq('id', id).eq('campaign_id', campaignId);
  if (error) return dbError(error);
  refresh();
  return ok(status === 'active' ? 'Matcher resumed' : 'Matcher paused');
}

export async function deleteMatcher(campaignId: string, id: string): Promise<ActionResult> {
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  const { error } = await g.db.from('fund_matchers').delete().eq('id', id).eq('campaign_id', campaignId);
  if (error) return dbError(error);
  refresh();
  return ok('Matcher removed');
}

// ---------------------------------------------------------------- teams & ambassadors

export async function saveTeam(input: z.input<typeof TeamSchema>): Promise<ActionResult> {
  const parsed = TeamSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, campaignId, ...row } = parsed.data;
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  const { error } = id
    ? await g.db.from('fund_teams').update(row).eq('id', id).eq('campaign_id', campaignId)
    : await g.db.from('fund_teams').insert({ ...row, campaign_id: campaignId });
  if (error) return dbError(error);
  refresh();
  return ok(id ? 'Team updated' : 'Team created');
}

export async function deleteTeam(campaignId: string, id: string): Promise<ActionResult> {
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  const { error } = await g.db.from('fund_teams').delete().eq('id', id).eq('campaign_id', campaignId);
  if (error) return dbError(error);
  refresh();
  return ok('Team deleted (its donations stay on the campaign)');
}

export async function saveAmbassador(input: z.input<typeof AmbassadorSchema>): Promise<ActionResult> {
  const parsed = AmbassadorSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, campaignId, ...row } = parsed.data;
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  const { error } = id
    ? await g.db.from('fund_ambassadors').update(row).eq('id', id).eq('campaign_id', campaignId)
    : await g.db.from('fund_ambassadors').insert({ ...row, campaign_id: campaignId });
  if (error) return dbError(error);
  refresh();
  return ok(id ? 'Ambassador updated' : 'Ambassador added');
}

export async function deleteAmbassador(campaignId: string, id: string): Promise<ActionResult> {
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  const { error } = await g.db.from('fund_ambassadors').delete().eq('id', id).eq('campaign_id', campaignId);
  if (error) return dbError(error);
  refresh();
  return ok('Ambassador removed');
}

// ---------------------------------------------------------------- links

export async function createLink(input: z.input<typeof LinkSchema>): Promise<ActionResult<{ code: string }>> {
  const parsed = LinkSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { campaignId, code, ...row } = parsed.data;
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  for (let attempt = 0; attempt < 4; attempt++) {
    const candidate = code || randomCode(7);
    const { error } = await g.db.from('fund_links').insert({ ...row, campaign_id: campaignId, code: candidate });
    if (!error) {
      refresh();
      return { ok: true, data: { code: candidate }, message: 'Link created' };
    }
    if (error.code !== '23505' || code) return dbError(error);
  }
  return fail('Could not generate a unique code, try again');
}

export async function deleteLink(campaignId: string, id: string): Promise<ActionResult> {
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  const { error } = await g.db.from('fund_links').delete().eq('id', id).eq('campaign_id', campaignId);
  if (error) return dbError(error);
  refresh();
  return ok('Link deleted');
}

// ---------------------------------------------------------------- outreach

export async function saveOutreach(input: z.input<typeof OutreachSchema>): Promise<ActionResult> {
  const parsed = OutreachSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, campaignId, ...row } = parsed.data;
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  const { error } = id
    ? await g.db.from('fund_outreach_logs').update(row).eq('id', id).eq('campaign_id', campaignId)
    : await g.db.from('fund_outreach_logs').insert({ ...row, campaign_id: campaignId });
  if (error) return dbError(error);
  refresh();
  return ok('Outreach logged');
}

export async function deleteOutreach(campaignId: string, id: string): Promise<ActionResult> {
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  const { error } = await g.db.from('fund_outreach_logs').delete().eq('id', id).eq('campaign_id', campaignId);
  if (error) return dbError(error);
  refresh();
  return ok('Entry deleted');
}

// ---------------------------------------------------------------- offline donations

/**
 * Cash / check / wire / DAF entry. The insert trigger settles it immediately: match
 * waterfall applied, totals + leaderboards updated, and a Realtime broadcast pushes
 * it to every open campaign page and big screen.
 */
export async function recordOfflineDonation(input: z.input<typeof OfflineDonationSchema>): Promise<ActionResult> {
  const parsed = OfflineDonationSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { campaignId, ...row } = parsed.data;
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  const { data, error } = await g.db
    .from('fund_donations')
    .insert({ ...row, campaign_id: campaignId, status: 'succeeded' })
    .select('matched_cents')
    .single<{ matched_cents: number }>();
  if (error) return dbError(error);
  refresh();
  const matched = data?.matched_cents ? ` + $${(data.matched_cents / 100).toLocaleString()} matched` : '';
  return ok(`Recorded $${(row.amount_cents / 100).toLocaleString()}${matched}. Live displays updated.`);
}

export async function voidOfflineDonation(campaignId: string, id: string): Promise<ActionResult> {
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  const { error } = await g.db
    .from('fund_donations')
    .update({ status: 'canceled' })
    .eq('id', id)
    .eq('campaign_id', campaignId)
    .neq('source', 'online');
  if (error) return dbError(error);
  refresh();
  return ok('Donation voided — totals and match pools restored');
}

// ---------------------------------------------------------------- campaign settings

/** Content & giving settings. Slug, organization, fee and status are admin-controlled (also enforced by the DB guard trigger). */
export async function updateCampaignSettings(input: z.input<typeof CampaignSchema>): Promise<ActionResult> {
  const parsed = CampaignSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, ...rest } = parsed.data;
  const row = Object.fromEntries(
    Object.entries(rest).filter(([k]) => !['slug', 'org_id', 'platform_fee_bps', 'status'].includes(k)),
  ) as Omit<typeof rest, 'slug' | 'org_id' | 'platform_fee_bps' | 'status'>;
  if (!id) return fail('Missing campaign');
  const g = await guard(id);
  if ('error' in g) return g.error;
  const { error } = await g.db
    .from('fund_campaigns')
    .update({ ...row, starts_at: new Date(row.starts_at).toISOString(), ends_at: new Date(row.ends_at).toISOString() })
    .eq('id', id);
  if (error) return dbError(error);
  refresh();
  return ok('Campaign settings saved');
}

/** Managers: draft -> review, live <-> paused, end early. Admin-only transitions are rejected by the DB. */
export async function requestCampaignStatus(campaignId: string, status: CampaignStatus): Promise<ActionResult> {
  const g = await guard(campaignId);
  if ('error' in g) return g.error;
  const { error } = await g.db.from('fund_campaigns').update({ status }).eq('id', campaignId);
  if (error) return dbError(error);
  refresh();
  return ok(status === 'pending_review' ? 'Submitted for platform review' : `Campaign ${status}`);
}
