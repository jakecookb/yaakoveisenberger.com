import type { VisitRecord } from './store';

/** One row per visit, with the visitor's total visit count and what they clicked — shared by the admin table and the CSV. */
export function rows(visits: VisitRecord[]) {
  const count = new Map<string, number>();
  for (const v of visits) count.set(v.vid, (count.get(v.vid) ?? 0) + 1);
  return visits.map((v) => ({
    when: v.start, ip: v.ip, location: [v.city, v.region, v.country].filter(Boolean).join(', '), referrer: v.referrer,
    seconds: Math.round(v.pages.reduce((s, p) => s + p.ms, 0) / 1000), pages: v.pages.map((p) => `${p.path} (${Math.round(p.ms / 1000)}s)`).join(' → '),
    clicks: v.clicks.map((c) => c.target).filter(Boolean).join(', '), visits: count.get(v.vid) ?? 1, visitor: v.vid, device: /mobile|iphone|android/i.test(v.ua) ? 'Mobile' : 'Desktop',
  }));
}
export type Row = ReturnType<typeof rows>[number];

/** Which cards/tools people opened from the hub (clicks on links to site sections). */
export function interest(visits: VisitRecord[]) {
  const m = new Map<string, number>();
  for (const v of visits) for (const c of v.clicks) if (/^\/[a-z0-9-]+\/?$/.test(c.target) || c.target.startsWith('/access/')) m.set(c.target.replace('/access/', '/'), (m.get(c.target.replace('/access/', '/')) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
