'use server';

import { randomBytes } from 'node:crypto';
import { adminEmails, clientIp } from '@/lib/admin/session';
import { writeJson } from '@/lib/admin/store';
import { cleanEmail, cleanName, cleanPhone } from '@/lib/access/visitor';
import { sendEmail } from '@/lib/email/send';
import { quoteToCustomer, quoteToOwner } from '@/lib/email/templates';

const BOARDS: Record<string, string> = { fishboards: 'Fish Boards', meatboards: 'Meat Boards', events: 'Events', photography: 'Photography' };
const hits = new Map<string, { n: number; t: number }>();
const text = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);

/** A visitor asks for a board quote: the owner gets the details (reply goes to the customer) and the customer a confirmation. */
export async function requestQuote(input: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  if (text(input.website, 10)) return { ok: true }; // honeypot
  const board = BOARDS[text(input.board, 20)];
  if (!board) return { ok: false, error: 'Please choose a category.' };
  const ip = await clientIp();
  const h = hits.get(ip);
  if (h && Date.now() - h.t < 15 * 60_000 && h.n >= 4) return { ok: false, error: 'Too many requests — please try again in a few minutes.' };
  hits.set(ip, h && Date.now() - h.t < 15 * 60_000 ? { n: h.n + 1, t: h.t } : { n: 1, t: Date.now() });
  const name = cleanName(text(input.name, 80));
  const email = cleanEmail(text(input.email, 254));
  const phone = cleanPhone(text(input.phone, 30));
  if (name.length < 2) return { ok: false, error: 'Please enter your name.' };
  if (!email) return { ok: false, error: 'Please enter a valid email address.' };
  if (!phone) return { ok: false, error: 'Please enter a valid phone number.' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text(input.date, 10)) ? text(input.date, 10) : '';
  const q = { board, name, email, phone, date, guests: text(input.guests, 6).replace(/\D/g, ''), message: text(input.message, 2000) };
  await writeJson(`site/quotes/${Date.now()}-${randomBytes(4).toString('hex')}.json`, { ...q, at: new Date().toISOString() }).catch(() => {});
  const owner = adminEmails[0];
  const [toOwner] = await Promise.all([
    owner ? sendEmail({ to: owner, replyTo: email, ...quoteToOwner(q) }) : Promise.resolve(false),
    sendEmail({ to: email, replyTo: owner, ...quoteToCustomer(q) }),
  ]);
  if (!toOwner) return { ok: false, error: 'Your request was saved, but the email didn’t go through — please also call or email directly.' };
  return { ok: true };
}
