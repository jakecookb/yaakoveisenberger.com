import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { SiteHeader } from '@/components/site/header';
import { SiteFooter } from '@/components/site/footer';
import { LockedGate } from '@/components/hub/locked-gate';
import { ICONS } from '@/data/icons';
import { loadSettings } from '@/lib/site/load';
import { resolveCards } from '@/lib/site/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Private', robots: { index: false } };

/** Where unapproved visitors land when they click a locked box (the proxy sends them here). */
export default async function AccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = resolveCards(await loadSettings(), { includeHidden: true }).find((c) => c.id === id);
  if (!card || !card.lockable) notFound();
  if (!card.locked) redirect(card.href);
  const Icon = ICONS[card.iconKey];
  return (
    <div className="site-dark min-h-screen bg-neutral-950 text-neutral-100 [color-scheme:dark]">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl text-neutral-950 shadow-xl" style={{ background: card.accent }}>
          <Icon className="size-8" strokeWidth={2.2} />
        </span>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{card.title}</h1>
        <LockedGate categoryId={id} accent={card.accent} continueHref={card.href} />
        <Link href="/" className="mx-auto mt-12 inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition hover:bg-white/5">
          <ArrowLeft className="size-4" /> Back to all
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
