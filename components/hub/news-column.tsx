import { ArrowUpRight } from 'lucide-react';
import { loadCarFeed } from '@/lib/cars/fetch';
import { loadTechFeed } from '@/lib/tech/fetch';
import { loadWeaponsFeed } from '@/lib/weapons/fetch';
import type { CarItem } from '@/lib/cars/types';

/** The hub's NEWS feed: the freshest stories from the Weapons & 2A, car and tech feeds, each with a "news" pill. */
export async function NewsStrip() {
  const [w, c, t] = await Promise.all([loadWeaponsFeed().catch(() => null), loadCarFeed().catch(() => null), loadTechFeed().catch(() => null)]);
  const pick: [CarItem | undefined, string, string][] = [
    ...(w?.rights.slice(0, 2) ?? []).map((i) => [i, '2A News', '/weapons#rights'] as [CarItem, string, string]),
    [w?.handguns[0], 'Weapons', '/weapons'], [w?.knives[0], 'Weapons', '/weapons#knives'],
    [c?.thisWeek[0], 'Cars', '/cars'], [c?.thisWeek[1], 'Cars', '/cars'],
    [t?.samsung[0], 'Tech', '/tech'], [t?.apple[0], 'Tech', '/tech'],
  ];
  const items = pick.filter((x): x is [CarItem, string, string] => Boolean(x[0])).sort((a, b) => +new Date(b[0].publishedAt) - +new Date(a[0].publishedAt)).slice(0, 8);
  if (!items.length) return null;
  return (
    <ul className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {items.map(([i, label]) => (
        <li key={i.id}>
          <a href={i.url} target="_blank" rel="noopener noreferrer" className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-neutral-900/70 ring-1 ring-white/10 transition hover:ring-white/30 sm:rounded-3xl">
            <span className="absolute right-2.5 top-2.5 z-10 rounded-full border border-white/15 bg-neutral-950/55 px-2 py-0.5 font-mono text-[10px] lowercase leading-4 tracking-[0.12em] text-neutral-300/90 backdrop-blur-sm">news</span>
            {i.image ? <img src={i.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[16/9] w-full object-cover opacity-90 transition duration-500 group-hover:scale-105" /> : <span className="aspect-[16/9] w-full bg-gradient-to-br from-neutral-800 to-neutral-900" aria-hidden />}
            <span className="flex flex-1 flex-col gap-1 p-3">
              <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label} · {i.source}</span>
              <span className="line-clamp-3 text-sm font-medium leading-snug text-white">{i.title}</span>
              <ArrowUpRight className="mt-auto size-4 self-end text-neutral-600 transition group-hover:text-white" aria-hidden />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
