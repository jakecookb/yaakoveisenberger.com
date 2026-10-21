import {
  AudioLines, Beef, BookOpen, Briefcase, CalendarCheck, Cake, Camera, CarFront, ChefHat, Clapperboard, CodeXml, Crosshair, PartyPopper, Disc3, KeyRound, ShieldCheck, SquareTerminal, Film, Fish, Gauge, Globe,
  Hammer, HandHeart, Heart, Image as ImageIcon, Mic, Music, Palette, QrCode, Scissors, Sparkles, Star, Utensils, WandSparkles,
  type LucideIcon,
} from 'lucide-react';

// Icons the admin editor can pick from. Add an entry here and it shows up in the picker.
export const ICONS = {
  HandHeart, Clapperboard, Scissors, Camera, CodeXml, ChefHat, BookOpen, Fish, Beef, Music, CalendarCheck,
  Heart, Star, Film, AudioLines, CarFront, Gauge, QrCode, Image: ImageIcon, Mic, Palette, Hammer, Utensils, Globe, Sparkles, Briefcase, Cake, WandSparkles, Crosshair, PartyPopper, Disc3, ShieldCheck, KeyRound, SquareTerminal,
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONS;
export const ICON_KEYS = Object.keys(ICONS) as [IconKey, ...IconKey[]];

export function iconKeyOf(icon: LucideIcon): IconKey {
  return (ICON_KEYS.find((k) => ICONS[k] === icon) ?? 'Star') as IconKey;
}
