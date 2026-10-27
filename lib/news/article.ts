import 'server-only';
import { isLiveStore, readJson } from '@/lib/admin/store';
import { buildStory, TOPICS, type Story } from './build';
import { hashOf, urlOf, type NewsTopic } from './slug';

export { TOPICS };
export type { Story };

// What a visitor's request does: read a small saved file. The saved files are made every 30 minutes by the scheduled GitHub Action
// (see .github/workflows/news-refresh.yml and scripts/build-news.ts), because fetching and parsing publishers' pages costs far
// more than the Cloudflare free plan's 10 ms of CPU per request. Local development has no such limit, so it builds live instead.

const memo = new Map<string, { at: number; v: unknown }>();
const MEMO_MS = 60_000;

/** A saved news file, kept in memory for a minute so a burst of visitors reads it once. */
export async function readNews<T>(key: string): Promise<T | null> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.v as T;
  const v = await readJson<T>(key);
  if (v !== null) memo.set(key, { at: Date.now(), v });
  return v;
}

/** The saved stories file for a topic is a map keyed by hashOf(original link). */
export async function loadStory(topic: NewsTopic, slug: string): Promise<Story | null> {
  const url = TOPICS[topic] && urlOf(slug);
  if (!url) return null;
  if (!isLiveStore) return buildStory(topic, url); // local development only
  return (await readNews<Record<string, Story>>(`news/${topic}-stories.json`))?.[hashOf(url)] ?? null;
}
