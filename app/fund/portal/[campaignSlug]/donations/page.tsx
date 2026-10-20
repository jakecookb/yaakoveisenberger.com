import Link from 'next/link';
import { Download } from 'lucide-react';
import { getCampaignAccess } from '@/lib/fund/auth';
import { formatDateTime, formatMoney } from '@/lib/fund/format';
import type { AmbassadorRow, DonationRow, TeamRow } from '@/lib/fund/types';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { LinkTabs } from '@/components/fund/dashboard/tabs';
import { LiveRefresher } from '@/components/fund/dashboard/live-refresher';
import { Table, Td, Th } from '@/components/fund/dashboard/table';
import { OfflineDonationForm, VoidDonationButton } from '@/components/fund/portal/offline-donation-form';
import { Badge, Card, StatusBadge } from '@/components/fund/ui/primitives';

export const metadata = { title: 'Donations' };

const FILTERS = [
  { id: 'succeeded', label: 'Completed' },
  { id: 'offline', label: 'Offline' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
  { id: 'refunded', label: 'Refunded / voided' },
];

export default async function PortalDonations({ params, searchParams }: PageProps<'/fund/portal/[campaignSlug]/donations'>) {
  const { campaignSlug } = await params;
  const { supabase, campaign, canManage } = await getCampaignAccess(campaignSlug);
  const sp = await searchParams;
  const tab = FILTERS.find((f) => f.id === sp.tab)?.id ?? 'succeeded';

  let q = supabase.from('fund_donations').select('*').eq('campaign_id', campaign.id).order('created_at', { ascending: false }).limit(300);
  if (tab === 'offline') q = q.neq('source', 'online').eq('status', 'succeeded');
  else if (tab === 'refunded') q = q.in('status', ['refunded', 'canceled', 'disputed']);
  else q = q.eq('status', tab);
  const [{ data: rows }, { data: teams }, { data: ambassadors }] = await Promise.all([
    q,
    supabase.from('fund_teams').select('*').eq('campaign_id', campaign.id).order('sort_order').order('name'),
    supabase.from('fund_ambassadors').select('*').eq('campaign_id', campaign.id).order('name'),
  ]);
  const teamName = new Map((teams ?? []).map((t: TeamRow) => [t.id, t.name]));
  const ambName = new Map((ambassadors ?? []).map((a: AmbassadorRow) => [a.id, a.name]));

  return (
    <>
      <PageHeader
        title="Donations"
        subtitle="Every gift, online and offline. Donor contact details are visible to your organization only."
        actions={
          <>
            <LiveRefresher campaignId={campaign.id} />
            <a href={`/api/fund/portal/${campaign.slug}/export?status=${tab === 'succeeded' || tab === 'offline' ? 'succeeded' : 'all'}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Download className="size-4" /> Export CSV
            </a>
          </>
        }
      />
      {canManage && (
        <div className="mb-6">
          <OfflineDonationForm campaignId={campaign.id} teams={(teams ?? []) as TeamRow[]} ambassadors={(ambassadors ?? []) as AmbassadorRow[]} />
        </div>
      )}
      <div className="mb-4"><LinkTabs tabs={FILTERS} active={tab} base={`/fund/portal/${campaign.slug}/donations`} /></div>
      <Card>
        <Table>
          <thead><tr><Th>Date</Th><Th>Donor</Th><Th>Gift</Th><Th>Match</Th><Th>Method</Th><Th>Credit</Th><Th>Message</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>
            {((rows ?? []) as DonationRow[]).map((d) => (
              <tr key={d.id}>
                <Td className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(d.received_at ?? d.succeeded_at ?? d.created_at)}</Td>
                <Td>
                  <p className="font-medium text-slate-900">{d.donor_name ?? '—'} {d.is_anonymous && <Badge>anon</Badge>}</p>
                  <p className="text-xs text-slate-500">{[d.donor_email, d.donor_phone].filter(Boolean).join(' · ')}</p>
                </Td>
                <Td className="whitespace-nowrap font-medium text-slate-900">{formatMoney(d.amount_cents, d.currency)}</Td>
                <Td className="whitespace-nowrap text-[var(--fund-accent-strong)]">{d.matched_cents > 0 ? `+${formatMoney(d.matched_cents, d.currency)}` : '—'}</Td>
                <Td className="text-xs">{d.source}{d.reference ? <p className="text-slate-500">#{d.reference}</p> : null}</Td>
                <Td className="text-xs">{[d.team_id && teamName.get(d.team_id), d.ambassador_id && ambName.get(d.ambassador_id)].filter(Boolean).join(' · ') || '—'}</Td>
                <Td className="max-w-56 text-xs text-slate-600">{d.message}{d.failure_message && <p className="text-red-600">{d.failure_message}</p>}</Td>
                <Td><StatusBadge status={d.status} /></Td>
                <Td>{canManage && d.source !== 'online' && d.status === 'succeeded' && <VoidDonationButton campaignId={campaign.id} donationId={d.id} />}</Td>
              </tr>
            ))}
            {!rows?.length && <tr><Td colSpan={9} className="py-10 text-center text-slate-500">No donations in this view.</Td></tr>}
          </tbody>
        </Table>
      </Card>
      <p className="mt-3 text-xs text-slate-500">Need to refund an online gift? Refund it in Stripe — the platform updates automatically. Questions: <Link href="/fund" className="underline">contact the platform team</Link>.</p>
    </>
  );
}
