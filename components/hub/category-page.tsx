import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ICONS } from '@/data/icons';
import { loadSettings } from '@/lib/site/load';
import { mediaUrl, resolveCards } from '@/lib/site/settings';
import { LockedGate } from './locked-gate';
import { PhotoGallery } from './photo-gallery';
import { RichText } from './rich-text';
import { QuoteButton } from './quote-form';

const QUOTABLE = ['fishboards', 'meatboards', 'events', 'photography'];

/**
 * A category's own page: heading and text (editable in the admin), its photo gallery, and — if the admin
 * locked it — an access request gate instead of the content. Locked content is never in this page's HTML.
 */
export async function CategoryPage({ id }: { id: string }) {
  const settings = await loadSettings();
  const card = resolveCards(settings, { includeHidden: true }).find((c) => c.id === id);
  if (!card) return null;
  const Icon = ICONS[card.iconKey];
  const page = settings.pages[id];
  const photos = card.locked ? [] : (settings.photos[id] ?? []).map((p) => ({ id: p.id, src: mediaUrl(p.pathname), caption: p.caption }));
  const showSoon = card.status === 'soon' && !card.locked && photos.length === 0;

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: `radial-gradient(700px 360px at 50% 0%, ${card.accent}33, transparent 70%)` }} aria-hidden />
      <div className={`relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 ${photos.length || card.locked ? '' : 'flex min-h-[60vh] flex-col items-center justify-center'}`}>
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl text-neutral-950 shadow-xl" style={{ background: card.accent }}>
          <Icon className="size-8" strokeWidth={2.2} />
        </span>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{page?.heading || card.title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-neutral-400">{card.teaser}</p>
        {QUOTABLE.includes(id) && <QuoteButton category={id} accent={card.accent} />}
        {!card.locked && page?.body && <RichText text={page.body} className="mx-auto mt-8 max-w-2xl" />}
        {showSoon && <p className="mx-auto mt-6 w-fit rounded-full bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-neutral-300 ring-1 ring-white/10">Coming soon</p>}

        {card.locked ? <LockedGate categoryId={id} accent={card.accent} /> : photos.length > 0 && <div className="mt-10 text-left"><PhotoGallery photos={photos} /></div>}

        <Link href="/" className="mx-auto mt-12 inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition hover:bg-white/5">
          <ArrowLeft className="size-4" /> Back to all
        </Link>
      </div>
    </section>
  );
}
