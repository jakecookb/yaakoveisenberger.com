'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/session';
import { cleanEmail } from '@/lib/access/visitor';
import { sendEmail } from '@/lib/email/send';
import { deleteMail, getMail, newMailId, saveSent, setRead, splitAddress, decodeHeader } from '@/lib/mail/store';
import { siteUrl } from '@/lib/site/url';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const domain = () => new URL(siteUrl()).hostname.replace(/^www\./, '');

export async function markReadAction(id: string, read: boolean) {
  await requireAdmin();
  await setRead(id, read);
  revalidatePath('/admin/inbox');
}

export async function deleteMailAction(id: string) {
  await requireAdmin();
  await deleteMail(id);
  revalidatePath('/admin/inbox');
  redirect('/admin/inbox');
}

/**
 * Replies to a message. It goes out from the address the email was sent to (e.g. info@…), to the sender's reply-to
 * address (as the browser read it from the message) or their From address, threaded under the original.
 */
export async function replyAction(input: { id: string; replyTo?: string; body: string; quote?: string }): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const m = await getMail(input.id);
  if (!m) return { ok: false, error: 'That email no longer exists.' };
  const body = String(input.body ?? '').trim().slice(0, 20_000);
  if (!body) return { ok: false, error: 'Write a reply first.' };
  const to = cleanEmail(String(input.replyTo ?? '')) ?? cleanEmail(splitAddress(m.fromHeader || m.from).email) ?? cleanEmail(m.from);
  if (!to) return { ok: false, error: 'Could not find an address to reply to.' };
  const own = m.to.toLowerCase().endsWith('@' + domain()) ? m.to.toLowerCase() : `info@${domain()}`;
  const subject0 = decodeHeader(m.subject) || '(no subject)';
  const subject = /^re:/i.test(subject0) ? subject0 : `Re: ${subject0}`;
  const quote = String(input.quote ?? '').slice(0, 20_000);
  const who = decodeHeader(m.fromHeader || m.from);
  const text = `${body}\n\n${quote ? `On ${m.date}, ${who} wrote:\n${quote.split('\n').map((l) => `> ${l}`).join('\n')}` : ''}`.trim();
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;white-space:pre-wrap">${esc(body)}</div>${quote ? `<br><div style="color:#666;font-size:13px">On ${esc(m.date)}, ${esc(who)} wrote:</div><blockquote style="margin:6px 0 0;padding-left:12px;border-left:3px solid #ddd;color:#555;white-space:pre-wrap;font-size:13px">${esc(quote)}</blockquote>` : ''}`;
  const headers: Record<string, string> = m.messageId ? { 'In-Reply-To': m.messageId, References: m.messageId } : {};
  const ok = await sendEmail({ from: `Yaakov Eisenberger <${own}>`, to, subject, text, html, headers });
  if (!ok) return { ok: false, error: 'The reply could not be sent. Try again, or reply from your email app.' };
  await saveSent({ id: newMailId(), to, from: own, subject, text: body, inReplyTo: m.id, at: new Date().toISOString() });
  await setRead(m.id, true);
  revalidatePath('/admin/inbox');
  return { ok: true };
}
