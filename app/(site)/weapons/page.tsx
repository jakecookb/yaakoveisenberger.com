import { Crosshair } from 'lucide-react';
import { CarCard } from '@/components/cars/car-card';
import { NEWS_GRID } from '@/components/cars/news-grid';
import { loadWeaponsFeed } from '@/lib/weapons/fetch';
import { SOURCES } from '@/lib/weapons/sources';
import type { WeaponItem, WeaponsTab } from '@/lib/weapons/pick';

export const metadata = { title: 'Weapons & 2A Hub', description: 'Latest handgun, long gun and knife news, plus Second Amendment legislation, court cases and carry-permit reciprocity.' };
export const revalidate = 1800;

const ACCENT = '#fb923c';

// The sections, in the order they appear on the page.
const SECTIONS: { id: WeaponsTab; title: string; hint: string }[] = [
  { id: 'handguns', title: 'Handguns', hint: 'New pistols and revolvers, reviews and specs' },
  { id: 'longguns', title: 'Long Guns', hint: 'Rifles, shotguns, optics and suppressors' },
  { id: 'knives', title: 'Knives & Edged Tools', hint: 'New knives, blade steels and knife law' },
  { id: 'rights', title: '2A Gun Rights News', hint: 'Legislation, court cases and carry-permit reciprocity' },
];

// One large story plus a row of three (never more than four per section), so the grid ends cleanly and the page stays easy to scan.
const fit = (n: number) => Math.min(n, 4);

function Section({ id, title, hint, items: all }: { id: string; title: string; hint: string; items: WeaponItem[] }) {
  const items = all.slice(0, fit(all.length));
  if (items.length === 0) return null;
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mt-14 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: ACCENT }}>{title}</h2>
        <p className="text-sm text-neutral-500">{hint}</p>
      </div>
      <div className={`mt-5 ${NEWS_GRID}`}>
        {items.map((c, i) => <CarCard key={c.id} topic="weapons" car={c} accent={ACCENT} featured={i === 0 && items.length > 2} />)}
      </div>
    </section>
  );
}

export default async function WeaponsPage() {
  const feed = await loadWeaponsFeed();
  const names = [...new Set(SOURCES.filter((s) => !s.gnews).map((s) => s.name))];
  const empty = SECTIONS.every((s) => feed[s.id].length === 0);
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mt-6 flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-neutral-950" style={{ background: ACCENT }}><Crosshair className="size-7" strokeWidth={2.2} /></span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Weapons &amp; 2A Hub</h1>
            <p className="mt-1 text-neutral-400">Firearm and knife news, specs, and the latest on gun-rights law — refreshed automatically.</p>
          </div>
        </div>

        {empty ? (
          <p className="mt-12 rounded-3xl bg-neutral-900/70 p-8 text-center text-neutral-400 ring-1 ring-white/10">The feed is taking a breather — check back in a few minutes.</p>
        ) : (
          SECTIONS.map((s) => <Section key={s.id} id={s.id} title={s.title} hint={s.hint} items={feed[s.id]} />)
        )}

        <p className="mt-12 text-xs leading-relaxed text-neutral-500">
          Each story opens here on the site, with a link to the original at {names.join(', ')}, plus Google News searches for knife-law and permit-reciprocity coverage.
          News only — not legal advice; laws change, so check your state’s current rules before you carry or travel. Updated automatically every 30 minutes{feed.stale ? ' (showing the last saved list right now)' : ''}.
        </p>
      </div>
    </section>
  );
}
