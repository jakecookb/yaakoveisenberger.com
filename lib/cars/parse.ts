import { XMLParser } from 'fast-xml-parser';
import { decodeEntities, excerpt, safeUrl, stripHtml } from './text';
import type { CarItem, CarSource } from './types';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', trimValues: true, processEntities: true, htmlEntities: true });

type Node = Record<string, unknown>;
const arr = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : v && typeof v === 'object' && '#text' in (v as Node) ? String((v as Node)['#text']) : '');
const attr = (v: unknown, name: string): string | undefined => (v && typeof v === 'object' ? ((v as Node)[`@_${name}`] as string | undefined) : undefined);

const IMG_EXT = /\.(jpe?g|png|webp|avif)(\?|#|$)/i;

function pickImage(item: Node, html: string): string | undefined {
  const candidates: (string | undefined)[] = [];
  for (const m of arr(item['media:content'])) if (!attr(m, 'medium') || attr(m, 'medium') === 'image') candidates.push(attr(m, 'url'));
  for (const m of arr(item['media:thumbnail'])) candidates.push(attr(m, 'url'));
  for (const m of arr(item['enclosure'])) if (/^image\//i.test(attr(m, 'type') ?? '') || IMG_EXT.test(attr(m, 'url') ?? '')) candidates.push(attr(m, 'url'));
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img) candidates.push(img[1]);
  for (const c of candidates) {
    const u = safeUrl(c);
    // Skip tracking pixels and icons.
    if (u && !/pixel|tracker|spacer|1x1|logo|avatar|icon/i.test(u)) return u;
  }
  return undefined;
}

/** Reads an RSS 2.0 (or Atom) feed into plain, validated items. Never throws on a bad item: it just skips it. */
export function parseFeed(xml: string, source: CarSource): (Omit<CarItem, 'tags' | 'specs' | 'score'> & { fullText: string })[] {
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch {
    return [];
  }
  const channel = ((doc.rss as Node | undefined)?.channel ?? (doc.feed as Node | undefined)) as Node | undefined;
  const raw = arr<Node>((channel?.item ?? channel?.entry) as Node | Node[] | undefined);
  const out: ReturnType<typeof parseFeed> = [];
  for (const it of raw) {
    const title = stripHtml(text(it.title));
    const link = safeUrl(text(it.link) || attr(arr(it.link as Node | Node[])[0], 'href') || text(it.guid));
    const when = new Date(text(it.pubDate) || text(it['dc:date']) || text(it.published) || text(it.updated));
    if (!title || !link || Number.isNaN(when.getTime())) continue;
    const descHtml = decodeEntities(text(it.description) || text(it.summary));
    const bodyHtml = decodeEntities(text(it['content:encoded']) || text(it.content));
    const desc = stripHtml(descHtml);
    out.push({
      id: `${source.id}:${link}`,
      title,
      excerpt: excerpt(desc && desc.toLowerCase() !== title.toLowerCase() ? desc : stripHtml(bodyHtml)),
      url: link,
      image: pickImage(it, bodyHtml || descHtml),
      source: source.name,
      publishedAt: when.toISOString(),
      fullText: `${title}. ${desc}. ${stripHtml(bodyHtml).slice(0, 6000)}`,
    });
  }
  return out;
}

export interface Article {
  url: string;
  title: string;
  source: string;
  home: string;
  publishedAt: string;
  image?: string;
  images: string[];
  /** The opening of the story as plain paragraphs, never HTML. */
  paragraphs: string[];
}

const PARA_SPLIT = /<\/(?:p|h[1-6]|li|div|blockquote)>|<br\s*\/?>/i;
const BOILERPLATE = /appeared first on|^read (?:more|the full)|^source:|^(?:via|credit|image|photo)\b|^(?:subscribe|sign up|follow us|advertisement)|\bnewsletter\b/i;

/** Like parseFeed, but keeps each story's paragraphs and pictures so a summary page can be built. Plain text and validated URLs only. */
export function parseArticles(xml: string, source: CarSource): Article[] {
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch {
    return [];
  }
  const channel = ((doc.rss as Node | undefined)?.channel ?? (doc.feed as Node | undefined)) as Node | undefined;
  const raw = arr<Node>((channel?.item ?? channel?.entry) as Node | Node[] | undefined);
  const out: Article[] = [];
  for (const it of raw) {
    const title = stripHtml(text(it.title));
    const url = safeUrl(text(it.link) || attr(arr(it.link as Node | Node[])[0], 'href') || text(it.guid));
    const when = new Date(text(it.pubDate) || text(it['dc:date']) || text(it.published) || text(it.updated));
    if (!title || !url || Number.isNaN(when.getTime())) continue;
    const descHtml = decodeEntities(text(it.description) || text(it.summary));
    const bodyHtml = decodeEntities(text(it['content:encoded']) || text(it.content));
    const html = bodyHtml.length > descHtml.length ? bodyHtml : descHtml;
    const paragraphs = html
      .replace(/<(script|style|figure|figcaption|aside|iframe|noscript|table)[\s\S]*?<\/\1>/gi, ' ')
      .split(PARA_SPLIT)
      .map(stripHtml)
      .filter((p) => p.length > 40 && !BOILERPLATE.test(p) && p.toLowerCase() !== title.toLowerCase());
    const image = pickImage(it, html);
    const images = [image, ...[...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => safeUrl(m[1]))]
      .filter((u): u is string => Boolean(u) && !/pixel|tracker|spacer|1x1|logo|avatar|icon|emoji|gravatar|badge/i.test(u!));
    out.push({ url, title, source: source.name, home: source.home, publishedAt: when.toISOString(), image, images: [...new Set(images)].slice(0, 4), paragraphs });
  }
  return out;
}
