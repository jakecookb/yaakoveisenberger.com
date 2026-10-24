import { z } from 'zod';
import { categories, type NavCategory } from '@/data/navigation';
import { ICON_KEYS, iconKeyOf, type IconKey } from '@/data/icons';

// Shared (server + client) description of everything the admin editor can change.
// Safe to import from client components: no secrets, no server-only modules.

export const ICON_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type IconSize = (typeof ICON_SIZES)[number];
export const BOX_WIDTHS = ['normal', 'wide', 'full'] as const;
export type BoxWidth = (typeof BOX_WIDTHS)[number];
export const BOX_HEIGHTS = ['compact', 'standard', 'tall', 'xl'] as const;
export type BoxHeight = (typeof BOX_HEIGHTS)[number];

const cardOverride = z.object({
  title: z.string().trim().max(60).optional(), // empty = use the built-in name
  teaser: z.string().trim().max(200).optional(),
  hidden: z.boolean().optional(),
  status: z.enum(['live', 'soon']).optional(),
  locked: z.boolean().optional(),
  /** Locked AND shown greyed out on the hub: only a faint hint of the box, no description. */
  greyed: z.boolean().optional(),
  width: z.enum(BOX_WIDTHS).optional(),
  height: z.enum(BOX_HEIGHTS).optional(),
  /** Legacy: replaced by `width`. */
  wide: z.boolean().optional(),
  iconKey: z.enum(ICON_KEYS).optional(),
  iconSize: z.enum(ICON_SIZES).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

/** A box the owner created in the editor: either its own page (text + photos) or a link to another website. */
export const CUSTOM_ID = /^c-[a-z0-9]{4,12}$/;
const customBox = z.object({
  id: z.string().regex(CUSTOM_ID),
  kind: z.enum(['page', 'link']),
  /** Link boxes only: https://… or a path on this site such as /cookbook. */
  url: z.string().trim().max(500).optional(),
});
export type CustomBox = z.infer<typeof customBox>;

export const isSafeUrl = (u: string | undefined): u is string => Boolean(u && (/^https?:\/\/[^\s<>"']+$/i.test(u) || /^\/[A-Za-z0-9/_\-.]*$/.test(u)));

export const PHOTO_PATH = /^photos\/[a-z0-9-]{1,40}\/[A-Za-z0-9._-]{1,120}$/;
export const HERO_PATH = /^hero\/[A-Za-z0-9._-]{1,120}$/;

const photo = z.object({
  id: z.string().min(1).max(60),
  pathname: z.string().regex(PHOTO_PATH),
  caption: z.string().trim().max(200).default(''),
});

export const settingsSchema = z.object({
  hero: z.object({
    tagline: z.string().trim().max(160),
    logoPath: z.string().regex(HERO_PATH).optional(),
  }),
  order: z.array(z.string().max(40)).max(80),
  custom: z.array(customBox).max(40).default([]),
  cards: z.record(z.string().max(40), cardOverride),
  pages: z.record(z.string().max(40), z.object({ heading: z.string().trim().max(80).optional(), body: z.string().trim().max(20000).optional() })),
  photos: z.record(z.string().max(40), z.array(photo).max(500)),
});

export type SiteSettings = z.infer<typeof settingsSchema>;
export type CardOverride = z.infer<typeof cardOverride>;
export type Photo = z.infer<typeof photo>;

export const DEFAULT_TAGLINE = 'Video, projects, food and fundraising — everything in one place.';

export const defaultSettings = (): SiteSettings => ({
  hero: { tagline: DEFAULT_TAGLINE },
  order: [],
  custom: [],
  // Before anything is saved, every private-capable box starts locked (Funding stays open), so a fresh store never
  // exposes private pages.
  cards: Object.fromEntries(categories.filter((c) => c.lockable && c.id !== 'fund').map((c) => [c.id, { locked: true }])),
  pages: {},
  photos: {},
});

/** Base description of every box: the built-in ones plus the ones created in the editor. */
function bases(s: SiteSettings): (NavCategory & { custom?: CustomBox })[] {
  const palette = ['#f472b6', '#60a5fa', '#4ade80', '#facc15', '#fb7185', '#2dd4bf'];
  const extra = s.custom.map((c, i): NavCategory & { custom: CustomBox } => ({
    id: c.id,
    title: 'New box',
    teaser: c.kind === 'link' ? 'Opens another website.' : '',
    href: c.kind === 'page' ? `/p/${c.id}` : isSafeUrl(c.url) ? c.url : '#',
    icon: categories[0].icon, // overridden by iconKey below
    accent: palette[i % palette.length],
    external: c.kind === 'link',
    gallery: c.kind === 'page',
    lockable: true,
    custom: c,
  }));
  return [...categories, ...extra];
}

/** Drops anything that isn't a known box so stale or tampered ids never persist. */
export function sanitizeSettings(input: SiteSettings): SiteSettings {
  const seen = new Set<string>();
  const custom = input.custom
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .map((c) => (c.kind === 'link' ? { ...c, url: isSafeUrl(c.url) ? c.url : undefined } : { id: c.id, kind: c.kind }));
  const withCustom = { ...input, custom };
  const all = bases(withCustom);
  const known = new Set(all.map((c) => c.id));
  const only = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => known.has(k)));
  const galleryIds = new Set(all.filter((c) => c.gallery).map((c) => c.id));
  const lockable = new Set(all.filter((c) => c.lockable).map((c) => c.id));
  const cards = only(input.cards);
  for (const [id, o] of Object.entries(cards)) {
    if (o.locked && !lockable.has(id)) delete o.locked;
    if (o.greyed && !lockable.has(id)) delete o.greyed;
    if (o.title !== undefined && !o.title.trim()) delete o.title; // blank name = back to the default
  }
  return {
    hero: input.hero,
    order: input.order.filter((id, i, a) => known.has(id) && a.indexOf(id) === i),
    custom,
    cards,
    pages: only(input.pages),
    photos: Object.fromEntries(Object.entries(input.photos).filter(([k]) => galleryIds.has(k))),
  };
}

/** Serializable view of one hub card (no component references, so it can cross to client components). */
export interface CardView {
  id: string;
  title: string;
  teaser: string;
  /** Where the box goes. Locked boxes never reveal their real destination here. */
  href: string;
  iconKey: IconKey;
  iconSize: IconSize;
  accent: string;
  external: boolean;
  badge?: 'live' | 'new';
  /** A live news feed (shows a "news" pill on its tile). */
  news: boolean;
  status: 'live' | 'soon';
  width: BoxWidth;
  height: BoxHeight;
  locked: boolean;
  /** Greyed-out display (always also locked). */
  greyed: boolean;
  hidden: boolean;
  gallery: boolean;
  lockable: boolean;
  /** Created in the editor (can be deleted) rather than built in. */
  custom: boolean;
  kind: 'builtin' | 'page' | 'link';
}

export function resolveCards(s: SiteSettings, opts: { includeHidden?: boolean } = {}): CardView[] {
  const all = bases(s);
  const byId = new Map(all.map((c) => [c.id, c]));
  const ids = [...s.order.filter((id) => byId.has(id)), ...all.map((c) => c.id).filter((id) => !s.order.includes(id))];
  const views = ids.map((id): CardView => {
    const c = byId.get(id)!;
    const o = s.cards[id] ?? {};
    const locked = Boolean(c.lockable && (o.locked || o.greyed));
    const kind = c.custom ? c.custom.kind : 'builtin';
    // A locked link goes through /go/<id> so the real URL is only revealed to approved visitors.
    const href = locked && kind === 'link' ? `/go/${id}` : c.href;
    return {
      id,
      title: o.title?.trim() ? o.title : c.title,
      teaser: o.teaser ?? c.teaser, // an empty description is allowed: the tile then shows none
      href,
      iconKey: o.iconKey ?? (c.custom ? 'Star' : iconKeyOf(c.icon)),
      iconSize: o.iconSize ?? 'md',
      accent: o.accent ?? c.accent,
      external: Boolean(c.external),
      badge: c.badge,
      news: Boolean(c.news),
      status: o.status ?? c.status ?? 'live',
      width: o.width ?? (o.wide || c.featured ? 'wide' : 'normal'),
      height: o.height ?? 'standard',
      locked,
      greyed: locked && Boolean(o.greyed),
      hidden: Boolean(o.hidden) || (kind === 'link' && !isSafeUrl(c.custom?.url)),
      gallery: Boolean(c.gallery),
      lockable: Boolean(c.lockable),
      custom: Boolean(c.custom),
      kind,
    };
  });
  return opts.includeHidden ? views : views.filter((v) => !v.hidden);
}

/** The real destination of a link box (server-side only: never put this in a locked box's HTML). */
export const linkTarget = (s: SiteSettings, id: string) => s.custom.find((c) => c.id === id && c.kind === 'link')?.url;

export const mediaUrl = (pathname: string) => `/media/${pathname}`;
