import 'server-only';
import { isBlobConfigured, readJson, writeJson } from '@/lib/admin/store';
import { cached } from '@/lib/news/cache';
import { parseFeed } from '@/lib/cars/parse';
import { enrichWeapon, selectWeapons, type WeaponItem, type WeaponsSelection } from './pick';
import { SOURCES, type WeaponSource } from './sources';

/** Backups are written at most every 30 minutes (each write is a storage operation). */
let lastSaved = 0;
const SNAPSHOT = 'weapons/latest.json';

async function pull(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; yaakoveisenberger.com news feed)', accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 1800 },
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Google News headlines end in " - Publisher": show the publisher as the source, and skip off-topic matches. */
function fromSource(s: WeaponSource, xml: string, now: number): WeaponItem[] {
  return parseFeed(xml, s).flatMap((r) => {
    if (!s.gnews) {
      const e = enrichWeapon(r, now);
      return e ? [e] : [];
    }
    const m = r.title.match(/^(.*\S)\s+[-–]\s+([^-–]{2,60})$/);
    const title = m ? m[1] : r.title;
    if (!s.gnews.must.test(title) || !/\s/.test(title)) return [];
    const e = enrichWeapon({ ...r, title, excerpt: '', source: m ? m[2].trim() : 'Google News' }, now, s.gnews.tab);
    return e ? [e] : [];
  });
}

export interface WeaponsFeed extends WeaponsSelection {
  updatedAt: string;
  stale: boolean;
}

/** Same approach as the car feed: cached for 30 minutes; if every site is down, the last saved list is shown. */
export async function loadWeaponsFeed(): Promise<WeaponsFeed> {
  const now = Date.now();
  const fresh = await cached<WeaponsFeed>('news-cache/weapons-feed.json', 20 * 60_000, async () => {
    const batches = await Promise.all(SOURCES.map(async (s) => { const xml = await pull(s.feed); return xml ? fromSource(s, xml, now) : []; }));
    const items = batches.flat();
    if (items.length < 8) return null;
    if (isBlobConfigured && now - lastSaved > 6 * 3600_000) { lastSaved = now; writeJson(SNAPSHOT, { savedAt: now, items }).catch(() => {}); }
    return { ...selectWeapons(items), updatedAt: new Date(now).toISOString(), stale: false };
  });
  if (fresh) return fresh;
  const snap = await readJson<{ savedAt: number; items: WeaponItem[] }>(SNAPSHOT);
  if (snap?.items?.length) return { ...selectWeapons(snap.items), updatedAt: new Date(snap.savedAt).toISOString(), stale: true };
  return { handguns: [], longguns: [], knives: [], rights: [], updatedAt: new Date(now).toISOString(), stale: true };
}
