import Link from 'next/link';
import { ExternalLink, MonitorPlay, Plus, Search, Settings2 } from 'lucide-react';
import { requirePlatformAdmin } from '@/lib/fund/auth';
import { formatDateTime, formatMoney } from '@/lib/fund/format';
import type { CampaignRow, CampaignStatus } from '@/lib/fund/types';
import { PageHeader } from '@/components/fund/dashboard/page-header';
import { LinkTabs } from '@/components/fund/dashboard/tabs';
import { Table, Td, Th } from '@/components/fund/dashboard/table';
import { CampaignStatusActions } from '@/components/fund/admin/campaign-actions';
import { Card, StatusBadge } from '@/components/fund/ui/primitives';
import { Meter } from '@/components/fund/ui/stat';

export const metadata = { title: 'Campaigns' };

const FILTERS: { id: string; label: string; statuses?: CampaignStatus[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live', statuses: ['active'] },
  { id: 'review', label: 'Needs review', statuses: ['pending_review'] },
  { id: 'draft', label: 'Drafts', statuses: ['draft'] },
  { id: 'paused', label: 'Paused', statuses: ['paused'] },
  { id: 'done', label: 'Completed', statuses: ['completed'] },
  { id: 'archived', label: 'Archived', statuses: ['archived'] },
];

type Row = CampaignRow & { org: { name: string } | null };

export default async function AdminCampaigns({ searchParams }: PageProps<'/fund/admin/campaigns'>) {
  const { supabase } = await requirePlatformAdmin('/fund/admin/campaigns');
  const sp = await searchParams;
  const tab = typeof sp.tab === 'string' ? sp.tab : 'all';
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const filter = FILTERS.find((f) => f.id === tab) ?? FILTERS[0]!;

  let query = supabase.from('fund_campaigns').select('*, org:fund_organizations(name)').order('created_at', { ascending: false }).limit(200);
  if (filter.statuses) query = query.in('status', filter.statuses);
  else query = query.neq('status', 'archived');
  if (q) query = query.or(`title.ilike.%${q.replace(/[%,()]/g, '')}%,slug.ilike.%${q.replace(/[%,()]/g, '')}%`);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Create, approve, pause and archive campaigns. Each lives at yaakoveisenberger.com/fund/<slug>."
        actions={
          <Link href="/fund/admin/campaigns/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--fund-accent)] px-4 text-sm font-medium text-white hover:bg-[var(--fund-accent-strong)]">
            <Plus className="size-4" /> New campaign
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <LinkTabs tabs={FILTERS.map((f) => ({ id: f.id, label: f.label }))} active={filter.id} base="/fund/admin/campaigns" extra={q ? { q } : undefined} />
        <form className="relative" action="/fund/admin/campaigns">
          <input type="hidden" name="tab" value={filter.id} />
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Search title or URL" className="h-9 w-64 rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-[var(--fund-accent)] focus:outline-none" />
        </form>
      </div>
      <Card>
        <Table>
          <thead>
            <tr><Th>Campaign</Th><Th>Nonprofit</Th><Th>Status</Th><Th className="w-56">Raised</Th><Th>Schedule</Th><Th>Actions</Th></tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const total = c.raised_cents + c.matched_cents;
              return (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={`/fund/admin/campaigns/${c.id}`} className="font-medium text-slate-900 hover:underline">{c.title}</Link>
                    <p className="text-xs text-slate-500">/fund/{c.slug}</p>
                  </Td>
                  <Td>{c.org?.name}</Td>
                  <Td><StatusBadge status={c.status} /></Td>
                  <Td>
                    <p className="font-medium text-slate-900">{formatMoney(total)} <span className="font-normal text-slate-500">/ {formatMoney(c.goal_cents)}</span></p>
                    <Meter value={total} max={c.goal_cents} height="h-1.5" className="mt-1.5" label="Progress" />
                    <p className="mt-1 text-xs text-slate-500">{c.donation_count} gifts · {formatMoney(c.matched_cents)} matched</p>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(c.starts_at)}<br />→ {formatDateTime(c.ends_at)}</Td>
                  <Td>
                    <div className="flex flex-col gap-2">
                      <CampaignStatusActions campaignId={c.id} status={c.status} />
                      <div className="flex gap-3 text-xs">
                        <Link href={`/fund/admin/campaigns/${c.id}`} className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"><Settings2 className="size-3.5" /> Edit</Link>
                        <Link href={`/fund/portal/${c.slug}`} className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">Portal</Link>
                        <a href={`/fund/${c.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"><ExternalLink className="size-3.5" /> Page</a>
                        <a href={`/fund/display/${c.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"><MonitorPlay className="size-3.5" /> Screen</a>
                      </div>
                    </div>
                  </Td>
                </tr>
              );
            })}
            {!rows.length && <tr><Td colSpan={6} className="py-10 text-center text-slate-500">No campaigns here yet.</Td></tr>}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
