import 'server-only';
import { isLiveStore } from '@/lib/admin/store';
import { buildCars } from '@/lib/news/build';
import { readNews } from '@/lib/news/article';
import type { Selection } from './pick';

export interface CarFeed extends Selection {
  updatedAt: string;
  stale: boolean;
}

const STALE_MS = 3 * 3600_000;

/**
 * The feed for /cars. On the live site this only reads the saved list that the scheduled GitHub Action rebuilds every 30
 * minutes (a visitor's request must stay far under the Cloudflare free plan's 10 ms CPU limit). Local development builds live.
 */
export async function loadCarFeed(): Promise<CarFeed> {
  if (!isLiveStore) {
    const sel = await buildCars();
    if (sel) return { ...sel, updatedAt: new Date().toISOString(), stale: false };
  } else {
    const saved = await readNews<{ at: number; v: Selection }>('news/cars-feed.json');
    if (saved) return { ...saved.v, updatedAt: new Date(saved.at).toISOString(), stale: Date.now() - saved.at > STALE_MS };
  }
  return { thisWeek: [], earlier: [], updatedAt: new Date().toISOString(), stale: true };
}
