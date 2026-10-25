'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LoaderCircle, Send } from 'lucide-react';
import { subscribeAction } from '@/app/subscribe-actions';

const TOPICS = [
  ['all', 'Everything new'], ['weapons', 'Weapons & 2A'], ['boards', 'Fish & Meat Boards'],
  ['photography', 'Photography'], ['events', 'Events'], ['devtools', 'Developer Tools'], ['news', 'Car & tech news'],
] as const;

/** Sign-up pill in the site's black and gold: a bright circling gold edge with a breathing halo, and a custom topic picker. */
export function SubscribeForm() {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string>();
  const [topic, setTopic] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!box.current?.contains(e.target as Node) || (e as KeyboardEvent).key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setState('busy'); setError(undefined);
    const r = await subscribeAction(String(d.get('email')), topic, String(d.get('website') ?? '')).catch(() => ({ ok: false, error: 'Something went wrong.' }));
    if (r.ok) setState('done'); else { setState('idle'); setError(r.error); }
  }
  const label = TOPICS.find(([v]) => v === topic)![1];
  return (
    <div className="relative mx-auto w-full max-w-xl rounded-3xl border border-[#c8a96a]/40 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(200,169,106,0.22),rgba(10,10,10,0.95)_70%)] px-5 py-7 text-center shadow-[0_0_60px_-12px_rgba(200,169,106,0.5)] sm:px-8 sm:py-9">
      <span aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#f5e3a8] to-transparent" />
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.4em] text-[#c8a96a]">Stay in the loop</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Get <span className="bg-gradient-to-r from-[#f5e3a8] via-[#c8a96a] to-[#f5e3a8] bg-clip-text text-transparent">updates</span></h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-400">New videos, boards and tools, straight to your inbox.</p>
      <div className="gold-ring relative isolate mt-5 rounded-full p-[2px]">
        {state === 'done' ? (
          <p className="flex h-14 items-center justify-center gap-2 rounded-full bg-neutral-950 text-sm text-[#f5e3a8]" role="status"><Check className="size-4" /> Subscribed — check your inbox.</p>
        ) : (
          <form onSubmit={submit} className="flex h-14 items-center gap-1 rounded-full bg-neutral-950 pl-5 pr-1.5">
            <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="Your email" aria-label="Email address" className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-neutral-500" />
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
            <button disabled={state === 'busy'} aria-label="Subscribe" className="gold-fill flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold uppercase tracking-wider text-neutral-950 transition hover:brightness-110 active:scale-95 disabled:opacity-60">
              {state === 'busy' ? <LoaderCircle className="size-4 animate-spin" /> : <>Subscribe <Send className="size-4" /></>}
            </button>
          </form>
        )}
      </div>
      {state !== 'done' && (
        <div ref={box} className="relative mt-4 inline-block text-left">
          <button type="button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Updates about: ${label}`} className="flex h-9 items-center gap-2 rounded-full bg-[#c8a96a]/10 px-4 text-xs text-[#f1e2b8] ring-1 ring-[#c8a96a]/30 transition hover:bg-[#c8a96a]/20">
            <span className="text-neutral-400">About</span><span>{label}</span><ChevronDown className={`size-3.5 transition ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <ul role="listbox" aria-label="Updates about" className="absolute left-0 bottom-full z-30 mb-2 w-56 overflow-hidden rounded-2xl bg-neutral-900/95 p-1 shadow-2xl ring-1 ring-white/15 backdrop-blur-xl">
              {TOPICS.map(([v, l]) => (
                <li key={v} role="option" aria-selected={topic === v}>
                  <button type="button" onClick={() => { setTopic(v); setOpen(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${topic === v ? 'bg-white/10 text-white' : 'text-neutral-300 hover:bg-white/5'}`}>{l}{topic === v && <Check className="size-3.5 text-[#c8a96a]" />}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
