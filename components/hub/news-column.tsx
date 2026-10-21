import { ArrowUpRight, Newspaper } from 'lucide-react';
import { loadCarFeed } from '@/lib/cars/fetch';
import { loadTechFeed } from '@/lib/tech/fetch';
import { loadWeaponsFeed } from '@/lib/weapons/fetch';
import type { CarItem } from '@/lib/cars/types';

/** The hub's NEWS sidebar: the freshest stories from the Weapons & 2A, car and tech feeds. */
export async function NewsColumn() {
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
    <aside aria-labelledby="news-h" className="rounded-3xl bg-neutral-900/50 p-4 ring-1 ring-white/10">
      <h2 id="news-h" className="flex items-center gap-2 px-1 font-mono text-xs font-semibold uppercase tracking-[0.3em] text-neutral-300"><Newspaper className="size-4 text-[#fb923c]" /> News</h2>
      <ul className="mt-3 space-y-2.5">
        {items.map(([i, label, href]) => (
          <li key={i.id}>
            <a href={i.url} target="_blank" rel="noopener noreferrer" className="group relative block rounded-2xl bg-neutral-950/60 p-3 pr-14 ring-1 ring-white/5 transition hover:ring-white/20">
              <span className="absolute right-2.5 top-2.5 rounded-full border border-white/15 bg-neutral-950/50 px-2 py-0.5 font-mono text-[10px] lowercase leading-4 tracking-[0.12em] text-neutral-300/90">news</span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label} · {i.source}</span>
              <span className="mt-1 line-clamp-3 block text-sm font-medium leading-snug text-white">{i.title}</span>
              <ArrowUpRight className="absolute bottom-2.5 right-2.5 size-4 text-neutral-600 transition group-hover:text-white" aria-hidden />
            </a>
            <a href={href} className="sr-only">More {label} stories</a>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-3 px-1 text-xs"><a href="/weapons" className="text-neutral-400 hover:text-white">Weapons & 2A →</a><a href="/cars" className="text-neutral-400 hover:text-white">Cars →</a><a href="/tech" className="text-neutral-400 hover:text-white">Tech →</a></div>
    </aside>
  );
}
