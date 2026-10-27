import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { loadStory, TOPICS } from '@/lib/news/article';
import type { NewsTopic } from '@/lib/news/slug';

// One story from the feeds on /cars, /tech and /weapons, read on this site: all the text the publisher's feed shares, with its pictures in place. Each topic mounts it under its own
// path (/cars/story/<id> ...), so the same lock that guards the topic page guards its stories.

export async function storyMetadata(topic: NewsTopic, slug: string): Promise<Metadata> {
  const story = await loadStory(topic, slug);
  return { title: story?.title ?? 'Story', description: story?.blocks.find((b) => b.t === 'p')?.v.slice(0, 200) };
}

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
  // The lead picture sits above the text, unless the story itself opens with a picture (often the same one at another size).
  const firstText = story.blocks.findIndex((b) => b.t !== 'img');
  const opensWithPicture = firstText !== 0;
  const hero = story.image && !opensWithPicture ? story.image : undefined;
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

        <div className="mt-8 space-y-6 text-lg leading-relaxed text-neutral-200">
          {story.blocks.map((b, i) =>
            b.t === 'img' ? (
              <div key={i} className="overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/10">
                <img src={b.v} alt="" loading={i < 4 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" className="h-auto w-full" />
              </div>
            ) : b.t === 'h' ? (
              <h2 key={i} className="pt-4 text-2xl font-semibold tracking-tight text-white">{b.v}</h2>
            ) : (
              <p key={i}>{b.v}</p>
            ),
          )}
          {story.partial && <p className="text-base text-neutral-400">{story.source} only shares the opening of this story. The rest is at the link below.</p>}
        </div>

        <div className="mt-12 rounded-3xl bg-neutral-900/70 p-6 ring-1 ring-white/10 sm:p-8">
          <p className="text-sm leading-relaxed text-neutral-400">
            Reported by <span className="font-medium text-neutral-200">{story.source}</span>. All credit for the story and pictures goes to the original publisher; see their page for the latest version.
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
