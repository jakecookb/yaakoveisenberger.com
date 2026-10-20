import Link from 'next/link';
import { Database } from 'lucide-react';

export function SetupRequired({ area }: { area: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <Database className="mx-auto size-8 text-slate-400" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold">{area} needs Supabase</h1>
        <p className="mt-2 text-sm text-slate-600">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, then run the migration
          (<code>npm run fund:setup</code> does both). Until then you can preview the public experience.
        </p>
        <div className="mt-5 flex justify-center gap-3 text-sm font-medium">
          <Link href="/fund/demo" className="rounded-xl bg-slate-900 px-4 py-2 text-white">Demo campaign</Link>
          <Link href="/fund/display/demo" className="rounded-xl border border-slate-300 px-4 py-2">Demo big screen</Link>
        </div>
      </div>
    </main>
  );
}
