import 'server-only';
import { isLiveStore } from '@/lib/admin/store';
import { buildWeapons } from '@/lib/news/build';
import { readNews } from '@/lib/news/article';
import type { WeaponsSelection } from './pick';

export interface WeaponsFeed extends WeaponsSelection {
  updatedAt: string;
  stale: boolean;
}

const STALE_MS = 3 * 3600_000;

/** Same approach as the car feed: the live site reads the saved list (rebuilt every 30 minutes by the scheduled GitHub Action). */
export async function loadWeaponsFeed(): Promise<WeaponsFeed> {
  if (!isLiveStore) {
    const sel = await buildWeapons();
    if (sel) return { ...sel, updatedAt: new Date().toISOString(), stale: false };
  } else {
    const saved = await readNews<{ at: number; v: WeaponsSelection }>('news/weapons-feed.json');
    if (saved) return { ...saved.v, updatedAt: new Date(saved.at).toISOString(), stale: Date.now() - saved.at > STALE_MS };
  }
  return { handguns: [], longguns: [], knives: [], rights: [], updatedAt: new Date().toISOString(), stale: true };
}
