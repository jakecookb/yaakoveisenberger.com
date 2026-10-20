import { z } from 'zod';
import { categories } from '@/data/navigation';
import { ICON_KEYS, iconKeyOf, type IconKey } from '@/data/icons';

// Shared (server + client) description of everything the admin editor can change.
// Safe to import from client components: no secrets, no server-only modules.

export const ICON_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type IconSize = (typeof ICON_SIZES)[number];

const cardOverride = z.object({
  title: z.string().trim().min(1).max(60).optional(),
  teaser: z.string().trim().max(200).optional(),
  hidden: z.boolean().optional(),
  status: z.enum(['live', 'soon']).optional(),
  locked: z.boolean().optional(),
  wide: z.boolean().optional(),
  iconKey: z.enum(ICON_KEYS).optional(),
  iconSize: z.enum(ICON_SIZES).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

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
  order: z.array(z.string().max(40)).max(60),
  cards: z.record(z.string().max(40), cardOverride),
  pages: z.record(z.string().max(40), z.object({ heading: z.string().trim().max(80).optional(), body: z.string().trim().max(4000).optional() })),
  photos: z.record(z.string().max(40), z.array(photo).max(500)),
});

export type SiteSettings = z.infer<typeof settingsSchema>;
export type CardOverride = z.infer<typeof cardOverride>;
export type Photo = z.infer<typeof photo>;

export const DEFAULT_TAGLINE = 'Video, projects, food and fundraising — everything in one place.';

export const defaultSettings = (): SiteSettings => ({
  hero: { tagline: DEFAULT_TAGLINE },
  order: [],
  cards: {},
  pages: {},
  photos: {},
});

/** Drops anything that isn't a known category so stale or tampered ids never persist. */
export function sanitizeSettings(input: SiteSettings): SiteSettings {
  const known = new Set(categories.map((c) => c.id));
  const only = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => known.has(k)));
  const galleryIds = new Set(categories.filter((c) => c.gallery).map((c) => c.id));
  const lockable = new Set(categories.filter((c) => c.lockable).map((c) => c.id));
  const cards = only(input.cards);
  for (const [id, o] of Object.entries(cards)) if (o.locked && !lockable.has(id)) delete o.locked;
  return {
    hero: input.hero,
    order: input.order.filter((id, i, a) => known.has(id) && a.indexOf(id) === i),
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
  href: string;
  iconKey: IconKey;
  iconSize: IconSize;
  accent: string;
  external: boolean;
  badge?: 'live' | 'new';
  status: 'live' | 'soon';
  wide: boolean;
  locked: boolean;
  hidden: boolean;
  gallery: boolean;
  lockable: boolean;
}

export function resolveCards(s: SiteSettings, opts: { includeHidden?: boolean } = {}): CardView[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const ids = [...s.order.filter((id) => byId.has(id)), ...categories.map((c) => c.id).filter((id) => !s.order.includes(id))];
  const views = ids.map((id): CardView => {
    const c = byId.get(id)!;
    const o = s.cards[id] ?? {};
    return {
      id,
      title: o.title ?? c.title,
      teaser: o.teaser ?? c.teaser,
      href: c.href,
      iconKey: o.iconKey ?? iconKeyOf(c.icon),
      iconSize: o.iconSize ?? 'md',
      accent: o.accent ?? c.accent,
      external: Boolean(c.external),
      badge: c.badge,
      status: o.status ?? c.status ?? 'live',
      wide: o.wide ?? Boolean(c.featured),
      locked: Boolean(c.lockable && o.locked),
      hidden: Boolean(o.hidden),
      gallery: Boolean(c.gallery),
      lockable: Boolean(c.lockable),
    };
  });
  return opts.includeHidden ? views : views.filter((v) => !v.hidden);
}

export const mediaUrl = (pathname: string) => `/media/${pathname}`;
