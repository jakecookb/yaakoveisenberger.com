import { XMLParser } from 'fast-xml-parser';
import { decodeEntities, excerpt, safeUrl, stripHtml, TAG } from './text';
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

export type Block = { t: 'p' | 'h'; v: string } | { t: 'img'; v: string };

export interface Article {
  url: string;
  title: string;
  source: string;
  home: string;
  publishedAt: string;
  image?: string;
  /** The story as the feed gives it, in order: paragraphs, subheadings and pictures. Plain text and validated URLs only, never HTML. */
  blocks: Block[];
}

const PARA_SPLIT = /<\/(?:p|h[1-6]|li|div|blockquote|figure)>|<br\s*\/?>/i;
const BOILERPLATE = /appeared first on|^read (?:more|the full)|^source:|^(?:via|credit|image|photo)\b|^(?:subscribe|sign up|follow us|advertisement)|\bnewsletter\b/i;
const NOT_A_PICTURE = /pixel|tracker|spacer|1x1|logo|avatar|icon|emoji|gravatar|badge|sprite|\.svg|\.gif(\?|$)/i;
const MARK = '\u0001';

/** Turns story HTML into ordered blocks. Pictures become markers in the text, and subheadings get one too, so the order survives the tag-stripping. */
export function toBlocks(html: string, title: string, base?: string): Block[] {
  const marked = html
    .replace(TAG, (tag) => tag.replace(/\s+/g, ' ')) // a tag split over several lines must stay one tag
    .replace(/<(script|style|figcaption|aside|iframe|noscript|table|form|button|nav|header|footer|svg|video|audio)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<source\b[^>]*>/gi, ' ')
    .replace(new RegExp(TAG.source.replace('[a-zA-Z/!]', 'img\\b'), 'gi'), (tag) => {
      const pick = (name: string) => tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1];
      const set = (pick('srcset') ?? pick('data-srcset'))?.split(',').map((x) => x.trim().split(/\s+/)[0]).pop();
      const raw = pick('data-src') ?? pick('data-lazy-src') ?? pick('src') ?? set;
      let src: string | undefined;
      try { src = safeUrl(raw && base ? new URL(decodeEntities(raw), base).toString() : raw); } catch { src = undefined; }
      const w = Number(pick('width') ?? 999), h = Number(pick('height') ?? 999);
      return src && !NOT_A_PICTURE.test(src) && w >= 200 && h >= 120 ? `\n${MARK}I${src}${MARK}\n` : ' ';
    })
    .replace(/<h[1-6][^>]*>/gi, `\n${MARK}H`);
  const blocks: Block[] = [];
  const seen = new Set<string>();
  for (const chunk of marked.split(PARA_SPLIT)) {
    for (const part of chunk.split('\n')) {
      if (part.startsWith(`${MARK}I`)) {
        const src = part.slice(2).replace(new RegExp(`${MARK}$`), '');
        if (!seen.has(src)) { seen.add(src); blocks.push({ t: 'img', v: src }); }
        continue;
      }
      const heading = part.startsWith(`${MARK}H`);
      const v = stripHtml(heading ? part.slice(2) : part);
      if (heading ? v.length > 2 && v.length < 140 : v.length > 40 && !BOILERPLATE.test(v) && v.toLowerCase() !== title.toLowerCase()) blocks.push({ t: heading ? 'h' : 'p', v });
    }
  }
  return cleanBlocks(blocks);
}

// Where a page's article ends and its "more stories" furniture begins.
const FURNITURE = /^(?:related|most popular|more from|you (?:may|might) also|read next|read more|recommended|trending|comments?|latest (?:news|stories)|popular|newsletter|about the author|share this|tags?:?)\b/i;
const JUNK = /\b(?:class|data-[a-z-]+|srcset|sizes|href)=|we may earn a commission|affiliate|^(?:[\w&.'’-]+(?: [\w&.'’-]+)* , ){2,}/i;

/** Drops page furniture: junk lines, everything from a "Related/Most Popular" heading on, and a trailing run of bare headlines. */
function cleanBlocks(blocks: Block[]): Block[] {
  let out = blocks.filter((b) => b.t === 'img' || !JUNK.test(b.v));
  const cut = out.findIndex((b) => b.t === 'h' && FURNITURE.test(b.v));
  if (cut > 3) out = out.slice(0, cut);
  // Story text is sentences; the "more stories" list is Title Case headlines. Tell them apart by length and how many words are capitalised.
  const sentence = (b: Block) => {
    if (b.t !== 'p' || !/[.!?"”’)]$/.test(b.v)) return false;
    const w = b.v.split(/\s+/);
    return w.length >= 14 && w.filter((x) => /^[A-Z0-9]/.test(x)).length / w.length < 0.55;
  };
  let end = out.length;
  while (end > 0 && !sentence(out[end - 1])) end--; // trailing headlines, pictures and subheadings are not the story
  return end >= 2 ? out.slice(0, end) : out;
}

/** Like parseFeed, but keeps each story's text and pictures in reading order so a page can be built from it. */
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
    const image = pickImage(it, html);
    const blocks = toBlocks(html, title, url);
    out.push({ url, title, source: source.name, home: source.home, publishedAt: when.toISOString(), image, blocks });
  }
  return out;
}
