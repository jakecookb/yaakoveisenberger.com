import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify, SignJWT } from 'jose';
import { fingerprint, verifyPassword } from './password';
import { isBlobConfigured, readJson } from './store';

/** `next dev` on your own machine (never on Vercel): /admin/dev-login signs in as admin with no key. */
export const LOCAL_DEV = process.env.NODE_ENV === 'development' && !process.env.VERCEL;
/** /admin/dev-login?key=<ADMIN_BYPASS_KEY> signs in as admin wherever the key is set (32+ chars). Off unless set. */
export const BYPASS_KEY = (process.env.ADMIN_BYPASS_KEY ?? '').length >= 32 ? process.env.ADMIN_BYPASS_KEY! : '';
const SECRET = process.env.ADMIN_SESSION_SECRET || (LOCAL_DEV ? 'local-dev-only-session-secret-not-for-production' : '');
const IS_PROD = process.env.NODE_ENV === 'production';
export const ADMIN_COOKIE = IS_PROD ? '__Host-ve_admin' : 've_admin';
const MAX_AGE = 60 * 60 * 24 * 7;

export const CREDENTIAL_PATH = 'site/admin.json';

/** One or more admin emails, comma-separated in ADMIN_EMAIL. */
export const adminEmails = (process.env.ADMIN_EMAIL ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export const isAdminConfigured = Boolean(SECRET.length >= 32 && ((adminEmails.length && process.env.ADMIN_PASSWORD_HASH) || LOCAL_DEV || BYPASS_KEY));

/** Password hash in effect: one saved from the admin area wins over the env var. */
async function currentHash(): Promise<string> {
  const saved = isBlobConfigured ? await readJson<{ hash?: string }>(CREDENTIAL_PATH) : null;
  return saved?.hash || process.env.ADMIN_PASSWORD_HASH || '';
}

const key = () => new TextEncoder().encode(SECRET);

export async function checkCredentials(email: string, password: string): Promise<boolean> {
  if (!isAdminConfigured) return false;
  const hash = await currentHash();
  const passwordOk = await verifyPassword(password, hash);
  const emailOk = adminEmails.includes(email.trim().toLowerCase());
  return passwordOk && emailOk;
}

export const isAdminEmail = (email: string) => adminEmails.includes(email.trim().toLowerCase());

export async function startAdminSession() {
  const hash = await currentHash();
  const token = await new SignJWT({ pv: fingerprint(hash) })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('admin')
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(ADMIN_COOKIE, token, { httpOnly: true, secure: IS_PROD, sameSite: 'lax', path: '/', maxAge: MAX_AGE });
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** Verifies an admin session token (changing the password signs every session out). */
export async function isAdminToken(token: string | undefined): Promise<boolean> {
  if (!isAdminConfigured || !token) return false;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'], subject: 'admin' });
    return payload.pv === fingerprint(await currentHash());
  } catch {
    return false;
  }
}

/** True when the request carries a valid admin session. */
export async function isAdmin(): Promise<boolean> {
  return isAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin/login');
}

/** Same-origin check for route handlers that accept a POST (defence in depth on top of SameSite=Lax). */
export async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get('origin');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Best-effort brute-force limiter (per server instance; the scrypt cost and delay do the rest).
const attempts = new Map<string, { n: number; first: number }>();
export function loginBlocked(ip: string) {
  const a = attempts.get(ip);
  return Boolean(a && Date.now() - a.first < 15 * 60_000 && a.n >= 5);
}
export function recordLogin(ip: string, ok: boolean) {
  if (ok) return void attempts.delete(ip);
  const a = attempts.get(ip);
  if (!a || Date.now() - a.first > 15 * 60_000) attempts.set(ip, { n: 1, first: Date.now() });
  else a.n += 1;
}
export async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
}
