'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Clock, Lock, ShieldX } from 'lucide-react';
import { requestAccess } from '@/app/access-actions';
import { PhotoGallery, type GalleryPhoto } from './photo-gallery';
import { RichText } from './rich-text';

type State = 'loading' | 'none' | 'pending' | 'approved' | 'denied';
interface Status {
  state: Exclude<State, 'loading'>;
  name?: string;
  retryAt?: string;
}

const minutesLeft = (iso: string | undefined, now: number) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000)) : 0);

/**
 * Shown instead of a locked box's content (in the pop-up on the home page, on /access/<id>, and inside locked pages).
 * It asks the server whether this browser was approved. Nothing private is in the page itself.
 * Visitors see Pending → Approved (then they're let in) or Declined (then they can ask again after a wait).
 */
export function LockedGate({ categoryId, accent, continueHref, className = 'mt-10' }: { categoryId: string; accent: string; continueHref?: string; className?: string }) {
  const [status, setStatus] = useState<{ state: State; name?: string; retryAt?: string }>({ state: 'loading' });
  const [name, setName] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [content, setContent] = useState<{ body: string; photos: GalleryPhoto[] }>();
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const waited = useRef(false); // true once we've seen Pending/Declined in this session → show the "Approved" message first

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/access/status?cat=${encodeURIComponent(categoryId)}`, { cache: 'no-store' }).catch(() => null);
      const data: Status = res?.ok ? await res.json() : { state: 'none' };
      let body: { body: string; photos: GalleryPhoto[] } | undefined;
      if (data.state === 'approved' && !continueHref) {
        const c = await fetch(`/api/category/${encodeURIComponent(categoryId)}`, { cache: 'no-store' }).catch(() => null);
        if (c?.ok) body = await c.json();
      }
      if (!alive) return;
      if (data.state === 'pending' || data.state === 'denied') waited.current = true;
      setStatus(data);
      setNow(Date.now());
      if (body) setContent(body);
      if (data.state === 'approved' && continueHref) {
        // Let people who were waiting read "Approved" for a moment; returning approved visitors go straight in.
        setTimeout(() => window.location.replace(continueHref), waited.current ? 1500 : 0);
      }
    })();
    return () => { alive = false; };
  }, [categoryId, tick, continueHref]);

  // While waiting (or declined) keep checking: the owner may decide at any time.
  const state = status.state;
  useEffect(() => {
    if (state !== 'pending' && state !== 'denied') return;
    const t = setInterval(() => { setTick((n) => n + 1); setNow(Date.now()); }, 15_000);
    return () => clearInterval(t);
  }, [state]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await requestAccess(name, categoryId, website);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setTick((n) => n + 1);
  }

  if (state === 'approved' && continueHref) {
    return (
      <div className={`mx-auto w-full max-w-md rounded-3xl bg-neutral-900 p-6 text-left ring-1 ring-emerald-400/30 sm:p-8 ${className}`} role="status">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-400 text-neutral-950"><Check className="size-5" /></span>
          <h2 className="text-lg font-semibold text-white">Approved</h2>
        </div>
        <p className="mt-3 text-sm text-neutral-300">{status.name ? `Welcome, ${status.name}. ` : ''}Opening it now…</p>
      </div>
    );
  }

  if (state === 'approved') {
    return (
      <div className="mt-10 text-left">
        {content?.body && <RichText text={content.body} className="mb-8" />}
        {content ? content.photos.length ? <PhotoGallery photos={content.photos} /> : <p className="text-center text-neutral-500">Nothing here yet.</p> : <p className="text-center text-neutral-500">Loading…</p>}
      </div>
    );
  }

  const wait = state === 'denied' ? minutesLeft(status.retryAt, now) : 0;
  const canAsk = state === 'none' || (state === 'denied' && wait === 0);
  const who = status.name;

  return (
    <div className={`mx-auto w-full max-w-md rounded-3xl bg-neutral-900 p-6 text-left ring-1 sm:p-8 ${state === 'denied' ? 'ring-red-400/30' : 'ring-white/10'} ${className}`}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl text-neutral-950" style={{ background: state === 'denied' ? '#f87171' : accent }}>
          {state === 'pending' ? <Clock className="size-5" /> : state === 'denied' ? <ShieldX className="size-5" /> : <Lock className="size-5" />}
        </span>
        <h2 className="text-lg font-semibold text-white">
          {state === 'pending' ? 'Request sent' : state === 'denied' ? 'Declined' : 'This page is private'}
        </h2>
      </div>

      {state === 'loading' && <p className="mt-4 text-sm text-neutral-500">Checking…</p>}

      {state === 'pending' && (
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">
          Thanks{who ? `, ${who}` : ''}. I’ll review your request. Keep this open or come back later in the same browser — it opens as soon as I approve it.
          <span className="mt-3 flex items-center gap-2 text-neutral-500"><Check className="size-4" /> Waiting for approval</span>
        </p>
      )}

      {state === 'denied' && (
        <p className="mt-4 text-sm leading-relaxed text-neutral-300" role="status">
          Sorry{who ? `, ${who}` : ''} — your request was declined.{' '}
          <span className="text-neutral-400">{wait > 0 ? `You can try again in ${wait} minute${wait === 1 ? '' : 's'}.` : 'You can ask again now.'}</span>
        </p>
      )}

      {canAsk && (
        <form onSubmit={submit} className="mt-5 space-y-3">
          {state === 'none' && <p className="text-sm text-neutral-400">You don’t have access to this yet. {who ? `Request it as ${who}.` : 'Type your name and I’ll approve it first.'}</p>}
          {!who && (
            <>
              <label className="block text-sm font-medium text-neutral-200" htmlFor="visitor-name">Your name</label>
              <input id="visitor-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoComplete="name" placeholder="First and last name" className="h-11 w-full rounded-xl bg-neutral-950 px-4 text-white ring-1 ring-white/15 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#c8a96a]" />
            </>
          )}
          <input tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" name="website" />
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button disabled={busy || (!who && name.trim().length < 2)} className="h-11 w-full rounded-full bg-[#c8a96a] font-semibold text-neutral-950 transition hover:bg-[#d8bc82] disabled:opacity-50">
            {busy ? 'Sending…' : state === 'denied' ? 'Ask again' : 'Request access'}
          </button>
        </form>
      )}

      {state === 'denied' && wait > 0 && (
        <button disabled className="mt-5 h-11 w-full cursor-not-allowed rounded-full bg-white/5 text-sm font-semibold text-neutral-500 ring-1 ring-white/10">
          Ask again in {wait} min
        </button>
      )}
    </div>
  );
}
