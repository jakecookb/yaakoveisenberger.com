import { dedupe } from '@/lib/cars/pick';
import type { CarItem, CarSpec } from '@/lib/cars/types';
import { KNIFE_SOURCES, POLICY_SOURCES } from './sources';

type Raw = Omit<CarItem, 'tags' | 'specs' | 'score'> & { fullText: string };
export type WeaponsTab = 'handguns' | 'longguns' | 'knives' | 'rights';

const KNIFE = /\b(knife|knives|blades?|bladed|edc|folder|folding knife|fixed[- ]blade|switchblade|automatic knife|otf|balisong|butterfly knife|machete|axe|hatchet|tomahawk|multi-?tool|bowie|sharpen\w*|kniferights|cutlery|karambit)\b/i;
const RIGHTS = /\b(2a|second amendment|gun[- ](?:rights?|control|ban|laws?|owners?|grabbers?|registry)|bills?|laws?|legislat\w+|lawmakers?|supreme court|scotus|court|judge|ruling|appeals?|lawsuit|sues?|sued|atf|doj|congress|senate|house|governor|ban|bans|banned|permits?|reciprocity|constitutional carry|permitless|red[- ]flag|assault weapons?|magazine (?:ban|limit)\w*|nfa|hearing protection act|shorty act|ccw|concealed carry|executive order|attorney general|veto\w*|signed|election|vote\w*|administration|rule|regulation\w*|unconstitutional|amendment|freedom|rights|restrictions?|sheriff|police chief|gun-free|armed citizen|self-defen[cs]e|defensive gun use)\b/i;
const HANDGUN = /\b(pistols?|handguns?|revolvers?|glock|sig sauer p\d+|p365|p320|1911s?|9mm|\.?380|\.?45 acp|10mm|\.?40 s&w|micro[- ]?compact|sub[- ]?compact|compact|carry gun|holsters?|edc pistol|derringer|snub|m&p|hellcat|shield)\b/i;
const LONG = /\b(rifles?|shotguns?|ar-?15s?|ar-?10|ak(?:-?47)?s?|carbines?|bolt[- ]action|lever[- ]action|scopes?|riflescopes?|\.?308|6\.5 creedmoor|5\.56|\.?223|12[- ]gauge|20[- ]gauge|precision rifle|pcc|muzzleloader|\.?30-06|\.?300 (?:blk|blackout|win mag|prc)|7\.62|long guns?|hunting rifle|suppressors?|silencers?|m4a1|m4|m16|mini-14|sbr)\b/i;
const NOISE = /\$\d[\d,]*(?:\.\d\d)?\s*$|\bdrops? to \$|\bsave \d+%|\bprice drop|\bon sale\b|\b(deals?|sale|discounts?|coupons?|giveaway|sweepstakes|podcast|sponsored|webinar|ammo deals|black friday|cyber monday|gift guide|subscribe|newsletter|horoscope)\b/i;

const CAL = /\b(9mm(?: luger)?|\.?380 acp|\.?45 acp|10mm(?: auto)?|\.?40 s&w|\.?22 lr|\.?22 wmr|\.?357 mag(?:num)?|\.?38 special|\.?44 mag(?:num)?|5\.7x28(?:mm)?|5\.56(?: nato|mm)?|\.?223 rem(?:ington)?|\.?308 win(?:chester)?|6\.5 creedmoor|6\.5 prc|\.?300 blk|\.?300 blackout|\.?300 win mag|\.?30-06|7\.62x39|7\.62x51|12[- ]gauge|20[- ]gauge|\.?410 bore|\.?350 legend|\.?45-70)\b/i;
const STEEL = /\b(magnacut|s30v|s35vn|s45vn|s90v|m390|20cv|204p|m4|elmax|d2|154cm|vg-?10|aus-?8|8cr13mov|14c28n|nitro-?v|1095|cpm[- ]?3v|cpm[- ]?\w+|lc200n|h1|bd1n)\b/i;

const num = (s: string) => Number(s.replace(/,/g, ''));

