import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCategory } from '@/data/navigation';

export function ComingSoon({ id }: { id: string }) {
  const category = getCategory(id);
  if (!category) return null;
  const Icon = category.icon;
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ background: `radial-gradient(700px 360px at 50% 0%, ${category.accent}33, transparent 70%)` }}
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
        <span className="flex size-16 items-center justify-center rounded-3xl text-neutral-950 shadow-xl" style={{ background: category.accent }}>
          <Icon className="size-8" strokeWidth={2.2} />
        </span>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{category.title}</h1>
        <p className="mt-3 text-neutral-400">{category.teaser}</p>
        <p className="mt-6 rounded-full bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-neutral-300 ring-1 ring-white/10">Coming soon</p>
        <Link href="/" className="mt-10 inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition hover:bg-white/5">
          <ArrowLeft className="size-4" /> Back to all
        </Link>
      </div>
    </section>
  );
}
