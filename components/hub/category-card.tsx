'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowUpRight, Check, Clock, Lock, ShieldX, Unlock } from 'lucide-react';
import { ICONS } from '@/data/icons';
import type { BoxHeight, CardView, IconSize } from '@/lib/site/settings';
import { AccessModal } from './access-modal';

// Phones show two boxes per row, so everything is a step smaller there (sm: and up is unchanged).
const HEIGHTS: Record<BoxHeight, { box: string; title: string; teaser: string }> = {
  compact: { box: 'min-h-28 gap-3 p-3.5 sm:p-4', title: 'text-sm sm:text-base', teaser: 'line-clamp-2 text-xs' },
  standard: { box: 'min-h-40 gap-5 p-4 sm:min-h-48 sm:gap-8 sm:p-7', title: 'text-base sm:text-xl', teaser: 'line-clamp-3 text-xs sm:line-clamp-none sm:text-sm' },
  tall: { box: 'min-h-56 gap-6 p-4 sm:min-h-72 sm:gap-10 sm:p-8', title: 'text-lg sm:text-2xl', teaser: 'text-sm sm:text-base' },
  xl: { box: 'min-h-72 gap-8 p-5 sm:min-h-96 sm:gap-12 sm:p-10', title: 'text-xl sm:text-3xl', teaser: 'text-sm sm:text-lg' },
};

const SIZES: Record<IconSize, { tile: string; icon: string }> = {
  sm: { tile: 'size-9 rounded-xl sm:size-10', icon: 'size-4.5 sm:size-5' },
  md: { tile: 'size-10 rounded-xl sm:size-12 sm:rounded-2xl', icon: 'size-5 sm:size-6' },
  lg: { tile: 'size-12 rounded-2xl sm:size-16', icon: 'size-6 sm:size-8' },
  xl: { tile: 'size-14 rounded-2xl sm:size-20 sm:rounded-3xl', icon: 'size-7 sm:size-10' },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export interface AccessInfo {
  state: 'none' | 'pending' | 'approved' | 'denied';
  retryAt?: string;
}

const PILL = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1';

function Badge({ category, liveCount, access }: { category: CardView; liveCount?: number; access?: AccessInfo }) {
  if (category.locked) {
    const st = access?.state ?? 'none';
    if (st === 'approved') return <span className={`${PILL} bg-emerald-400/10 text-emerald-300 ring-emerald-400/30`}><Unlock className="size-3" /> Approved</span>;
    if (st === 'pending') return <span className={`${PILL} bg-amber-400/10 text-amber-300 ring-amber-400/30`}><Clock className="size-3" /> Pending</span>;
    if (st === 'denied') return <span className={`${PILL} bg-red-400/10 text-red-300 ring-red-400/30`}><ShieldX className="size-3" /> Declined</span>;
    return <span className={`${PILL} bg-white/5 text-neutral-300 ring-white/15`}><Lock className="size-3" /> Private</span>;
  }
  if (category.badge === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
        </span>
        {liveCount ? `${liveCount} live` : 'Live'}
      </span>
    );
  }
  if (category.badge === 'new') {
    return <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white ring-1 ring-white/20">New</span>;
  }
  if (category.status === 'soon') {
    return <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 ring-1 ring-white/10">Soon</span>;
  }
  return null;
}

