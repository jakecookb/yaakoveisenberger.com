import { headers } from 'next/headers';
import { clientIp } from '@/lib/admin/session';
import { isBlobConfigured, isLiveStore, writeJson } from '@/lib/admin/store';
import { visitPath, type VisitRecord } from '@/lib/analytics/store';

export const dynamic = 'force-dynamic';

const ID = /^[0-9]{6,20}$/;
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor/i;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
const geo = (v: string | null) => { try { return decodeURIComponent(v ?? '').slice(0, 60); } catch { return ''; } };

// Each visit is one storage write, so one address may send only a few a minute (keeps the free storage quota safe).
const hits = new Map<string, { n: number; t: number }>();
function tooMany(ip: string) {
  if (hits.size > 5000) hits.clear();
  const h = hits.get(ip);
  if (!h || Date.now() - h.t > 60_000) return void hits.set(ip, { n: 1, t: Date.now() }), false;
  return ++h.n > 6;
}

/** Receives one visit summary from the browser (see components/site/tracker.tsx) and stores it privately. */
export async function POST(req: Request) {
  const h = await headers();
  const ua = h.get('user-agent') ?? '';
  const raw = await req.text();
  if (!isBlobConfigured || !isLiveStore || raw.length > 64_000 || BOT.test(ua)) return new Response(null, { status: 204 });
  const ip = (await clientIp()).slice(0, 45);
  if (tooMany(ip)) return new Response(null, { status: 204 });
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  const id = str(b.id, 20), vid = str(b.vid, 20);
  if (!ID.test(id) || !ID.test(vid)) return new Response(null, { status: 400 });
  const pages = (Array.isArray(b.pages) ? b.pages : []).slice(-200).map((p: Record<string, unknown>) => ({ path: str(p?.path, 200), at: num(p?.at), ms: Math.min(num(p?.ms), 6 * 3_600_000) })).filter((p) => p.path.startsWith('/') && !p.path.startsWith('/admin'));
  if (!pages.length) return new Response(null, { status: 204 });
  const clicks = (Array.isArray(b.clicks) ? b.clicks : []).slice(-300).map((c: Record<string, unknown>) => ({ path: str(c?.path, 200), target: str(c?.target, 80), at: num(c?.at) }));
  const rec: VisitRecord = {
    id, vid,
    ip,
    country: geo(h.get('cf-ipcountry')), region: geo(h.get('cf-region')), city: geo(h.get('cf-ipcity')),
    ua: ua.slice(0, 200), referrer: str(b.referrer, 300),
    start: new Date(pages[0].at || Date.now()).toISOString(), end: new Date().toISOString(), pages, clicks,
  };
  await writeJson(visitPath(rec.start.slice(0, 10), id), rec).catch(() => {});
  return new Response(null, { status: 204 });
}
