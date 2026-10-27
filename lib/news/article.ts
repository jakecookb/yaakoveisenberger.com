import 'server-only';
import { parseArticles, toBlocks, type Article, type Block } from '@/lib/cars/parse';
import { decodeEntities, safeUrl, stripHtml } from '@/lib/cars/text';
import { SOURCES as CAR_SOURCES } from '@/lib/cars/sources';
import { SOURCES as TECH_SOURCES } from '@/lib/tech/sources';
import { SOURCES as WEAPON_SOURCES } from '@/lib/weapons/sources';
import type { CarSource } from '@/lib/cars/types';
import { extractSpecs } from '@/lib/cars/specs';
import { extractWeaponSpecs } from '@/lib/weapons/pick';
import type { CarSpec } from '@/lib/cars/types';
import { condense, type Condensed } from './condense';
import { cached } from './cache';
import { hashOf, urlOf, type NewsTopic } from './slug';

export const TOPICS: Record<NewsTopic, { name: string; path: string; accent: string; sources: CarSource[] }> = {
  cars: { name: 'Latest Car Reveals', path: '/cars', accent: '#818cf8', sources: CAR_SOURCES },
  tech: { name: 'Tech & Gadgets', path: '/tech', accent: '#34d399', sources: TECH_SOURCES },
  weapons: { name: 'Weapons & 2A Hub', path: '/weapons', accent: '#fb923c', sources: WEAPON_SOURCES.filter((s) => !s.gnews) },
};

async function pull(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; yaakoveisenberger.com news pages)', accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(6000),
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

const meta = (html: string, name: string) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))?.[1] ??
  html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i'))?.[1];

/** The text from `open` to the next `close` (no regex: this runs over whole pages). */
function between(html: string, open: string, close: string): string | undefined {
  const a = html.indexOf(open);
  if (a < 0) return undefined;
  const b = html.indexOf(close, a);
  return html.slice(a, b < 0 ? undefined : b + close.length);
}

interface Page { blocks: Block[]; title?: string; image?: string; publishedAt?: string }

/** Many feeds only carry a teaser. For those, read the story's own page and take its article text and pictures (server side, cached like the feeds). */
async function fromPage(url: string): Promise<Page> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; yaakoveisenberger.com news pages)', accept: 'text/html' },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 1800 },
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/html/i.test(type)) return { blocks: [] };
    const page = (await res.text()).slice(0, 1_200_000);
    const title = stripHtml(decodeEntities(meta(page, 'og:title') ?? page.match(/<title[^>]*>([^<]*)/i)?.[1] ?? ''));
    const body = between(page, '<article', '</article>') ?? between(page, '<main', '</main>');
    const when = new Date(meta(page, 'article:published_time') ?? meta(page, 'datePublished') ?? '');
    return {
      blocks: body ? toBlocks(body, title, res.url || url) : [],
      title: title || undefined,
      image: safeUrl(meta(page, 'og:image') ? decodeEntities(meta(page, 'og:image')!) : undefined),
      publishedAt: Number.isNaN(when.getTime()) ? undefined : when.toISOString(),
    };
  } catch {
    return { blocks: [] };
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

const host = (u: string) => new URL(u).hostname.replace(/^www\./, '');

async function build(topic: NewsTopic, url: string): Promise<Story | null> {
  const cfg = TOPICS[topic];
  const h = host(url);
  const source = cfg.sources.find((s) => { const sh = host(s.home); return h === sh || h.endsWith(`.${sh}`); });
  if (!source) return null;
  // The story's own page usually has everything (text, pictures, headline); the publisher's feed is only read when it doesn't.
  const page = await fromPage(url);
  let blocks = tidy(page.blocks);
  let art: Article | undefined;
  if (!page.title || words(blocks) < 150) {
    const xml = await pull(source.feed);
    art = xml ? parseArticles(xml, source).find((a) => a.url === url) : undefined;
    const feedBlocks = tidy(art?.blocks ?? []);
    if (words(feedBlocks) >= words(blocks)) blocks = feedBlocks;
  }
  const title = art?.title ?? page.title?.replace(new RegExp(`\\s*[|–—-]\\s*${source.name.replace(/[^\w ]/g, '.')}.*$`, 'i'), '');
  if (!title) return null;
  const text = [title, ...blocks.map((b) => (b.t === 'img' ? '' : b.v))].join('. ');
  const facts = topic === 'cars' ? extractSpecs(text, 6) : topic === 'weapons' ? extractWeaponSpecs(text, /\b(knife|blade|folder)\b/i.test(title)) : [];
  const image = art?.image ?? page.image;
  return {
    url, title, source: source.name, home: source.home, publishedAt: art?.publishedAt ?? page.publishedAt ?? new Date().toISOString(), image,
    ...condense(blocks, title, image), facts: facts.length >= 2 || (facts.length === 1 && facts[0].kind !== 'drive') ? facts : [], partial: words(blocks) < 150,
  };
}

/**
 * The story behind a card: its address carries the original link, so only that link's publisher is contacted, and only
 * publishers on the topic's own list. A built story is kept for an hour (in memory and in the store), so opening it again,
 * or a crowd opening it, costs almost nothing. Every change in the feeds flows through here automatically.
 */
export async function loadStory(topic: NewsTopic, slug: string): Promise<Story | null> {
  const url = TOPICS[topic] && urlOf(slug);
  if (!url) return null;
  return cached<Story>(`news-cache/story-${topic}-${hashOf(url)}.json`, 3600_000, () => build(topic, url));
}
