import 'server-only';
import { parseArticles, toBlocks, type Article, type Block } from '@/lib/cars/parse';
import { SOURCES as CAR_SOURCES } from '@/lib/cars/sources';
import { SOURCES as TECH_SOURCES } from '@/lib/tech/sources';
import { SOURCES as WEAPON_SOURCES } from '@/lib/weapons/sources';
import type { CarSource } from '@/lib/cars/types';
import { extractSpecs } from '@/lib/cars/specs';
import { extractWeaponSpecs } from '@/lib/weapons/pick';
import type { CarItem, CarSpec } from '@/lib/cars/types';
import { condense, type Condensed } from './condense';
import { isRedirect, slugOf, type NewsTopic } from './slug';
import { loadCarFeed } from '@/lib/cars/fetch';
import { loadTechFeed } from '@/lib/tech/fetch';
import { loadWeaponsFeed } from '@/lib/weapons/fetch';

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

/** Every story the topic page is showing (the same lists the cards come from, saved copy included), so a card always finds its story. */
async function listed(topic: NewsTopic): Promise<CarItem[]> {
  if (topic === 'cars') { const f = await loadCarFeed(); return [...f.thisWeek, ...f.earlier]; }
  if (topic === 'tech') { const f = await loadTechFeed(); return [...f.samsung, ...f.apple, ...f.more]; }
  const f = await loadWeaponsFeed();
  return [...f.handguns, ...f.longguns, ...f.knives, ...f.rights];
}

/**
 * The story behind a card, found by the id in its address. The card list gives the headline, picture, source and date, so a story
 * always opens; the text comes from the publisher's feed, or failing that from the story's own page, or failing that is the
 * excerpt the card showed. Every change in the feeds flows through here automatically: nothing is stored by hand.
 */
export async function loadStory(topic: NewsTopic, slug: string): Promise<Story | null> {
  const cfg = TOPICS[topic];
  if (!cfg || !/^[a-z0-9]{4,20}$/.test(slug)) return null;
  const item = (await listed(topic)).find((i) => slugOf(i.url) === slug);
  if (!item) return null;
  const source = cfg.sources.find((x) => x.name === item.source);
  let blocks: Block[] = [];
  if (source) {
    const xml = await pull(source.feed);
    blocks = tidy((xml ? parseArticles(xml, source).find((a) => a.url === item.url)?.blocks : undefined) ?? []);
  }
  if (words(blocks) < 150 && !isRedirect(item.url)) {
    const page = tidy(await fromPage(item.url, item.title));
    if (words(page) > words(blocks) * 1.5) blocks = page;
  }
  if (!blocks.some((b) => b.t === 'p') && item.excerpt) blocks = [{ t: 'p', v: item.excerpt }];
  const text = [item.title, ...blocks.map((b) => (b.t === 'img' ? '' : b.v))].join('. ');
  const facts = topic === 'cars' ? extractSpecs(text, 6) : topic === 'weapons' ? extractWeaponSpecs(text, /\b(knife|blade|folder)\b/i.test(item.title)) : [];
  return {
    url: item.url, title: item.title, source: item.source, home: source?.home ?? new URL(item.url).origin, publishedAt: item.publishedAt, image: item.image,
    ...condense(blocks, item.title, item.image), facts: facts.length >= 2 || (facts.length === 1 && facts[0].kind !== 'drive') ? facts : [], partial: words(blocks) < 150,
  };
}
