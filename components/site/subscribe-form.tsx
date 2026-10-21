'use client';

import { useState } from 'react';
import { Check, LoaderCircle, Mail } from 'lucide-react';
import { subscribeAction } from '@/app/subscribe-actions';

const TOPICS = [
  ['all', 'Latest updates on the website'], ['weapons', 'Weapons & 2A Hub'], ['boards', 'Fish & Meat Boards'],
  ['photography', 'Photography'], ['events', 'Events'], ['devtools', 'Developer Tools'], ['news', 'Car & tech news'],
] as const;

export function SubscribeForm() {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string>();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setState('busy'); setError(undefined);
    const r = await subscribeAction(String(d.get('email')), String(d.get('topic')), String(d.get('website') ?? '')).catch(() => ({ ok: false, error: 'Something went wrong.' }));
    if (r.ok) setState('done'); else { setState('idle'); setError(r.error); }
  }
  if (state === 'done') return <p className="flex items-center justify-center gap-2 text-sm text-emerald-300" role="status"><Check className="size-4" /> You’re subscribed — check your inbox.</p>;
  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-2xl">
      <p className="mb-3 text-sm font-medium text-white">Get updates by email</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" aria-label="Email address" className="h-11 flex-1 rounded-full bg-neutral-900 px-4 text-sm text-white ring-1 ring-white/15 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-[#c8a96a]" />
        <select name="topic" defaultValue="all" aria-label="What would you like updates about?" className="h-11 rounded-full bg-neutral-900 px-4 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-[#c8a96a]">
          {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <button disabled={state === 'busy'} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#c8a96a] px-5 text-sm font-semibold text-neutral-950 hover:bg-[#d8bc82] disabled:opacity-60">{state === 'busy' ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />} Subscribe</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
      <p className="mt-2 text-xs text-neutral-500">Unsubscribe any time with one click.</p>
    </form>
  );
}
