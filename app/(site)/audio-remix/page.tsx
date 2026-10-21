import Link from 'next/link';
import { ArrowLeft, Disc3 } from 'lucide-react';
import { RemixStudio } from '@/components/remix/remix-studio';

export const metadata = { title: 'Wedding Intro Remix', description: 'Stitch songs into one seamless intro — on-beat blends, matched loudness, MP3 or WAV.' };

export default function Page() {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-white">
          <ArrowLeft className="size-4" /> All projects
        </Link>
        <div className="mt-6 flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-neutral-950" style={{ background: '#c084fc' }}><Disc3 className="size-7" strokeWidth={2.2} /></span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Wedding Intro Remix</h1>
            <p className="mt-1 text-neutral-400">Stitch songs into one seamless intro — on-beat blends, matched loudness, MP3 or WAV.</p>
          </div>
        </div>
        <div className="mt-8">
          <RemixStudio />
        </div>
        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-neutral-500">How the “AI” works: tempo and beats are detected from the audio itself (onset analysis), blend points are snapped to beats and bar lines, blend length is chosen from how closely the tempos match, every part is matched to the same loudness (ITU BS.1770, −14 LUFS) and a look-ahead limiter catches peaks. Songs keep their own tempo — blends are short enough that the beats stay together. Everything runs in your browser; nothing is uploaded.</p>
      </div>
    </section>
  );
}
