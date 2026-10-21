import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { listPaths, readJson, removePath, writeJson } from '@/lib/admin/store';
import { siteUrl } from '@/lib/site/url';

// Email subscribers: one private JSON record per address (named by its hash). Each has a secret token for its
// one-click unsubscribe link.

export const TOPICS = [
  { id: 'all', label: 'Latest updates on the website' },
  { id: 'weapons', label: 'Weapons & 2A Hub' },
  { id: 'boards', label: 'Fish & Meat Boards' },
  { id: 'photography', label: 'Photography' },
  { id: 'events', label: 'Events' },
  { id: 'devtools', label: 'Developer Tools' },
  { id: 'news', label: 'Car & tech news' },
] as const;
export type Topic = (typeof TOPICS)[number]['id'];
export const isTopic = (t: string): t is Topic => TOPICS.some((x) => x.id === t);
export const topicLabel = (t: string) => TOPICS.find((x) => x.id === t)?.label ?? t;

export interface Subscriber { email: string; topics: Topic[]; token: string; createdAt: string; updatedAt: string }

const PREFIX = 'site/subscribers/';
const key = (email: string) => createHash('sha256').update(email).digest('hex').slice(0, 32);
const path = (k: string) => `${PREFIX}${k}.json`;

export const unsubscribeLink = (s: Subscriber) => `${siteUrl()}/unsubscribe?k=${key(s.email)}&t=${s.token}`;

/** Adds (or updates) a subscriber; topics are merged with any they already had. */
export async function subscribe(email: string, topics: Topic[]): Promise<Subscriber> {
  const now = new Date().toISOString();
  const old = await readJson<Subscriber>(path(key(email)));
  const sub: Subscriber = old
    ? { ...old, topics: [...new Set([...old.topics, ...topics])], updatedAt: now }
    : { email, topics, token: randomBytes(18).toString('base64url'), createdAt: now, updatedAt: now };
  await writeJson(path(key(email)), sub);
  return sub;
}

export async function unsubscribe(k: string, token: string): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(k)) return false;
  const sub = await readJson<Subscriber>(path(k));
  if (!sub) return true; // already gone
  const a = Buffer.from(sub.token);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  await removePath(path(k));
  return true;
}

export async function listSubscribers(): Promise<Subscriber[]> {
  const paths = await listPaths(PREFIX, 5000);
  const all = await Promise.all(paths.map((p) => readJson<Subscriber>(p)));
  return all.filter((s): s is Subscriber => Boolean(s)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Who gets an announcement about `topic`: everyone who chose it, plus everyone who wants all updates. */
export const audience = (subs: Subscriber[], topic: Topic) => subs.filter((s) => topic === 'all' || s.topics.includes('all') || s.topics.includes(topic));
