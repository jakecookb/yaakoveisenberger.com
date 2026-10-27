import { Crosshair } from 'lucide-react';
import { WeaponsFeed } from '@/components/weapons/weapons-feed';
import { loadWeaponsFeed } from '@/lib/weapons/fetch';
import { SOURCES } from '@/lib/weapons/sources';

export const metadata = { title: 'Weapons & 2A Hub', description: 'Latest handgun, long gun and knife news, plus Second Amendment legislation, court cases and carry-permit reciprocity.' };
export const revalidate = 1800;

export default async function WeaponsPage() {
  const feed = await loadWeaponsFeed();
  const names = [...new Set(SOURCES.filter((s) => !s.gnews).map((s) => s.name))];
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mt-6 flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-neutral-950" style={{ background: '#fb923c' }}><Crosshair className="size-7" strokeWidth={2.2} /></span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Weapons &amp; 2A Hub</h1>
            <p className="mt-1 text-neutral-400">Firearm and knife news, specs, and the latest on gun-rights law — refreshed automatically.</p>
          </div>
        </div>
        <WeaponsFeed feed={feed} />
        <p className="mt-12 text-xs leading-relaxed text-neutral-500">
          Each story opens a short summary here, with a link to the original at {names.join(', ')}, plus Google News searches for knife-law and permit-reciprocity coverage.
          News only — not legal advice; laws change, so check your state’s current rules before you carry or travel. Updated automatically every 30 minutes{feed.stale ? ' (showing the last saved list right now)' : ''}.
        </p>
      </div>
    </section>
  );
}
