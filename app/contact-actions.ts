'use server';

import { adminEmails, clientIp } from '@/lib/admin/session';
import { cleanEmail, cleanName, cleanPhone } from '@/lib/access/visitor';
import { sendEmail } from '@/lib/email/send';
import { esc, layout } from '@/lib/email/templates';

const INQUIRY_TYPES = ['General Inquiry', 'Product / Service Quote', 'Compliment', 'Complaint / Issue', 'Business / Collaboration Proposal'] as const;
const hits = new Map<string, { n: number; t: number }>();
const text = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);

/** Contact form: the owner gets the message (type in the subject, replies go to the sender); the sender gets a copy. */
export async function sendContact(input: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  if (text(input.website, 10)) return { ok: true };
  const type = INQUIRY_TYPES.find((t) => t === text(input.type, 60));
  const name = cleanName(text(input.name, 80));
  const email = cleanEmail(text(input.email, 254));
  const phone = text(input.phone, 30) ? cleanPhone(text(input.phone, 30)) : '';
  const subject = text(input.subject, 120).replace(/[\r\n]+/g, ' ');
  const message = text(input.message, 5000);
  if (!type) return { ok: false, error: 'Please choose an inquiry type.' };
  if (name.length < 2) return { ok: false, error: 'Please enter your name.' };
  if (!email) return { ok: false, error: 'Please enter a valid email address.' };
  if (phone === null) return { ok: false, error: 'That phone number doesn’t look right.' };
  if (subject.length < 2 || message.length < 5) return { ok: false, error: 'Please add a subject and a message.' };
  const ip = await clientIp();
  const h = hits.get(ip);
  if (h && Date.now() - h.t < 15 * 60_000 && h.n >= 5) return { ok: false, error: 'Too many messages — please try again in a few minutes.' };
  hits.set(ip, h && Date.now() - h.t < 15 * 60_000 ? { n: h.n + 1, t: h.t } : { n: 1, t: Date.now() });
  const owner = adminEmails[0];
  if (!owner) return { ok: false, error: 'Messages aren’t set up yet — please email directly.' };
  const rows = [['Type', type], ['Name', name], ['Email', email], ['Phone', phone || '—'], ['Subject', subject]];
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#737373;">${esc(k)}</td><td style="padding:4px 0;color:#e5e5e5;">${esc(v)}</td></tr>`).join('')}</table>`;
  const body = `<p style="margin:16px 0 0;white-space:pre-wrap;color:#e5e5e5;">${esc(message)}</p>`;
  const ok = await sendEmail({
    to: owner, replyTo: email,
    subject: `[${type}] ${subject} — ${name}`,
    html: layout({ preheader: `${type} from ${name}`, heading: `${type}`, body: table + body + '<p style="margin:16px 0 0;">Reply to this email to answer directly.</p>' }),
    text: `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${message}`,
  });
  if (!ok) return { ok: false, error: 'Your message couldn’t be sent right now — please email or call instead.' };
  await sendEmail({
    to: email, replyTo: owner,
    subject: `Got your message: ${subject}`,
    html: layout({ preheader: 'Thanks — your message is in', heading: `Thanks, ${name.split(' ')[0]}!`, body: `<p style="margin:0 0 14px;">Your message (“${esc(subject)}”) is in, and I’ll get back to you soon.</p><p style="margin:0;">Anything to add? Just reply to this email.</p>` }),
    text: `Thanks, ${name.split(' ')[0]}! Your message ("${subject}") is in — I'll get back to you soon. Reply to this email to add anything.`,
  });
  return { ok: true };
}
