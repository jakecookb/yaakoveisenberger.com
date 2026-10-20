import Link from 'next/link';
import { AlertTriangle, Download } from 'lucide-react';
import { requirePlatformAdmin } from '@/lib/fund/auth';
import { formatDateTime, formatMoney } from '@/lib/fund/format';
import type { AuditRow, DonationRow, FlaggedIpRow, WebhookEventRow } from '@/lib/fund/types';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { LinkTabs } from '@/components/fund/dashboard/tabs';
import { LiveRefresher } from '@/components/fund/dashboard/live-refresher';
import { Table, Td, Th } from '@/components/fund/dashboard/table';
import { BlockIpButton, BlockIpForm, DonationOverrideButton, FlagToggle, UnblockIpButton } from '@/components/fund/admin/monitor-controls';
import { Badge, Card, CardHeader, StatusBadge } from '@/components/fund/ui/primitives';

export const metadata = { title: 'Fraud & transactions' };

const TABS = [
  { id: 'transactions', label: 'Transactions', exportType: 'donations' },
  { id: 'failed', label: 'Failed charges', exportType: 'failed' },
  { id: 'flagged', label: 'Flagged', exportType: 'flagged' },
  { id: 'webhooks', label: 'Webhooks', exportType: 'webhooks' },
  { id: 'ips', label: 'Blocked IPs', exportType: 'ips' },
  { id: 'audit', label: 'Overrides & audit', exportType: 'audit' },
] as const;

type DonationWithCampaign = DonationRow & { campaign: { slug: string; title: string } | null };

function DonationsTable({ rows, showFailure }: { rows: DonationWithCampaign[]; showFailure?: boolean }) {
  return (
    <Table>
      <thead>
        <tr><Th>When</Th><Th>Donor</Th><Th>Campaign</Th><Th>Amount</Th><Th>Status</Th><Th>{showFailure ? 'Failure' : 'Risk'}</Th><Th>Network</Th><Th /></tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.id} className={d.is_flagged ? 'bg-amber-50/50' : undefined}>
            <Td className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(d.created_at)}</Td>
            <Td>
              <p className="font-medium text-slate-900">{d.donor_name ?? '—'} {d.is_anonymous && <Badge>anon</Badge>}</p>
              <p className="text-xs text-slate-500">{d.donor_email ?? ''}</p>
            </Td>
            <Td className="text-xs"><Link className="hover:underline" href={`/fund/portal/${d.campaign?.slug}/donations`}>{d.campaign?.title}</Link></Td>
            <Td className="whitespace-nowrap">
              <p className="font-medium text-slate-900">{formatMoney(d.amount_cents, d.currency)}</p>
              <p className="text-xs text-slate-500">{d.source}{d.matched_cents > 0 ? ` · +${formatMoney(d.matched_cents, d.currency)} match` : ''}</p>
            </Td>
            <Td><StatusBadge status={d.status} /></Td>
            <Td className="max-w-64 text-xs">
              {showFailure ? (
                <span className="text-red-700">{d.failure_code ? `${d.failure_code}: ` : ''}{d.failure_message ?? '—'}</span>
              ) : (
                <>
                  {d.risk_level && <Badge tone={d.risk_level === 'normal' ? 'neutral' : 'danger'}>{d.risk_level}</Badge>}
                  {d.is_flagged && <p className="mt-1 flex items-start gap-1 text-amber-800"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {d.flag_reason ?? 'Flagged'}</p>}
                </>
              )}
            </Td>
            <Td className="whitespace-nowrap font-mono text-xs text-slate-500">{d.ip_address ?? '—'}{d.country ? ` · ${d.country}` : ''}</Td>
            <Td>
              <div className="flex items-center">
                <DonationOverrideButton donation={d} />
                <FlagToggle donation={d} />
                {d.ip_address && <BlockIpButton ip={d.ip_address} />}
              </div>
            </Td>
          </tr>
        ))}
        {!rows.length && <tr><Td colSpan={8} className="py-10 text-center text-slate-500">Nothing to show.</Td></tr>}
      </tbody>
    </Table>
  );
}

