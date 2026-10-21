import { CodeXml } from 'lucide-react';
import { CarCard } from '@/components/cars/car-card';
import { NEWS_GRID, phoneOrphan } from '@/components/cars/news-grid';
import { loadTechFeed } from '@/lib/tech/fetch';
import { SOURCES } from '@/lib/tech/sources';
import type { CarItem } from '@/lib/cars/types';

export const metadata = { title: 'Tech & Gadgets' };
export const revalidate = 1800;

const ACCENT = '#34d399';

// One large story plus rows of three, so the grid never ends with a gap.
const fit = (n: number) => (n >= 4 ? 1 + Math.floor((n - 1) / 3) * 3 : n);

function Section({ title, hint, items: all }: { title: string; hint: string; items: CarItem[] }) {
  const items = all.slice(0, fit(all.length));
  if (items.length === 0) return null;
  return (
    <>
      <div className="mt-14 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: ACCENT }}>{title}</h2>
        <p className="text-sm text-neutral-500">{hint}</p>
      </div>
      <div className={`mt-5 ${NEWS_GRID}`}>
        {items.map((c, i) => <CarCard key={c.id} car={c} accent={ACCENT} featured={i === 0 && items.length > 2} className={phoneOrphan(i, items.length, items.length > 2)} />)}
      </div>
    </>
  );
}

export default async function TechPage() {
  const feed = await loadTechFeed();
  const empty = feed.samsung.length + feed.apple.length + feed.more.length === 0;
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mt-6 flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-neutral-950" style={{ background: ACCENT }}><CodeXml className="size-7" strokeWidth={2.2} /></span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Tech &amp; Gadgets</h1>
            <p className="mt-1 text-neutral-400">The latest on Samsung Galaxy, iPhone and wearables — refreshed automatically.</p>
          </div>
        </div>

        {empty ? (
          <p className="mt-12 rounded-3xl bg-neutral-900/70 p-8 text-center text-neutral-400 ring-1 ring-white/10">The feed is taking a breather — check back in a few minutes.</p>
        ) : (
          <>
            <Section title="Samsung Galaxy" hint="Galaxy S26 Ultra news and the latest Galaxy S27 Ultra leaks" items={feed.samsung} />
            <Section title="Apple" hint="iPhone, iOS and Apple Watch" items={feed.apple} />
            <Section title="Wearables & more phones" hint="Watches, rings, earbuds and other phones" items={feed.more} />
          </>
        )}

        <p className="mt-12 text-xs leading-relaxed text-neutral-500">
          Headlines and images link to the original stories at {SOURCES.map((s) => s.name).join(', ')}. Rumours and leaks are tagged as such and aren&apos;t confirmed. Updated automatically every 30 minutes{feed.stale ? ' (showing the last saved list right now)' : ''}.
        </p>
      </div>
    </section>
  );
}
