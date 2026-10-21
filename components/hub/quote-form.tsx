'use client';

import { useState } from 'react';
import { Check, LoaderCircle, Send } from 'lucide-react';
import { requestQuote } from '@/app/quote-actions';

const f = 'h-11 w-full rounded-xl bg-neutral-950 px-4 text-sm text-white ring-1 ring-white/15 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-[var(--accent)]';

export function QuoteForm({ board, title, accent }: { board: string; title: string; accent: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    const res = await requestQuote({ ...Object.fromEntries(new FormData(e.currentTarget)), board }).catch(() => ({ ok: false, error: 'Something went wrong — please try again.' }));
    setBusy(false);
    if (res.ok) setDone(true); else setError(res.error);
  }
  if (done) return <div className="mx-auto mt-12 max-w-xl rounded-3xl bg-emerald-500/10 p-6 text-left ring-1 ring-emerald-400/30"><p className="flex items-center gap-2 font-semibold text-white"><Check className="size-5 text-emerald-300" /> Request sent!</p><p className="mt-2 text-sm text-neutral-300">Check your inbox for a confirmation — I’ll be in touch soon.</p></div>;
  return (
    <form onSubmit={submit} style={{ '--accent': accent } as React.CSSProperties} className="mx-auto mt-12 max-w-xl space-y-3 rounded-3xl bg-neutral-900/70 p-6 text-left ring-1 ring-white/10">
      <h2 className="text-lg font-semibold text-white">Get a {title} quote</h2>
      <p className="text-sm text-neutral-400">Tell me about your event — you’ll get a confirmation email and I’ll reply with pricing.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required maxLength={80} autoComplete="name" placeholder="Name" aria-label="Name" className={f} />
        <input name="phone" type="tel" required maxLength={25} autoComplete="tel" placeholder="Phone" aria-label="Phone" className={f} />
        <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="Email" aria-label="Email" className={`${f} sm:col-span-2`} />
        <label className="text-xs text-neutral-400">Event date<input name="date" type="date" className={`${f} mt-1 [color-scheme:dark]`} /></label>
        <label className="text-xs text-neutral-400">Guests<input name="guests" type="number" min={1} max={5000} className={`${f} mt-1`} /></label>
      </div>
      <textarea name="message" rows={4} maxLength={2000} placeholder="Size, style, dietary needs, delivery address…" aria-label="Details" className={`${f} h-auto py-3`} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full font-semibold text-neutral-950 disabled:opacity-60" style={{ background: accent }}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Request a quote</button>
    </form>
  );
}
