'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/session';
import { sendBatch } from '@/lib/email/send';
import { broadcastEmail } from '@/lib/email/templates';
import { audience, isTopic, listSubscribers, unsubscribeLink } from '@/lib/subscribers';
import { siteUrl } from '@/lib/site/url';

export interface BroadcastState { ok?: boolean; error?: string; sent?: number; total?: number }

/** Sends an announcement to everyone interested in the chosen topic (plus "all updates" subscribers). */
export async function sendBroadcast(_prev: BroadcastState, form: FormData): Promise<BroadcastState> {
  await requireAdmin();
  const topic = String(form.get('topic'));
  const subject = String(form.get('subject') ?? '').trim().slice(0, 140);
  const body = String(form.get('body') ?? '').trim().slice(0, 20_000);
  const linkRaw = String(form.get('link') ?? '').trim();
  const link = linkRaw ? (linkRaw.startsWith('/') ? siteUrl() + linkRaw : /^https:\/\/[^\s<>"']+$/.test(linkRaw) ? linkRaw : '') : undefined;
  if (!isTopic(topic)) return { error: 'Choose who should get it.' };
  if (subject.length < 3 || body.length < 10) return { error: 'Add a subject and a message.' };
  if (linkRaw && !link) return { error: 'The link must start with https:// or /' };
  if (form.get('confirm') !== 'yes') return { error: 'Tick the box to confirm sending.' };
  const to = audience(await listSubscribers(), topic);
  if (!to.length) return { error: 'No subscribers for that topic yet.' };
  const sent = await sendBatch(to.map((s) => {
    const unsub = unsubscribeLink(s);
    return { to: s.email, ...broadcastEmail(subject, body, unsub, link), headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
  }));
  revalidatePath('/admin/broadcast');
  return sent ? { ok: true, sent, total: to.length } : { error: 'Nothing was sent — check the email settings (RESEND_API_KEY).' };
}
