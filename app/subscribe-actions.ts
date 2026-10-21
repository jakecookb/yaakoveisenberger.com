'use server';

import { clientIp } from '@/lib/admin/session';
import { isBlobConfigured } from '@/lib/admin/store';
import { cleanEmail } from '@/lib/access/visitor';
import { sendEmail } from '@/lib/email/send';
import { welcomeSubscriber } from '@/lib/email/templates';
import { isTopic, subscribe, topicLabel, unsubscribeLink } from '@/lib/subscribers';

const hits = new Map<string, { n: number; t: number }>();

export async function subscribeAction(email: string, topic: string, website: string): Promise<{ ok: boolean; error?: string }> {
  if (website) return { ok: true }; // honeypot
  const clean = cleanEmail(String(email).slice(0, 254));
  if (!clean) return { ok: false, error: 'Please enter a valid email address.' };
  if (!isTopic(topic)) return { ok: false, error: 'Please choose what you’d like to hear about.' };
  if (!isBlobConfigured) return { ok: false, error: 'Sign-ups aren’t available right now.' };
  const ip = await clientIp();
  const h = hits.get(ip);
  if (h && Date.now() - h.t < 10 * 60_000 && h.n >= 5) return { ok: false, error: 'Too many sign-ups — try again later.' };
  hits.set(ip, h && Date.now() - h.t < 10 * 60_000 ? { n: h.n + 1, t: h.t } : { n: 1, t: Date.now() });
  try {
    const sub = await subscribe(clean, [topic]);
    await sendEmail({ to: clean, ...welcomeSubscriber(sub.topics.map(topicLabel).join(', '), unsubscribeLink(sub)) });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
