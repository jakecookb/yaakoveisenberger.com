import 'server-only';
import { cache } from 'react';
import { DEMO_SLUG, isDemoEnabled, isSupabaseConfigured } from './env';
import { buildDemoCampaign } from './demo';
import { createFundAnonClient, createFundServerClient } from './supabase/server';
import type { PublicCampaign, PublicCampaignListItem } from './types';

/**
 * Loads everything a public campaign surface needs in one RPC. Tries the anonymous
 * client first (public campaigns); falls back to the visitor's session so managers
 * can preview drafts at the same URL.
 */
export const getPublicCampaign = cache(async (slug: string): Promise<PublicCampaign | null> => {
  const normalized = slug.toLowerCase();
  if (isDemoEnabled && normalized === DEMO_SLUG) return buildDemoCampaign();
  if (!isSupabaseConfigured) return null;

  const { data, error } = await createFundAnonClient().rpc('fund_get_public_campaign', { p_slug: normalized });
  if (error) console.error('[fund] fund_get_public_campaign', error.message);
  if (data) return data as PublicCampaign;

  try {
    const supabase = await createFundServerClient();
    const { data: preview } = await supabase.rpc('fund_get_public_campaign', { p_slug: normalized });
    return (preview as PublicCampaign | null) ?? null;
  } catch {
    return null;
  }
});

export async function listPublicCampaigns(): Promise<PublicCampaignListItem[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createFundAnonClient().rpc('fund_list_public_campaigns');
  if (error) {
    console.error('[fund] fund_list_public_campaigns', error.message);
    return [];
  }
  return (data as PublicCampaignListItem[]) ?? [];
}
