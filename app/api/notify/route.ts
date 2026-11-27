import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/admin/session';
import { isBlobConfigured } from '@/lib/admin/store';
import { cleanEmail } from '@/lib/access/visitor';
import { sendEmail } from '@/lib/email/send';
import { welcomeSubscriber } from '@/lib/email/templates';
import { subscribe, topicLabel, unsubscribeLink } from '@/lib/subscribers';

export const dynamic = 'force-dynamic';

const hits = new Map<string, { n: number; t: number }>();

/** "Tell me when it's back" on the closed-for-now page: subscribes the address to site updates. */
export async function POST(req: Request) {
  const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== new URL(req.url).host) return fail('Not allowed.', 403);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return fail('Bad request.'); }
  if (typeof b.website === 'string' && b.website) return NextResponse.json({ ok: true }); // honeypot
  const email = cleanEmail(String(b.email ?? '').slice(0, 254));
  if (!email) return fail('Please enter a valid email address.');
  if (!isBlobConfigured) return fail('Sign-ups aren’t available right now.', 503);
  const ip = await clientIp();
  if (hits.size > 5000) hits.clear();
  const h = hits.get(ip);
  if (h && Date.now() - h.t < 10 * 60_000 && h.n >= 5) return fail('Too many sign-ups — try again later.', 429);
  hits.set(ip, h && Date.now() - h.t < 10 * 60_000 ? { n: h.n + 1, t: h.t } : { n: 1, t: Date.now() });
  try {
    const sub = await subscribe(email, ['all']);
    await sendEmail({ to: email, ...welcomeSubscriber(sub.topics.map(topicLabel).join(', '), unsubscribeLink(sub)) });
    return NextResponse.json({ ok: true });
  } catch {
    return fail('Something went wrong — please try again.', 500);
  }
}
