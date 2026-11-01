import Link from 'next/link';
import { ArrowLeft, Power, Trash2, UserX } from 'lucide-react';
import { categories } from '@/data/navigation';
import { CodeForm } from '@/components/admin/code-form';
import { deleteCodeAction, toggleCodeAction } from '@/app/admin/codes/actions';
import { removeVisitorAction } from '@/app/admin/actions';
import { listCodes, listUses } from '@/lib/access/codes';
import { listRequests } from '@/lib/access/visitor';
import { requireAdmin } from '@/lib/admin/session';
import { loadSettings } from '@/lib/site/load';
import { resolveCards } from '@/lib/site/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Access codes' };

const btn = 'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition';
const neutral = 'bg-white/5 text-neutral-300 ring-1 ring-white/10 hover:bg-white/10';
const danger = 'bg-red-400/10 text-red-300 ring-1 ring-red-400/20 hover:bg-red-400/20';
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });

function Act({ action, fields, children, className }: { action: (f: FormData) => Promise<void>; fields: Record<string, string>; children: React.ReactNode; className: string }) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={`${btn} ${className}`}>{children}</button>
    </form>
  );
}

export default async function CodesPage() {
  await requireAdmin();
  const [codes, uses, requests, settings] = await Promise.all([listCodes(), listUses(), listRequests(), loadSettings()]);
  const cards = resolveCards(settings, { includeHidden: true });
  const title = (id: string) => cards.find((c) => c.id === id)?.title ?? categories.find((c) => c.id === id)?.title ?? id;
  const lockable = cards.filter((c) => c.lockable).map((c) => ({ id: c.id, title: c.title }));
  const count = (id: string) => uses.filter((u) => u.codeId === id).length;
  // People who only ever came in with a code (no email): listed here instead of with the email sign-ups.
  const codePeople = requests.filter((r) => !r.email && r.codeGranted?.length);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"><ArrowLeft className="size-4" /> Editor</Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">Access codes</h1>
      <p className="mt-1 max-w-lg text-sm text-neutral-400">Give someone a code: they type their name and the code (in the email box) on a locked page, and it opens right away — no approval or email needed. Email sign-ups stay in <Link href="/admin/access" className="text-[#c8a96a]">Access requests</Link>.</p>

      <div className="mt-6"><CodeForm boxes={lockable} /></div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-[#c8a96a]">Codes ({codes.length})</h2>
      <ul className="mt-3 space-y-3">
        {codes.length === 0 && <li className="rounded-2xl bg-neutral-900/60 p-5 text-sm text-neutral-500 ring-1 ring-white/10">No codes yet.</li>}
        {codes.map((c) => (
          <li key={c.id} className={`rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10 ${c.active ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-white">{c.label} <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${c.active ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30' : 'bg-white/5 text-neutral-400 ring-white/10'}`}>{c.active ? 'On' : 'Off'}</span></p>
                <p className="mt-1 font-mono text-sm text-neutral-200">{c.code ?? <span className="font-sans text-neutral-500">Hidden (only its owner has it)</span>}</p>
                <p className="mt-1 text-xs text-neutral-500">Opens {c.boxes === '*' ? 'every locked page' : c.boxes.map(title).join(', ')} · used {count(c.id)}× · made {when(c.createdAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Act action={toggleCodeAction} fields={{ id: c.id }} className={neutral}><Power className="size-3.5" /> {c.active ? 'Turn off' : 'Turn on'}</Act>
                <Act action={deleteCodeAction} fields={{ id: c.id }} className={neutral}><Trash2 className="size-3.5" /> Delete</Act>
                <Act action={deleteCodeAction} fields={{ id: c.id, lockout: 'yes' }} className={danger}><UserX className="size-3.5" /> Delete + remove access it gave</Act>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-[#c8a96a]">Code log ({uses.length})</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl ring-1 ring-white/10">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-neutral-500"><tr><th className="p-3 font-medium">When</th><th className="p-3 font-medium">Name</th><th className="p-3 font-medium">Code</th><th className="p-3 font-medium">Opened</th><th className="p-3 font-medium">Country</th></tr></thead>
          <tbody className="divide-y divide-white/5">
            {uses.length === 0 && <tr><td colSpan={5} className="p-4 text-neutral-500">No one has used a code yet.</td></tr>}
            {uses.map((u) => <tr key={u.id}><td className="whitespace-nowrap p-3 text-neutral-400">{when(u.at)}</td><td className="p-3 text-white">{u.name}</td><td className="p-3 text-neutral-300">{u.label}</td><td className="p-3 text-neutral-300">{title(u.box)}</td><td className="p-3 text-neutral-400">{u.country ?? '—'}</td></tr>)}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-[#c8a96a]">People who joined with a code ({codePeople.length})</h2>
      <ul className="mt-3 space-y-2">
        {codePeople.length === 0 && <li className="rounded-2xl bg-neutral-900/60 p-4 text-sm text-neutral-500 ring-1 ring-white/10">No one yet.</li>}
        {codePeople.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-neutral-900/60 p-4 ring-1 ring-white/10">
            <div className="min-w-0 text-sm"><p className="font-medium text-white">{r.name}</p><p className="text-xs text-neutral-500">Has {r.all ? 'everything' : r.granted.map(title).join(', ') || 'nothing'} · since {when(r.createdAt)}</p></div>
            <Act action={removeVisitorAction} fields={{ id: r.id, cat: '' }} className={neutral}><Trash2 className="size-3.5" /> Remove</Act>
          </li>
        ))}
      </ul>
    </main>
  );
}
