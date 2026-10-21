'use client';

import { useState } from 'react';
import { Check, LoaderCircle, Send } from 'lucide-react';
import { sendContact } from '@/app/contact-actions';

const TYPES = ['General Inquiry', 'Product / Service Quote', 'Compliment', 'Complaint / Issue', 'Business / Collaboration Proposal'];
const f = 'h-12 w-full rounded-xl bg-neutral-950 px-4 text-base text-white ring-1 ring-white/15 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-[#c8a96a] sm:text-sm';

export function ContactForm() {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string>();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('busy'); setError(undefined);
    const r = await sendContact(Object.fromEntries(new FormData(e.currentTarget))).catch(() => ({ ok: false, error: 'Something went wrong — please try again.' }));
    if (r.ok) setState('done'); else { setState('idle'); setError(r.error); }
  }
  if (state === 'done') return (
    <div className="mx-auto max-w-xl rounded-3xl bg-emerald-500/10 p-6 text-center ring-1 ring-emerald-400/30" role="status">
      <Check className="mx-auto size-8 text-emerald-300" /><p className="mt-2 font-semibold text-white">Message sent!</p><p className="mt-1 text-sm text-neutral-300">A copy is in your inbox — I’ll be in touch soon.</p>
    </div>
  );
  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-3 rounded-3xl bg-neutral-900/70 p-5 text-left ring-1 ring-white/10 sm:p-6">
      <label className="block text-xs text-neutral-400">Inquiry type / specific interest
        <select name="type" required defaultValue="General Inquiry" className={`${f} mt-1`}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required maxLength={80} autoComplete="name" placeholder="Name" aria-label="Name" className={f} />
        <input name="phone" type="tel" maxLength={25} autoComplete="tel" placeholder="Phone (optional)" aria-label="Phone" className={f} />
      </div>
      <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="Email" aria-label="Email" className={f} />
      <input name="subject" required maxLength={120} placeholder="Subject" aria-label="Subject" className={f} />
      <textarea name="message" required rows={5} maxLength={5000} placeholder="Your message" aria-label="Message" className={`${f} h-auto py-3`} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button disabled={state === 'busy'} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#c8a96a] font-semibold text-neutral-950 hover:bg-[#d8bc82] disabled:opacity-60">
        {state === 'busy' ? <><LoaderCircle className="size-4 animate-spin" /> Sending…</> : <><Send className="size-4" /> Send message</>}
      </button>
    </form>
  );
}
