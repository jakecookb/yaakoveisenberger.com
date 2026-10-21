import Link from 'next/link';
import { ArrowLeft, BadgeCheck, Check, Download, Mail, Phone, Trash2, X } from 'lucide-react';
import type { AccessRequest } from '@/lib/access/visitor';
import { overallStatus } from '@/lib/access/csv';
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

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });

/** Name, contact details and dates for one person. */
function Who({ r, right }: { r: AccessRequest; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-white">{r.name} <span className="ml-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-neutral-400 ring-1 ring-white/10">{overallStatus(r)}</span></p>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-400">
          {r.email ? (
            <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 break-all hover:text-white"><Mail className="size-3.5 shrink-0" /> {r.email}{r.emailVerifiedAt && <BadgeCheck className="size-3.5 shrink-0 text-emerald-400" aria-label="Email confirmed" />}</a>
          ) : <span className="text-neutral-600">No email (older request)</span>}
          {r.phone && <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-white"><Phone className="size-3.5" /> {r.phone}</a>}
        </p>
        <p className="mt-1 text-xs text-neutral-500">Requested {when(r.createdAt)}{r.emailVerifiedAt ? ' · email confirmed' : r.email ? ' · email not confirmed yet' : ''}</p>
      </div>
      {right}
    </div>
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
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Access requests</h1>
          <p className="mt-1 max-w-md text-sm text-neutral-400">Everyone who asked to see a locked or greyed-out box. Approve one box or everything — it unlocks right away, and they get an email.</p>
        </div>
        <a href="/api/admin/access-csv" download className="inline-flex h-11 items-center gap-2 rounded-full bg-[#c8a96a] px-5 text-sm font-semibold text-neutral-950 transition hover:bg-[#d8bc82]">
          <Download className="size-4" /> Download CSV <span className="rounded-full bg-neutral-950/15 px-2 py-0.5 text-xs">{requests.length}</span>
        </a>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-[#c8a96a]">Waiting ({pending.length})</h2>
      <ul className="mt-3 space-y-3">
        {pending.length === 0 && <li className="rounded-2xl bg-neutral-900/60 p-5 text-sm text-neutral-500 ring-1 ring-white/10">No one is waiting.</li>}
        {pending.map((r) => (
          <li key={r.id} className="rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10">
            <Who r={r} />
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
            <Who r={r} right={<Act action={removeVisitorAction} id={r.id} cat="" className={neutral}><Trash2 className="size-3.5" /> Remove</Act>} />
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
