import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SpeedTest } from '@/components/speed/speed-test';

export const metadata = { title: 'Speed Test' };

export default function SpeedPage() {
  return (
    <section>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-white">
          <ArrowLeft className="size-4" /> All projects
        </Link>
        <h1 className="mt-6 text-center text-sm font-semibold uppercase tracking-[0.3em] text-[#22d3ee]">Speed Test</h1>
        <div className="mt-8"><SpeedTest /></div>
      </div>
    </section>
  );
}
