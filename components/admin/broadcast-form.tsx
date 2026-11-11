'use client';

import { startTransition, useActionState, useMemo, useState } from 'react';
import { LoaderCircle, Send } from 'lucide-react';
import { sendBroadcast, type BroadcastState } from '@/app/admin/broadcast/actions';

const f = 'w-full rounded-xl bg-neutral-950 px-4 py-2.5 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-[#c8a96a]';
const chip = 'rounded-full px-3 py-1 text-xs font-medium text-neutral-300 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white';

export interface Person { id: string; email: string; name: string; why: string }

export function BroadcastForm({ topics, people }: { topics: { id: string; label: string; count: number }[]; people: Person[] }) {
  const [state, action, pending] = useActionState<BroadcastState, FormData>(sendBroadcast, {});
  const [who, setWho] = useState('all');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const shown = useMemo(() => people.filter((p) => `${p.email} ${p.name}`.toLowerCase().includes(query.trim().toLowerCase())), [people, query]);
  const toggle = (id: string) => setChosen((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const addShown = () => setChosen((c) => new Set([...c, ...shown.map((p) => p.id)]));
  const removeShown = () => setChosen((c) => { const n = new Set(c); shown.forEach((p) => n.delete(p.id)); return n; });
  return (
    // Submitted by hand rather than as a form action: React empties an action form after every submit, which would wipe the message
    // whenever the server answers with an error (a typo in an address, an unticked box).
    <form onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startTransition(() => action(data)); }} className="space-y-3 rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10">
      <label className="block text-sm text-neutral-300">Send to
        <select name="topic" className={`${f} mt-1`} value={who} onChange={(e) => setWho(e.target.value)}>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.id === 'all' ? `Everyone (${t.count})` : `${t.label} — ${t.count} (incl. “all updates”)`}</option>)}
          <option value="pick">Choose specific people…</option>
        </select>
      </label>
      {who === 'pick' && (
        <fieldset className="rounded-xl bg-neutral-950/60 p-3 ring-1 ring-white/10">
          <legend className="px-1 text-sm text-neutral-300">Who gets it <span className="text-neutral-500">· {chosen.size} selected</span></legend>
          {people.length === 0 ? <p className="p-2 text-sm text-neutral-500">No one has signed up or asked for access yet.</p> : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names or emails…" aria-label="Search people" className={`${f} min-w-0 flex-1`} />
                <button type="button" onClick={addShown} className={chip}>Select {query ? 'shown' : 'all'}</button>
                <button type="button" onClick={removeShown} className={chip}>Clear {query ? 'shown' : 'all'}</button>
              </div>
              <ul className="mt-3 max-h-72 divide-y divide-white/5 overflow-y-auto rounded-xl ring-1 ring-white/10">
                {shown.length === 0 && <li className="p-3 text-sm text-neutral-500">No one matches.</li>}
                {shown.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-start gap-3 p-3 text-sm hover:bg-white/5">
                      <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} className="mt-0.5" />
                      <span className="min-w-0"><span className="block truncate text-white">{p.name ? `${p.name} · ` : ''}<span className={p.name ? 'text-neutral-400' : ''}>{p.email}</span></span><span className="block text-xs text-neutral-500">{p.why}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          <label className="mt-3 block text-sm text-neutral-300">Or type any email addresses
            <textarea name="extra" rows={2} className={`${f} mt-1`} placeholder="name@example.com, another@example.com (commas, spaces or new lines)" />
            <span className="mt-1 block text-xs text-neutral-500">Anyone, even if they never signed up. They get the email with a note on why, and replies come to you.</span>
          </label>
          {/* Everyone ticked is submitted, even when the search hides them. */}
          {[...chosen].map((id) => <input key={id} type="hidden" name="to" value={id} />)}
        </fieldset>
      )}
      <label className="block text-sm text-neutral-300">Subject<input name="subject" required maxLength={140} className={`${f} mt-1`} placeholder="New on the site: …" /></label>
      <label className="block text-sm text-neutral-300">Message<textarea name="body" required rows={8} maxLength={20000} className={`${f} mt-1`} placeholder="Plain text. Blank lines start new paragraphs; links become clickable." /></label>
      <label className="block text-sm text-neutral-300">Button link (optional)<input name="link" className={`${f} mt-1`} placeholder="/weapons or https://…" /></label>
      <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" name="confirm" value="yes" /> I’m ready to send this to {who === 'pick' ? 'the people I picked' : 'real subscribers'}</label>
      {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-emerald-300">Sent to {state.sent} of {state.total}.</p>}
      <button disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#c8a96a] px-6 font-semibold text-neutral-950 disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Send announcement</button>
    </form>
  );
}
