import {
  AudioLines,
  BookOpen,
  Beef,
  CalendarCheck,
  Camera,
  CarFront,
  ChefHat,
  Clapperboard,
  CodeXml,
  Disc3,
  KeyRound,
  ShieldCheck,
  SquareTerminal,
  Crosshair,
  Fish,
  Gauge,
  QrCode,
  HandHeart,
  Music,
  Scissors,
  WandSparkles,
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
  /** A live news feed: its tile shows a small "news" pill. */
  news?: boolean;
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
  { id: 'tech', news: true, lockable: true, title: 'Tech & Gadgets', teaser: 'Live news on Samsung Galaxy, iPhone and wearables — S27 Ultra leaks included.', href: '/tech', icon: CodeXml, accent: '#34d399', badge: 'new' },
  { id: 'speed', lockable: true, title: 'Speed Test', teaser: 'Check your download, upload and ping in seconds.', href: '/speed', icon: Gauge, accent: '#22d3ee', badge: 'new' },
  { id: 'cookbook', lockable: true, title: 'Cookbook & Recipes', teaser: 'Family recipes — scanned, scaled, saved and shared.', href: '/cookbook', icon: ChefHat, accent: '#fb923c', external: true },
  { id: 'bookbinding', gallery: true, lockable: true, title: 'Book Binding', teaser: 'Hand-bound books, sewn and finished the slow way.', href: '/bookbinding', icon: BookOpen, accent: '#d6a27a', status: 'soon' },
  { id: 'fishboards', gallery: true, lockable: true, title: 'Fish Boards', teaser: 'Beautifully arranged boards for the Shabbos table.', href: '/fishboards', icon: Fish, accent: '#22d3ee', status: 'soon' },
  { id: 'meatboards', gallery: true, lockable: true, title: 'Meat Boards', teaser: 'Showstopping grazing boards, made to order.', href: '/meatboards', icon: Beef, accent: '#ef4444', status: 'soon' },
  { id: 'music', gallery: true, lockable: true, title: 'Music & DJ', teaser: 'Sound and sets for simchas and events.', href: '/music', icon: Music, accent: '#e879f9', status: 'soon' },
  { id: 'separator', lockable: true, title: 'Audio Separator', teaser: 'Split any song into vocals and instrumental — free, private, right in your browser.', href: '/separator', icon: AudioLines, accent: '#a3e635', badge: 'new', external: true /* needs a full page load so the browser applies the cross-origin isolation headers (multi-threaded WebAssembly) */ },
  { id: 'cars', news: true, lockable: true, title: 'Latest Car Reveals', teaser: 'Fresh reveals and concepts from around the web — about seven new ones every week.', href: '/cars', icon: CarFront, accent: '#818cf8', badge: 'new' },
  { id: 'qr', lockable: true, title: 'QR Code Generator', teaser: 'Turn any link or text into a branded QR code — instant, free, downloadable.', href: '/qr', icon: QrCode, accent: '#f472b6', badge: 'new' },
  { id: 'editor', lockable: true, title: 'AI Photo Suite', teaser: 'Pro photo editor with AI background removal, auto-enhance and color grades — free, right in your browser.', href: '/editor', icon: WandSparkles, accent: '#fda4af', badge: 'new', external: true /* full page load for cross-origin isolation (multi-threaded AI) */ },
  { id: 'weapons', news: true, lockable: true, title: 'Weapons & 2A Hub', teaser: 'Handguns, long guns and knives — plus the latest on 2A law and carry reciprocity.', href: '/weapons', icon: Crosshair, accent: '#fb923c', badge: 'new' },
  { id: 'audio-remix', lockable: true, title: 'Wedding Intro Remix', teaser: 'Stitch songs into one on-beat intro — low, bridge, high — and export MP3 or WAV.', href: '/audio-remix', icon: Disc3, accent: '#c084fc', badge: 'new' },
  { id: 'ccw', lockable: true, title: 'CCW Reciprocity & Laws', teaser: 'Up to four permits, 50-state coverage map, and every state’s carry rules.', href: '/ccw', icon: ShieldCheck, accent: '#f59e0b', badge: 'new' },
  { id: 'rentals', lockable: true, title: 'Rental Command Center', teaser: 'Hertz, National and Avis side by side — AAA and codes saved, true all-in totals.', href: '/rentals', icon: KeyRound, accent: '#60a5fa', badge: 'new' },
  { id: 'devtools', lockable: true, title: 'Developer Tools', teaser: 'JSON → TypeScript, glass style builder, Git cheat sheet, Base64 & URL tools.', href: '/devtools', icon: SquareTerminal, accent: '#2dd4bf', badge: 'new' },
  { id: 'contact', lockable: true, title: 'Contact & Booking', teaser: 'Start a project or check availability.', href: '/contact', icon: CalendarCheck, accent: '#fbbf24' },
];

export const getCategory = (id: string) => categories.find((c) => c.id === id);
