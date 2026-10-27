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
import { urlOf, type NewsTopic } from './slug';

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
    const page = (await res.text()).slice(0, 2_000_000);
    const title = stripHtml(decodeEntities(meta(page, 'og:title') ?? page.match(/<title[^>]*>([^<]*)/i)?.[1] ?? ''));
    const body = page.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? page.match(/<main\b[\s\S]*?<\/main>/i)?.[0];
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

/**
 * The story behind a card: its address carries the original link, so only that link's publisher is contacted (its feed, for the
 * headline, picture, date and text, and the story's own page, for the full text). Only publishers on the topic's own list are ever
 * fetched. Every change in the feeds flows through here automatically: nothing is stored by hand.
 */
export async function loadStory(topic: NewsTopic, slug: string): Promise<Story | null> {
  const cfg = TOPICS[topic];
  const url = cfg && urlOf(slug);
  if (!cfg || !url) return null;
  const h = host(url);
  const source = cfg.sources.find((s) => { const sh = host(s.home); return h === sh || h.endsWith(`.${sh}`); });
  if (!source) return null;
  const [xml, page] = await Promise.all([pull(source.feed), fromPage(url)]);
  const art = xml ? parseArticles(xml, source).find((a) => a.url === url) : undefined;
  const title = art?.title ?? page.title;
  if (!title) return null;
  let blocks = tidy(art?.blocks ?? []);
  const fuller = tidy(page.blocks);
  if (words(blocks) < 150 && words(fuller) > words(blocks) * 1.5) blocks = fuller;
  const text = [title, ...blocks.map((b) => (b.t === 'img' ? '' : b.v))].join('. ');
  const facts = topic === 'cars' ? extractSpecs(text, 6) : topic === 'weapons' ? extractWeaponSpecs(text, /\b(knife|blade|folder)\b/i.test(title)) : [];
  const image = art?.image ?? page.image;
  return {
    url, title, source: source.name, home: source.home, publishedAt: art?.publishedAt ?? page.publishedAt ?? new Date().toISOString(), image,
    ...condense(blocks, title, image), facts: facts.length >= 2 || (facts.length === 1 && facts[0].kind !== 'drive') ? facts : [], partial: words(blocks) < 150,
  };
}
