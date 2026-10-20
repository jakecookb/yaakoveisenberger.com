import Link from 'next/link';
import { ArrowLeft, Check, Trash2, X } from 'lucide-react';
import { categories } from '@/data/navigation';
import { approveAction, denyAction, removeVisitorAction, revokeAction } from '@/app/admin/actions';
import { requireAdmin } from '@/lib/admin/session';
import { listRequests } from '@/lib/access/visitor';
import { loadSettings } from '@/lib/site/load';
import { resolveCards } from '@/lib/site/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Access requests' };

const btn = 'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition';

function Act({ action, id, cat, children, className }: { action: (f: FormData) => Promise<void>; id: string; cat: string; children: React.ReactNode; className: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="cat" value={cat} />
      <button className={`${btn} ${className}`}>{children}</button>
    </form>
  );
}

export default async function AccessPage() {
  await requireAdmin();
  const [requests, settings] = await Promise.all([listRequests(), loadSettings()]);
  const title = (id: string) => resolveCards(settings, { includeHidden: true }).find((c) => c.id === id)?.title ?? categories.find((c) => c.id === id)?.title ?? id;
  const ok = 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-400/25';
  const neutral = 'bg-white/5 text-neutral-300 ring-1 ring-white/10 hover:bg-white/10';
  const pending = requests.filter((r) => r.requested.length > 0);
  const others = requests.filter((r) => r.requested.length === 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"><ArrowLeft className="size-4" /> Editor</Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">Access requests</h1>
      <p className="mt-1 text-sm text-neutral-400">People who typed their name on a locked box. Approve one box or everything — it unlocks in their browser right away.</p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-[#c8a96a]">Waiting ({pending.length})</h2>
      <ul className="mt-3 space-y-3">
        {pending.length === 0 && <li className="rounded-2xl bg-neutral-900/60 p-5 text-sm text-neutral-500 ring-1 ring-white/10">No one is waiting.</li>}
        {pending.map((r) => (
          <li key={r.id} className="rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10">
            <p className="font-medium text-white">{r.name} <span className="ml-2 text-xs font-normal text-neutral-500">{new Date(r.createdAt).toLocaleString('en-US', { timeZone: 'America/New_York' })}</span></p>
            <ul className="mt-3 space-y-2">
              {r.requested.map((c) => (
                <li key={c} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-neutral-300">Wants <b className="text-white">{title(c)}</b></span>
                  <span className="flex flex-wrap gap-2">
                    <Act action={approveAction} id={r.id} cat={c} className={ok}><Check className="size-3.5" /> Approve</Act>
                    <Act action={denyAction} id={r.id} cat={c} className={neutral}><X className="size-3.5" /> Deny</Act>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3"><Act action={approveAction} id={r.id} cat="*" className={neutral}>Approve everything</Act></div>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-[#c8a96a]">People with access ({others.length})</h2>
      <ul className="mt-3 space-y-3">
        {others.map((r) => (
          <li key={r.id} className="rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-white">{r.name}</p>
              <Act action={removeVisitorAction} id={r.id} cat="" className={neutral}><Trash2 className="size-3.5" /> Remove</Act>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {r.all && <Act action={revokeAction} id={r.id} cat="*" className={ok}>Everything <X className="size-3" /></Act>}
              {r.granted.map((c) => <Act key={c} action={revokeAction} id={r.id} cat={c} className={ok}>{title(c)} <X className="size-3" /></Act>)}
              {r.denied.map((c) => <span key={c} className={`${btn} bg-red-400/10 text-red-300 ring-1 ring-red-400/20`}>Denied: {title(c)}</span>)}
              {!r.all && r.granted.length === 0 && r.denied.length === 0 && <span className="text-sm text-neutral-500">No access</span>}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
