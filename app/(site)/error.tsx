'use client';

import Link from 'next/link';

/** Any unexpected error on a page shows this instead of a blank screen — with a way out. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
      <p className="mt-2 text-neutral-400">This page hit a snag. Try again, or head back to the hub.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="h-11 rounded-full bg-white px-5 font-semibold text-neutral-950">Try again</button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full px-5 font-semibold text-white ring-1 ring-white/20">Return to Main Page</Link>
      </div>
    </section>
  );
}
