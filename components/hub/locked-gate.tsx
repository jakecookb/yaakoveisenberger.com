'use client';

import { useEffect, useState } from 'react';
import { Check, Clock, Lock, ShieldX } from 'lucide-react';
import { requestAccess } from '@/app/access-actions';
import { PhotoGallery, type GalleryPhoto } from './photo-gallery';

type State = 'loading' | 'none' | 'pending' | 'approved' | 'denied';

/**
 * Shown instead of a locked page's content. The page itself carries nothing private: this component asks the
 * server whether this browser has been approved, and only then fetches the content.
 */
export function LockedGate({ categoryId, accent }: { categoryId: string; accent: string }) {
  const [state, setState] = useState<State>('loading');
  const [knownName, setKnownName] = useState<string>();
  const [name, setName] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [content, setContent] = useState<{ body: string; photos: GalleryPhoto[] }>();

  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/access/status?cat=${encodeURIComponent(categoryId)}`, { cache: 'no-store' }).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { state: Exclude<State, 'loading'>; name?: string }) : { state: 'none' as const, name: undefined };
      let body: { body: string; photos: GalleryPhoto[] } | undefined;
      if (data.state === 'approved') {
        const c = await fetch(`/api/category/${encodeURIComponent(categoryId)}`, { cache: 'no-store' }).catch(() => null);
        if (c?.ok) body = await c.json();
      }
      if (!alive) return;
      setKnownName(data.name);
      setState(data.state);
      if (body) setContent(body);
    })();
    return () => { alive = false; };
  }, [categoryId, tick]);

  // While waiting for approval, check again every 20 seconds.
  useEffect(() => {
    if (state !== 'pending') return;
    const t = setInterval(() => setTick((n) => n + 1), 20_000);
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

  if (state === 'approved') {
    return (
      <div className="mt-10 text-left">
        {content?.body && <p className="mb-8 whitespace-pre-line text-neutral-300">{content.body}</p>}
        {content ? content.photos.length ? <PhotoGallery photos={content.photos} /> : <p className="text-center text-neutral-500">Nothing here yet.</p> : <p className="text-center text-neutral-500">Loading…</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md rounded-3xl bg-neutral-900/70 p-6 text-left ring-1 ring-white/10 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl text-neutral-950" style={{ background: accent }}>
          {state === 'pending' ? <Clock className="size-5" /> : state === 'denied' ? <ShieldX className="size-5" /> : <Lock className="size-5" />}
        </span>
        <h2 className="text-lg font-semibold text-white">
          {state === 'pending' ? 'Request sent' : state === 'denied' ? 'Access not granted' : 'This page is private'}
        </h2>
      </div>

      {state === 'loading' && <p className="mt-4 text-sm text-neutral-500">Checking…</p>}

      {state === 'pending' && (
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">
          Thanks{knownName ? `, ${knownName}` : ''}. I’ll review your request. Keep this page open or come back later in the same browser — it unlocks as soon as I approve it.
          <span className="mt-3 flex items-center gap-2 text-neutral-500"><Check className="size-4" /> Waiting for approval</span>
        </p>
      )}

      {state === 'denied' && <p className="mt-4 text-sm leading-relaxed text-neutral-400">Sorry{knownName ? `, ${knownName}` : ''} — I wasn’t able to approve this one.</p>}

      {(state === 'none' || state === 'denied') && (
        <form onSubmit={submit} className="mt-5 space-y-3">
          {state === 'none' && <p className="text-sm text-neutral-400">You don’t have access to this yet. {knownName ? `Request it as ${knownName}.` : 'Type your name and I’ll approve it first.'}</p>}
          {!knownName && (
            <>
              <label className="block text-sm font-medium text-neutral-200" htmlFor="visitor-name">Your name</label>
              <input id="visitor-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoComplete="name" placeholder="First and last name" className="h-11 w-full rounded-xl bg-neutral-950 px-4 text-white ring-1 ring-white/15 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#c8a96a]" />
            </>
          )}
          <input tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" name="website" />
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button disabled={busy || (!knownName && name.trim().length < 2)} className="h-11 w-full rounded-full bg-[#c8a96a] font-semibold text-neutral-950 transition hover:bg-[#d8bc82] disabled:opacity-50">
            {busy ? 'Sending…' : state === 'denied' ? 'Ask again' : 'Request access'}
          </button>
        </form>
      )}
    </div>
  );
}
