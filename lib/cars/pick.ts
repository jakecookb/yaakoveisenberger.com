import { extractSpecs } from './specs';
import type { CarItem } from './types';

type Raw = Omit<CarItem, 'tags' | 'specs' | 'score'> & { fullText: string };

// What counts as a "reveal": new cars and concepts being shown, launched or teased. News about recalls, lawsuits, sales,
// reviews, rumours and spy shots is left out.
const STRONG = /\b(reveal(?:s|ed)?|unveil(?:s|ed|ing)?|debut(?:s|ed)?|world premiere|first look|concept|officially (?:revealed|unveiled|launched))\b/i;
const WEAK = /\b(looks?|gets|confirms?|arrives?|goes official|(?:20[2-3]\d)|launch(?:es|ed)?|teas(?:er|es|ed)|previews?|production version|all-new|new generation|next-gen|returns?|revival|reborn|one-off|limited[- ]edition|special edition)\b/i;
const NOISE = /\b(recall(?:s|ed)?|lawsuit|sues?|sued|tariffs?|sales|stock|earnings|lease|insurance|review|tested|vs\.?|versus|comparison|best|worst|top \d+|buyer'?s guide|opinion|crash(?:es|ed)?|fire|investigat\w*|trademarks?|price cuts?|discounts?|charging|fleet|awards?|long-term|how to|why|should you|rumou?rs?|report|reportedly|spied|spotted|spy|dealers?|owners?|used|dies|dead|ending|dropping|discontinu\w+|cancel\w*|ban|bans|2035|emissions|regulations?|legislation|eu|congress)\b|\?\s*$/i;
// A story has to be about an actual car, and not a game, an app or a service.
const MAKES = 'abarth|acura|alfa romeo|alpine|aston martin|audi|bentley|bmw|bugatti|buick|byd|cadillac|chevrolet|chevy|corvette|chrysler|citroen|cupra|dacia|dodge|ferrari|fiat|ford|genesis|gmc|honda|hyundai|infiniti|jaguar|jeep|kia|koenigsegg|lamborghini|land rover|range rover|lexus|lincoln|lotus|lucid|maserati|mazda|mclaren|mercedes|amg|mg|mini|mitsubishi|nissan|pagani|peugeot|polestar|porsche|ram|renault|rimac|rivian|rolls-royce|saab|seat|skoda|subaru|suzuki|tesla|toyota|vauxhall|volkswagen|vw|volvo|xiaomi|zeekr|li auto|nio|xpeng|lynk|ineos|defender|mustang|camaro|civic|supra|gt-?r|miata|bronco|hummer|cybertruck|roadster';
const CAR = new RegExp(`\\b(${MAKES}|cars?|suv|sedan|saloon|hatch(?:back)?|coupe|convertible|supercar|hypercar|pickup|truck|wagon|estate|crossover|ev|concept|hot hatch|sports car|roadster|minivan|van)\\b`, 'i');
const NOT_CAR = /\b(ps[45]|xbox|nintendo|steam|beamng|gran turismo|forza|game|gaming|controller|simulator|app|mapquest|maps|podcast|newsletter|stock|netflix|streaming|subscription)\b/i;
const FUN = /\b(supercar|hypercar|sports car|roadster|coupe|convertible|track[- ]?only|v12|v10|v8|electric|ev)\b/i;

const DAY = 86_400_000;

/** Turns a raw feed item into a scored one, or null if it isn't a reveal worth showing. */
export function enrich(raw: Raw, now = Date.now()): CarItem | null {
  const { fullText, ...item } = raw;
  const title = item.title;
  const strong = STRONG.test(title);
  const weak = WEAK.test(title);
  if (!strong && !weak) return null; // not about a reveal
  if (NOT_CAR.test(title) || !CAR.test(`${title} ${item.excerpt}`)) return null; // games, apps and services
  if (NOISE.test(title) && !strong) return null; // looks like news, not a reveal
  let specs = extractSpecs(fullText);
  if (specs.length === 1 && specs[0].kind === 'drive') specs = []; // a lone "Electric" tells the reader nothing
  const ageDays = Math.max(0, (now - new Date(item.publishedAt).getTime()) / DAY);
  const tags: string[] = [];
  const hay = `${title} ${item.excerpt}`;
  if (/\bconcept\b/i.test(hay)) tags.push('Concept');
  else if (strong) tags.push('Reveal');
  else if (/teas(?:er|es|ed)|preview/i.test(title)) tags.push('Teaser');
  else tags.push('New');
  if (/\b(supercar|hypercar)\b/i.test(hay)) tags.push('Supercar');
  if (/\b(electric|EV|kWh|battery)\b/.test(hay) || /\belectric\b/i.test(hay)) tags.push('EV');
  else if (/\b(hybrid|PHEV)\b/i.test(hay)) tags.push('Hybrid');

  const score =
    (strong ? 5 : 3) +
    (NOISE.test(title) ? -3 : 0) +
    (FUN.test(title) ? 1 : 0) +
    (item.image ? 2 : -3) +
    Math.min(4, specs.filter((c) => !(c.kind === 'drive' && specs.length === 1)).length) +
    (ageDays <= 7 ? 3 * (1 - ageDays / 7) : 0);
  if (score < 4) return null;
  return { ...item, tags: tags.slice(0, 3), specs, score: Math.round(score * 100) / 100 };
}

const STOP = new Set(['the', 'a', 'an', 'new', 'all', 'is', 'to', 'of', 'for', 'and', 'in', 'on', 'with', 'its', 'this', 'that', 'at', 'as', 'by', 'from', 'it', 'be', 'will', 'gets', 'get']);
const tokens = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w) && !/^20\d\d$/.test(w)));

