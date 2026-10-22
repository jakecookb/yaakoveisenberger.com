import 'server-only';
import { cookies } from 'next/headers';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { isBlobConfigured, listPaths, readJson, removePath, writeJson } from '@/lib/admin/store';
import { isAdmin } from '@/lib/admin/session';

// A visitor asks for access with their name, email and phone. The request is a private blob
// (site/access/<id>.json); each signed-in browser keeps "<id>.<secret>" in a cookie and only hashes of
// the secrets are stored. A sign-in link emailed to the visitor signs in any other device (and proves the
// email is theirs). The admin approves per category or for everything.

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
  email?: string;
  phone?: string;
  /** Set once the visitor opened a sign-in link from their inbox. */
  emailVerifiedAt?: string;
  /** The first browser's secret (older records only have this one). */
  secretHash: string;
  /** Every other signed-in browser (most recent last, capped). */
  deviceHashes?: string[];
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
// One small index file per email address (named by its hash) points to that person's record.
const emailPath = (email: string) => `site/access-email/${sha(email)}.json`;
const MAX_DEVICES = 10;
const ID = /^[a-f0-9]{24}$/;

export function cleanName(raw: string) {
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** A plausible email address, lower-cased; null if it isn't one. */
export function cleanEmail(raw: string) {
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/.test(e) ? e : null;
}

/** Keeps digits, a leading +, and common separators; null unless there are 7–15 digits. */
export function cleanPhone(raw: string) {
  const p = raw.replace(/[^\d+()\-.\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 25);
  const digits = p.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 15 ? p : null;
}

/** Looks up the access record a visitor cookie value points to (null if missing, forged or unknown). */
export async function recordFromCookie(raw: string | undefined): Promise<AccessRequest | null> {
  if (!raw) return null;
  const [id, secret] = raw.split('.');
  if (!id || !secret || !ID.test(id)) return null;
  const rec = await readJson<AccessRequest>(recordPath(id));
  if (!rec) return null;
  const a = Buffer.from(sha(secret));
  const match = (h: string) => { const b = Buffer.from(h); return a.length === b.length && timingSafeEqual(a, b); };
  return [rec.secretHash, ...(rec.deviceHashes ?? [])].some(match) ? rec : null;
}

async function visitorRecord() {
  return recordFromCookie((await cookies()).get(VISITOR_COOKIE)?.value);
}

export const grants = (rec: AccessRequest | null, categoryId: string) => Boolean(rec && (rec.all || rec.granted.includes(categoryId)));

export type AccessState = 'none' | 'pending' | 'approved' | 'denied';
export interface AccessInfo {
  state: AccessState;
  name?: string;
  /** The signed-in visitor already gave their email (so the form only needs a button). */
  hasEmail?: boolean;
  /** Declined only: when the visitor may ask again (ISO). */
  retryAt?: string;
}

function stateFrom(rec: AccessRequest | null, categoryId: string): AccessInfo {
  if (!rec) return { state: 'none' };
  return { ...stateOnly(rec, categoryId), hasEmail: Boolean(rec.email) };
}

function stateOnly(rec: AccessRequest, categoryId: string): AccessInfo {
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

export interface Contact { name: string; email: string; phone: string }
export type RequestResult =
  | { ok: true; signedIn: boolean; record: AccessRequest; emailTo?: string; existingEmail?: boolean }
  | { ok: false; error: string };

function addCategory(rec: AccessRequest, categoryId: string): string | null {
  const info = stateFrom(rec, categoryId);
  if (info.state === 'denied' && info.retryAt && new Date(info.retryAt).getTime() > Date.now()) {
    const mins = Math.max(1, Math.ceil((new Date(info.retryAt).getTime() - Date.now()) / 60_000));
    return `Declined. You can ask again in ${mins} minute${mins === 1 ? '' : 's'}.`;
  }
  if (!rec.requested.includes(categoryId) && !rec.granted.includes(categoryId) && !rec.all) rec.requested.push(categoryId);
  rec.denied = rec.denied.filter((c) => c !== categoryId);
  if (rec.deniedAt) delete rec.deniedAt[categoryId];
  return null;
}

async function recordByEmail(email: string) {
  const idx = await readJson<{ id: string }>(emailPath(email));
  return idx && ID.test(idx.id) ? readJson<AccessRequest>(recordPath(idx.id)) : null;
}

/** Signs this browser in to a record: a new secret, its hash stored alongside the others. */
async function signInBrowser(rec: AccessRequest) {
  const secret = randomBytes(24).toString('base64url');
  rec.deviceHashes = [...(rec.deviceHashes ?? []), sha(secret)].slice(-MAX_DEVICES);
  (await cookies()).set(VISITOR_COOKIE, `${rec.id}.${secret}`, visitorCookieOptions());
}

/**
 * A visitor asks for a box. Three cases:
 *  - this browser is already signed in: the box is added to their record (contact details filled in if missing);
 *  - the email belongs to someone already registered: the box is added, but this browser is NOT signed in —
 *    only the emailed link can do that (otherwise anyone could type someone else's email and get their access);
 *  - a new person: a record is created and this browser is signed in to it.
 */
export async function createOrUpdateRequest(contact: Partial<Contact>, categoryId: string): Promise<RequestResult> {
  if (!isBlobConfigured) return { ok: false, error: 'Access requests are not set up yet.' };
  const now = new Date().toISOString();
  const current = await visitorRecord();
  const email = contact.email ? cleanEmail(contact.email) : null;
  const phone = contact.phone ? cleanPhone(contact.phone) : null;

  if (current) {
    const err = addCategory(current, categoryId);
    if (err) return { ok: false, error: err };
    if (!current.email) {
      // Older records were name-only: ask for the contact details once.
      if (!email) return { ok: false, error: 'Please enter a valid email address.' };
      if (!phone) return { ok: false, error: 'Please enter a valid phone number.' };
      const other = await recordByEmail(email);
      if (other && other.id !== current.id) return { ok: false, error: 'That email is already registered — use “Sign in” instead.' };
      current.email = email;
      current.phone = phone;
      await writeJson(emailPath(email), { id: current.id });
    }
    current.updatedAt = now;
    await writeJson(recordPath(current.id), current);
    return { ok: true, signedIn: true, record: current, emailTo: current.email };
  }

  const name = cleanName(contact.name ?? '');
  if (name.length < 2) return { ok: false, error: 'Please type your name.' };
  if (!email) return { ok: false, error: 'Please enter a valid email address.' };
  if (!phone) return { ok: false, error: 'Please enter a valid phone number.' };

  const known = await recordByEmail(email);
  if (known) {
    const err = addCategory(known, categoryId);
    if (err) return { ok: false, error: err };
    known.updatedAt = now;
    await writeJson(recordPath(known.id), known);
    return { ok: true, signedIn: false, record: known, emailTo: email, existingEmail: true };
  }

  if ((await listPaths(PREFIX, MAX_REQUESTS + 1)).length > MAX_REQUESTS) return { ok: false, error: 'Too many open requests right now. Please try again later.' };
  const id = randomBytes(12).toString('hex');
  const secret = randomBytes(24).toString('base64url');
  const rec: AccessRequest = { id, name, email, phone, secretHash: sha(secret), requested: [categoryId], granted: [], denied: [], all: false, createdAt: now, updatedAt: now };
  await writeJson(recordPath(id), rec);
  await writeJson(emailPath(email), { id });
  (await cookies()).set(VISITOR_COOKIE, `${id}.${secret}`, visitorCookieOptions());
  return { ok: true, signedIn: true, record: rec, emailTo: email };
}

/** "Sign in" with just an email: finds the record (if any) so a link can be sent. Never says whether it exists. */
export const findByEmail = async (raw: string) => {
  const email = cleanEmail(raw);
  return email ? recordByEmail(email) : null;
};

// ---- sign-in links ----

export const LINK_HOURS = 24;
const linkKey = () => new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET ?? '');

/** A signed link that signs any browser in to this record. `ver` ties it to the record's email at the time. */
export async function signInToken(rec: AccessRequest, next?: string) {
  return new SignJWT({ next: next ?? '', em: sha(rec.email ?? '').slice(0, 16) })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(rec.id)
    .setAudience('visitor-sign-in')
    .setIssuedAt()
    .setExpirationTime(`${LINK_HOURS}h`)
    .sign(linkKey());
}

/** Opens a sign-in link: signs this browser in and marks the email as confirmed. Returns where to go next. */
export async function redeemSignIn(token: string): Promise<{ ok: true; next: string } | { ok: false }> {
  if ((process.env.ADMIN_SESSION_SECRET ?? '').length < 32) return { ok: false };
  try {
    const { payload } = await jwtVerify(token, linkKey(), { algorithms: ['HS256'], audience: 'visitor-sign-in' });
    const id = String(payload.sub ?? '');
    if (!ID.test(id)) return { ok: false };
    const rec = await readJson<AccessRequest>(recordPath(id));
    if (!rec || payload.em !== sha(rec.email ?? '').slice(0, 16)) return { ok: false };
    rec.emailVerifiedAt ??= new Date().toISOString();
    await signInBrowser(rec);
    rec.updatedAt = new Date().toISOString();
    await writeJson(recordPath(id), rec);
    const next = typeof payload.next === 'string' && /^[a-z0-9-]{1,40}$/.test(payload.next) ? payload.next : '';
    return { ok: true, next };
  } catch {
    return { ok: false };
  }
}

// ---- admin side ----

export async function listRequests(): Promise<AccessRequest[]> {
  if (!isBlobConfigured) return [];
  const paths = await listPaths(PREFIX, MAX_REQUESTS);
  const recs = await Promise.all(paths.map((p) => readJson<AccessRequest>(p)));
  return recs.filter((r): r is AccessRequest => Boolean(r)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Applies a change and saves it; returns the saved record, or null if nothing changed (or it doesn't exist). */
export async function updateRequest(id: string, fn: (r: AccessRequest) => void): Promise<AccessRequest | null> {
  if (!ID.test(id)) return null;
  const rec = await readJson<AccessRequest>(recordPath(id));
  if (!rec) return null;
  const before = JSON.stringify(rec);
  fn(rec);
  if (JSON.stringify(rec) === before) return null;
  rec.updatedAt = new Date().toISOString();
  await writeJson(recordPath(id), rec);
  return rec;
}

export async function deleteRequest(id: string) {
  if (!ID.test(id)) return;
  const rec = await readJson<AccessRequest>(recordPath(id));
  if (rec?.email) await removePath(emailPath(rec.email)).catch(() => {});
  await removePath(recordPath(id));
}

export async function getRequest(id: string) {
  return ID.test(id) ? readJson<AccessRequest>(recordPath(id)) : null;
}
