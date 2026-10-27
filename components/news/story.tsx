import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { loadSummary, TOPICS } from '@/lib/news/article';
import type { NewsTopic } from '@/lib/news/slug';

// A summary of one story from the feeds on /cars, /tech and /weapons, kept on this site. Each topic mounts it under its own
// path (/cars/story/<id> ...), so the same lock that guards the topic page guards its stories.

export async function storyMetadata(topic: NewsTopic, slug: string): Promise<Metadata> {
  const story = await loadSummary(topic, slug);
  return { title: story?.title ?? 'Story', description: story?.summary[0] };
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export async function Story({ topic, slug }: { topic: NewsTopic; slug: string }) {
  const story = await loadSummary(topic, slug);
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
  const [hero, ...more] = [story.image, ...story.images].filter((u, i, a): u is string => Boolean(u) && a.indexOf(u) === i);
  return (
    <article style={{ '--accent': cfg.accent } as React.CSSProperties}>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href={cfg.path} className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400 transition hover:text-[var(--accent)]">
          <ArrowLeft className="size-4" aria-hidden /> {cfg.name}
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">{story.source} · {fmt(story.publishedAt)}</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">{story.title}</h1>

        {hero && (
          <div className="mt-8 overflow-hidden rounded-3xl bg-neutral-900 ring-1 ring-white/10">
            <img src={hero} alt="" referrerPolicy="no-referrer" className="aspect-[16/9] w-full object-cover" />
          </div>
        )}

        <div className="mt-8 space-y-5 text-lg leading-relaxed text-neutral-200">
          {story.summary.length ? story.summary.map((p, i) => <p key={i}>{p}</p>) : <p className="text-neutral-400">{story.source} hasn’t shared a preview of this story. The full piece is at the link below.</p>}
        </div>

        {more.length > 0 && (
          <div className={`mt-8 grid gap-3 ${more.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {more.slice(0, 3).map((src) => (
              <div key={src} className="overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/10">
                <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[16/10] w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-3xl bg-neutral-900/70 p-6 ring-1 ring-white/10 sm:p-8">
          <p className="text-sm leading-relaxed text-neutral-400">
            A short summary of reporting by <span className="font-medium text-neutral-200">{story.source}</span>. All credit for the story and pictures goes to the original publisher.
          </p>
          <a
            href={story.url} target="_blank" rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:brightness-110"
          >
            Read the full story at {story.source} <ArrowUpRight className="size-4" aria-hidden />
          </a>
        </div>
      </div>
    </article>
  );
}
