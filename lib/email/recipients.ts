import 'server-only';
import { categories } from '@/data/navigation';
import { listRequests, cleanEmail } from '@/lib/access/visitor';
import { listSubscribers, subscriberKey, topicLabel, type Subscriber } from '@/lib/subscribers';

// Everyone the owner can send an announcement to by name: email subscribers, plus anyone who ever asked for access to a page
// on the site and left an email address (the two lists are merged by address).

export interface Recipient {
  id: string; // subscriberKey(email): the same for the same address, whichever list it came from
  email: string;
  name?: string;
  /** Present when they subscribed: their email carries their own one-click unsubscribe link. */
  subscriber?: Subscriber;
  /** One line for the picker: what they signed up for. */
  why: string;
}

const titleOf = (id: string) => categories.find((c) => c.id === id)?.title ?? id;

export async function recipientPool(): Promise<Recipient[]> {
  const [subs, requests] = await Promise.all([listSubscribers(), listRequests()]);
  const byEmail = new Map<string, Recipient>();
  for (const s of subs) byEmail.set(s.email.toLowerCase(), { id: subscriberKey(s.email), email: s.email, subscriber: s, why: `Subscribed: ${s.topics.map(topicLabel).join(', ')}` });
  for (const r of requests) {
    const email = r.email && cleanEmail(r.email);
    if (!email) continue;
    const asked = [...new Set([...r.requested, ...r.granted])].map(titleOf);
    const why = `Asked for access${asked.length ? `: ${asked.slice(0, 4).join(', ')}${asked.length > 4 ? ` +${asked.length - 4}` : ''}` : ''}`;
    const have = byEmail.get(email);
    if (have) { have.name ??= r.name; have.why = `${have.why} · ${why}`; } else byEmail.set(email, { id: subscriberKey(email), email, name: r.name, why });
  }
  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}
