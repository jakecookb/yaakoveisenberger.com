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
const PREFIX = 'site/access/';
const MAX_REQUESTS = 500;

export interface AccessRequest {
  id: string;
  name: string;
  secretHash: string;
  requested: string[];
  granted: string[];
  denied: string[];
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

export async function accessState(categoryId: string): Promise<{ state: AccessState; name?: string }> {
  if (await isAdmin()) return { state: 'approved' };
  const rec = await visitorRecord();
  if (!rec) return { state: 'none' };
  if (rec.all || rec.granted.includes(categoryId)) return { state: 'approved', name: rec.name };
  if (rec.denied.includes(categoryId)) return { state: 'denied', name: rec.name };
  if (rec.requested.includes(categoryId)) return { state: 'pending', name: rec.name };
  return { state: 'none', name: rec.name };
}

export const hasAccess = async (categoryId: string) => (await accessState(categoryId)).state === 'approved';

export async function createOrUpdateRequest(name: string | null, categoryId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isBlobConfigured) return { ok: false, error: 'Access requests are not set up yet.' };
  const existing = await visitorRecord();
  const now = new Date().toISOString();
  if (existing) {
    if (!existing.requested.includes(categoryId) && !existing.granted.includes(categoryId) && !existing.all) existing.requested.push(categoryId);
    existing.denied = existing.denied.filter((c) => c !== categoryId);
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
  (await cookies()).set(VISITOR_COOKIE, `${id}.${secret}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
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
