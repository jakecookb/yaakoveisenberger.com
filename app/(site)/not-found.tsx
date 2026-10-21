import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-white">Page not found</h1>
      <p className="mt-2 text-neutral-400">That page doesn’t exist (or moved).</p>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-white px-5 font-semibold text-neutral-950">Back to Hub</Link>
    </section>
  );
}
