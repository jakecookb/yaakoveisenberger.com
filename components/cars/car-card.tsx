'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { CarItem } from '@/lib/cars/types';

const ago = (iso: string, now: number) => {
  const d = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 3_600_000));
  return d < 1 ? 'Just now' : d < 24 ? `${d}h ago` : `${Math.floor(d / 24)}d ago`;
};

// Pages are generated ahead of time, so "how long ago" is only worked out in the browser; the generated page shows the
// date instead (otherwise the two disagree and React has to redo the page).
const noop = () => () => {};
const useNow = () => useSyncExternalStore(noop, () => Math.floor(Date.now() / 60_000) * 60_000, () => 0);
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Phones show news cards two per row, so a normal card is compact there; the featured one spans the row. */
export function CarCard({ car, featured, accent = '#818cf8', className = '' }: { car: CarItem; featured?: boolean; accent?: string; className?: string }) {
  const now = useNow();
  // Same touch-glow as the hub cards: lights up on touch, even while the finger scrolls.
  const [touched, setTouched] = useState(false);
  const fade = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(fade.current), []);
  const on = () => { clearTimeout(fade.current); setTouched(true); };
  const off = () => { clearTimeout(fade.current); fade.current = setTimeout(() => setTouched(false), 450); };

  return (
    <a
      href={car.url}
      target="_blank"
      rel="noopener noreferrer"
      data-active={touched}
      onTouchStart={on}
      onTouchEnd={off}
      onTouchCancel={off}
      style={{ '--accent': accent } as React.CSSProperties}
      className={`group relative flex flex-col overflow-hidden rounded-3xl bg-neutral-900/70 ring-1 ring-white/10 outline-none [-webkit-tap-highlight-color:transparent] transition-[box-shadow,transform] duration-300 hover:ring-[var(--accent)] hover:shadow-[0_20px_60px_-20px_var(--accent)] data-[active=true]:-translate-y-1 data-[active=true]:ring-[var(--accent)] data-[active=true]:shadow-[0_20px_60px_-20px_var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${featured ? 'col-span-2 lg:col-span-3 lg:flex-row' : 'rounded-2xl sm:rounded-3xl'} ${className}`}
    >
      <div className={`relative overflow-hidden bg-neutral-800 ${featured ? 'aspect-[16/9] lg:aspect-auto lg:w-3/5' : 'aspect-[16/10]'}`}>
        {!car.image && (
          // No picture in the feed: a quiet gradient with the source's name instead of an empty box.
          <div className="flex size-full items-end bg-[radial-gradient(120%_90%_at_10%_0%,color-mix(in_srgb,var(--accent)_22%,transparent),transparent_60%),linear-gradient(160deg,#1c1c1c,#0f0f0f)] p-4" aria-hidden>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">{car.source}</span>
          </div>
        )}
        {car.image && (
          <img src={car.image} alt="" loading={featured ? 'eager' : 'lazy'} referrerPolicy="no-referrer" className="size-full object-cover transition duration-500 group-hover:scale-105 group-data-[active=true]:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/70 via-transparent to-transparent" aria-hidden />
        <div className={`absolute flex flex-wrap gap-1.5 ${featured ? 'left-3 top-3' : 'left-2 top-2 sm:left-3 sm:top-3'}`}>
          {car.tags.map((t, i) => (
            <span key={t} className={`rounded-full bg-neutral-950/70 font-semibold uppercase tracking-wider text-white ring-1 ring-white/20 backdrop-blur ${featured ? 'px-2.5 py-1 text-[11px]' : `px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-[11px] ${i > 0 ? 'hidden sm:inline' : ''}`}`}>{t}</span>
          ))}
        </div>
      </div>
      <div className={`flex flex-1 flex-col ${featured ? 'gap-3 p-5 sm:p-6 lg:justify-center lg:p-10' : 'gap-1.5 p-3 sm:gap-3 sm:p-6'}`}>
        <p className={`font-medium uppercase tracking-wider text-neutral-500 ${featured ? 'text-xs' : 'truncate text-[10px] sm:text-xs'}`}>{car.source} · {now ? ago(car.publishedAt, now) : dateLabel(car.publishedAt)}</p>
        <h3 className={`font-semibold leading-snug tracking-tight text-white ${featured ? 'text-2xl sm:text-3xl' : 'line-clamp-4 text-sm sm:line-clamp-none sm:text-lg'}`}>{car.title}</h3>
        {car.excerpt && <p className={`text-sm leading-relaxed text-neutral-400 ${featured ? '' : 'hidden sm:line-clamp-3'}`}>{car.excerpt}</p>}
        {car.specs.length > 0 && (
          <ul className={`mt-auto flex flex-wrap pt-1 ${featured ? 'gap-2' : 'gap-1 sm:gap-2'}`}>
            {car.specs.map((s, i) => (
              <li key={s.label} className={`rounded-lg bg-white/5 font-medium text-neutral-200 ring-1 ring-white/10 ${featured ? 'px-2.5 py-1 text-xs' : `px-1.5 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs ${i > 1 ? 'hidden sm:block' : ''}`}`}>{s.label}</li>
            ))}
          </ul>
        )}
        <span className={`items-center gap-1 text-sm font-medium text-[var(--accent)] ${featured ? 'inline-flex' : 'hidden sm:inline-flex'}`}>
          Read the full story <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </span>
      </div>
    </a>
  );
}

