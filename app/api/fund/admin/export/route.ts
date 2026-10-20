import { NextResponse } from 'next/server';
import { getFundSession } from '@/lib/fund/auth';
import { csvResponse, toCsv } from '@/lib/fund/csv';
import { donationsCsv, fetchAll } from '@/lib/fund/exports';
import type { AuditRow, FlaggedIpRow, WebhookEventRow } from '@/lib/fund/types';

/** GET /api/fund/admin/export?type=donations|failed|flagged|webhooks|ips|audit[&campaign=<uuid>] */
export async function GET(request: Request) {
  const session = await getFundSession();
  if (!session?.isPlatformAdmin) return NextResponse.json({ error: 'Platform admin only' }, { status: 403 });
  const url = new URL(request.url);
  const type = url.searchParams.get('type') ?? 'donations';
  const campaignId = url.searchParams.get('campaign') ?? undefined;
  const stamp = new Date().toISOString().slice(0, 10);
  const db = session.supabase;

  try {
    switch (type) {
      case 'donations':
        return csvResponse(`fund-donations-${stamp}.csv`, await donationsCsv(db, { campaignId, includeNetwork: true }));
      case 'failed':
        return csvResponse(`fund-failed-charges-${stamp}.csv`, await donationsCsv(db, { campaignId, status: 'failed', includeNetwork: true }));
      case 'flagged':
        return csvResponse(`fund-flagged-${stamp}.csv`, await donationsCsv(db, { campaignId, flagged: true, includeNetwork: true }));
      case 'webhooks': {
        const rows = await fetchAll<WebhookEventRow>((from, to) =>
          db.from('fund_webhook_events')
            .select('id, type, account, livemode, status, attempts, error, related_donation_id, received_at, processed_at')
            .order('received_at', { ascending: false })
            .range(from, to),
        );
        return csvResponse(
          `fund-webhooks-${stamp}.csv`,
          toCsv(
            ['event_id', 'type', 'account', 'livemode', 'status', 'attempts', 'error', 'donation_id', 'received_at', 'processed_at'],
            rows.map((r) => [r.id, r.type, r.account, r.livemode, r.status, r.attempts, r.error, r.related_donation_id, r.received_at, r.processed_at]),
          ),
        );
      }
      case 'ips': {
        const rows = await fetchAll<FlaggedIpRow>((from, to) =>
          db.from('fund_flagged_ips').select('*').order('created_at', { ascending: false }).range(from, to),
        );
        return csvResponse(
          `fund-flagged-ips-${stamp}.csv`,
          toCsv(['ip', 'blocked', 'reason', 'hits', 'expires_at', 'created_at'], rows.map((r) => [r.ip, r.is_blocked, r.reason, r.hit_count, r.expires_at, r.created_at])),
        );
      }
      case 'audit': {
        const rows = await fetchAll<AuditRow>((from, to) =>
          db.from('fund_audit_log').select('*').order('created_at', { ascending: false }).range(from, to),
        );
        return csvResponse(
          `fund-audit-${stamp}.csv`,
          toCsv(
            ['id', 'created_at', 'actor', 'action', 'entity', 'entity_id', 'campaign_id', 'details'],
            rows.map((r) => [r.id, r.created_at, r.actor_email, r.action, r.entity_type, r.entity_id, r.campaign_id, JSON.stringify(r.details)]),
          ),
        );
      }
      default:
        return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Export failed' }, { status: 500 });
  }
}