/** `cols` forces a column count (used by the editor's phone/tablet/desktop preview); the live site uses breakpoints. */
export function CategoryCard({ category, liveCount, cols, access, onModalClose }: { category: CardView; liveCount?: number; cols?: 1 | 2 | 4; access?: AccessInfo; onModalClose?: () => void }) {
  const reduce = useReducedMotion();
  const [asking, setAsking] = useState(false);
  // Phones have no hover, so the glow is driven by touch as well: it lights up the moment a finger lands, stays on while the
  // finger scrolls the page (touch events, unlike pointer events, aren't cancelled by scrolling) and fades shortly after.
  const [touched, setTouched] = useState(false);
  const fade = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(fade.current), []);
  const Icon = ICONS[category.iconKey];
  // Greyed out: a faint, colourless hint of the box until this visitor is approved.
  const grey = category.greyed && access?.state !== 'approved';
  const size = SIZES[category.iconSize];
  const h = HEIGHTS[category.height];
  // Wide and full-row boxes take the whole row on a phone (two columns), as they do in the preview's phone view.
  const span = cols
    ? category.width === 'normal' ? '' : category.width === 'wide' || cols === 1 ? 'col-span-2' : 'col-span-full'
    : category.width === 'wide' ? 'col-span-2' : category.width === 'full' ? 'col-span-2 sm:col-span-full' : '';
  const className = `group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-neutral-900/70 ring-1 ring-white/10 outline-none [-webkit-tap-highlight-color:transparent] transition-[box-shadow,transform,--tw-ring-color] duration-300 hover:ring-[var(--accent)] hover:shadow-[0_0_0_1px_var(--accent),0_20px_60px_-20px_var(--accent)] data-[active=true]:-translate-y-1.5 data-[active=true]:scale-[1.02] data-[active=true]:ring-[var(--accent)] data-[active=true]:shadow-[0_0_0_1px_var(--accent),0_20px_60px_-20px_var(--accent)] motion-reduce:data-[active=true]:translate-y-0 motion-reduce:data-[active=true]:scale-100 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${grey ? 'grayscale' : ''} ${h.box}`;
  const style = { '--accent': grey ? '#737373' : category.accent } as React.CSSProperties;

  const inner = (
    <>
      {/* pointer-follow highlight */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-data-[active=true]:opacity-100"
        style={{ background: 'radial-gradient(420px circle at var(--mx,50%) var(--my,0%), color-mix(in srgb, var(--accent) 18%, transparent), transparent 60%)' }}
        aria-hidden
      />
      <span className="relative flex items-start justify-between gap-3">
        <span
          className={`flex items-center justify-center ${size.tile} text-neutral-950 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 group-data-[active=true]:scale-110 group-data-[active=true]:-rotate-3`}
          style={{ background: grey ? '#525252' : category.accent }}
        >
          <Icon className={size.icon} strokeWidth={2.2} />
        </span>
        <Badge category={category} liveCount={liveCount} access={access} />
      </span>
      <span className="relative">
        <span className="flex items-center justify-between gap-3">
          <span className={`${h.title} font-semibold tracking-tight ${grey ? 'text-neutral-400' : 'text-white'}`}>{category.title}</span>
          <ArrowUpRight
            className="size-5 shrink-0 -translate-x-1 translate-y-1 text-neutral-500 opacity-60 transition duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-[var(--accent)] group-hover:opacity-100 group-data-[active=true]:translate-x-0 group-data-[active=true]:translate-y-0 group-data-[active=true]:text-[var(--accent)] group-data-[active=true]:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
            aria-hidden
          />
        </span>
        {grey ? (
          <span className={`mt-2 flex items-center gap-1.5 ${h.teaser} text-neutral-500`}><Lock className="size-3.5" /> Private · tap to request access</span>
        ) : (
          <span className={`mt-2 block ${h.teaser} leading-relaxed text-neutral-400`}>{category.teaser}</span>
        )}
      </span>
      {grey && (
        // Fog: the box is there, but you can barely make it out.
        <span className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-900/45 backdrop-blur-[5px] transition-[backdrop-filter] duration-300 group-hover:backdrop-blur-[4px]" aria-hidden>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-300 ring-1 ring-white/10"><Lock className="size-3" /> Private</span>
        </span>
      )}
    </>
  );

  // A locked box never navigates from the hub: clicking it opens the "type your name" pop-up instead.
  const onClick = category.locked && access?.state !== 'approved' ? (e: React.MouseEvent) => { e.preventDefault(); setAsking(true); } : undefined;

  const aim = (el: HTMLElement, x: number, y: number) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${x - r.left}px`);
    el.style.setProperty('--my', `${y - r.top}px`);
  };
  const touch = {
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => { clearTimeout(fade.current); setTouched(true); aim(e.currentTarget, e.touches[0].clientX, e.touches[0].clientY); },
    onTouchMove: (e: React.TouchEvent<HTMLElement>) => aim(e.currentTarget, e.touches[0].clientX, e.touches[0].clientY),
    onTouchEnd: () => { clearTimeout(fade.current); fade.current = setTimeout(() => setTouched(false), 450); },
    onTouchCancel: () => { clearTimeout(fade.current); fade.current = setTimeout(() => setTouched(false), 450); },
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <motion.li
      variants={cardVariants}
      whileHover={reduce ? undefined : { y: -6, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={span || undefined}
    >
      {category.external ? (
        <a href={category.href} {...(/^https?:/.test(category.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={className} style={style} data-active={touched ? 'true' : undefined} onClick={onClick} onPointerMove={onPointerMove} {...touch}>{inner}</a>
      ) : (
        <Link href={category.href} className={className} style={style} data-active={touched ? 'true' : undefined} onClick={onClick} onPointerMove={onPointerMove} {...touch}>{inner}</Link>
      )}
      {category.locked && <AccessModal open={asking} onClose={() => { setAsking(false); onModalClose?.(); }} title={category.title} accent={category.accent} categoryId={category.id} continueHref={category.href} />}
    </motion.li>
  );
}
