import 'server-only';
import { isBlobConfigured, readJson, writeJson } from '@/lib/admin/store';
import { cached } from '@/lib/news/cache';
import { parseFeed } from '@/lib/cars/parse';
import type { CarItem } from '@/lib/cars/types';
import { enrichTech, selectTech, type TechSelection } from './pick';
import { SOURCES } from './sources';

/** Backups are written at most every 30 minutes (each write is a storage operation). */
let lastSaved = 0;
const SNAPSHOT = 'tech/latest.json';

async function pull(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; yaakoveisenberger.com tech feed)', accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 1800 },
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

export interface TechFeed extends TechSelection {
  updatedAt: string;
  stale: boolean;
}

/** Same approach as the car feed: pages are cached for 30 minutes; if every site is down the last saved list is shown. */
export async function loadTechFeed(): Promise<TechFeed> {
  const now = Date.now();
  const fresh = await cached<TechFeed>('news-cache/tech-feed.json', 20 * 60_000, async () => {
    const batches = await Promise.all(SOURCES.map(async (s) => { const xml = await pull(s.feed); return xml ? parseFeed(xml, s) : []; }));
    const items = batches.flat().map((r) => enrichTech(r, now)).filter((i): i is CarItem => i !== null);
    if (items.length < 3) return null;
    if (isBlobConfigured && now - lastSaved > 6 * 3600_000) { lastSaved = now; writeJson(SNAPSHOT, { savedAt: now, items }).catch(() => {}); }
    return { ...selectTech(items, now), updatedAt: new Date(now).toISOString(), stale: false };
  });
  if (fresh) return fresh;
  const snap = await readJson<{ savedAt: number; items: CarItem[] }>(SNAPSHOT);
  if (snap?.items?.length) return { ...selectTech(snap.items, snap.savedAt), updatedAt: new Date(snap.savedAt).toISOString(), stale: true };
  return { samsung: [], apple: [], more: [], updatedAt: new Date(now).toISOString(), stale: true };
}