export default async function Monitor({ searchParams }: PageProps<'/fund/admin/monitor'>) {
  const { supabase } = await requirePlatformAdmin('/fund/admin/monitor');
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab) ?? TABS[0];
  const campaign = typeof sp.campaign === 'string' && /^[0-9a-f-]{36}$/i.test(sp.campaign) ? sp.campaign : undefined;
  const select = '*, campaign:fund_campaigns(slug, title)';

  const { data: campaigns } = await supabase.from('fund_campaigns').select('id, title').neq('status', 'archived').order('created_at', { ascending: false }).limit(100);

  let body: React.ReactNode = null;
  if (tab.id === 'transactions' || tab.id === 'failed' || tab.id === 'flagged') {
    let q = supabase.from('fund_donations').select(select).order('created_at', { ascending: false }).limit(200);
    if (tab.id === 'failed') q = q.eq('status', 'failed');
    if (tab.id === 'flagged') q = q.eq('is_flagged', true);
    if (campaign) q = q.eq('campaign_id', campaign);
    const { data } = await q;
    body = <DonationsTable rows={(data ?? []) as unknown as DonationWithCampaign[]} showFailure={tab.id === 'failed'} />;
  } else if (tab.id === 'webhooks') {
    const { data } = await supabase
      .from('fund_webhook_events')
      .select('id, type, account, livemode, status, attempts, error, related_donation_id, received_at, processed_at')
      .order('received_at', { ascending: false })
      .limit(200);
    body = (
      <Table>
        <thead><tr><Th>Received</Th><Th>Event</Th><Th>Status</Th><Th>Attempts</Th><Th>Account</Th><Th>Error</Th></tr></thead>
        <tbody>
          {((data ?? []) as WebhookEventRow[]).map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(e.received_at)}</Td>
              <Td><p className="font-medium text-slate-900">{e.type}</p><p className="font-mono text-xs text-slate-500">{e.id}{e.livemode === false ? ' · test' : ''}</p></Td>
              <Td><StatusBadge status={e.status} /></Td>
              <Td>{e.attempts}</Td>
              <Td className="font-mono text-xs text-slate-500">{e.account ?? 'platform'}</Td>
              <Td className="max-w-72 text-xs text-red-700">{e.error}</Td>
            </tr>
          ))}
          {!data?.length && <tr><Td colSpan={6} className="py-10 text-center text-slate-500">No webhook events received yet. Run <code>npm run fund:setup</code> to register the endpoint with Stripe.</Td></tr>}
        </tbody>
      </Table>
    );
  } else if (tab.id === 'ips') {
    const { data } = await supabase.from('fund_flagged_ips').select('*').order('created_at', { ascending: false }).limit(500);
    body = (
      <>
        <div className="border-b border-slate-100 p-5"><BlockIpForm /></div>
        <Table>
          <thead><tr><Th>IP</Th><Th>Reason</Th><Th>Expires</Th><Th>Added</Th><Th /></tr></thead>
          <tbody>
            {((data ?? []) as FlaggedIpRow[]).map((ip) => {
              const expired = ip.expires_at && new Date(ip.expires_at) < new Date();
              return (
                <tr key={ip.ip}>
                  <Td className="font-mono text-sm">{ip.ip} {expired ? <Badge>expired</Badge> : ip.is_blocked ? <Badge tone="danger" dot>blocked</Badge> : <Badge tone="warning">watch</Badge>}</Td>
                  <Td className="text-xs">{ip.reason}</Td>
                  <Td className="whitespace-nowrap text-xs text-slate-500">{ip.expires_at ? formatDateTime(ip.expires_at) : 'Never'}</Td>
                  <Td className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(ip.created_at)}</Td>
                  <Td><UnblockIpButton ip={ip.ip} /></Td>
                </tr>
              );
            })}
            {!data?.length && <tr><Td colSpan={5} className="py-10 text-center text-slate-500">No blocked IPs. Card-testing bursts (5+ failed payments/hour) are blocked automatically.</Td></tr>}
          </tbody>
        </Table>
      </>
    );
  } else {
    const { data } = await supabase.from('fund_audit_log').select('*').order('created_at', { ascending: false }).limit(200);
    body = (
      <Table>
        <thead><tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Changes</Th></tr></thead>
        <tbody>
          {((data ?? []) as AuditRow[]).map((a) => (
            <tr key={a.id}>
              <Td className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(a.created_at)}</Td>
              <Td className="text-xs">{a.actor_email ?? '—'}</Td>
              <Td><p className="font-medium text-slate-900">{a.action} {a.entity_type.replace('fund_', '').replace(/_/g, ' ')}</p><p className="font-mono text-xs text-slate-500">{a.entity_id}</p></Td>
              <Td className="max-w-xl">
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] leading-snug text-slate-600">
                  {a.action === 'update'
                    ? Object.entries(a.details as Record<string, { from: unknown; to: unknown }>).map(([k, v]) => `${k}: ${JSON.stringify(v.from)} → ${JSON.stringify(v.to)}`).join('\n')
                    : JSON.stringify(a.details, null, 1).slice(0, 600)}
                </pre>
              </Td>
            </tr>
          ))}
          {!data?.length && <tr><Td colSpan={4} className="py-10 text-center text-slate-500">No manual changes recorded yet.</Td></tr>}
        </tbody>
      </Table>
    );
  }

  const exportHref = `/api/fund/admin/export?type=${tab.exportType}${campaign ? `&campaign=${campaign}` : ''}`;
  return (
    <>
      <PageHeader
        title="Fraud & transaction monitor"
        subtitle="Webhooks, failed charges, Radar risk, flagged IPs and manual overrides — all audited."
        actions={
          <>
            <LiveRefresher tables={['fund_donations', 'fund_webhook_events']} />
            <a href={exportHref} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Download className="size-4" /> Export CSV
            </a>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <LinkTabs tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} active={tab.id} base="/fund/admin/monitor" extra={campaign ? { campaign } : undefined} />
        {['transactions', 'failed', 'flagged'].includes(tab.id) && (
          <form action="/fund/admin/monitor" className="flex items-center gap-2">
            <input type="hidden" name="tab" value={tab.id} />
            <select name="campaign" defaultValue={campaign ?? ''} className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm" aria-label="Filter by campaign">
              <option value="">All campaigns</option>
              {(campaigns ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <button className="h-9 rounded-xl bg-slate-900 px-3 text-sm font-medium text-white">Filter</button>
          </form>
        )}
      </div>
      <Card>
        <CardHeader title={tab.label} description={tab.id === 'transactions' ? 'Latest 200 — export CSV for everything.' : undefined} />
        {body}
      </Card>
    </>
  );
}
