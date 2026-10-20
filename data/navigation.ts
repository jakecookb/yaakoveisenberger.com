import {
  AudioLines,
  BookOpen,
  Beef,
  CalendarCheck,
  Camera,
  ChefHat,
  Clapperboard,
  CodeXml,
  Fish,
  HandHeart,
  Music,
  Scissors,
  type LucideIcon,
} from 'lucide-react';

// Every card on the home-page hub lives here. To add a venture, add one entry to
// `categories` — the grid, the "coming soon" stub (if you set status: 'soon') and the
// layout all pick it up. Order here is the order on the page.

export interface NavCategory {
  id: string;
  title: string;
  teaser: string;
  href: string;
  icon: LucideIcon;
  /** Hex colour used for the icon tile, border glow and hover highlight. */
  accent: string;
  /** Served by a different app behind a rewrite (e.g. /cookbook) → needs a full page load. */
  external?: boolean;
  /** 'live' shows a pulsing "Live" chip (with a campaign count when known). */
  badge?: 'live' | 'new';
  /** 'soon' shows a "Soon" chip; the page shows "Coming soon" until it has photos. */
  status?: 'live' | 'soon';
  /** Spans two columns on wider screens. */
  featured?: boolean;
  /** Page has a photo gallery the admin can fill. */
  gallery?: boolean;
  /** Box can be locked: a proxy gate stops unapproved visitors (also for boxes that open a separate site). */
  lockable?: boolean;
}

export const categories: NavCategory[] = [
  { id: 'fund', lockable: true, title: 'Funding Platform', teaser: 'Live matching campaigns — every gift multiplied and counted in real time.', href: '/fund', icon: HandHeart, accent: '#c8a96a', badge: 'live', featured: true },
  { id: 'video', gallery: true, lockable: true, title: 'Video & Media', teaser: 'Featured films, camp highlights and event videos.', href: '/video', icon: Clapperboard, accent: '#f43f5e' },
  { id: 'editing', gallery: true, lockable: true, title: 'Video Editing', teaser: 'Story-first edits, motion and color for your next project.', href: '/editing', icon: Scissors, accent: '#a78bfa', status: 'soon' },
  { id: 'photography', gallery: true, lockable: true, title: 'Photography', teaser: 'Events, portraits and the moments in between.', href: '/photography', icon: Camera, accent: '#38bdf8', status: 'soon' },
  { id: 'tech', gallery: true, lockable: true, title: 'Tech Projects', teaser: 'Apps, tools and experiments built and shipped.', href: '/tech', icon: CodeXml, accent: '#34d399', status: 'soon' },
  { id: 'cookbook', lockable: true, title: 'Cookbook & Recipes', teaser: 'Family recipes — scanned, scaled, saved and shared.', href: '/cookbook', icon: ChefHat, accent: '#fb923c', external: true },
  { id: 'bookbinding', gallery: true, lockable: true, title: 'Book Binding', teaser: 'Hand-bound books, sewn and finished the slow way.', href: '/bookbinding', icon: BookOpen, accent: '#d6a27a', status: 'soon' },
  { id: 'fishboards', gallery: true, lockable: true, title: 'Fish Boards', teaser: 'Beautifully arranged boards for the Shabbos table.', href: '/fishboards', icon: Fish, accent: '#22d3ee', status: 'soon' },
  { id: 'meatboards', gallery: true, lockable: true, title: 'Meat Boards', teaser: 'Showstopping grazing boards, made to order.', href: '/meatboards', icon: Beef, accent: '#ef4444', status: 'soon' },
  { id: 'music', gallery: true, lockable: true, title: 'Music & DJ', teaser: 'Sound and sets for simchas and events.', href: '/music', icon: Music, accent: '#e879f9', status: 'soon' },
  { id: 'separator', lockable: true, title: 'Audio Separator', teaser: 'Split any song into vocals and instrumental — free, private, right in your browser.', href: '/separator', icon: AudioLines, accent: '#a3e635', badge: 'new' },
  { id: 'contact', lockable: true, title: 'Contact & Booking', teaser: 'Start a project or check availability.', href: '/contact', icon: CalendarCheck, accent: '#fbbf24' },
];

export const getCategory = (id: string) => categories.find((c) => c.id === id);
