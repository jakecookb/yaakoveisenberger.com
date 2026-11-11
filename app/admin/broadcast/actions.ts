'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/session';
import { sendBatch } from '@/lib/email/send';
import { broadcastEmail } from '@/lib/email/templates';
import { cleanEmail } from '@/lib/access/visitor';
import { recipientPool, type Recipient } from '@/lib/email/recipients';
import { audience, isTopic, listSubscribers, subscriberKey, unsubscribeLink } from '@/lib/subscribers';
import { site } from '@/lib/site/content';
import { siteUrl } from '@/lib/site/url';

export interface BroadcastState { ok?: boolean; error?: string; sent?: number; total?: number }

/** Sends an announcement to everyone interested in the chosen topic (plus "all updates" subscribers), or to the people ticked and any addresses typed in. */
export async function sendBroadcast(_prev: BroadcastState, form: FormData): Promise<BroadcastState> {
  await requireAdmin();
  const topic = String(form.get('topic'));
  const subject = String(form.get('subject') ?? '').trim().slice(0, 140);
  const body = String(form.get('body') ?? '').trim().slice(0, 20_000);
  const linkRaw = String(form.get('link') ?? '').trim();
  const link = linkRaw ? (linkRaw.startsWith('/') ? siteUrl() + linkRaw : /^https:\/\/[^\s<>"']+$/.test(linkRaw) ? linkRaw : '') : undefined;
  const picked = topic === 'pick';
  if (!picked && !isTopic(topic)) return { error: 'Choose who should get it.' };
  if (subject.length < 3 || body.length < 10) return { error: 'Add a subject and a message.' };
  if (linkRaw && !link) return { error: 'The link must start with https:// or /' };
  if (form.get('confirm') !== 'yes') return { error: 'Tick the box to confirm sending.' };
  // People: topic sends go to subscribers; "choose people" goes to whoever is ticked from everyone who ever signed up or asked for
  // access (matched by key against the real list), plus any addresses typed in.
  let people: Recipient[];
  const typed: string[] = [];
  if (picked) {
    const pool = await recipientPool();
    const keys = new Set(form.getAll('to').map(String));
    people = pool.filter((r) => keys.has(r.id));
    const bad: string[] = [];
    for (const raw of String(form.get('extra') ?? '').split(/[\s,;]+/).filter(Boolean)) {
      const e = cleanEmail(raw);
      if (!e) bad.push(raw.slice(0, 60));
      else if (!people.some((p) => p.email.toLowerCase() === e) && !typed.includes(e)) typed.push(e);
    }
    if (bad.length) return { error: `These don’t look like email addresses: ${bad.slice(0, 5).join(', ')}` };
    if (people.length + typed.length > 300) return { error: 'That’s a lot at once — send to 300 or fewer at a time.' };
    if (!people.length && !typed.length) return { error: 'Tick at least one person, or type an email address.' };
  } else {
    const subs = audience(await listSubscribers(), topic as Parameters<typeof audience>[1]);
    if (!subs.length) return { error: 'No subscribers for that topic yet.' };
    people = subs.map((s) => ({ id: subscriberKey(s.email), email: s.email, subscriber: s, why: '' }));
  }
  const mails = [
    ...people.map((r) => {
      if (r.subscriber) {
        const unsub = unsubscribeLink(r.subscriber);
        return { to: r.email, ...broadcastEmail(subject, body, unsub, link), headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
      }
      return { to: r.email, replyTo: site.email, ...broadcastEmail(subject, body, null, link) };
    }),
    ...typed.map((e) => ({ to: e, replyTo: site.email, ...broadcastEmail(subject, body, null, link, 'you’re getting this because I wrote to you from yaakoveisenberger.com') })),
  ];
  const sent = await sendBatch(mails);
  revalidatePath('/admin/broadcast');
  return sent ? { ok: true, sent, total: mails.length } : { error: 'Nothing was sent — check the email settings (RESEND_API_KEY).' };
}
