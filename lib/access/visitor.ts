import 'server-only';
import { cookies } from 'next/headers';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { list, del } from '@vercel/blob';
import { isBlobConfigured, readJson, writeJson } from '@/lib/admin/store';
import { isAdmin } from '@/lib/admin/session';

// A visitor asks for access by typing their name. The request is a private blob
// (site/access/<id>.json); the visitor's browser keeps "<id>.<secret>" in a cookie and only the
// hash of the secret is stored. The admin approves per category or for everything.

export const VISITOR_COOKIE = 've_visitor';
/** About 13 months: the longest a browser will keep a cookie (Chrome caps it at 400 days). Renewed on every visit. */
export const VISITOR_MAX_AGE = 60 * 60 * 24 * 400;
export const visitorCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: VISITOR_MAX_AGE,
});

/** An approved visitor's access never expires on our side; this keeps their browser's copy of it alive too. */
export async function renewVisitorCookie() {
  const store = await cookies();
  const value = store.get(VISITOR_COOKIE)?.value;
  if (value) store.set(VISITOR_COOKIE, value, visitorCookieOptions());
}
const PREFIX = 'site/access/';
const MAX_REQUESTS = 500;
/** After a decline, the same visitor has to wait this long before asking for that box again. */
export const RETRY_MINUTES = 25;

export interface AccessRequest {
  id: string;
  name: string;
  secretHash: string;
  requested: string[];
  granted: string[];
  denied: string[];
  /** When each box was declined (ISO). A visitor may ask again RETRY_MINUTES later. */
  deniedAt?: Record<string, string>;
  all: boolean;
  createdAt: string;
  updatedAt: string;
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const recordPath = (id: string) => `${PREFIX}${id}.json`;
const ID = /^[a-f0-9]{24}$/;

export function cleanName(raw: string) {
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** Looks up the access record a visitor cookie value points to (null if missing, forged or unknown). */
export async function recordFromCookie(raw: string | undefined): Promise<AccessRequest | null> {
  if (!raw) return null;
  const [id, secret] = raw.split('.');
  if (!id || !secret || !ID.test(id)) return null;
  const rec = await readJson<AccessRequest>(recordPath(id));
  if (!rec) return null;
  const a = Buffer.from(sha(secret));
  const b = Buffer.from(rec.secretHash);
  return a.length === b.length && timingSafeEqual(a, b) ? rec : null;
}

async function visitorRecord() {
  return recordFromCookie((await cookies()).get(VISITOR_COOKIE)?.value);
}

export const grants = (rec: AccessRequest | null, categoryId: string) => Boolean(rec && (rec.all || rec.granted.includes(categoryId)));

export type AccessState = 'none' | 'pending' | 'approved' | 'denied';
export interface AccessInfo {
  state: AccessState;
  name?: string;
  /** Declined only: when the visitor may ask again (ISO). */
  retryAt?: string;
}

function stateFrom(rec: AccessRequest | null, categoryId: string): AccessInfo {
  if (!rec) return { state: 'none' };
  if (rec.all || rec.granted.includes(categoryId)) return { state: 'approved', name: rec.name };
  if (rec.denied.includes(categoryId)) {
    const at = new Date(rec.deniedAt?.[categoryId] ?? rec.updatedAt).getTime();
    return { state: 'denied', name: rec.name, retryAt: new Date(at + RETRY_MINUTES * 60_000).toISOString() };
  }
  if (rec.requested.includes(categoryId)) return { state: 'pending', name: rec.name };
  return { state: 'none', name: rec.name };
}

export async function accessState(categoryId: string): Promise<AccessInfo> {
  if (await isAdmin()) return { state: 'approved' };
  return stateFrom(await visitorRecord(), categoryId);
}

/** Status of several boxes at once (one record read) — lets the home page label each locked box. */
export async function accessStates(ids: string[]): Promise<Record<string, AccessInfo>> {
  const admin = await isAdmin();
  const rec = admin ? null : await visitorRecord();
  return Object.fromEntries(ids.map((id) => [id, admin ? { state: 'approved' as const } : stateFrom(rec, id)]));
}

export const hasAccess = async (categoryId: string) => (await accessState(categoryId)).state === 'approved';

export async function createOrUpdateRequest(name: string | null, categoryId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isBlobConfigured) return { ok: false, error: 'Access requests are not set up yet.' };
  const existing = await visitorRecord();
  const now = new Date().toISOString();
  if (existing) {
    const info = stateFrom(existing, categoryId);
    if (info.state === 'denied' && info.retryAt && new Date(info.retryAt).getTime() > Date.now()) {
      const mins = Math.max(1, Math.ceil((new Date(info.retryAt).getTime() - Date.now()) / 60_000));
      return { ok: false, error: `Declined. You can ask again in ${mins} minute${mins === 1 ? '' : 's'}.` };
    }
    if (!existing.requested.includes(categoryId) && !existing.granted.includes(categoryId) && !existing.all) existing.requested.push(categoryId);
    existing.denied = existing.denied.filter((c) => c !== categoryId);
    if (existing.deniedAt) delete existing.deniedAt[categoryId];
    existing.updatedAt = now;
    await writeJson(recordPath(existing.id), existing);
    return { ok: true };
  }
  const clean = cleanName(name ?? '');
  if (clean.length < 2) return { ok: false, error: 'Please type your name.' };
  const { blobs } = await list({ prefix: PREFIX, limit: MAX_REQUESTS + 1 });
  if (blobs.length > MAX_REQUESTS) return { ok: false, error: 'Too many open requests right now. Please try again later.' };
  const id = randomBytes(12).toString('hex');
  const secret = randomBytes(24).toString('base64url');
  const rec: AccessRequest = { id, name: clean, secretHash: sha(secret), requested: [categoryId], granted: [], denied: [], all: false, createdAt: now, updatedAt: now };
  await writeJson(recordPath(id), rec);
  (await cookies()).set(VISITOR_COOKIE, `${id}.${secret}`, visitorCookieOptions());
  return { ok: true };
}

// ---- admin side ----

export async function listRequests(): Promise<AccessRequest[]> {
  if (!isBlobConfigured) return [];
  const { blobs } = await list({ prefix: PREFIX, limit: MAX_REQUESTS });
  const recs = await Promise.all(blobs.map((b) => readJson<AccessRequest>(b.pathname)));
  return recs.filter((r): r is AccessRequest => Boolean(r)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateRequest(id: string, fn: (r: AccessRequest) => void) {
  if (!ID.test(id)) return;
  const rec = await readJson<AccessRequest>(recordPath(id));
  if (!rec) return;
  fn(rec);
  rec.updatedAt = new Date().toISOString();
  await writeJson(recordPath(id), rec);
}

export async function deleteRequest(id: string) {
  if (ID.test(id)) await del(recordPath(id));
}
