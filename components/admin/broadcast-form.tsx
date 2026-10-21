'use client';

import { useActionState } from 'react';
import { LoaderCircle, Send } from 'lucide-react';
import { sendBroadcast, type BroadcastState } from '@/app/admin/broadcast/actions';

const f = 'w-full rounded-xl bg-neutral-950 px-4 py-2.5 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-[#c8a96a]';

export function BroadcastForm({ topics }: { topics: { id: string; label: string; count: number }[] }) {
  const [state, action, pending] = useActionState<BroadcastState, FormData>(sendBroadcast, {});
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10">
      <label className="block text-sm text-neutral-300">Send to
        <select name="topic" className={`${f} mt-1`} defaultValue="all">{topics.map((t) => <option key={t.id} value={t.id}>{t.id === 'all' ? `Everyone (${t.count})` : `${t.label} — ${t.count} (incl. “all updates”)`}</option>)}</select>
      </label>
      <label className="block text-sm text-neutral-300">Subject<input name="subject" required maxLength={140} className={`${f} mt-1`} placeholder="New on the site: …" /></label>
      <label className="block text-sm text-neutral-300">Message<textarea name="body" required rows={8} maxLength={20000} className={`${f} mt-1`} placeholder="Plain text. Blank lines start new paragraphs; links become clickable." /></label>
      <label className="block text-sm text-neutral-300">Button link (optional)<input name="link" className={`${f} mt-1`} placeholder="/weapons or https://…" /></label>
      <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" name="confirm" value="yes" /> I’m ready to send this to real subscribers</label>
      {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-emerald-300">Sent to {state.sent} of {state.total} subscribers.</p>}
      <button disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#c8a96a] px-6 font-semibold text-neutral-950 disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Send announcement</button>
    </form>
  );
}
