import 'server-only';
import { listPaths, readJson } from '@/lib/admin/store';

export interface VisitRecord {
  id: string; vid: string; ip: string; country: string; region: string; city: string; ua: string; referrer: string;
  start: string; end: string; pages: { path: string; at: number; ms: number }[]; clicks: { path: string; target: string; at: number }[];
}

export const visitPath = (day: string, id: string) => `site/analytics/${day}/${id}.json`;

/** Visits from the last `days` days (newest first), up to `max`. */
export async function loadVisits(days: number, max = 3000): Promise<VisitRecord[]> {
  const paths: string[] = [];
  for (let d = 0; d < days && paths.length < max; d++) {
    const day = new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
    paths.push(...(await listPaths(`site/analytics/${day}/`, max - paths.length)));
  }
  const recs: VisitRecord[] = [];
  for (let i = 0; i < paths.length; i += 50) recs.push(...(await Promise.all(paths.slice(i, i + 50).map((p) => readJson<VisitRecord>(p)))).filter((r): r is VisitRecord => Boolean(r)));
  return recs.sort((a, b) => b.start.localeCompare(a.start));
}
