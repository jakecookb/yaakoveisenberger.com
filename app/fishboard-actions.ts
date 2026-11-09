'use server';

import { randomBytes } from 'node:crypto';
import { adminEmails, clientIp } from '@/lib/admin/session';
import { putFile, writeJson } from '@/lib/admin/store';
import { cleanEmail, cleanName, cleanPhone } from '@/lib/access/visitor';
import { sendEmail } from '@/lib/email/send';
import { boardToCustomer, boardToOwner } from '@/lib/email/templates';
import { cleanDesign, describe, price } from '@/lib/fishboard/model';

const hits = new Map<string, { n: number; t: number }>();
const text = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
const JPEG = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * A customer sends the board they designed. The design is rebuilt and priced here (nothing the browser says about price is
 * trusted); the picture they saw is checked to be a real, small JPEG, saved, and emailed to the owner with the details under it.
 */
export async function requestBoard(input: Record<string, unknown>, image: string): Promise<{ ok: boolean; error?: string }> {
  if (text(input.website, 10)) return { ok: true }; // honeypot
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
  const message = text(input.message, 2000);

  const m = typeof image === 'string' && image.length < 1_400_000 ? JPEG.exec(image) : null;
  const bytes = m ? Buffer.from(m[1], 'base64') : null;
  if (!bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8) return { ok: false, error: 'The board picture didn’t come through — please try again.' };

  const design = cleanDesign(input.design);
  const info = { name, email, phone, date, message, rows: describe(design), price: price(design) };
  const id = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  await Promise.all([
    putFile(`site/quotes/board-${id}.jpg`, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, 'image/jpeg', true),
    writeJson(`site/quotes/board-${id}.json`, { ...info, design, at: new Date().toISOString() }),
  ]).catch(() => {});

  const attachments = [{ filename: 'fish-board.jpg', content: m![1], contentId: 'board' }];
  const owner = adminEmails[0];
  const [toOwner] = await Promise.all([
    owner ? sendEmail({ to: owner, replyTo: email, attachments, ...boardToOwner(info) }) : Promise.resolve(false),
    sendEmail({ to: email, replyTo: owner, attachments, ...boardToCustomer(info) }),
  ]);
  if (!toOwner) return { ok: false, error: 'Your design was saved, but the email didn’t go through — please also call or email directly.' };
  return { ok: true };
}
