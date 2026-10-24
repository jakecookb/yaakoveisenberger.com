'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowUpRight, Check, Clock, Lock, ShieldX, Unlock } from 'lucide-react';
import { ICONS } from '@/data/icons';
import type { BoxHeight, CardView, IconSize } from '@/lib/site/settings';
import { AccessModal } from './access-modal';

// Small, quiet boxes. Phones get a step smaller still (two per row, packed tight); sm: and up is the larger size.
const HEIGHTS: Record<BoxHeight, { box: string; title: string; teaser: string }> = {
  compact: { box: 'min-h-20 gap-1.5 p-2.5 sm:p-3.5', title: 'text-sm', teaser: 'line-clamp-2 text-[11px] sm:text-xs' },
  standard: { box: 'min-h-24 gap-2 p-2.5 sm:min-h-36 sm:gap-4 sm:p-4.5', title: 'text-sm sm:text-base', teaser: 'line-clamp-2 text-[11px] sm:text-xs' },
  tall: { box: 'min-h-28 gap-2 p-3 sm:min-h-44 sm:gap-5 sm:p-5', title: 'text-base sm:text-lg', teaser: 'line-clamp-3 text-xs sm:text-sm' },
  xl: { box: 'min-h-32 gap-3 p-3.5 sm:min-h-56 sm:gap-6 sm:p-6', title: 'text-base sm:text-xl', teaser: 'line-clamp-3 text-xs sm:text-sm' },
};

const SIZES: Record<IconSize, { tile: string; icon: string }> = {
  sm: { tile: 'size-7 rounded-lg sm:size-8', icon: 'size-3.5 sm:size-4' },
  md: { tile: 'size-8 rounded-lg sm:size-9 sm:rounded-xl', icon: 'size-4 sm:size-4.5' },
  lg: { tile: 'size-9 rounded-xl sm:size-11', icon: 'size-4.5 sm:size-5.5' },
  xl: { tile: 'size-10 rounded-xl sm:size-13', icon: 'size-5 sm:size-6.5' },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 36 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
};

export interface AccessInfo {
  state: 'none' | 'pending' | 'approved' | 'denied';
  retryAt?: string;
}

const PILL = 'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1';
// Access states are a tiny icon in the corner, so they never crowd the box's icon.
const DOT = 'inline-flex size-5 items-center justify-center rounded-full ring-1';

function Badge({ category, liveCount, access }: { category: CardView; liveCount?: number; access?: AccessInfo }) {
  if (category.locked) {
    const st = access?.state ?? 'none';
    if (st === 'approved') return <span title="Access approved" className={`${DOT} bg-emerald-400/10 text-emerald-400 ring-emerald-400/40`}><Unlock className="size-2.5" /><span className="sr-only">Approved</span></span>;
    if (st === 'pending') return <span title="Request pending" className={`${DOT} bg-amber-400/10 text-amber-300 ring-amber-400/30`}><Clock className="size-2.5" /><span className="sr-only">Pending</span></span>;
    if (st === 'denied') return <span title="Request declined" className={`${DOT} bg-red-400/10 text-red-300 ring-red-400/30`}><ShieldX className="size-2.5" /><span className="sr-only">Declined</span></span>;
    return <span title="Private" className={`${DOT} bg-white/5 text-neutral-400 ring-white/15`}><Lock className="size-2.5" /><span className="sr-only">Private</span></span>;
  }
  if (category.badge === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
        </span>
        {liveCount ? `${liveCount} live` : 'Live'}
      </span>
    );
  }
  if (category.badge === 'new') {
    return <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white ring-1 ring-white/20">New</span>;
  }
  if (category.status === 'soon') {
    return <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 ring-1 ring-white/10">Soon</span>;
  }
  return null;
}

