import type { Block } from '@/lib/cars/parse';

// Turns a scraped story into an easy read: only the story itself (no promos, picture credits or link lists), long
// paragraphs broken up, a medium length (about 450 words), quotes pulled out, and only the pictures that belong to it.
// Plain text in, plain text out: nothing here produces HTML.

export type StoryBlock = Block | { t: 'quote'; v: string };

export interface Condensed {
  /** The opening paragraph, shown larger as the standfirst. */
  lede?: string;
  blocks: StoryBlock[];
  /** Whole story's reading time before shortening, and after. */
  minutes: number;
}

const PROMO = /^(?:sign up|subscribe|follow|click here|check out|read more|also read|see also|watch:|video:|more:|related:|advertisement)|\b(?:sign up for|our newsletter|follow us on|join our|check out our|click here)\b/i;
const CREDIT = /^(?:photo|image|credit|source|via|pictured|courtesy|©)\b|\b(?:photo|image) (?:credit|by|courtesy)\b|^\(?(?:source|photo):/i;
const AD_PICTURE = /\b(?:ads?|banner|promo|sponsor\w*|doubleclick|affiliate|giphy|widget|thumb(?:nail)?s?|related)\b|[-_/](?:ad|ads)[-_/.]/i;

const TARGET = 460; // words kept when a story is longer than LONG
const LONG = 560;
const PARA_MAX = 70; // words before a paragraph is broken in two
const MAX_PICTURES = 4;

const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
const stem = (u: string) => {
  try {
    const f = new URL(u).pathname.split('/').pop() ?? u;
    return f.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]\d{2,4}x\d{2,4}$/i, '').replace(/^(?:xs|sm|md|lg|xl|xxl|s|m|l|t)[-_](?=.{6,})/i, '').replace(/[-_]?(?:thumb|small|medium|large|scaled)$/i, '').toLowerCase();
  } catch {
    return u;
  }
};

/** Breaks a long paragraph into readable chunks at sentence ends. */
function split(p: string): string[] {
  if (wc(p) <= PARA_MAX) return [p];
  const sentences = p.match(/[^.!?]+(?:[.!?]+["”’)]*)(?:\s+|$)|[^.!?]+$/g)?.map((s) => s.trim()) ?? [p];
  const out: string[] = [];
  let cur: string[] = [];
  for (const s of sentences) {
    if (cur.length >= 2 && wc(cur.join(' ')) + wc(s) > PARA_MAX * 0.8) { out.push(cur.join(' ')); cur = []; }
    cur.push(s);
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
}

const isQuote = (p: string) => /^[“"]/.test(p) && /[”"]$/.test(p) && p.length >= 60 && p.length <= 300;

interface Para { text: string; orig: number; section: number; score: number; quote: boolean }

export function condense(blocks: Block[], title: string, lead?: string): Condensed {
  // 1) Keep only story text, and note which section and picture each piece belongs to.
  const heads: string[] = [''];
  const paras: Para[] = [];
  const pictures: { src: string; orig: number }[] = [];
  const seen = new Set<string>(lead ? [stem(lead)] : []);
  let n = 0;
  for (const b of blocks) {
    if (b.t === 'h') { if (!PROMO.test(b.v) && b.v.toLowerCase() !== title.toLowerCase()) heads.push(b.v); continue; }
    if (b.t === 'img') {
      const k = stem(b.v);
      if (!seen.has(k) && !AD_PICTURE.test(b.v)) { seen.add(k); pictures.push({ src: b.v, orig: n }); }
      continue;
    }
    if (b.t !== 'p' || PROMO.test(b.v) || CREDIT.test(b.v)) continue;
    for (const text of split(b.v)) {
      const quote = isQuote(text);
      const score = (/\d/.test(text) ? 2 : 0) + (quote ? 3 : /[“"].{20,}[”"]/.test(text) ? 1 : 0) + (wc(text) >= 18 && wc(text) <= 60 ? 1 : 0) - (wc(text) < 10 ? 2 : 0);
      paras.push({ text, orig: n++, section: heads.length - 1, score, quote });
    }
  }
  const total = paras.reduce((a, p) => a + wc(p.text), 0);

  // 2) Shorten a long story: always the opening and each section's first paragraph, then the best of the rest, kept in order.
  const keep = new Set<number>();
  if (total <= LONG) paras.forEach((_, i) => keep.add(i));
  else {
    let used = 0;
    const take = (i: number) => { if (!keep.has(i)) { keep.add(i); used += wc(paras[i].text); } };
    paras.slice(0, 2).forEach((_, i) => take(i));
    const firsts = new Map<number, number>();
    paras.forEach((p, i) => { if (!firsts.has(p.section)) firsts.set(p.section, i); });
    for (const i of firsts.values()) if (used < TARGET) take(i);
    const rest = paras.map((p, i) => ({ i, s: p.score - (p.orig / paras.length) * 0.8 })).filter((x) => !keep.has(x.i)).sort((a, b) => b.s - a.s);
    for (const { i } of rest) { if (used >= TARGET) break; if (used + wc(paras[i].text) <= TARGET + 40) take(i); }
  }
  const kept = paras.map((p, i) => ({ p, i })).filter(({ i }) => keep.has(i)).map(({ p }) => p);

  // 3) Only a few pictures, spread through the story, never ahead of the opening paragraph.
  const chosen = pictures.length <= MAX_PICTURES ? pictures : Array.from({ length: MAX_PICTURES }, (_, k) => pictures[Math.floor((k * pictures.length) / MAX_PICTURES)]);
  const after = new Map<number, string[]>(); // kept-paragraph index -> pictures that follow it
  for (const pic of chosen) {
    let at = 0;
    kept.forEach((p, k) => { if (p.orig < pic.orig) at = k; });
    after.set(at, [...(after.get(at) ?? []), pic.src]);
  }

  // 4) Assemble, with section headings only where something under them survived; at most two pulled quotes.
  const out: StoryBlock[] = [];
  let lastSection = 0, quotes = 0;
  kept.forEach((p, k) => {
    if (p.section !== lastSection && p.section > 0) out.push({ t: 'h', v: heads[p.section] });
    lastSection = p.section;
    out.push(p.quote && quotes++ < 2 ? { t: 'quote', v: p.text } : { t: 'p', v: p.text });
    for (const src of after.get(k) ?? []) out.push({ t: 'img', v: src });
  });
  const first = out.findIndex((b) => b.t === 'p');
  const lede = first >= 0 ? (out.splice(first, 1)[0].v) : undefined;
  return { lede, blocks: out, minutes: Math.max(1, Math.round(kept.reduce((a, p) => a + wc(p.text), 0) / 220)) };
}
