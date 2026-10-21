import 'server-only';
import { isBlobConfigured, readJson, writeJson } from '@/lib/admin/store';
import { parseFeed } from './parse';
import { enrich, selectFeed, type Selection } from './pick';
import { SOURCES } from './sources';
import type { CarItem } from './types';

const SNAPSHOT = 'cars/latest.json';

async function pull(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; yaakoveisenberger.com car feed)', accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 1800 },
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Pulls every source's feed in parallel; a site that is down is just skipped. */
async function live(): Promise<CarItem[]> {
  const now = Date.now();
  const batches = await Promise.all(
    SOURCES.map(async (s) => {
      const xml = await pull(s.feed);
      return xml ? parseFeed(xml, s) : [];
    }),
  );
  return batches.flat().map((r) => enrich(r, now)).filter((i): i is CarItem => i !== null);
}

export interface CarFeed extends Selection {
  updatedAt: string;
  stale: boolean;
}

/**
 * The feed for /cars. Pages that call this are cached for 30 minutes (ISR). If every site is unreachable, the last good
 * snapshot saved in the private Blob store is shown instead, so the page is never empty.
 */
export async function loadCarFeed(): Promise<CarFeed> {
  const now = Date.now();
  const items = await live();
  if (items.length >= 3) {
    if (isBlobConfigured) writeJson(SNAPSHOT, { savedAt: now, items }).catch(() => {});
    return { ...selectFeed(items, now), updatedAt: new Date(now).toISOString(), stale: false };
  }
  const snap = await readJson<{ savedAt: number; items: CarItem[] }>(SNAPSHOT);
  if (snap?.items?.length) return { ...selectFeed(snap.items, snap.savedAt), updatedAt: new Date(snap.savedAt).toISOString(), stale: true };
  return { thisWeek: [], earlier: [], updatedAt: new Date(now).toISOString(), stale: true };
}
