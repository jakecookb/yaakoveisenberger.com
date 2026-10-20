'use client';

import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowUpRight, Lock } from 'lucide-react';
import { ICONS } from '@/data/icons';
import type { CardView, IconSize } from '@/lib/site/settings';

const SIZES: Record<IconSize, { tile: string; icon: string }> = {
  sm: { tile: 'size-10 rounded-xl', icon: 'size-5' },
  md: { tile: 'size-12 rounded-2xl', icon: 'size-6' },
  lg: { tile: 'size-16 rounded-2xl', icon: 'size-8' },
  xl: { tile: 'size-20 rounded-3xl', icon: 'size-10' },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function Badge({ category, liveCount }: { category: CardView; liveCount?: number }) {
  if (category.locked) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-300 ring-1 ring-white/15">
        <Lock className="size-3" /> Private
      </span>
    );
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

export function CategoryCard({ category, liveCount }: { category: CardView; liveCount?: number }) {
  const reduce = useReducedMotion();
  const Icon = ICONS[category.iconKey];
  const size = SIZES[category.iconSize];
  const className = `group relative flex h-full min-h-48 flex-col justify-between gap-8 overflow-hidden rounded-3xl bg-neutral-900/70 p-6 ring-1 ring-white/10 outline-none transition-[box-shadow,--tw-ring-color] duration-300 hover:ring-[var(--accent)] hover:shadow-[0_0_0_1px_var(--accent),0_20px_60px_-20px_var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:p-7 ${category.wide ? 'min-h-56' : ''}`;
  const style = { '--accent': category.accent } as React.CSSProperties;

  const inner = (
    <>
      {/* pointer-follow highlight */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(420px circle at var(--mx,50%) var(--my,0%), color-mix(in srgb, var(--accent) 18%, transparent), transparent 60%)' }}
        aria-hidden
      />
      <span className="relative flex items-start justify-between gap-3">
        <span
          className={`flex items-center justify-center ${size.tile} text-neutral-950 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}
          style={{ background: category.accent }}
        >
          <Icon className={size.icon} strokeWidth={2.2} />
        </span>
        <Badge category={category} liveCount={liveCount} />
      </span>
      <span className="relative">
        <span className="flex items-center justify-between gap-3">
          <span className="text-xl font-semibold tracking-tight text-white">{category.title}</span>
          <ArrowUpRight
            className="size-5 shrink-0 -translate-x-1 translate-y-1 text-neutral-500 opacity-60 transition duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-[var(--accent)] group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
            aria-hidden
          />
        </span>
        <span className="mt-2 block text-sm leading-relaxed text-neutral-400">{category.teaser}</span>
      </span>
    </>
  );

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
      className={category.wide ? 'sm:col-span-2' : undefined}
    >
      {category.external ? (
        <a href={category.href} className={className} style={style} onPointerMove={onPointerMove}>{inner}</a>
      ) : (
        <Link href={category.href} className={className} style={style} onPointerMove={onPointerMove}>{inner}</Link>
      )}
    </motion.li>
  );
}
