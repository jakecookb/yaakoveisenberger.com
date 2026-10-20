import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">yaakoveisenberger.com</h1>
      <p className="mt-3 text-slate-600">Stand-in home page for the existing site.</p>
      <Link href="/fund" className="mt-8 inline-block rounded-lg bg-slate-900 px-4 py-2 text-white">Go to /fund</Link>
    </main>
  );
}
