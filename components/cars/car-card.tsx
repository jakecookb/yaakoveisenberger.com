'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { CarItem } from '@/lib/cars/types';
import { articleHref, isRedirect, type NewsTopic } from '@/lib/news/slug';

const ago = (iso: string, now: number) => {
  const d = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 3_600_000));
  return d < 1 ? 'Just now' : d < 24 ? `${d}h ago` : `${Math.floor(d / 24)}d ago`;
};

// Pages are generated ahead of time, so "how long ago" is only worked out in the browser; the generated page shows the
// date instead (otherwise the two disagree and React has to redo the page).
const noop = () => () => {};
const useNow = () => useSyncExternalStore(noop, () => Math.floor(Date.now() / 60_000) * 60_000, () => 0);
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** A news story card; the featured one spans the whole row on larger screens. */
export function CarCard({ car, topic, featured, accent = '#818cf8', className = '' }: { car: CarItem; topic: NewsTopic; featured?: boolean; accent?: string; className?: string }) {
  const now = useNow();
  // Same touch-glow as the hub cards: lights up on touch, even while the finger scrolls.
  const [touched, setTouched] = useState(false);
  const fade = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(fade.current), []);
  const on = () => { clearTimeout(fade.current); setTouched(true); };
  const off = () => { clearTimeout(fade.current); fade.current = setTimeout(() => setTouched(false), 450); };

  // The summary page on this site; only a story with nothing to summarise (a bare Google News link) goes straight out.
  const external = isRedirect(car.url);
  const Tag = external ? 'a' : Link;
  return (
    <Tag
      href={articleHref(topic, car.url)}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      data-active={touched}
      onTouchStart={on}
      onTouchEnd={off}
      onTouchCancel={off}
      style={{ '--accent': accent } as React.CSSProperties}
      className={`group relative flex flex-col overflow-hidden rounded-3xl bg-neutral-900/70 ring-1 ring-white/10 outline-none [-webkit-tap-highlight-color:transparent] transition-[box-shadow,transform] duration-300 hover:ring-[var(--accent)] hover:shadow-[0_20px_60px_-20px_var(--accent)] data-[active=true]:-translate-y-1 data-[active=true]:ring-[var(--accent)] data-[active=true]:shadow-[0_20px_60px_-20px_var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${featured ? 'md:col-span-2 lg:col-span-3 lg:flex-row' : ''} ${className}`}
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
        <div className={`absolute flex flex-wrap gap-1.5 left-3 top-3`}>
          {car.tags.map((t) => (
            <span key={t} className={`rounded-full bg-neutral-950/70 font-semibold uppercase tracking-wider text-white ring-1 ring-white/20 backdrop-blur px-2.5 py-1 text-[11px]`}>{t}</span>
          ))}
        </div>
      </div>
      <div className={`flex flex-1 flex-col gap-3 p-5 sm:p-6 ${featured ? 'lg:justify-center lg:p-10' : ''}`}>
        <p className={`font-medium uppercase tracking-wider text-neutral-500 text-xs`}>{car.source} · {now ? ago(car.publishedAt, now) : dateLabel(car.publishedAt)}</p>
        <h3 className={`font-semibold leading-snug tracking-tight text-white ${featured ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>{car.title}</h3>
        {car.excerpt && <p className={`text-sm leading-relaxed text-neutral-400 ${featured ? '' : 'line-clamp-3'}`}>{car.excerpt}</p>}
        {car.specs.length > 0 && (
          <ul className={`mt-auto flex flex-wrap pt-1 gap-2`}>
            {car.specs.map((s) => (
              <li key={s.label} className={`rounded-lg bg-white/5 font-medium text-neutral-200 ring-1 ring-white/10 px-2.5 py-1 text-xs`}>{s.label}</li>
            ))}
          </ul>
        )}
        <span className={`items-center gap-1 text-sm font-medium text-[var(--accent)] inline-flex`}>
          {external ? 'Read the full story' : 'Read the summary'} <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </span>
      </div>
    </Tag>
  );
}

