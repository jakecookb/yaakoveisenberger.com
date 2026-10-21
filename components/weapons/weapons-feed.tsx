'use client';

import { useEffect, useState } from 'react';
import { CarCard } from '@/components/cars/car-card';
import { NEWS_GRID, phoneOrphan } from '@/components/cars/news-grid';
import type { WeaponItem, WeaponsSelection, WeaponsTab } from '@/lib/weapons/pick';

const ACCENT = '#fb923c';
export const TABS: { id: WeaponsTab; label: string; hint: string }[] = [
  { id: 'handguns', label: 'Handguns', hint: 'New pistols and revolvers, reviews and specs' },
  { id: 'longguns', label: 'Long Guns', hint: 'Rifles, shotguns, optics and suppressors' },
  { id: 'knives', label: 'Knives & Edged Tools', hint: 'New knives, blade steels and knife law' },
  { id: 'rights', label: '2A Gun Rights News', hint: 'Legislation, court cases and carry-permit reciprocity' },
];

// One large story, then rows of three, so the grid never ends with a gap.
const fit = (n: number) => (n >= 4 ? 1 + Math.floor((n - 1) / 3) * 3 : n);

/** The four tabs. The chosen tab is kept in the address (#knives etc.) so it can be shared or bookmarked. */
export function WeaponsFeed({ feed }: { feed: WeaponsSelection }) {
  const [tab, setTab] = useState<WeaponsTab>('handguns');
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); if (TABS.some((t) => t.id === h)) setTab(h as WeaponsTab); };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const choose = (t: WeaponsTab) => { setTab(t); history.replaceState(null, '', `#${t}`); };
  const all: WeaponItem[] = feed[tab];
  const items = all.slice(0, fit(all.length));
  const info = TABS.find((t) => t.id === tab)!;

  return (
    <div className="mt-10">
      <div role="tablist" aria-label="Topics" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.id} role="tab" aria-selected={tab === t.id} aria-controls="weapons-panel" onClick={() => choose(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1 transition ${tab === t.id ? 'bg-[#fb923c] text-neutral-950 ring-[#fb923c]' : 'bg-neutral-900/70 text-neutral-300 ring-white/10 hover:text-white hover:ring-white/25'}`}
          >
            {t.label} <span className={`ml-1 font-mono text-xs ${tab === t.id ? 'text-neutral-900/70' : 'text-neutral-500'}`}>{feed[t.id].length}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-neutral-500">{info.hint}</p>
      <div id="weapons-panel" role="tabpanel" aria-label={info.label} className={`mt-5 ${NEWS_GRID}`}>
        {items.length === 0 && <p className="col-span-full rounded-3xl bg-neutral-900/70 p-8 text-center text-neutral-400 ring-1 ring-white/10">No fresh stories in this section right now — check back soon.</p>}
        {items.map((c, i) => <CarCard key={c.id} car={c} accent={ACCENT} featured={i === 0 && items.length > 2} className={phoneOrphan(i, items.length, items.length > 2)} />)}
      </div>
    </div>
  );
}
