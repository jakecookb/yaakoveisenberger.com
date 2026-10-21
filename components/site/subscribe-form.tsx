'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LoaderCircle, Send } from 'lucide-react';
import { subscribeAction } from '@/app/subscribe-actions';

const TOPICS = [
  ['all', 'Everything new'], ['weapons', 'Weapons & 2A'], ['boards', 'Fish & Meat Boards'],
  ['photography', 'Photography'], ['events', 'Events'], ['devtools', 'Developer Tools'], ['news', 'Car & tech news'],
] as const;

/** Compact sign-up pill with a flowing multi-colour glow edge and a custom topic picker. */
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
    <div className="mx-auto w-full max-w-xl">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-neutral-400">Get updates</p>
      <div className="glow-ring relative isolate rounded-full p-[1.5px]">
        {state === 'done' ? (
          <p className="flex h-11 items-center justify-center gap-2 rounded-full bg-neutral-950 text-sm text-emerald-300" role="status"><Check className="size-4" /> Subscribed — check your inbox.</p>
        ) : (
          <form onSubmit={submit} className="flex h-11 items-center gap-1 rounded-full bg-neutral-950 pl-4 pr-1">
            <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" aria-label="Email address" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-neutral-600" />
            <div ref={box} className="relative">
              <button type="button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Updates about: ${label}`} className="flex h-8 items-center gap-1 rounded-full bg-white/5 px-3 text-xs text-neutral-200 ring-1 ring-white/10 transition hover:bg-white/10">
                <span className="max-w-24 truncate sm:max-w-none">{label}</span><ChevronDown className={`size-3.5 transition ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <ul role="listbox" aria-label="Updates about" className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-2xl bg-neutral-900/95 p-1 text-left shadow-2xl ring-1 ring-white/15 backdrop-blur-xl">
                  {TOPICS.map(([v, l]) => (
                    <li key={v} role="option" aria-selected={topic === v}>
                      <button type="button" onClick={() => { setTopic(v); setOpen(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${topic === v ? 'bg-white/10 text-white' : 'text-neutral-300 hover:bg-white/5'}`}>{l}{topic === v && <Check className="size-3.5 text-cyan-300" />}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
            <button disabled={state === 'busy'} aria-label="Subscribe" className="glow-fill flex size-9 shrink-0 items-center justify-center rounded-full text-white transition hover:brightness-110 active:scale-95 disabled:opacity-60">
              {state === 'busy' ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </form>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
