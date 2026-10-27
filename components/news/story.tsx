import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Clock } from 'lucide-react';
import { loadStory, TOPICS } from '@/lib/news/article';
import type { NewsTopic } from '@/lib/news/slug';

// One story from the feeds on /cars, /tech and /weapons, read on this site: all the text the publisher's feed shares, with its pictures in place. Each topic mounts it under its own
// path (/cars/story/<id> ...), so the same lock that guards the topic page guards its stories.

export async function storyMetadata(topic: NewsTopic, slug: string): Promise<Metadata> {
  const story = await loadStory(topic, slug);
  return { title: story?.title ?? 'Story', description: story?.lede?.slice(0, 200) };
}

const CAPTION: Record<string, string> = {
  power: 'Power', torque: 'Torque', speed: 'Acceleration', range: 'Range', battery: 'Battery', price: 'Price', drive: 'Powertrain', topspeed: 'Top speed',
  caliber: 'Caliber', capacity: 'Capacity', barrel: 'Barrel', blade: 'Blade', steel: 'Steel', weight: 'Weight',
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export async function Story({ topic, slug }: { topic: NewsTopic; slug: string }) {
  const story = await loadStory(topic, slug);
  const cfg = TOPICS[topic];
  if (!story) {
    return (
      <section className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold text-white">That story has moved on</h1>
        <p className="mt-2 text-neutral-400">It has dropped out of the feed. The latest stories are on {cfg.name}.</p>
        <Link href={cfg.path} className="mt-6 inline-flex h-11 items-center rounded-full bg-white px-5 font-semibold text-neutral-950">Back to {cfg.name}</Link>
      </section>
    );
  }
  return (
    <article style={{ '--accent': cfg.accent } as React.CSSProperties}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href={cfg.path} className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400 transition hover:text-[var(--accent)]">
          <ArrowLeft className="size-4" aria-hidden /> {cfg.name}
        </Link>

        <header className="mt-8">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-[0.18em]">
            <span className="text-[var(--accent)]">{story.source}</span>
            <span className="text-neutral-500">{fmt(story.publishedAt)}</span>
            <span className="inline-flex items-center gap-1.5 text-neutral-500"><Clock className="size-3.5" aria-hidden />{story.minutes} min read</span>
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-[2.6rem]">{story.title}</h1>
          {story.lede && <p className="mt-5 border-l-2 border-[var(--accent)] pl-4 text-xl leading-relaxed text-neutral-200 sm:text-[1.35rem]">{story.lede}</p>}
        </header>

        {story.image && (
          <figure className="mt-8 overflow-hidden rounded-3xl bg-neutral-900 ring-1 ring-white/10">
            <img src={story.image} alt="" referrerPolicy="no-referrer" className="aspect-[16/9] w-full object-cover" />
          </figure>
        )}

        {story.facts.length > 0 && (
          <section aria-label="At a glance" className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">At a glance</h2>
            <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {story.facts.map((f) => (
                <li key={f.kind + f.label} className="rounded-2xl bg-neutral-900/80 p-4 ring-1 ring-white/10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{CAPTION[f.kind] ?? 'Detail'}</p>
                  <p className="mt-1.5 text-lg font-semibold leading-snug text-white">{f.label}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-10 space-y-6 text-[1.075rem] leading-[1.85] text-neutral-300">
          {story.blocks.map((b, i) =>
            b.t === 'img' ? (
              <figure key={i} className="!my-9 overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/10">
                <img src={b.v} alt="" loading={i < 6 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" className="h-auto w-full" />
              </figure>
            ) : b.t === 'h' ? (
              <h2 key={i} className="!mt-12 flex items-center gap-3 text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl">
                <span className="h-6 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />{b.v}
              </h2>
            ) : b.t === 'quote' ? (
              <blockquote key={i} className="!my-9 rounded-2xl bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-6 py-5 text-xl font-medium italic leading-relaxed text-white ring-1 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]">{b.v}</blockquote>
            ) : (
              <p key={i}>{b.v}</p>
            ),
          )}
          {story.partial && <p className="rounded-2xl bg-white/5 p-4 text-base text-neutral-400">{story.source} only shares the opening of this story. The rest is at the link below.</p>}
        </div>

        <footer className="mt-14 rounded-3xl bg-neutral-900/70 p-6 ring-1 ring-white/10 sm:p-8">
          <p className="text-sm leading-relaxed text-neutral-400">
            Shortened for easy reading from <span className="font-medium text-neutral-200">{story.source}</span>. All credit for the story and pictures goes to the original publisher; their page has the full version.
          </p>
          <a
            href={story.url} target="_blank" rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:brightness-110"
          >
            Read the full story at {story.source} <ArrowUpRight className="size-4" aria-hidden />
          </a>
        </footer>
      </div>
    </article>
  );
}
