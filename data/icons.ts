import {
  AudioLines, Beef, BookOpen, Briefcase, CalendarCheck, Cake, Camera, CarFront, ChefHat, Clapperboard, CodeXml, Film, Fish, Globe,
  Hammer, HandHeart, Heart, Image as ImageIcon, Mic, Music, Palette, Scissors, Sparkles, Star, Utensils,
  type LucideIcon,
} from 'lucide-react';

// Icons the admin editor can pick from. Add an entry here and it shows up in the picker.
export const ICONS = {
  HandHeart, Clapperboard, Scissors, Camera, CodeXml, ChefHat, BookOpen, Fish, Beef, Music, CalendarCheck,
  Heart, Star, Film, AudioLines, CarFront, Image: ImageIcon, Mic, Palette, Hammer, Utensils, Globe, Sparkles, Briefcase, Cake,
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONS;
export const ICON_KEYS = Object.keys(ICONS) as [IconKey, ...IconKey[]];

export function iconKeyOf(icon: LucideIcon): IconKey {
  return (ICON_KEYS.find((k) => ICONS[k] === icon) ?? 'Star') as IconKey;
}
