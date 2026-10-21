import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { AnalyticsTable } from '@/components/admin/analytics-table';
import { requireAdmin } from '@/lib/admin/session';
import { loadVisits } from '@/lib/analytics/store';
import { interest, rows } from '@/lib/analytics/summary';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analytics' };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin();
  const days = Math.min(90, Math.max(1, Number((await searchParams).days) || 7));
  const visits = await loadVisits(days);
  const data = rows(visits);
  const people = new Set(visits.map((v) => v.vid)).size;
  const top = interest(visits).slice(0, 12);
  const refs = [...visits.reduce((m, v) => { let k = 'Direct'; try { if (v.referrer) k = new URL(v.referrer).hostname; } catch { k = 'Other'; } m.set(k, (m.get(k) ?? 0) + 1); return m; }, new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const stat = (n: string | number, l: string) => <div className="rounded-2xl bg-neutral-900/60 p-4 ring-1 ring-white/10"><p className="text-2xl font-semibold text-white">{n}</p><p className="text-xs text-neutral-400">{l}</p></div>;
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"><ArrowLeft className="size-4" /> Editor</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold text-white">Visitor analytics</h1>
        <div className="flex flex-wrap gap-2">
          {[1, 7, 30, 90].map((d) => <Link key={d} href={`/admin/analytics?days=${d}`} className={`rounded-full px-3 py-1.5 text-sm ring-1 ${d === days ? 'bg-white/10 text-white ring-white/30' : 'text-neutral-400 ring-white/10'}`}>{d === 1 ? 'Today' : `${d} days`}</Link>)}
          <a href={`/api/admin/analytics-csv?days=${days}`} download className="inline-flex items-center gap-2 rounded-full bg-[#c8a96a] px-4 py-1.5 text-sm font-semibold text-neutral-950"><Download className="size-4" /> Download Full Analytics CSV</a>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat(visits.length, 'Visits')}{stat(people, 'Unique visitors')}{stat(visits.reduce((s, v) => s + v.pages.length, 0), 'Page views')}
        {stat(visits.length ? `${Math.round(data.reduce((s, r) => s + r.seconds, 0) / visits.length)}s` : '—', 'Average time per visit')}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl bg-neutral-900/60 p-4 ring-1 ring-white/10"><h2 className="text-sm font-semibold text-white">Most-opened cards & tools</h2><ul className="mt-2 space-y-1 text-sm">{top.length ? top.map(([k, n]) => <li key={k} className="flex justify-between text-neutral-300"><span>{k}</span><span className="text-neutral-500">{n}</span></li>) : <li className="text-neutral-500">No clicks yet.</li>}</ul></section>
        <section className="rounded-2xl bg-neutral-900/60 p-4 ring-1 ring-white/10"><h2 className="text-sm font-semibold text-white">Where visitors come from</h2><ul className="mt-2 space-y-1 text-sm">{refs.map(([k, n]) => <li key={k} className="flex justify-between text-neutral-300"><span>{k}</span><span className="text-neutral-500">{n}</span></li>)}</ul></section>
      </div>
      <p className="mt-6 mb-3 text-xs text-neutral-500">Access requests (who asked for which locked card) are in <Link href="/admin/access" className="text-[#c8a96a]">Access requests</Link>.</p>
      <AnalyticsTable data={data} />
    </main>
  );
}
