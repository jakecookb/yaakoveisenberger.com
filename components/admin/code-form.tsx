'use client';

import { useActionState, useState } from 'react';
import { Copy, KeyRound, LoaderCircle } from 'lucide-react';
import { createCodeAction, type CodeFormState } from '@/app/admin/codes/actions';

const f = 'w-full rounded-xl bg-neutral-950 px-4 py-2.5 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-[#c8a96a]';

export function CodeForm({ boxes }: { boxes: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState<CodeFormState, FormData>(createCodeAction, {});
  const [all, setAll] = useState(true);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-neutral-300">Who it’s for<input name="label" required maxLength={60} className={`${f} mt-1`} placeholder="e.g. Family, Shabbos guests" /></label>
        <label className="block text-sm text-neutral-300">Code (leave blank to make one)<input name="code" maxLength={40} autoComplete="off" className={`${f} mt-1 font-mono`} placeholder="Random, like K7QM-2XHP-9TRW" /></label>
      </div>
      <fieldset className="text-sm text-neutral-300">
        <legend>Opens</legend>
        <label className="mt-1 flex items-center gap-2"><input type="checkbox" name="all" value="yes" checked={all} onChange={(e) => setAll(e.target.checked)} /> Every locked page</label>
        {!all && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {boxes.map((b) => <label key={b.id} className="flex items-center gap-1.5"><input type="checkbox" name="boxes" value={b.id} /> {b.title}</label>)}
          </div>
        )}
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
      {state.ok && state.created && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-emerald-300">
          Made: <code className="rounded bg-emerald-400/10 px-2 py-0.5 font-mono text-white">{state.created}</code>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(state.created!); setCopied(true); }} className="inline-flex items-center gap-1 text-xs text-neutral-300 hover:text-white"><Copy className="size-3.5" /> {copied ? 'Copied' : 'Copy'}</button>
        </p>
      )}
      <button disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#c8a96a] px-6 font-semibold text-neutral-950 disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Create code</button>
    </form>
  );
}
