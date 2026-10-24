import 'server-only';
import { isAdminToken } from '@/lib/admin/session';
import { categories } from '@/data/navigation';
import { readJsonStrict } from '@/lib/admin/store';
import { SETTINGS_PATH } from '@/lib/site/load';
import { defaultSettings, resolveCards, sanitizeSettings, settingsSchema } from '@/lib/site/settings';
import { grants, recordFromCookie } from './visitor';

// Used by proxy.ts: decides, for each request to a locked box, whether this browser may go in.
// Short in-memory caches keep this cheap (the Cookbook loads many files per page); a lock, unlock or
// revoke takes effect within a few seconds.

const TTL = 60_000;
const memo = new Map<string, { v: unknown; exp: number }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && hit.exp > Date.now()) return hit.v as T;
  const v = await fn();
  if (memo.size > 500) memo.clear();
  memo.set(key, { v, exp: Date.now() + TTL });
  return v;
}

/**
 * Path prefix -> box id, for every locked box that lives on this site (built-in pages, /p/<id> pages and /go/<id> links).
 * If the settings can't be read the gate fails CLOSED: every lockable built-in page, and all of /p and /go, are
 * treated as locked (id "*", admin only) rather than letting everyone in.
 */
export const lockedPaths = () =>
  cached('locked', async () => {
    const out = new Map<string, string>();
    try {
      const raw = await readJsonStrict<unknown>(SETTINGS_PATH);
      const parsed = raw ? settingsSchema.safeParse(raw) : null;
      if (raw && !parsed?.success) throw new Error('settings unreadable');
      for (const c of resolveCards(parsed?.success ? sanitizeSettings(parsed.data) : defaultSettings(), { includeHidden: true })) if (c.locked && c.href.startsWith('/')) out.set(c.href, c.id);
    } catch {
      out.clear();
      // Funding stays open in this case: a storage outage must not take donations offline.
      for (const c of categories) if (c.lockable && c.id !== 'fund') out.set(c.href, '*');
      out.set('/p', '*');
      out.set('/go', '*');
    }
    return out;
  });

/** Who may enter a locked box: the owner, an approved visitor, or nobody. */
export async function mayEnter(id: string, visitorCookie: string | undefined, adminCookie: string | undefined): Promise<'admin' | 'visitor' | null> {
  if (adminCookie && (await cached(`admin:${adminCookie}`, () => isAdminToken(adminCookie)))) return 'admin';
  if (!visitorCookie || id === '*') return null; // "*" = settings unreadable: admin only
  // A "yes" is remembered for a minute; a "no" only for a few seconds, so a fresh approval lets them in right away.
  const key = `visitor:${visitorCookie}:${id}`;
  const ok = await cached(key, async () => grants(await recordFromCookie(visitorCookie), id));
  if (!ok) memo.set(key, { v: false, exp: Date.now() + 3_000 });
  return ok ? 'visitor' : null;
}
