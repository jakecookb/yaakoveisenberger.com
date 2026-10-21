'use client';

import { useState } from 'react';
import { Check, ChevronDown, LoaderCircle, Radio, Send } from 'lucide-react';
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
  return (
    // Glass card with a glowing gradient edge, a faint tech grid and a live "signal" badge.
    <div className="relative mx-auto w-full max-w-3xl rounded-[2rem] bg-gradient-to-br from-[#c8a96a]/60 via-white/10 to-cyan-400/50 p-px shadow-[0_30px_100px_-40px_rgba(34,211,238,0.5)]">
      <div className="relative overflow-hidden rounded-[2rem] bg-neutral-950/90 px-5 py-7 text-left backdrop-blur-xl sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_at_top,#000,transparent_75%)]" aria-hidden />
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-[#c8a96a]/20 blur-3xl" aria-hidden />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-300 ring-1 ring-cyan-300/30">
            <Radio className="size-3.5 animate-pulse" /> Signal · updates
          </span>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">Stay in the loop</h3>
          <p className="mt-1 text-sm text-neutral-400">Pick what you care about — I’ll email you when something new lands. No spam, one-click unsubscribe.</p>
          {state === 'done' ? (
            <p className="mt-5 flex items-center gap-2 rounded-2xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-emerald-400/30" role="status"><Check className="size-4" /> You’re subscribed — check your inbox for a welcome email.</p>
          ) : (
            <form onSubmit={submit} className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto]">
              <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" aria-label="Email address" className="h-12 rounded-2xl bg-white/[0.04] px-4 font-mono text-sm text-white ring-1 ring-white/15 outline-none transition placeholder:text-neutral-600 focus:bg-white/[0.07] focus:ring-2 focus:ring-cyan-300/70" />
              <label className="relative">
                <span className="sr-only">What would you like updates about?</span>
                <select name="topic" defaultValue="all" className="h-12 w-full appearance-none rounded-2xl bg-white/[0.04] pl-4 pr-9 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-cyan-300/70 [&>option]:bg-neutral-900">
                  {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
              </label>
              <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
              <button disabled={state === 'busy'} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#c8a96a] to-cyan-300 px-6 text-sm font-semibold text-neutral-950 shadow-[0_0_30px_-8px_rgba(103,232,249,0.8)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
                {state === 'busy' ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Subscribe
              </button>
            </form>
          )}
          {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
        </div>
      </div>
    </div>
  );
}
