import type { CarSource } from '@/lib/cars/types';
import type { WeaponsTab } from './pick';

export interface WeaponSource extends CarSource {
  /** A Google News topic search: the publisher comes from the headline, and stories always go to `tab`. */
  gnews?: { tab: WeaponsTab; must: RegExp };
}

const gnews = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

// Public RSS feeds from firearms, knife and gun-rights publications. We show a headline, a short summary, the feed's
// thumbnail and a link to the original article. To add a source, add a line.
export const SOURCES: WeaponSource[] = [
  { id: 'ttag', name: 'The Truth About Guns', feed: 'https://www.thetruthaboutguns.com/feed/', home: 'https://www.thetruthaboutguns.com' },
  { id: 'bearingarms', name: 'Bearing Arms', feed: 'https://bearingarms.com/feed', home: 'https://bearingarms.com' },
  { id: 'ammoland', name: 'AmmoLand', feed: 'https://www.ammoland.com/feed/', home: 'https://www.ammoland.com' },
  { id: 'rifleman', name: 'American Rifleman', feed: 'https://www.americanrifleman.org/rss', home: 'https://www.americanrifleman.org' },
  { id: 'recoil', name: 'Recoil', feed: 'https://www.recoilweb.com/feed', home: 'https://www.recoilweb.com' },
  { id: 'tfb', name: 'The Firearm Blog', feed: 'https://www.thefirearmblog.com/blog/feed/', home: 'https://www.thefirearmblog.com' },
  { id: 'reload', name: 'The Reload', feed: 'https://www.thereload.com/feed', home: 'https://www.thereload.com' },
  { id: 'goa', name: 'Gun Owners of America', feed: 'https://www.gunowners.org/feed/', home: 'https://www.gunowners.org' },
  { id: 'knifenews', name: 'Knife News', feed: 'https://www.knifenews.com/feed/', home: 'https://www.knifenews.com' },
  // Topic searches fill the two gaps the publications rarely cover: knife law and carry-permit reciprocity.
  {
    id: 'gnews-knives', name: 'Google News', home: 'https://news.google.com',
    feed: gnews('"knife law" OR "knife laws" OR "knife ban" OR "knife rights" OR "switchblade ban" OR "switchblade law" OR "automatic knife" when:60d'),
    gnews: { tab: 'knives', must: /\b(laws?|bans?|banned|legal\w*|rights|sues?|sued|bill|court|judge|repeal\w*|permit|carry|legislat\w+|ordinance)\b/i },
  },
  {
    id: 'gnews-reciprocity', name: 'Google News', home: 'https://news.google.com',
    feed: gnews('"concealed carry reciprocity" OR "permit reciprocity" OR "constitutional carry" OR "permitless carry" when:30d'),
    gnews: { tab: 'rights', must: /\b(reciprocity|permit\w*|carry|gun|firearms?|2a|second amendment)\b/i },
  },
  { id: 'outdoorlife', name: 'Outdoor Life', feed: 'https://www.outdoorlife.com/feed/', home: 'https://www.outdoorlife.com' },
];

/** Sites about rights and law rather than gear (by name, as stories carry it): their stories default to the 2A tab. */
export const POLICY_SOURCES = new Set(['The Reload', 'Gun Owners of America', 'Bearing Arms']);
/** Knife sites: their stories default to the Knives tab. */
export const KNIFE_SOURCES = new Set(['Knife News']);
