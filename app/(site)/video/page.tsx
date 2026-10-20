import Image from 'next/image';
import { ExternalLink, Play } from 'lucide-react';
import { featuredWork, theZoneVideos } from '@/lib/site/content';
import { YouTubeLite } from '@/components/site/youtube-lite';
import { PhotoGallery } from '@/components/hub/photo-gallery';
import { loadSettings } from '@/lib/site/load';
import { mediaUrl } from '@/lib/site/settings';

export const revalidate = 60;

export const metadata = { title: 'Video & Media' };

export default async function VideoPage() {
  const settings = await loadSettings();
  const photos = (settings.photos.video ?? []).map((p) => ({ id: p.id, src: mediaUrl(p.pathname), caption: p.caption }));
  return (
    <>
      <section id="work" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#c8a96a]">Featured work</h1>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {featuredWork.map((w) => (
              <a
                key={w.title}
                href={w.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group relative block overflow-hidden rounded-3xl bg-neutral-900 ring-1 ring-white/10 ${
                  w.layout === 'tall' ? 'aspect-[4/5] lg:row-span-2 lg:aspect-auto' : 'aspect-video lg:col-span-2'
                }`}
              >
                <Image
                  src={w.image}
                  alt=""
                  placeholder="blur"
                  sizes={w.layout === 'tall' ? '(min-width: 1024px) 33vw, 100vw' : '(min-width: 1024px) 66vw, 100vw'}
                  className={`absolute inset-0 size-full transition duration-700 group-hover:scale-[1.03] ${w.layout === 'tall' ? 'bg-black object-contain' : 'object-cover'}`}
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" aria-hidden />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-7">
                  <span>
                    <span className="block text-xl font-semibold text-white sm:text-2xl">{w.title}</span>
                    <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-neutral-300">
                      Watch video <ExternalLink className="size-3.5" />
                    </span>
                  </span>
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#c8a96a] text-neutral-950 transition group-hover:scale-110" aria-hidden>
                    <Play className="ml-0.5 size-5 fill-current" />
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="videos" className="scroll-mt-20 border-t border-white/5 bg-neutral-900/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#c8a96a]">TheZone Camp</h2>
          <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2">
            {theZoneVideos.map((v) => (
              <article key={v.youtubeId}>
                <YouTubeLite id={v.youtubeId} title={v.title} />
                <h3 className="mt-3 font-medium text-white">{v.title}</h3>
                {v.description && <p className="mt-1 text-sm leading-relaxed text-neutral-400">{v.description}</p>}
              </article>
            ))}
          </div>
        </div>
      </section>

      {photos.length > 0 && (
        <section className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#c8a96a]">Photos</h2>
            <div className="mt-8"><PhotoGallery photos={photos} /></div>
          </div>
        </section>
      )}
    </>
  );
}
