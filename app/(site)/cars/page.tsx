import Link from 'next/link';
import { ArrowLeft, CarFront } from 'lucide-react';
import { CarCard } from '@/components/cars/car-card';
import { loadCarFeed } from '@/lib/cars/fetch';
import { SOURCES } from '@/lib/cars/sources';

export const metadata = { title: 'Latest Car Reveals' };
export const revalidate = 1800;

export default async function CarsPage() {
  const feed = await loadCarFeed();
  const [first, ...rest] = feed.thisWeek;
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-white">
          <ArrowLeft className="size-4" /> All projects
        </Link>
        <div className="mt-6 flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-2xl text-neutral-950" style={{ background: '#818cf8' }}><CarFront className="size-7" strokeWidth={2.2} /></span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Latest Car Reveals</h1>
            <p className="mt-1 text-neutral-400">The newest reveals and concepts — about seven fresh ones every week.</p>
          </div>
        </div>

        {first ? (
          <>
            <h2 className="mt-12 text-sm font-semibold uppercase tracking-[0.3em] text-[#818cf8]">This week</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <CarCard car={first} featured />
              {rest.map((c) => <CarCard key={c.id} car={c} />)}
            </div>
            {feed.earlier.length > 0 && (
              <>
                <h2 className="mt-14 text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500">Earlier</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {feed.earlier.map((c) => <CarCard key={c.id} car={c} />)}
                </div>
              </>
            )}
          </>
        ) : (
          <p className="mt-12 rounded-3xl bg-neutral-900/70 p-8 text-center text-neutral-400 ring-1 ring-white/10">The feed is taking a breather — check back in a few minutes.</p>
        )}

        <p className="mt-12 text-xs leading-relaxed text-neutral-500">
          Headlines and images link to the original stories at {SOURCES.map((s) => s.name).join(', ')}. Updated automatically every 30 minutes{feed.stale ? ' (showing the last saved list right now)' : ''}.
        </p>
      </div>
    </section>
  );
}
