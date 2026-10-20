import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ExternalLink, HandHeart, Mail, Phone, Play } from 'lucide-react';
import logo from '@/public/images/home/logo.png';
import wordmark from '@/public/images/home/wordmark-white.png';
import { featuredWork, site, theZoneVideos } from '@/lib/site/content';
import { YouTubeLite } from '@/components/site/youtube-lite';

export default function HomePage() {
  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_50%_0%,rgba(200,169,106,0.18),transparent_70%)]" aria-hidden />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
          <Image src={logo} alt="" priority className="size-40 rounded-3xl shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:size-48" />
          <h1 className="mt-10">
            <Image src={wordmark} alt="Yaakov Eisenberger" priority className="mx-auto h-4 w-auto sm:h-6" />
          </h1>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="#work" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#c8a96a] px-6 text-sm font-semibold text-neutral-950 transition hover:bg-[#d8bc82]">
              <Play className="size-4 fill-current" /> Watch the work
            </Link>
            <Link href="#contact" className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition hover:bg-white/5">
              Get in touch
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ featured work */}
      <section id="work" className="scroll-mt-20 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#c8a96a]">Featured work</h2>
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

      {/* ------------------------------------------------------------ videos */}
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

      {/* ------------------------------------------------------------ fundraising */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Link href="/fund" className="group flex flex-col gap-5 rounded-3xl bg-gradient-to-br from-[#c8a96a]/20 to-transparent p-8 ring-1 ring-[#c8a96a]/30 transition hover:ring-[#c8a96a]/60 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <span className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#c8a96a] text-neutral-950"><HandHeart className="size-6" /></span>
              <span>
                <span className="block text-xl font-semibold text-white">Fundraising campaigns</span>
                <span className="mt-1 block text-neutral-400">Live matching campaigns — every gift multiplied and counted in real time.</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-2 font-semibold text-[#c8a96a]">
              View campaigns <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------ contact */}
      <section id="contact" className="scroll-mt-20 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#c8a96a]">Get in touch</h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={`mailto:${site.email}`} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-neutral-950 transition hover:bg-neutral-200">
              <Mail className="size-4" /> {site.email}
            </a>
            <a href={site.phoneHref} className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 px-6 font-semibold text-white transition hover:bg-white/5">
              <Phone className="size-4" /> {site.phone}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
