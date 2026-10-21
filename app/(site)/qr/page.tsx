import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { QrMaker } from '@/components/qr/qr-maker';

export const metadata = { title: 'QR Code Generator' };

export default function QrPage() {
  return (
    <section>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-white">
          <ArrowLeft className="size-4" /> All projects
        </Link>
        <h1 className="mt-6 text-center text-sm font-semibold uppercase tracking-[0.3em] text-[#f472b6]">QR Code Generator</h1>
        <p className="mx-auto mt-3 max-w-md text-center text-neutral-400">Paste a link or any text and get a branded code instantly.</p>
        <div className="mt-10"><QrMaker /></div>
      </div>
    </section>
  );
}
