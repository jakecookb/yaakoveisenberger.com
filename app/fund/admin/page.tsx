import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CircleDollarSign, Landmark, Lock, Radio } from 'lucide-react';
import { requirePlatformAdmin } from '@/lib/fund/auth';
import { isServiceRoleConfigured, isStripeClientConfigured, isStripeServerConfigured, serverEnv } from '@/lib/fund/env';
import { formatMoney, formatMoneyCompact, formatNumber, timeAgo } from '@/lib/fund/format';
import type { CampaignRow, DonationRow, PlatformMetrics } from '@/lib/fund/types';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { LiveRefresher } from '@/components/fund/dashboard/live-refresher';
import { Table, Td, Th } from '@/components/fund/dashboard/table';
import { CampaignStatusActions } from '@/components/fund/admin/campaign-actions';
import { Card, CardHeader, StatusBadge } from '@/components/fund/ui/primitives';
import { StatTile } from '@/components/fund/ui/stat';

export const metadata = { title: 'Overview' };

type RecentDonation = DonationRow & { campaign: { slug: string; title: string } | null };

export default async function AdminOverview() {
  const { supabase } = await requirePlatformAdmin();
  const [{ data: metrics, error }, { data: pending }, { data: recent }] = await Promise.all([
    supabase.rpc('fund_platform_metrics'),
    supabase.from('fund_campaigns').select('id, slug, title, status, goal_cents, starts_at, org:fund_organizations(name)').eq('status', 'pending_review').order('created_at'),
    supabase
      .from('fund_donations')
      .select('id, amount_cents, matched_cents, currency, donor_name, is_anonymous, source, status, is_flagged, created_at, campaign:fund_campaigns(slug, title)')
      .order('created_at', { ascending: false })
      .limit(12),
  ]);
  const m = (metrics ?? {}) as PlatformMetrics;
  const env = serverEnv();
  const health = [
    { ok: isServiceRoleConfigured(), label: 'Supabase secret key (webhooks, checkout, rate limits)' },
    { ok: isStripeServerConfigured() && isStripeClientConfigured, label: 'Stripe secret + publishable keys' },
    { ok: env.stripeWebhookSecrets.length > 0, label: `Stripe webhook signing secret${env.stripeWebhookSecrets.length > 1 ? 's (platform + Connect)' : ''}` },
    { ok: Boolean(env.turnstileSecret), label: 'Cloudflare Turnstile bot check (optional)' },
  ];

  return (
    <>
      <PageHeader title="Platform overview" subtitle="Every campaign, every nonprofit, in real time." actions={<LiveRefresher tables={['fund_donations', 'fund_webhook_events']} />} />
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Metrics unavailable: {error.message}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile emphasis label="Total platform revenue" value={formatMoneyCompact(m.gross_cents ?? 0)} sub={`${formatMoneyCompact(m.online_gross_cents ?? 0)} online · ${formatMoneyCompact(m.gross_24h_cents ?? 0)} last 24h`} icon={<CircleDollarSign className="size-5" />} />
        <StatTile label="Active live campaigns" value={formatNumber(m.live_campaigns ?? 0)} sub={`${m.active_campaigns ?? 0} active or paused · ${m.pending_review ?? 0} awaiting review`} icon={<Radio className="size-5" />} />
        <StatTile label="Total match funds locked" value={formatMoneyCompact(m.match_locked_cents ?? 0)} sub={`${formatMoneyCompact(m.match_remaining_cents ?? 0)} still available to donors`} icon={<Lock className="size-5" />} />
        <StatTile label="Platform fees collected" value={formatMoneyCompact(m.platform_fees_cents ?? 0)} sub={`+ ${formatMoneyCompact(m.fee_cover_cents ?? 0)} donor-covered processing`} icon={<Landmark className="size-5" />} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Donations, last 24h" value={formatNumber(m.donations_24h ?? 0)} />
        <StatTile label="Failed charges, 24h" value={formatNumber(m.failed_24h ?? 0)} sub={<Link className="hover:underline" href="/fund/admin/monitor?tab=failed">Review →</Link>} />
        <StatTile label="Flagged for review" value={formatNumber(m.flagged_open ?? 0)} sub={<Link className="hover:underline" href="/fund/admin/monitor?tab=flagged">Review →</Link>} />
        <StatTile label="Webhook failures, 24h" value={formatNumber(m.webhooks_failed_24h ?? 0)} sub={`${m.blocked_ips ?? 0} IPs blocked · ${m.organizations_onboarded ?? 0}/${m.organizations ?? 0} nonprofits on Stripe`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Latest transactions" action={<Link href="/fund/admin/monitor" className="text-sm font-medium text-[var(--fund-accent-strong)] hover:underline">Open monitor</Link>} />
          <Table>
            <thead>
              <tr><Th>Donor</Th><Th>Campaign</Th><Th>Amount</Th><Th>Status</Th><Th>When</Th></tr>
            </thead>
            <tbody>
              {((recent ?? []) as unknown as RecentDonation[]).map((d) => (
                <tr key={d.id}>
                  <Td className="font-medium text-slate-900">{d.is_anonymous ? `${d.donor_name ?? 'Anonymous'} (anon)` : (d.donor_name ?? '—')}</Td>
                  <Td><Link href={`/fund/${d.campaign?.slug}`} className="hover:underline">{d.campaign?.title}</Link></Td>
                  <Td>{formatMoney(d.amount_cents, d.currency)}{d.matched_cents > 0 && <span className="text-xs text-[var(--fund-accent-strong)]"> +{formatMoney(d.matched_cents, d.currency)}</span>}</Td>
                  <Td><StatusBadge status={d.status} /> {d.is_flagged && <AlertTriangle className="ml-1 inline size-4 text-amber-500" aria-label="flagged" />}</Td>
                  <Td className="whitespace-nowrap text-slate-500">{timeAgo(d.created_at)}</Td>
                </tr>
              ))}
              {!recent?.length && <tr><Td colSpan={5} className="py-8 text-center text-slate-500">No transactions yet.</Td></tr>}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Awaiting approval" />
            <ul className="divide-y divide-slate-100">
              {((pending ?? []) as unknown as (CampaignRow & { org: { name: string } | null })[]).map((c) => (
                <li key={c.id} className="space-y-2 px-5 py-4">
                  <div>
                    <Link href={`/fund/admin/campaigns/${c.id}`} className="font-medium text-slate-900 hover:underline">{c.title}</Link>
                    <p className="text-xs text-slate-500">{c.org?.name} · goal {formatMoney(c.goal_cents)} · /fund/{c.slug}</p>
                  </div>
                  <CampaignStatusActions campaignId={c.id} status={c.status} />
                </li>
              ))}
              {!pending?.length && <li className="px-5 py-6 text-sm text-slate-500">Nothing waiting. 🎉</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Platform health" />
            <ul className="space-y-2.5 p-5 text-sm">
              {health.map((h) => (
                <li key={h.label} className="flex items-start gap-2">
                  {h.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />}
                  <span className={h.ok ? 'text-slate-700' : 'text-slate-900'}>{h.label}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
