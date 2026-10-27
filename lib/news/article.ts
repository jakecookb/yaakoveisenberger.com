import 'server-only';
import { parseArticles, type Article } from '@/lib/cars/parse';
import { excerpt } from '@/lib/cars/text';
import { SOURCES as CAR_SOURCES } from '@/lib/cars/sources';
import { SOURCES as TECH_SOURCES } from '@/lib/tech/sources';
import { SOURCES as WEAPON_SOURCES } from '@/lib/weapons/sources';
import type { CarSource } from '@/lib/cars/types';
import { slugOf, type NewsTopic } from './slug';

export const TOPICS: Record<NewsTopic, { name: string; path: string; accent: string; sources: CarSource[] }> = {
  cars: { name: 'Latest Car Reveals', path: '/cars', accent: '#818cf8', sources: CAR_SOURCES },
  tech: { name: 'Tech & Gadgets', path: '/tech', accent: '#34d399', sources: TECH_SOURCES },
  weapons: { name: 'Weapons & 2A Hub', path: '/weapons', accent: '#fb923c', sources: WEAPON_SOURCES.filter((s) => !s.gnews) },
};

async function pull(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; yaakoveisenberger.com news summaries)', accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 1800 }, // the same cached copy the topic pages use
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

const BUDGET = 950; // characters of summary: the opening of the story, not the story

/** Keeps whole paragraphs until the budget is used, trimming the last one at a sentence end. */
function summarize(paragraphs: string[]): string[] {
  const out: string[] = [];
  let used = 0;
  for (const p of paragraphs) {
    if (used >= BUDGET || out.length >= 5) break;
    const room = BUDGET - used;
    if (p.length <= room + 80) { out.push(p); used += p.length; continue; }
    const cut = p.slice(0, room);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    out.push(end > 120 ? cut.slice(0, end + 1) : excerpt(p, room));
    break;
  }
  // A feed that cuts its text off mid-sentence would leave a stray fragment ("...too. A"): end on the last whole sentence instead.
  const last = out[out.length - 1];
  if (last && !/[.!?"”’)]$/.test(last)) {
    const end = Math.max(last.lastIndexOf('. '), last.lastIndexOf('! '), last.lastIndexOf('? '));
    if (end > 40) out[out.length - 1] = last.slice(0, end + 1);
    else if (out.length > 1) out.pop();
  }
  return out;
}

export interface Summary extends Omit<Article, 'paragraphs' | 'images'> {
  summary: string[];
  images: string[];
}

/** Finds a story by the id in its address, in its topic's feeds, and returns the opening of it as a short summary. */
export async function loadSummary(topic: NewsTopic, slug: string): Promise<Summary | null> {
  const cfg = TOPICS[topic];
  if (!cfg || !/^[a-z0-9]{4,20}$/.test(slug)) return null;
  for (const batch of await Promise.all(cfg.sources.map(async (s) => { const xml = await pull(s.feed); return xml ? parseArticles(xml, s) : []; }))) {
    const hit = batch.find((a) => slugOf(a.url) === slug);
    if (hit) {
      const { paragraphs, ...rest } = hit;
      return { ...rest, summary: summarize(paragraphs), images: hit.images };
    }
  }
  return null;
}
