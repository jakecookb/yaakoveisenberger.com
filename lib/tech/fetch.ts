import 'server-only';
import { isLiveStore } from '@/lib/admin/store';
import { buildTech } from '@/lib/news/build';
import { readNews } from '@/lib/news/article';
import type { TechSelection } from './pick';

export interface TechFeed extends TechSelection {
  updatedAt: string;
  stale: boolean;
}

const STALE_MS = 3 * 3600_000;

/** Same approach as the car feed: the live site reads the saved list (rebuilt every 30 minutes by the scheduled GitHub Action). */
export async function loadTechFeed(): Promise<TechFeed> {
  if (!isLiveStore) {
    const sel = await buildTech();
    if (sel) return { ...sel, updatedAt: new Date().toISOString(), stale: false };
  } else {
    const saved = await readNews<{ at: number; v: TechSelection }>('news/tech-feed.json');
    if (saved) return { ...saved.v, updatedAt: new Date(saved.at).toISOString(), stale: Date.now() - saved.at > STALE_MS };
  }
  return { samsung: [], apple: [], more: [], updatedAt: new Date().toISOString(), stale: true };
}
