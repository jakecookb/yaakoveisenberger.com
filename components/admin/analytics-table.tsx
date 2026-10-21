'use client';

import { useMemo, useState } from 'react';
import type { Row } from '@/lib/analytics/summary';

export function AnalyticsTable({ data }: { data: Row[] }) {
  const [q, setQ] = useState('');
  const [device, setDevice] = useState('');
  const [returning, setReturning] = useState(false);
  const shown = useMemo(() => data.filter((r) => (!device || r.device === device) && (!returning || r.visits > 1) && (!q || Object.values(r).join(' ').toLowerCase().includes(q.toLowerCase()))), [data, q, device, returning]);
  const f = 'h-9 rounded-xl bg-neutral-950 px-3 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-[#c8a96a]';
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search IP, place, page, referrer, click…" className={`${f} min-w-60 flex-1`} />
        <select value={device} onChange={(e) => setDevice(e.target.value)} className={f}><option value="">All devices</option><option>Mobile</option><option>Desktop</option></select>
        <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" checked={returning} onChange={(e) => setReturning(e.target.checked)} /> Returning visitors</label>
        <span className="self-center text-sm text-neutral-500">{shown.length} of {data.length} visits</span>
      </div>
      <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
        <table className="w-full min-w-[64rem] text-left text-xs">
          <thead className="bg-neutral-900 text-neutral-400"><tr>{['When', 'IP', 'Location', 'Referrer', 'Time', 'Visits', 'Pages', 'Clicks'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/5">
            {shown.slice(0, 500).map((r, i) => (
              <tr key={i} className="align-top hover:bg-white/5">
                <td className="whitespace-nowrap px-3 py-2 text-neutral-300">{new Date(r.when).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="px-3 py-2 font-mono text-neutral-300">{r.ip}</td>
                <td className="px-3 py-2 text-neutral-300">{r.location || '—'}</td>
                <td className="max-w-48 truncate px-3 py-2 text-neutral-400" title={r.referrer}>{r.referrer || 'Direct'}</td>
                <td className="px-3 py-2 text-neutral-300">{r.seconds >= 60 ? `${Math.floor(r.seconds / 60)}m ${r.seconds % 60}s` : `${r.seconds}s`}</td>
                <td className="px-3 py-2 text-neutral-300">{r.visits}</td>
                <td className="max-w-80 px-3 py-2 text-neutral-400">{r.pages}</td>
                <td className="max-w-64 px-3 py-2 text-neutral-500">{r.clicks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length > 500 && <p className="mt-2 text-xs text-neutral-500">Showing the newest 500 — download the CSV for everything.</p>}
    </div>
  );
}
