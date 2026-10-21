import { dedupe } from '@/lib/cars/pick';
import type { CarItem } from '@/lib/cars/types';

type Raw = Omit<CarItem, 'tags' | 'specs' | 'score'> & { fullText: string };

const SAMSUNG = /\b(samsung|galaxy|one ui|exynos|sammobile)\b/i;
const APPLE = /\b(apple|iphone|ipad|ios ?\d*|ipados|airpods|apple watch|watchos|macbook|vision pro|magsafe|a\d\d(?: pro)?)\b/i;
const WEARABLE = /\b(smart ?watch(?:es)?|wearables?|apple watch|galaxy watch|galaxy ring|galaxy buds|buds|airpods|fitbit|garmin|pixel watch|oura|smart ring|fitness tracker|earbuds|watchos|wear os)\b/i;
const PHONE = /\b(phones?|smartphones?|iphone|galaxy [szamf]\d*|pixel \d+|oneplus|xiaomi|foldables?|z fold|z flip|flip ?\d|fold ?\d|nothing phone|motorola|android \d+)\b/i;
const FLAGSHIP = /\b(s2[5-9]\s*(?:ultra|plus|\+|fe)?|galaxy s2[5-9]|iphone 1[6-9]|iphone 2\d|ios 2\d|one ui [5-9])\b/i;
const JUNK = /\b(deals?|discounts?|coupons?|promo|sale|save \$?\d+|best|top \d+|giveaway|how to|here's how|accessories|cases?|chargers?)\b/i;
const NOISE = /\b(vs\.?|hands-on with|review)\b|\?\s*$/i;

const DAY = 86_400_000;

/** Scores a feed item for the Tech page, or null if it isn't about phones or wearables. */
export function enrichTech(raw: Raw, now = Date.now()): CarItem | null {
  const { fullText, ...item } = raw;
  const hay = `${item.title} ${item.excerpt}`;
  const samsung = SAMSUNG.test(item.title) || (SAMSUNG.test(hay) && !APPLE.test(item.title));
  const apple = !SAMSUNG.test(item.title) && APPLE.test(item.title);
  const wearable = WEARABLE.test(item.title);
  const phone = PHONE.test(item.title);
  if (!samsung && !apple && !wearable && !phone) return null;
  if (JUNK.test(item.title)) return null;
  if (NOISE.test(item.title) && !FLAGSHIP.test(item.title)) return null;
  const ageDays = Math.max(0, (now - new Date(item.publishedAt).getTime()) / DAY);

  const tags: string[] = [];
  if (samsung) tags.push('Samsung');
  else if (apple) tags.push('Apple');
  if (wearable) tags.push('Wearable');
  else if (phone && tags.length < 2) tags.push('Phone');
  if (/\b(leaks?|leaked|rumou?rs?|reportedly|tipped|spotted|could|may|might|expected|renders?|certified)\b/i.test(item.title)) tags.push('Leak');
  else if (/\b(launch(?:es|ed)?|announce[sd]?|unveil\w*|official|release[sd]?|now available|rolls? out|reveals?)\b/i.test(item.title)) tags.push('Launch');

  const score =
    (samsung ? 4 : 0) + (apple ? 3 : 0) + (wearable ? 2 : 0) + (phone ? 1.5 : 0) +
    (FLAGSHIP.test(hay) ? 3 : 0) +
    (/\bs27\b/i.test(hay) ? 3 : 0) +
    (item.image ? 2 : -3) +
    (ageDays <= 7 ? 3 * (1 - ageDays / 7) : 0);
  if (score < 4) return null;
  return { ...item, tags: tags.slice(0, 3), specs: [], score: Math.round(score * 100) / 100 };
}

export interface TechSelection {
  samsung: CarItem[];
  apple: CarItem[];
  more: CarItem[];
}

const byNewest = (a: CarItem, b: CarItem) => +new Date(b.publishedAt) - +new Date(a.publishedAt);

/** Samsung and Apple get their own lists (best of the last two weeks, newest first); wearables and other phones follow. */
export function selectTech(all: CarItem[], now = Date.now()): TechSelection {
  const unique = dedupe(all).filter((i) => now - new Date(i.publishedAt).getTime() <= 21 * DAY);
  const used = new Set<CarItem>();
  const pick = (pool: CarItem[], n: number) => {
    const out = pool.filter((i) => !used.has(i)).sort((a, b) => b.score - a.score).slice(0, n);
    out.forEach((i) => used.add(i));
    return out.sort(byNewest);
  };
  const samsung = pick(unique.filter((i) => i.tags.includes('Samsung')), 7);
  const apple = pick(unique.filter((i) => i.tags.includes('Apple')), 7);
  const more = pick(unique.filter((i) => !i.tags.includes('Samsung') && !i.tags.includes('Apple')), 7);
  return { samsung, apple, more };
}