/** Several sites cover the same car: keep the best-scoring copy of each story. */
export function dedupe(items: CarItem[]): CarItem[] {
  const kept: { item: CarItem; tok: Set<string> }[] = [];
  for (const item of [...items].sort((a, b) => b.score - a.score)) {
    const tok = tokens(item.title);
    const dup = kept.some((k) => {
      const inter = [...tok].filter((w) => k.tok.has(w)).length;
      const hp = (c: CarItem) => c.specs.find((s) => s.kind === 'power')?.label.replace(/\D/g, '');
      const samePower = !!hp(item) && hp(item) === hp(k.item) && inter >= 2; // same car, different headline
      return (inter / Math.max(1, Math.min(tok.size, k.tok.size)) >= 0.6 && inter >= 3) || samePower;
    });
    if (!dup) kept.push({ item, tok });
  }
  return kept.map((k) => k.item);
}

export interface Selection {
  thisWeek: CarItem[];
  earlier: CarItem[];
}

/**
 * The page shows about seven fresh reveals a week: the best-scoring ones from the last 7 days, no more than three from any one
 * site; if there aren't seven yet it's topped up from slightly older ones. The best one is featured first, the rest follow
 * newest-first. Older reveals are listed below as "Earlier".
 */
export function selectFeed(all: CarItem[], now = Date.now(), weekCount = 7, earlierCount = 6): Selection {
  const unique = dedupe(all).filter((i) => now - new Date(i.publishedAt).getTime() <= 60 * DAY);
  const age = (i: CarItem) => (now - new Date(i.publishedAt).getTime()) / DAY;
  const fresh = unique.filter((i) => age(i) <= 7);
  const older = unique.filter((i) => age(i) > 7).sort((a, b) => b.score - a.score);

  const chosen: CarItem[] = [];
  const perSource = new Map<string, number>();
  const take = (pool: CarItem[], cap: number) => {
    for (const i of pool) {
      if (chosen.length >= weekCount) break;
      if (chosen.includes(i) || (perSource.get(i.source) ?? 0) >= cap) continue;
      chosen.push(i);
      perSource.set(i.source, (perSource.get(i.source) ?? 0) + 1);
    }
  };
  take([...fresh].sort((a, b) => b.score - a.score), 3);
  take([...fresh].sort((a, b) => b.score - a.score), 7); // relax the per-site limit if the week is thin
  take(older, 3);

  const withImage = chosen.filter((i) => i.image);
  const featured = withImage.sort((a, b) => b.score - a.score)[0] ?? chosen[0];
  const rest = chosen.filter((i) => i !== featured).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  const thisWeek = featured ? [featured, ...rest] : [];
  const earlier = unique.filter((i) => !thisWeek.includes(i)).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)).slice(0, earlierCount);
  return { thisWeek, earlier };
}