/** `cols` forces a column count (used by the editor's phone/tablet/desktop preview); the live site uses breakpoints. */
export function CategoryCard({ category, liveCount, cols, single, plain, access, onModalClose }: { category: CardView; liveCount?: number; cols?: 1 | 2 | 4; single?: boolean; plain?: boolean; access?: AccessInfo; onModalClose?: () => void }) {
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
  // The editor's phone preview runs in a wide window, so drop the larger-screen (sm:) sizes there.
  // Phone: drop sm:/md:/xl: sizes and apply max-sm:/max-md: ones; tablet/desktop: drop the phone-only ones.
  const phone = (c: string) => (!cols ? c : c.split(' ').flatMap((x) => (/^max-(sm|md):/.test(x) ? (cols === 1 ? [x.replace(/^max-\w+:/, '')] : []) : cols === 1 && /^(sm|md|lg|xl):/.test(x) ? [] : [x])).join(' '));
  const size = { tile: phone(SIZES[category.iconSize].tile), icon: phone(SIZES[category.iconSize].icon) };
  const h = { box: phone(HEIGHTS[category.height].box), title: phone(HEIGHTS[category.height].title), teaser: phone(HEIGHTS[category.height].teaser) };
  // Normal boxes are squares on a phone; News boxes take the full line there instead.
  const span = plain ? '' : phone(category.width === 'wide' ? `col-span-2${single ? ' max-md:col-span-full' : ''}` : category.width === 'full' ? 'col-span-full' : '');
  const className = `group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-neutral-900/95 ring-1 ring-white/20 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.9)] backdrop-blur-md outline-none [-webkit-tap-highlight-color:transparent] transition-[box-shadow,transform,--tw-ring-color] duration-300 hover:ring-[color-mix(in_srgb,var(--accent)_55%,transparent)] hover:shadow-[0_14px_40px_-22px_var(--accent)] data-[active=true]:-translate-y-1 data-[active=true]:scale-[1.01] data-[active=true]:ring-[var(--accent)] data-[active=true]:shadow-[0_14px_40px_-22px_var(--accent)] motion-reduce:data-[active=true]:translate-y-0 motion-reduce:data-[active=true]:scale-100 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${grey ? 'grayscale' : ''} ${h.box}`;
  const style = { '--accent': grey ? '#737373' : category.accent } as React.CSSProperties;

  const inner = (
    <>
      {/* pointer-follow highlight */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-data-[active=true]:opacity-100"
        style={{ background: 'radial-gradient(420px circle at var(--mx,50%) var(--my,0%), color-mix(in srgb, var(--accent) 18%, transparent), transparent 60%)' }}
        aria-hidden
      />
      <span className="relative flex flex-wrap items-start justify-between gap-2">
        <span
          className={`flex shrink-0 items-center justify-center ${size.tile} text-neutral-950 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 group-data-[active=true]:scale-110 group-data-[active=true]:-rotate-3`}
          style={{ background: grey ? '#525252' : category.accent }}
        >
          <Icon className={size.icon} strokeWidth={2.2} />
        </span>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          {category.news && <span className="rounded-full border border-white/15 bg-neutral-950/40 px-2 py-0.5 font-mono text-[10px] font-medium lowercase leading-4 tracking-[0.12em] text-neutral-300/90">news</span>}
          <Badge category={category} liveCount={liveCount} access={access} />
        </span>
      </span>
      <span className="relative">
        <span className="flex items-center justify-between gap-3">
          <span className={`${h.title} font-semibold tracking-tight ${grey ? 'text-neutral-400' : 'text-white'}`}>{category.title}</span>
          <ArrowUpRight
            className="size-4 shrink-0 -translate-x-1 translate-y-1 text-neutral-500 opacity-60 transition duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-[var(--accent)] group-hover:opacity-100 group-data-[active=true]:translate-x-0 group-data-[active=true]:translate-y-0 group-data-[active=true]:text-[var(--accent)] group-data-[active=true]:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
            aria-hidden
          />
        </span>
        {grey ? (
          <span className="mt-1.5 flex items-center gap-1 text-[10px] text-neutral-500"><Lock className="size-2.5" /> Tap to request access</span>
        ) : (
          <span className={`mt-1.5 block ${h.teaser} leading-relaxed text-neutral-400`}>{category.teaser}</span>
        )}
      </span>
      {grey && (
        // Fog: the box is there, but you can barely make it out.
        <span className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-900/45 backdrop-blur-[5px] transition-[backdrop-filter] duration-300 group-hover:backdrop-blur-[4px]" aria-hidden>
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-neutral-950/60 text-neutral-300 ring-1 ring-white/10"><Lock className="size-3" /></span>
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
      whileHover={reduce ? undefined : { y: -3, scale: 1.01 }}
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
