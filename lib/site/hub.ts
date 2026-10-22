import { categories } from '@/data/navigation';

// Shared by the home page and the admin's live preview, so both lay the boxes out identically.
export const HUB_SECTIONS = [
  { id: 'news', title: 'News', subtitle: 'Fresh stories from the weapons, car and tech feeds', accent: '#fb923c' },
  { id: 'productivity', title: 'Productivity', subtitle: 'Free tools that run right in your browser', accent: '#2dd4bf' },
  { id: 'personal', title: 'Personal & Boards', subtitle: 'Boards, photography, events, video and more', accent: '#c8a96a' },
] as const;
export type HubSectionId = (typeof HUB_SECTIONS)[number]['id'];

const GROUP = new Map(categories.map((c) => [c.id, c.group ?? 'personal']));
// Boards and galleries lead the personal section.
const FIRST = ['fishboards', 'meatboards', 'photography', 'events'];

export function groupCards<T extends { id: string }>(cards: T[]): Record<HubSectionId, T[]> {
  const groups = { news: [] as T[], productivity: [] as T[], personal: [] as T[] };
  for (const c of cards) groups[(GROUP.get(c.id) ?? 'personal') as HubSectionId].push(c);
  const rank = (id: string) => (FIRST.includes(id) ? FIRST.indexOf(id) : FIRST.length);
  groups.personal.sort((a, b) => rank(a.id) - rank(b.id));
  return groups;
}

/** Grid classes; `device` pins the column count for the admin preview (1 phone, 2 tablet, 4 desktop). */
export function gridClass(news: boolean, device?: 1 | 2 | 4) {
  if (device === 1) return news ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 gap-2.5';
  if (device) return news ? 'grid-cols-3 gap-4' : device === 2 ? 'grid-cols-3 gap-4' : 'grid-cols-4 gap-4';
  return news ? 'grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-4' : 'grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4';
}

/** The Personal & Boards section as a four-column directory. Boxes not listed here (e.g. custom pages) join the sandbox column. */
export const DIRECTORY = [
  { title: 'Personal Services · Culinary', ids: ['fishboards', 'meatboards', 'events'] },
  { title: 'Audio & Visual Media', ids: ['music', 'video', 'photography'] },
  { title: 'Creative & Dev Sandbox', ids: ['editing', 'bookbinding'], rest: true },
  { title: 'Resources & Contact', ids: ['cookbook', 'fund', 'contact'] },
] as const;

export function directoryColumns<T extends { id: string }>(cards: T[]) {
  const known = new Set<string>(DIRECTORY.flatMap((c) => c.ids));
  return DIRECTORY.map((col) => ({
    title: col.title,
    cards: [...(col.ids as readonly string[]).flatMap((id) => cards.filter((c) => c.id === id)), ...('rest' in col ? cards.filter((c) => !known.has(c.id)) : [])],
  })).filter((c) => c.cards.length);
}