/** "308 win" -> ".308 Win", "5.56 nato" -> "5.56 NATO", "12-gauge" -> "12-gauge". */
function caliberLabel(raw: string) {
  let s = raw.replace(/^\./, '').toLowerCase();
  if (/^\d{2,3}[ -]/.test(s) && !/gauge|bore/.test(s.slice(0, 9))) s = `.${s}`;
  if (/^\d{2,3} bore/.test(s)) s = `.${s}`;
  return s
    .replace(/\b(acp|lr|wmr|blk|prc|nato|s&w)\b/g, (m) => m.toUpperCase())
    .replace(/\b(win|rem|mag|magnum|special|creedmoor|legend|luger|auto|blackout|bore|remington|winchester)\b/g, (m) => m[0].toUpperCase() + m.slice(1));
}

/** Up to four quick facts pulled from the article text: caliber, capacity, barrel or blade length, steel, weight, MSRP. */
export function extractWeaponSpecs(text: string, knife: boolean): CarSpec[] {
  const out: CarSpec[] = [];
  const add = (kind: CarSpec['kind'], label: string) => { if (!out.some((s) => s.kind === kind) && out.length < 4) out.push({ kind, label }); };
  if (knife) {
    const bl = text.match(/(\d(?:\.\d{1,2})?)[- ]?(?:inch|in\.|”|")[- ](?:\w+[- ])?blade/i);
    if (bl && num(bl[1]) > 0.5 && num(bl[1]) < 20) add('blade', `${bl[1]}" blade`);
    const st = text.match(STEEL);
    if (st) add('steel', st[1].replace(/^cpm[- ]?/i, 'CPM-').toUpperCase().replace('MAGNACUT', 'MagnaCut').replace('NITRO-V', 'Nitro-V'));
  } else {
    const c = text.match(CAL);
    if (c) add('caliber', caliberLabel(c[1]));
    const cap = text.match(/\b(\d{1,2})(?:\+1)?[- ]round\b|\bcapacity of (\d{1,2})\b|\b(\d{1,2})\+1\b/i);
    const n = cap ? num(cap[1] ?? cap[2] ?? cap[3]) : 0;
    if (n >= 2 && n <= 60) add('capacity', `${n} rounds`);
    const br = text.match(/(\d{1,2}(?:\.\d{1,2})?)[- ]?(?:inch|in\.|”|")[- ](?:\w+[- ])?barrel/i);
    if (br && num(br[1]) >= 2 && num(br[1]) <= 34) add('barrel', `${br[1]}" barrel`);
  }
  // Only "weighs 24 oz" / "weight: 6.5 lb" style statements, so stray numbers aren't mistaken for a weight.
  const wt = text.match(/\bweigh(?:s|ing|t)?\b[^.\d]{0,20}(\d{1,2}(?:\.\d{1,2})?)\s?(oz|ounces|lbs?\.?|pounds)\b/i);
  if (wt && num(wt[1]) > 0) add('weight', `${wt[1]} ${/oz|ounce/i.test(wt[2]) ? 'oz' : 'lb'}`);
  const pr = text.match(/\bmsrp[^$]{0,20}\$\s?([\d,]{2,6}(?:\.\d\d)?)/i);
  if (pr && num(pr[1]) >= 20 && num(pr[1]) < 50000) add('price', `MSRP $${pr[1].replace(/\.\d\d$/, '').replace(/,$/, '')}`);
  return out;
}

/** Which tab a story belongs on (or null to leave it out). Knife stories (including knife law) go to Knives. */
export function classify(title: string, excerpt: string, source: string): WeaponsTab | null {
  const hay = `${title} ${excerpt}`;
  if (NOISE.test(title)) return null;
  if (KNIFE.test(title) || (KNIFE_SOURCES.has(source) && !HANDGUN.test(title) && !LONG.test(title))) return 'knives';
  const rights = RIGHTS.test(title);
  const hg = (title.match(new RegExp(HANDGUN, 'gi')) ?? []).length * 2 + (excerpt.match(new RegExp(HANDGUN, 'gi')) ?? []).length;
  const lg = (title.match(new RegExp(LONG, 'gi')) ?? []).length * 2 + (excerpt.match(new RegExp(LONG, 'gi')) ?? []).length;
  if (rights || POLICY_SOURCES.has(source)) return rights || (!hg && !lg) ? 'rights' : hg >= lg ? 'handguns' : 'longguns';
  if (hg || lg) return hg >= lg ? 'handguns' : 'longguns';
  if (RIGHTS.test(hay)) return 'rights';
  if (KNIFE.test(excerpt)) return 'knives';
  return null;
}

const DAY = 86_400_000;
/** Carry-permit law (not carry gear): reciprocity, permitless carry, permits and licences. */
const CARRY_LAW = /\b(reciprocity|permitless|constitutional carry|carry permits?|permits? to carry|ccw permits?|carry licen[cs]es?|concealed carry (?:laws?|permits?|licen[cs]es?|bills?|reciprocity)|permit (?:delays?|process|fees?|backlog))\b/i;
const TAG: Record<WeaponsTab, string> = { handguns: 'Handgun', longguns: 'Long gun', knives: 'Edged', rights: '2A' };

export interface WeaponItem extends CarItem { tab: WeaponsTab }

export function enrichWeapon(raw: Raw, now = Date.now(), forceTab?: WeaponsTab): WeaponItem | null {
  const { fullText, ...item } = raw;
  const tab = forceTab ?? classify(item.title, item.excerpt, item.source);
  if (!tab) return null;
  const ageDays = Math.max(0, (now - new Date(item.publishedAt).getTime()) / DAY);
  if (ageDays > 30) return null;
  const specs = tab === 'rights' ? [] : extractWeaponSpecs(fullText, tab === 'knives');
  const tags = [TAG[tab]];
  if (tab === 'rights' && CARRY_LAW.test(item.title)) tags.push('Carry law');
  else if (tab === 'rights' && /court|judge|ruling|scotus|lawsuit|appeal/i.test(item.title)) tags.push('Courts');
  else if (tab === 'rights' && /bill|legislat|congress|senate|house|signed|veto|law/i.test(item.title)) tags.push('Legislation');
  else if (tab === 'knives' && /law|legal|ban|bill|repeal|rights/i.test(item.title)) tags.push('Knife law');
  else if (/\b(new|announce[sd]?|introduc\w+|launch\w*|unveil\w*|first look)\b/i.test(item.title)) tags.push('New');
  else if (/\breview\b/i.test(item.title)) tags.push('Review');
  // Carry-permit and knife-law stories are a focus of the hub, so they rank above general news of the same age.
  const focus = tags.includes('Carry law') || tags.includes('Knife law') ? 3.5 : 0;
  const score = (item.image ? 2 : 0) + Math.min(3, specs.length) + (ageDays <= 7 ? 4 * (1 - ageDays / 7) : 0) + (tags.length > 1 ? 1 : 0) + focus;
  return { ...item, tab, tags, specs, score: Math.round(score * 100) / 100 };
}

export type WeaponsSelection = Record<WeaponsTab, WeaponItem[]>;

/** Each tab: the ten best recent stories (no more than four from one site, a few places kept for carry/knife law), newest first. */
export function selectWeapons(all: WeaponItem[], per = 10): WeaponsSelection {
  const unique = dedupe(all) as WeaponItem[];
  const pickTab = (tab: WeaponsTab) => {
    const pool = unique.filter((i) => i.tab === tab).sort((a, b) => b.score - a.score);
    const out: WeaponItem[] = [];
    const bySrc = new Map<string, number>();
    // Up to three places are kept for carry-permit / knife-law stories (often photo-less, so they'd lose on score alone).
    const focus = pool
      .filter((i) => i.tags.includes('Carry law') || i.tags.includes('Knife law'))
      .sort((a, b) => Number(/reciprocity/i.test(b.title)) - Number(/reciprocity/i.test(a.title)) || b.score - a.score)
      .slice(0, 3);
    for (const cap of [4, per]) for (const i of [...focus, ...pool]) {
      if (out.length >= per || out.includes(i) || (bySrc.get(i.source) ?? 0) >= cap) continue;
      out.push(i);
      bySrc.set(i.source, (bySrc.get(i.source) ?? 0) + 1);
    }
    return out.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  };
  return { handguns: pickTab('handguns'), longguns: pickTab('longguns'), knives: pickTab('knives'), rights: pickTab('rights') };
}
