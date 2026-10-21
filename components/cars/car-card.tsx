'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { CarItem } from '@/lib/cars/types';

const ago = (iso: string) => {
  const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
  return d < 1 ? 'Just now' : d < 24 ? `${d}h ago` : `${Math.floor(d / 24)}d ago`;
};

export function CarCard({ car, featured, accent = '#818cf8' }: { car: CarItem; featured?: boolean; accent?: string }) {
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
      className={`group relative flex flex-col overflow-hidden rounded-3xl bg-neutral-900/70 ring-1 ring-white/10 outline-none [-webkit-tap-highlight-color:transparent] transition-[box-shadow,transform] duration-300 hover:ring-[var(--accent)] hover:shadow-[0_20px_60px_-20px_var(--accent)] data-[active=true]:-translate-y-1 data-[active=true]:ring-[var(--accent)] data-[active=true]:shadow-[0_20px_60px_-20px_var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${featured ? 'sm:col-span-2 lg:col-span-3 lg:flex-row' : ''}`}
    >
      <div className={`relative overflow-hidden bg-neutral-800 ${featured ? 'aspect-[16/9] lg:aspect-auto lg:w-3/5' : 'aspect-[16/10]'}`}>
        {car.image && (
          <img src={car.image} alt="" loading={featured ? 'eager' : 'lazy'} referrerPolicy="no-referrer" className="size-full object-cover transition duration-500 group-hover:scale-105 group-data-[active=true]:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/70 via-transparent to-transparent" aria-hidden />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {car.tags.map((t) => (
            <span key={t} className="rounded-full bg-neutral-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white ring-1 ring-white/20 backdrop-blur">{t}</span>
          ))}
        </div>
      </div>
      <div className={`flex flex-1 flex-col gap-3 p-5 sm:p-6 ${featured ? 'lg:justify-center lg:p-10' : ''}`}>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{car.source} · {ago(car.publishedAt)}</p>
        <h3 className={`font-semibold leading-snug tracking-tight text-white ${featured ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>{car.title}</h3>
        {car.excerpt && <p className={`text-sm leading-relaxed text-neutral-400 ${featured ? '' : 'line-clamp-3'}`}>{car.excerpt}</p>}
        {car.specs.length > 0 && (
          <ul className="mt-auto flex flex-wrap gap-2 pt-1">
            {car.specs.map((s) => (
              <li key={s.label} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-neutral-200 ring-1 ring-white/10">{s.label}</li>
            ))}
          </ul>
        )}
        <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)]">
          Read the full story <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </span>
      </div>
    </a>
  );
}
