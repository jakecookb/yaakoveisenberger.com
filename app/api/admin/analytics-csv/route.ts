import { isAdmin } from '@/lib/admin/session';
import { loadVisits } from '@/lib/analytics/store';
import { rows } from '@/lib/analytics/summary';

export const dynamic = 'force-dynamic';

const cell = (v: string | number) => { const s = String(v); const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response('Not allowed', { status: 401 });
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get('days')) || 30));
  const data = rows(await loadVisits(days, 20_000));
  const head = ['When (UTC)', 'IP', 'Location', 'Referrer', 'Seconds on site', 'Pages', 'Clicks', 'Visits by this visitor', 'Visitor ID', 'Device'];
  const body = data.map((r) => [r.when, r.ip, r.location, r.referrer, r.seconds, r.pages, r.clicks, r.visits, r.visitor, r.device].map(cell).join(','));
  return new Response('﻿' + [head.join(','), ...body].join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="yaakoveisenberger-analytics-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'private, no-store' },
  });
}
