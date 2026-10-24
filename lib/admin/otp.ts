import 'server-only';
import { cookies } from 'next/headers';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { isBlobConfigured, listPaths, readJson, removePath, writeJson } from './store';
import { sendWhatsAppCode } from './whatsapp';

// One-time codes for the second sign-in step and for password reset. A challenge is a private blob holding only
// hashes; the browser keeps "<id>.<secret>" in an HttpOnly cookie so a code can't be used from another browser.

export const CHALLENGE_COOKIE = 've_challenge';
const PREFIX = 'site/otp/';
const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_ACTIVE = 5; // bounds how many codes (and WhatsApp messages) anyone can trigger per 10 minutes

export type Purpose = 'login' | 'reset';
interface Challenge {
  id: string;
  purpose: Purpose;
  email: string;
  secretHash: string;
  codeHash: string;
  attempts: number;
  sentAt: number;
  exp: number;
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const path = (id: string) => `${PREFIX}${id}.json`;
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function current(): Promise<{ ch: Challenge; secret: string } | null> {
  const raw = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  const [id, secret] = (raw ?? '').split('.');
  if (!id || !secret || !/^[a-f0-9]{24}$/.test(id)) return null;
  const ch = await readJson<Challenge>(path(id));
  if (!ch || ch.exp < Date.now() || !same(sha(secret), ch.secretHash)) return null;
  return { ch, secret };
}

export async function activeChallenge(purpose: Purpose) {
  const c = await current();
  return c && c.ch.purpose === purpose ? c.ch : null;
}

/** Creates a challenge, sends the code over WhatsApp and binds it to this browser. */
export async function startChallenge(purpose: Purpose, email: string): Promise<'sent' | 'busy' | 'send-failed' | 'no-storage'> {
  if (!isBlobConfigured) return 'no-storage';
  const now = Date.now();
  const live: Challenge[] = [];
  for (const p of await listPaths(PREFIX, 100)) {
    const c = await readJson<Challenge>(p);
    if (c && c.exp > now) live.push(c);
    else await removePath(p).catch(() => {});
  }
  if (live.length >= MAX_ACTIVE) return 'busy';

  const id = randomBytes(12).toString('hex');
  const secret = randomBytes(24).toString('base64url');
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const ch: Challenge = { id, purpose, email, secretHash: sha(secret), codeHash: sha(`${id}:${code}`), attempts: 0, sentAt: now, exp: now + TTL_MS };
  if (!(await sendWhatsAppCode(code))) return 'send-failed';
  await writeJson(path(id), ch);
  (await cookies()).set(CHALLENGE_COOKIE, `${id}.${secret}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: TTL_MS / 1000,
  });
  return 'sent';
}

/** Checks a submitted code. Wrong guesses are counted and the challenge dies after five. */
export async function checkCode(purpose: Purpose, code: string): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const c = await current();
  if (!c || c.ch.purpose !== purpose) return { ok: false, error: 'This code has expired. Start again.' };
  const { ch } = c;
  if (ch.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'Too many wrong codes. Start again.' };
  const good = /^\d{6}$/.test(code.trim()) && same(sha(`${ch.id}:${code.trim()}`), ch.codeHash);
  if (!good) {
    ch.attempts += 1;
    await writeJson(path(ch.id), ch);
    return { ok: false, error: ch.attempts >= MAX_ATTEMPTS ? 'Too many wrong codes. Start again.' : 'That code is not right.' };
  }
  await removePath(path(ch.id)).catch(() => {});
  (await cookies()).delete({ name: CHALLENGE_COOKIE, path: '/admin' });
  return { ok: true, email: ch.email };
}
