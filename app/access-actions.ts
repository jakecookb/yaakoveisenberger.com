'use server';

import { clientIp } from '@/lib/admin/session';
import { createOrUpdateRequest, findByEmail, LINK_HOURS, signInToken, type AccessRequest } from '@/lib/access/visitor';
import { sendEmail } from '@/lib/email/send';
import { signInEmail } from '@/lib/email/templates';
import { loadSettings } from '@/lib/site/load';
import { resolveCards } from '@/lib/site/settings';
import { siteUrl } from '@/lib/site/url';

const recent = new Map<string, { n: number; first: number }>();
/** Simple per-key limiter (per server instance). */
function tooMany(key: string, max: number, windowMs: number) {
  const r = recent.get(key);
  if (recent.size > 5000) recent.clear();
  if (!r || Date.now() - r.first > windowMs) { recent.set(key, { n: 1, first: Date.now() }); return false; }
  return ++r.n > max;
}

export interface RequestReply { ok: boolean; error?: string; sentTo?: string; emailed?: boolean }

async function lockableTitle(categoryId: string) {
  return resolveCards(await loadSettings(), { includeHidden: true }).find((c) => c.id === categoryId && c.lockable)?.title;
}

async function emailLink(rec: AccessRequest, categoryId: string, box?: string) {
  if (!rec.email || tooMany(`mail:${rec.email}`, 4, 60 * 60_000)) return false; // at most 4 links an hour per address
  const link = `${siteUrl()}/access/verify?t=${await signInToken(rec, categoryId)}`;
  return sendEmail({ to: rec.email, ...signInEmail({ name: rec.name, link, box, hours: LINK_HOURS }) });
}

/** A visitor asks for access to one locked box with their name, email and phone. A sign-in link is emailed to them. */
export async function requestAccess(input: { name?: string; email?: string; phone?: string }, categoryId: string, website: string): Promise<RequestReply> {
  if (website) return { ok: true }; // honeypot: bots fill hidden fields
  const box = await lockableTitle(categoryId);
  if (!box) return { ok: false, error: 'That page can’t be requested.' };
  if (tooMany(`ip:${await clientIp()}`, 6, 10 * 60_000)) return { ok: false, error: 'Too many requests. Please try again in a few minutes.' };
  try {
    const res = await createOrUpdateRequest({ name: String(input.name ?? ''), email: String(input.email ?? ''), phone: String(input.phone ?? '') }, categoryId);
    if (!res.ok) return res;
    const emailed = res.emailTo ? await emailLink(res.record, categoryId, box) : false;
    return { ok: true, sentTo: res.emailTo, emailed };
  } catch {
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

/** Returning visitor on a new device: email them a sign-in link. Same answer whether or not the address is known. */
export async function signInByEmail(email: string, categoryId: string, website: string): Promise<RequestReply> {
  if (website) return { ok: true };
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(clean)) return { ok: false, error: 'Please enter a valid email address.' };
  if (tooMany(`ip:${await clientIp()}`, 6, 10 * 60_000)) return { ok: false, error: 'Too many requests. Please try again in a few minutes.' };
  try {
    const rec = await findByEmail(clean);
    const emailed = rec ? await emailLink(rec, categoryId, await lockableTitle(categoryId)) : true;
    return { ok: true, sentTo: clean, emailed };
  } catch {
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}
