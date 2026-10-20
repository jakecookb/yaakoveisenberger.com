import Link from 'next/link';

export default function CampaignNotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-slate-500">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Campaign not found</h1>
      <p className="mt-2 text-slate-600">This campaign may have ended, moved, or not launched yet.</p>
      <Link href="/fund" className="mt-6 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">See live campaigns</Link>
    </main>
  );
}
