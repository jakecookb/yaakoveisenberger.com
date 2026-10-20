import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cents, toCsv } from './csv';
import type { DonationRow } from './types';

const PAGE = 1000;
const MAX_ROWS = 100_000;

/** Pages through PostgREST's 1,000-row limit. Runs as the signed-in user, so RLS scopes the export. */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

type DonationExportRow = DonationRow & {
  campaign?: { slug: string; title: string } | null;
  team?: { name: string } | null;
  ambassador?: { name: string } | null;
};

export async function donationsCsv(
  supabase: SupabaseClient,
  filter: { campaignId?: string; status?: string; flagged?: boolean; includeNetwork?: boolean },
) {
  const rows = await fetchAll<DonationExportRow>((from, to) => {
    let q = supabase
      .from('fund_donations')
      .select('*, campaign:fund_campaigns(slug, title), team:fund_teams(name), ambassador:fund_ambassadors(name)')
      .order('created_at', { ascending: false })
      .range(from, to);
    if (filter.campaignId) q = q.eq('campaign_id', filter.campaignId);
    if (filter.status) q = q.eq('status', filter.status);
    if (filter.flagged) q = q.eq('is_flagged', true);
    return q;
  });

  const headers = [
    'donation_id', 'created_at', 'succeeded_at', 'campaign', 'status', 'source', 'amount', 'matched', 'fee_cover',
    'platform_fee', 'currency', 'donor_name', 'donor_email', 'donor_phone', 'anonymous', 'message', 'team',
    'ambassador', 'reference', 'stripe_payment_intent', 'stripe_charge', 'flagged', 'flag_reason',
    'failure_code', 'failure_message',
    ...(filter.includeNetwork ? ['ip_address', 'country', 'risk_level'] : []),
  ];
  return toCsv(
    headers,
    rows.map((d) => [
      d.id, d.created_at, d.succeeded_at, d.campaign?.slug, d.status, d.source, cents(d.amount_cents),
      cents(d.matched_cents), cents(d.fee_cover_cents), cents(d.platform_fee_cents), d.currency, d.donor_name,
      d.donor_email, d.donor_phone, d.is_anonymous, d.message, d.team?.name, d.ambassador?.name, d.reference,
      d.stripe_payment_intent_id, d.stripe_charge_id, d.is_flagged, d.flag_reason, d.failure_code, d.failure_message,
      ...(filter.includeNetwork ? [d.ip_address, d.country, d.risk_level] : []),
    ]),
  );
}
