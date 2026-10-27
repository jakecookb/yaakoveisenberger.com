import 'server-only';
import { readJson, writeJson } from '@/lib/admin/store';

// A small shared cache for the news pages. Building a topic list means fetching and parsing a dozen feeds, and building a
// story means fetching a page, so neither is done on every visit: the result is kept in memory (per server instance) and in the
// site's store (shared), and rebuilt when it is older than `ttl`. If a rebuild fails, the last saved copy is served instead.

const mem = new Map<string, { at: number; v: unknown }>();

export async function cached<T>(key: string, ttl: number, make: () => Promise<T | null>): Promise<T | null> {
  const now = Date.now();
  const hit = mem.get(key);
  if (hit && now - hit.at < ttl) return hit.v as T;
  let saved: { at: number; v: T } | null = null;
  try { saved = await readJson<{ at: number; v: T }>(key); } catch { /* the store being unavailable only means a rebuild */ }
  if (saved && now - saved.at < ttl) { mem.set(key, saved); return saved.v; }
  const v = await make();
  if (v !== null) {
    if (mem.size > 300) mem.clear();
    mem.set(key, { at: now, v });
    try { await writeJson(key, { at: now, v }); } catch { /* served from memory this time */ }
    return v;
  }
  return saved?.v ?? null; // a failed rebuild falls back to the last good copy, however old
}
