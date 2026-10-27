import 'server-only';
import { parseArticles, toBlocks, type Article, type Block } from '@/lib/cars/parse';
import { SOURCES as CAR_SOURCES } from '@/lib/cars/sources';
import { SOURCES as TECH_SOURCES } from '@/lib/tech/sources';
import { SOURCES as WEAPON_SOURCES } from '@/lib/weapons/sources';
import type { CarSource } from '@/lib/cars/types';
import { extractSpecs } from '@/lib/cars/specs';
import { extractWeaponSpecs } from '@/lib/weapons/pick';
import type { CarSpec } from '@/lib/cars/types';
import { condense, type Condensed } from './condense';
import { slugOf, type NewsTopic } from './slug';

export const TOPICS: Record<NewsTopic, { name: string; path: string; accent: string; sources: CarSource[] }> = {
  cars: { name: 'Latest Car Reveals', path: '/cars', accent: '#818cf8', sources: CAR_SOURCES },
  tech: { name: 'Tech & Gadgets', path: '/tech', accent: '#34d399', sources: TECH_SOURCES },
  weapons: { name: 'Weapons & 2A Hub', path: '/weapons', accent: '#fb923c', sources: WEAPON_SOURCES.filter((s) => !s.gnews) },
};

async function pull(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; yaakoveisenberger.com news pages)', accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 1800 }, // the same cached copy the topic pages use
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

export interface Story extends Omit<Article, 'blocks'>, Condensed {
  /** True when the publisher only shares the opening, so the page points readers to the original for the rest. */
  partial: boolean;
  /** Headline numbers found in the story (power, price, calibre ...), for the "at a glance" box. */
  facts: CarSpec[];
}

const words = (blocks: Block[]) => blocks.reduce((n, b) => n + (b.t === 'p' ? b.v.split(/\s+/).length : 0), 0);

/** Many feeds only carry a teaser. For those, read the story's own page and take its article text and pictures (server side, cached like the feeds). */
async function fromPage(url: string, title: string): Promise<Block[]> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; yaakoveisenberger.com news pages)', accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 1800 },
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/html/i.test(type)) return [];
    const page = (await res.text()).slice(0, 2_000_000);
    const body = page.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? page.match(/<main\b[\s\S]*?<\/main>/i)?.[0];
    return body ? toBlocks(body, title, res.url || url) : [];
  } catch {
    return [];
  }
}

/** A feed that cuts its text off mid-sentence would leave a stray fragment ("...too. A"): end on the last whole sentence instead. */
function tidy(blocks: Block[]): Block[] {
  const out = [...blocks];
  while (out.length && out[out.length - 1].t === 'h') out.pop(); // never end on a subheading
  const i = out.map((b) => b.t).lastIndexOf('p');
  const last = out[i];
  if (last && last.t === 'p' && !/[.!?"”’)]$/.test(last.v)) {
    const end = Math.max(last.v.lastIndexOf('. '), last.v.lastIndexOf('! '), last.v.lastIndexOf('? '));
    if (end > 40) out[i] = { t: 'p', v: last.v.slice(0, end + 1) };
    else out.splice(i, 1);
  }
  return out;
}

/** Finds a story by the id in its address, in its topic's feeds, and returns it as the feed gave it: all of the text, in order, with its pictures. */
export async function loadStory(topic: NewsTopic, slug: string): Promise<Story | null> {
  const cfg = TOPICS[topic];
  if (!cfg || !/^[a-z0-9]{4,20}$/.test(slug)) return null;
  for (const batch of await Promise.all(cfg.sources.map(async (s) => { const xml = await pull(s.feed); return xml ? parseArticles(xml, s) : []; }))) {
    const hit = batch.find((a) => slugOf(a.url) === slug);
    if (hit) {
      let blocks = tidy(hit.blocks);
      if (words(blocks) < 150 && !/^https?:\/\/news\.google\./i.test(hit.url)) {
        const page = tidy(await fromPage(hit.url, hit.title));
        if (words(page) > words(blocks) * 1.5) blocks = page;
      }
      const text = blocks.map((b) => (b.t === 'img' ? '' : b.v)).join(' ');
      let facts = topic === 'cars' ? extractSpecs(text) : topic === 'weapons' ? extractWeaponSpecs(text, /\b(knife|blade|folder)\b/i.test(hit.title)) : [];
      if (facts.length < 2) facts = [];
      const { blocks: _raw, ...rest } = hit;
      void _raw;
      return { ...rest, ...condense(blocks, hit.title, hit.image), facts: facts.slice(0, 6), partial: words(blocks) < 150 };
    }
  }
  return null;
}
