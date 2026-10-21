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
