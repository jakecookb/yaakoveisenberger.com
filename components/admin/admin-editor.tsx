'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowDown, ArrowUp, CircleDashed, Download, Eye, EyeOff, ExternalLink, FileText, History, ImagePlus, Images, Link2, Lock, LogOut, Plus, RefreshCw, RotateCcw, Save, ShieldAlert, Trash2, Unlock, Upload, Users } from 'lucide-react';
import { categories } from '@/data/navigation';
import { ICON_KEYS, ICONS } from '@/data/icons';
import { changePassword, logoutAction, restorePrevious, saveSettings, type FormState } from '@/app/admin/actions';
import { Announcement } from '@/components/site/announcement';
import { HubHero } from '@/components/hub/hub-hero';
import { CategoryCard } from '@/components/hub/category-card';
import { Directory } from '@/components/hub/category-grid';
import { gridClass, groupCards, HUB_SECTIONS } from '@/lib/site/hub';
import { RichText } from '@/components/hub/rich-text';
import {
  BOX_HEIGHTS, BOX_WIDTHS, ICON_SIZES, mediaUrl, resolveCards, sanitizeSettings, settingsSchema, TONES, type BoxHeight, type BoxWidth, type CardOverride, type CardView, type IconSize, type SiteBlock, type SiteSettings,
} from '@/lib/site/settings';
import type { SettingsState } from '@/lib/site/load';

type Tab = 'cards' | 'site' | 'photos' | 'account';
type Bulk = 'open' | 'locked' | 'greyed' | 'show' | 'hide';

const input = 'h-10 w-full rounded-xl bg-neutral-950 px-3 text-sm text-white ring-1 ring-white/15 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#c8a96a]';
const area = 'w-full rounded-xl bg-neutral-950 px-3 py-2 text-sm text-white ring-1 ring-white/15 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#c8a96a]';
const chip = (on: boolean) => `inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition ${on ? 'bg-[#c8a96a] text-neutral-950 ring-[#c8a96a]' : 'bg-white/5 text-neutral-300 ring-white/10 hover:bg-white/10'}`;
const label = 'mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500';

const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;

/** Resizes in the browser (max 2400px) so uploads are fast and stay well under the size limit. */
async function prepare(file: File): Promise<{ blob: Blob; ext: string }> {
  if (file.type === 'image/gif') return { blob: file, ext: 'gif' };
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // This browser can't decode it (e.g. an iPhone HEIC photo in Chrome): send common formats as they are.
    if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= 15 * 1024 * 1024) return { blob: file, ext: file.type.split('/')[1].replace('jpeg', 'jpg') };
    throw new Error(/heic|heif/i.test(file.type + file.name) ? 'iPhone HEIC photo — upload from Safari, or set iPhone Camera → Formats → Most Compatible.' : 'This file isn’t a supported image (use JPEG, PNG or WebP).');
  }
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const type = file.type === 'image/png' || file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.86));
  if (!blob) throw new Error('Could not read that image.');
  return { blob, ext: blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg' };
}

async function uploadImage(folder: string, file: File) {
  const { blob, ext } = await prepare(file);
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const pathname = `${folder}/${name}`;
  const res = await fetch(`/api/admin/upload?path=${encodeURIComponent(pathname)}`, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type } });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Upload failed');
  return { pathname };
}

type Mode = 'open' | 'locked' | 'greyed';
const MODES: Mode[] = ['open', 'locked', 'greyed'];
const modeOf = (c: { locked: boolean; greyed: boolean }): Mode => (c.greyed ? 'greyed' : c.locked ? 'locked' : 'open');
const MODE_INFO: Record<Mode, { label: string; hint: string; icon: typeof Lock; row: string }> = {
  open: { label: 'Open', hint: 'Anyone can open this box', icon: Unlock, row: 'text-neutral-400 ring-white/10 hover:bg-white/10' },
  locked: { label: 'Locked', hint: 'Shown normally with a lock; visitors request access and you approve them', icon: Lock, row: 'bg-[#c8a96a] text-neutral-950 ring-[#c8a96a]' },
  greyed: { label: 'Greyed out', hint: 'Shown as a faint grey hint with no description; clicking it asks for access', icon: CircleDashed, row: 'bg-neutral-600 text-white ring-neutral-500' },
};

export function AdminEditor({ initial, state, hasPrevious, blobReady, pending, email }: { initial: SiteSettings; state: SettingsState; hasPrevious: boolean; blobReady: boolean; pending: number; email: string }) {
  const [s, setS] = useState<SiteSettings>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [tab, setTab] = useState<Tab>('cards');
  const [photoCat, setPhotoCat] = useState('');
  const [status, setStatus] = useState<{ ok?: boolean; msg: string }>();
  const [saving, startSave] = useTransition();
  // Bumped after every save so the real-site preview reloads and shows the change.
  const [reload, setReload] = useState(0);
  const [showState, setShowState] = useState(state !== 'saved');
  const dirty = JSON.stringify(s) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const cards = useMemo(() => resolveCards(s, { includeHidden: true }), [s]);

  const setCard = (id: string, patch: Partial<Record<keyof CardOverride, CardOverride[keyof CardOverride] | undefined>>) =>
    setS((p) => ({ ...p, cards: { ...p.cards, [id]: Object.fromEntries(Object.entries({ ...p.cards[id], ...patch }).filter(([, v]) => v !== undefined)) as CardOverride } }));
  const addBox = (kind: 'page' | 'link') => {
    const id = `c-${Math.random().toString(36).slice(2, 8).padEnd(6, 'x')}`;
    setS((p) => ({ ...p, custom: [...p.custom, kind === 'link' ? { id, kind, url: '' } : { id, kind }], cards: { ...p.cards, [id]: { title: kind === 'link' ? 'New link' : 'New page' } } }));
    return id;
  };
  const removeBox = (id: string) =>
    setS((p) => {
      const rest = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== id));
      return { ...p, custom: p.custom.filter((c) => c.id !== id), order: p.order.filter((x) => x !== id), cards: rest(p.cards), pages: rest(p.pages), photos: rest(p.photos) };
    });
  const setPage = (id: string, k: 'heading' | 'body', v: string) =>
    setS((p) => ({ ...p, pages: { ...p.pages, [id]: clean({ ...p.pages[id], [k]: v }) } }));
  const setUrl = (id: string, url: string) => setS((p) => ({ ...p, custom: p.custom.map((c) => (c.id === id ? { ...c, url } : c)) }));
  const resetCard = (id: string) => setS((p) => { const c = { ...p.cards }; delete c[id]; return { ...p, cards: c }; });
  const move = (id: string, d: -1 | 1) =>
    setS((p) => {
      const ids = resolveCards(p, { includeHidden: true }).map((c) => c.id);
      const i = ids.indexOf(id), j = i + d;
      if (j < 0 || j >= ids.length) return p;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return { ...p, order: ids };
    });

  function persist(next: SiteSettings, msg = 'Saved — the site updates within a few seconds.') {
    setStatus(undefined);
    setS(next);
    startSave(async () => {
      const res = await saveSettings(next);
      if (res.ok) {
        setSaved(JSON.stringify(next));
        setShowState(false);
        setReload((n) => n + 1);
        setStatus({ ok: true, msg });
      } else setStatus({ ok: false, msg: res.error ?? 'Could not save.' });
    });
  }
  const save = () => persist(s);

  // Site-wide switches (lockdown, announcement, sections, footer).
  const setSite = (patch: Partial<SiteBlock>) => setS((p) => ({ ...p, site: { ...p.site, ...patch } }));

  /** Changes many boxes at once. Only lockable boxes can be locked; everything stays a draft until Save (or `now`). */
  const withBulk = (p: SiteSettings, kind: Bulk, ids: string[]): SiteSettings => {
    const view = new Map(resolveCards(p, { includeHidden: true }).map((c) => [c.id, c]));
    const cardsNext = { ...p.cards };
    for (const id of ids) {
      const c = view.get(id);
      if (!c) continue;
      const o: CardOverride = { ...cardsNext[id] };
      if (kind === 'show') delete o.hidden;
      else if (kind === 'hide') o.hidden = true;
      else if (c.lockable) {
        if (kind === 'open') { delete o.locked; delete o.greyed; } else { o.locked = true; if (kind === 'greyed') o.greyed = true; else delete o.greyed; }
      }
      cardsNext[id] = o;
    }
    // "Open" is meant literally: it also switches an active lockdown off.
    return { ...p, cards: cardsNext, site: kind === 'open' ? { ...p.site, lockdown: undefined } : p.site };
  };
  const bulk = (kind: Bulk, ids: string[]) => {
    setS((p) => withBulk(p, kind, ids));
    setStatus({ ok: true, msg: `Changed ${ids.length} box${ids.length === 1 ? '' : 'es'} — press Save changes to publish.` });
  };
  const openEverythingNow = () => persist(withBulk(s, 'open', cards.map((c) => c.id)), 'Everything is unlocked and saved.');

  const tabs: [Tab, string][] = [['cards', 'Boxes'], ['site', 'Site controls'], ['photos', 'Photos'], ['account', 'Account & backups']];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-neutral-950/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-white">Site editor</h1>
          <Link href="/" target="_blank" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white">View site <ExternalLink className="size-3" /></Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/access" className={chip(pending > 0)}><Users className="size-3.5" /> Access requests{pending > 0 && ` (${pending})`}</Link>
          <Link href="/admin/analytics" className={chip(false)}>Analytics</Link>
          <Link href="/admin/broadcast" className={chip(false)}>Subscribers & email</Link>
          {status && <span role="status" className={`text-xs ${status.ok ? 'text-emerald-300' : 'text-red-400'}`}>{status.msg}</span>}
          <button onClick={save} disabled={!dirty || saving || !blobReady} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#c8a96a] px-4 text-sm font-semibold text-neutral-950 transition hover:bg-[#d8bc82] disabled:opacity-40">
            <Save className="size-4" /> {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </header>

      {!blobReady && <p className="mt-4 rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-200 ring-1 ring-amber-400/30">Storage (Vercel Blob) isn’t connected to this deployment, so changes and photos can’t be saved yet.</p>}

      {showState && state !== 'saved' && (
        <div role="alert" className="mt-4 rounded-2xl bg-red-500/10 p-4 text-sm text-red-100 ring-1 ring-red-400/40">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> {{
            none: 'Nothing has been saved on this site yet',
            invalid: 'The saved settings could not be read',
            unreadable: 'Storage could not be read just now',
            saved: '',
          }[state]}</p>
          <p className="mt-1 text-red-100/80">
            {state === 'unreadable'
              ? 'The editor is showing factory defaults, which lock every private box. Reload the page to try again — don’t save until your real settings load, or you would replace them.'
              : 'Visitors are being shown the factory defaults, which lock every private box. That is why everything looks locked. Unlock what you want and save, or open everything in one click:'}
          </p>
          {state !== 'unreadable' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={openEverythingNow} disabled={saving} className={chip(true)}><Unlock className="size-3.5" /> Unlock everything &amp; save now</button>
              <button onClick={() => setShowState(false)} className={chip(false)}>I’ll choose box by box</button>
            </div>
          )}
        </div>
      )}
      {s.site.lockdown && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-100 ring-1 ring-amber-400/40">
          <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" /> Lockdown is ON — every private box is locked, whatever its own setting says.</p>
          <button onClick={() => persist({ ...s, site: { ...s.site, lockdown: undefined } }, 'Lockdown is off — boxes are back to their own settings.')} disabled={saving} className={chip(true)}><Unlock className="size-3.5" /> Turn lockdown off now</button>
        </div>
      )}

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Editor sections">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={chip(tab === k)} aria-pressed={tab === k}>{l}</button>)}
      </nav>

      {tab === 'cards' && <CardsTab cards={cards} overrides={s.cards} custom={s.custom} pages={s.pages} photoCounts={Object.fromEntries(Object.entries(s.photos).map(([k, v]) => [k, v.length]))} setPage={setPage} goPhotos={(id) => { setPhotoCat(id); setTab('photos'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} setCard={setCard} resetCard={resetCard} move={move} addBox={addBox} removeBox={removeBox} setUrl={setUrl} bulk={bulk} s={s} reload={reload} />}
      {tab === 'site' && <SiteTab s={s} setS={setS} setSite={setSite} blobReady={blobReady} />}
      {tab === 'photos' && <PhotosTab s={s} setS={setS} cards={cards} blobReady={blobReady} cat={photoCat} setCat={setPhotoCat} />}
      {tab === 'account' && <AccountTab email={email} hasPrevious={hasPrevious} saved={saved} apply={(next, msg) => { setS(next); setSaved(JSON.stringify(next)); setReload((n) => n + 1); setStatus({ ok: true, msg }); }} draft={(next, msg) => { setS(next); setStatus({ ok: true, msg }); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ boxes

function CardsTab({ cards, overrides, custom, pages, photoCounts, setPage, goPhotos, setCard, resetCard, move, addBox, removeBox, setUrl, bulk, s, reload }: { bulk: (k: Bulk, ids: string[]) => void; s: SiteSettings; reload: number; cards: CardView[]; overrides: SiteSettings['cards']; custom: SiteSettings['custom']; pages: SiteSettings['pages']; photoCounts: Record<string, number>; setPage: (id: string, k: 'heading' | 'body', v: string) => void; goPhotos: (id: string) => void; setCard: (id: string, p: Partial<Record<keyof CardOverride, CardOverride[keyof CardOverride] | undefined>>) => void; resetCard: (id: string) => void; move: (id: string, d: -1 | 1) => void; addBox: (kind: 'page' | 'link') => string; removeBox: (id: string) => void; setUrl: (id: string, url: string) => void }) {
  // Each lockable box is Open, Locked or Greyed out (greyed = locked, and shown as a faint colourless hint on the hub).
  const setMode = (id: string, m: Mode) => setCard(id, { locked: m === 'open' ? undefined : true, greyed: m === 'greyed' ? true : undefined });
  const [open, setOpen] = useState<string | null>(null);
  const [device, setDevice] = useState<1 | 2 | 4>(4);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'locked' | 'open' | 'hidden'>('all');
  const q = query.trim().toLowerCase();
  const shown = cards.filter((c) => (!q || c.title.toLowerCase().includes(q) || c.id.includes(q)) && (filter === 'all' || (filter === 'locked' ? c.locked : filter === 'open' ? !c.locked && !c.hidden : c.hidden)));
  const ids = shown.map((c) => c.id);
  const counts = { locked: cards.filter((c) => c.locked).length, hidden: cards.filter((c) => c.hidden).length, open: cards.filter((c) => !c.locked && !c.hidden).length };
  const filtered = Boolean(q) || filter !== 'all';
  // A new tile is added at the end of a long list: scroll to it so you can start writing straight away.
  const reveal = (id: string) => setTimeout(() => document.getElementById(`tile-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  return (
    <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div>
      <p className="mb-3 text-sm text-neutral-400">Click a box to edit it. Use the <Unlock className="inline size-3.5" /> button to switch a box between <b className="text-neutral-200">Open</b>, <b className="text-neutral-200">Locked</b> and <b className="text-neutral-200">Greyed out</b> — for the last two, visitors send their name, email and phone and you approve them first.</p>
      <div className="mb-5 space-y-3 rounded-2xl bg-neutral-900/60 p-4 ring-1 ring-white/10">
        <p className="text-sm font-semibold text-white">Quick controls <span className="font-normal text-neutral-400">— {counts.locked} locked · {counts.open} open · {counts.hidden} hidden</span></p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => bulk('open', ids)} className={chip(false)}><Unlock className="size-3.5" /> {filtered ? 'Unlock shown' : 'Unlock all'}</button>
          <button onClick={() => bulk('locked', ids)} className={chip(false)}><Lock className="size-3.5" /> {filtered ? 'Lock shown' : 'Lock all'}</button>
          <button onClick={() => bulk('greyed', ids)} className={chip(false)}><CircleDashed className="size-3.5" /> {filtered ? 'Grey out shown' : 'Grey out all'}</button>
          <button onClick={() => bulk('show', ids)} className={chip(false)}><Eye className="size-3.5" /> {filtered ? 'Show shown' : 'Show all'}</button>
          <button onClick={() => bulk('hide', ids)} className={chip(false)}><EyeOff className="size-3.5" /> {filtered ? 'Hide shown' : 'Hide all'}</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Search boxes" placeholder="Search boxes…" value={query} onChange={(e) => setQuery(e.target.value)} className={`${input} max-w-56`} />
          {(['all', 'locked', 'open', 'hidden'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={chip(filter === f)}>{{ all: 'All', locked: 'Locked', open: 'Open', hidden: 'Hidden' }[f]}</button>)}
        </div>
        <p className="text-xs text-neutral-500">Changes are drafts until you press <b className="text-neutral-300">Save changes</b>.</p>
      </div>
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-[#c8a96a]/15 to-transparent p-4 ring-1 ring-[#c8a96a]/40">
        <p className="flex items-center gap-2 font-semibold text-white"><Plus className="size-4 text-[#c8a96a]" /> Add a new tile</p>
        <p className="mt-1 text-xs text-neutral-400">It shows up on your home page right away (after you press Save). Choose what happens when someone clicks it:</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button onClick={() => { const id = addBox('page'); setOpen(id); reveal(id); }} className="rounded-xl bg-white/5 p-4 text-left ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-[#c8a96a]">
            <span className="flex items-center gap-2 font-semibold text-white"><FileText className="size-4 text-[#c8a96a]" /> A page you write</span>
            <span className="mt-1 block text-xs text-neutral-400">Opens its own page with your heading, your text and your photos.</span>
          </button>
          <button onClick={() => { const id = addBox('link'); setOpen(id); reveal(id); }} className="rounded-xl bg-white/5 p-4 text-left ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-[#c8a96a]">
            <span className="flex items-center gap-2 font-semibold text-white"><Link2 className="size-4 text-[#c8a96a]" /> A link to another website</span>
            <span className="mt-1 block text-xs text-neutral-400">Sends people to any web address you choose.</span>
          </button>
        </div>
      </div>
      <ul className="space-y-3">
        {shown.length === 0 && <li className="rounded-2xl bg-neutral-900/60 p-6 text-center text-sm text-neutral-500 ring-1 ring-white/10">No boxes match.</li>}
        {shown.map((c) => {
          const i = cards.findIndex((x) => x.id === c.id);
          const Icon = ICONS[c.iconKey];
          const isOpen = open === c.id;
          const def = categories.find((x) => x.id === c.id);
          const url = custom.find((x) => x.id === c.id)?.url ?? '';
          return (
            <li key={c.id} id={`tile-${c.id}`} className={`scroll-mt-24 rounded-2xl bg-neutral-900/60 ring-1 ring-white/10 ${c.hidden ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-neutral-950" style={{ background: c.accent }}><Icon className="size-5" /></span>
                <button onClick={() => setOpen(isOpen ? null : c.id)} className="min-w-0 flex-1 text-left" aria-expanded={isOpen}>
                  <span className="block truncate font-medium text-white">{c.title}</span>
                  <span className="block truncate text-xs text-neutral-500">{c.greyed ? 'Greyed out · ' : c.locked ? 'Locked · ' : ''}{c.hidden ? 'Hidden · ' : ''}{{ normal: 'Normal', wide: 'Wide', full: 'Full row' }[c.width]} · {{ compact: 'Compact', standard: 'Standard', tall: 'Tall', xl: 'Extra tall' }[c.height]} · {c.kind === 'link' ? url || 'no web address yet' : c.href}</span>
                </button>
                {c.lockable ? (
                  (() => {
                    const m = modeOf(c);
                    const nextMode = MODES[(MODES.indexOf(m) + 1) % MODES.length];
                    const ModeIcon = MODE_INFO[m].icon;
                    return (
                      <button aria-label={`${c.title}: ${MODE_INFO[m].label}. Switch to ${MODE_INFO[nextMode].label}`} onClick={() => setMode(c.id, nextMode)} className={`rounded-lg p-2 ring-1 ${MODE_INFO[m].row}`} title={`${MODE_INFO[m].label} — click for ${MODE_INFO[nextMode].label}`}><ModeIcon className="size-4" /></button>
                    );
                  })()
                ) : (
                  <span title="Can’t be locked — donors need the fundraising pages to stay public" className="rounded-lg p-2 text-neutral-700"><Lock className="size-4" /></span>
                )}
                <button aria-label="Move up" disabled={i === 0} onClick={() => move(c.id, -1)} className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 disabled:opacity-30"><ArrowUp className="size-4" /></button>
                <button aria-label="Move down" disabled={i === cards.length - 1} onClick={() => move(c.id, 1)} className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 disabled:opacity-30"><ArrowDown className="size-4" /></button>
              </div>
              {isOpen && (
                <div className="space-y-4 border-t border-white/10 p-4">
                  {c.id === 'fund' && c.locked && (
                    <p className="rounded-xl bg-amber-400/10 p-3 text-xs text-amber-200 ring-1 ring-amber-400/30">Funding is locked: every fundraising page (donation pages and the big-screen display) is hidden from anyone you haven’t approved. The payment system itself keeps working for people already on a campaign page.</p>
                  )}
                  {c.kind === 'link' && (
                    <div>
                      <label className={label} htmlFor={`url-${c.id}`}>Website address</label>
                      <input id={`url-${c.id}`} type="url" inputMode="url" placeholder="https://example.com" className={input} value={url} maxLength={500} onChange={(e) => setUrl(c.id, e.target.value)} />
                      <p className="mt-1 text-xs text-neutral-500">{c.locked ? 'Locked: visitors never see this address until you approve them.' : 'Opens in a new tab. Lock this box to hide the address until you approve someone.'} The box stays hidden until an address is set.</p>
                    </div>
                  )}
                  {c.gallery && c.id !== 'fund' && (
                    <div className="space-y-3 rounded-xl bg-white/[0.04] p-4 ring-1 ring-[#c8a96a]/30">
                      <p className="text-sm font-semibold text-white">What’s inside this tile</p>
                      <p className="-mt-2 text-xs text-neutral-400">This is the page people see when they click the tile{c.locked ? ' (after you approve them)' : ''}.</p>
                      <div>
                        <label className={label} htmlFor={`heading-${c.id}`}>Page heading</label>
                        <input id={`heading-${c.id}`} className={input} maxLength={80} placeholder={`Same as the tile title: ${c.title}`} value={pages[c.id]?.heading ?? ''} onChange={(e) => setPage(c.id, 'heading', e.target.value)} />
                      </div>
                      <div>
                        <label className={label} htmlFor={`body-${c.id}`}>Your text</label>
                        <textarea id={`body-${c.id}`} className={`${area} min-h-48 leading-relaxed`} rows={9} maxLength={20000} placeholder={'Write anything here.\n\nLeave a blank line to start a new paragraph.'} value={pages[c.id]?.body ?? ''} onChange={(e) => setPage(c.id, 'body', e.target.value)} />
                        <details className="mt-2 text-xs text-neutral-400">
                          <summary className="cursor-pointer text-neutral-300">Formatting tips</summary>
                          <ul className="mt-2 space-y-1 pl-4">
                            <li>Blank line = new paragraph</li>
                            <li><code className="text-neutral-200">## Big heading</code> and <code className="text-neutral-200">### Smaller heading</code></li>
                            <li><code className="text-neutral-200">- item</code> on each line = bullet list</li>
                            <li><code className="text-neutral-200">**bold**</code> and <code className="text-neutral-200">*italic*</code></li>
                            <li><code className="text-neutral-200">[link text](https://example.com)</code> = a link</li>
                          </ul>
                        </details>
                      </div>
                      {pages[c.id]?.body && (
                        <div>
                          <span className={label}>Preview</span>
                          <div className="rounded-xl bg-neutral-950 p-4 ring-1 ring-white/10"><RichText text={pages[c.id]!.body!} /></div>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                        <span className="text-xs text-neutral-400">{photoCounts[c.id] ? `${photoCounts[c.id]} photo${photoCounts[c.id] === 1 ? '' : 's'} in this tile` : 'No photos yet'}</span>
                        <button onClick={() => goPhotos(c.id)} className={chip(false)}><Images className="size-3.5" /> Add or manage photos</button>
                      </div>
                    </div>
                  )}
                  <div><label className={label} htmlFor={`title-${c.id}`}>Title</label><input id={`title-${c.id}`} className={input} value={overrides[c.id]?.title ?? c.title} maxLength={60} placeholder={def ? `Leave empty to use “${def.title}”` : 'Name of this tile'} onChange={(e) => setCard(c.id, { title: e.target.value })} /></div>
                  <div><label className={label} htmlFor={`teaser-${c.id}`}>Short description</label><textarea id={`teaser-${c.id}`} className={area} rows={2} maxLength={200} value={overrides[c.id]?.teaser ?? c.teaser} placeholder="A line under the title (can be left empty)" onChange={(e) => setCard(c.id, { teaser: e.target.value })} /></div>
                  <div><label className={label} htmlFor={`tag-${c.id}`}>Pill on the tile</label><input id={`tag-${c.id}`} className={`${input} max-w-48`} maxLength={14} placeholder="e.g. New, Beta, Updated" value={overrides[c.id]?.tag ?? ''} onChange={(e) => setCard(c.id, { tag: e.target.value || undefined })} /></div>
                  <div>
                    <span className={label}>Icon</span>
                    <div className="flex flex-wrap gap-1.5">
                      {ICON_KEYS.map((k) => { const I = ICONS[k]; return <button key={k} title={k} aria-label={k} aria-pressed={c.iconKey === k} onClick={() => setCard(c.id, { iconKey: k })} className={`rounded-lg p-2 ring-1 ${c.iconKey === k ? 'bg-[#c8a96a] text-neutral-950 ring-[#c8a96a]' : 'bg-white/5 text-neutral-300 ring-white/10 hover:bg-white/10'}`}><I className="size-4" /></button>; })}
                    </div>
                  </div>
                  <div>
                    <span className={label}>Icon size</span>
                    <div className="flex flex-wrap gap-2">
                      {ICON_SIZES.map((z: IconSize) => <button key={z} onClick={() => setCard(c.id, { iconSize: z })} aria-pressed={c.iconSize === z} className={chip(c.iconSize === z)}>{{ sm: 'Small', md: 'Medium', lg: 'Large', xl: 'Extra large' }[z]}</button>)}
                    </div>
                  </div>
                  <div>
                    <span className={label}>Box width</span>
                    <div className="flex flex-wrap gap-2">
                      {BOX_WIDTHS.map((w: BoxWidth) => <button key={w} onClick={() => setCard(c.id, { width: w, wide: undefined })} aria-pressed={c.width === w} className={chip(c.width === w)}>{{ normal: 'Normal', wide: 'Wide (2 boxes)', full: 'Full row' }[w]}</button>)}
                    </div>
                  </div>
                  <div>
                    <span className={label}>Box height</span>
                    <div className="flex flex-wrap gap-2">
                      {BOX_HEIGHTS.map((z: BoxHeight) => <button key={z} onClick={() => setCard(c.id, { height: z })} aria-pressed={c.height === z} className={chip(c.height === z)}>{{ compact: 'Compact', standard: 'Standard', tall: 'Tall', xl: 'Extra tall' }[z]}</button>)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-4">
                    <div><label className={label} htmlFor={`accent-${c.id}`}>Color</label><input id={`accent-${c.id}`} type="color" value={c.accent} onChange={(e) => setCard(c.id, { accent: e.target.value })} className="h-10 w-16 cursor-pointer rounded-lg bg-transparent" /></div>
                    <button onClick={() => setCard(c.id, { hidden: !c.hidden })} className={chip(c.hidden)}>{c.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {c.hidden ? 'Hidden' : 'Visible'}</button>
                    <button onClick={() => setCard(c.id, { status: c.status === 'soon' ? 'live' : 'soon' })} aria-pressed={c.status === 'soon'} className={chip(c.status === 'soon')}>“Soon” tag</button>
                    {c.lockable ? (
                      <div role="radiogroup" aria-label="Who can open this box" className="flex flex-wrap gap-2">
                        {MODES.map((m) => {
                          const ModeIcon = MODE_INFO[m].icon;
                          return <button key={m} role="radio" aria-checked={modeOf(c) === m} onClick={() => setMode(c.id, m)} className={chip(modeOf(c) === m)} title={MODE_INFO[m].hint}><ModeIcon className="size-3.5" /> {MODE_INFO[m].label}</button>;
                        })}
                      </div>
                    ) : <span className="text-xs text-neutral-600">Can’t be locked — donors need the fundraising pages to stay public.</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    {def && <button onClick={() => resetCard(c.id)} className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white"><RotateCcw className="size-3.5" /> Reset to default ({def.title})</button>}
                    {c.custom && <button onClick={() => { if (window.confirm(`Delete “${c.title}”? Its photos and text are removed when you save.`)) { removeBox(c.id); setOpen(null); } }} className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300"><Trash2 className="size-3.5" /> Delete this box</button>}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Live preview</p>
          <div className="flex gap-1.5" role="group" aria-label="Preview size">
            {([[1, 'Phone'], [2, 'Tablet'], [4, 'Desktop']] as const).map(([n, l]) => <button key={n} onClick={() => setDevice(n)} aria-pressed={device === n} className={chip(device === n)}>{l}</button>)}
          </div>
        </div>
        <PreviewFrame cards={cards.filter((c) => !c.hidden)} device={device} s={s} reload={reload} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ site controls

function Switch({ on, onChange, children, hint }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode; hint?: string }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm ring-1 transition ${on ? 'bg-[#c8a96a]/15 text-white ring-[#c8a96a]/50' : 'bg-white/[0.03] text-neutral-300 ring-white/10 hover:bg-white/5'}`}>
      <span>{children}{hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}</span>
      <span aria-hidden className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-[#c8a96a]' : 'bg-neutral-700'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${on ? 'left-[1.1rem]' : 'left-0.5'}`} /></span>
    </button>
  );
}

const card = 'space-y-4 rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10';

function SiteTab({ s, setS, setSite, blobReady }: { s: SiteSettings; setS: React.Dispatch<React.SetStateAction<SiteSettings>>; setSite: (p: Partial<SiteBlock>) => void; blobReady: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const ann = s.site.announcement ?? {};
  const foot = s.site.footer ?? {};
  const setAnn = (p: Partial<NonNullable<SiteBlock['announcement']>>) => setSite({ announcement: { ...ann, ...p } });
  const setFoot = (p: Partial<NonNullable<SiteBlock['footer']>>) => setSite({ footer: { ...foot, ...p } });
  const setSection = (id: (typeof HUB_SECTIONS)[number]['id'], p: { title?: string; subtitle?: string; hidden?: boolean }) =>
    setSite({ sections: { ...s.site.sections, [id]: { ...s.site.sections?.[id], ...p } } });

  async function logo(file?: File) {
    if (!file) return;
    setBusy(true); setErr(undefined);
    try { const r = await uploadImage('hero', file); setS((p) => ({ ...p, hero: { ...p.hero, logoPath: r.pathname } })); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed'); }
    setBusy(false);
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className={`${card} lg:col-span-2 ${s.site.lockdown ? 'ring-amber-400/50' : ''}`}>
        <h2 className="flex items-center gap-2 font-semibold text-white"><ShieldAlert className="size-4 text-[#c8a96a]" /> Lockdown</h2>
        <Switch on={Boolean(s.site.lockdown)} onChange={(v) => setSite({ lockdown: v || undefined })} hint="Locks every private box at once without changing any box’s own setting. Turn it off and each box goes back to how you had it. Funding stays open for donors.">Lock the whole site</Switch>
      </section>

      <section className={card}>
        <h2 className="font-semibold text-white">Announcement bar</h2>
        <p className="-mt-2 text-xs text-neutral-500">A thin strip across the very top of every page.</p>
        <Switch on={Boolean(ann.enabled)} onChange={(v) => setAnn({ enabled: v })}>Show the announcement</Switch>
        <div><label className={label} htmlFor="ann-text">Message</label><input id="ann-text" className={input} maxLength={200} placeholder="e.g. New: the Wedding Intro Remix is live" value={ann.text ?? ''} onChange={(e) => setAnn({ text: e.target.value })} /></div>
        <div><label className={label} htmlFor="ann-link">Link (optional)</label><input id="ann-link" className={input} maxLength={500} placeholder="https://… or /contact" value={ann.link ?? ''} onChange={(e) => setAnn({ link: e.target.value })} /></div>
        <div>
          <span className={label}>Colour</span>
          <div className="flex gap-2">{TONES.map((t) => <button key={t} onClick={() => setAnn({ tone: t })} aria-pressed={(ann.tone ?? 'info') === t} className={chip((ann.tone ?? 'info') === t)}>{{ info: 'Gold', good: 'Green', warn: 'Amber' }[t]}</button>)}</div>
        </div>
        <div className="pointer-events-none overflow-hidden rounded-xl"><Announcement site={{ ...s.site, announcement: { ...ann, enabled: true, text: ann.text || 'Your announcement shows here', link: undefined } }} /></div>
      </section>

      <section className={card}>
        <h2 className="font-semibold text-white">Home page hero</h2>
        <div><label className={label} htmlFor="tagline">Tagline under your name</label><textarea id="tagline" className={area} rows={2} maxLength={160} value={s.hero.tagline} onChange={(e) => setS((p) => ({ ...p, hero: { ...p.hero, tagline: e.target.value } }))} /></div>
        <div>
          <span className={label}>Logo image</span>
          <div className="flex items-center gap-4">
            {s.hero.logoPath ? <img src={mediaUrl(s.hero.logoPath)} alt="" className="size-20 rounded-2xl object-cover ring-1 ring-white/10" /> : <span className="flex size-20 items-center justify-center rounded-2xl bg-white/5 text-xs text-neutral-500 ring-1 ring-white/10">Default</span>}
            <div className="flex flex-wrap gap-2">
              <label className={`${chip(false)} cursor-pointer ${!blobReady || busy ? 'pointer-events-none opacity-50' : ''}`}><ImagePlus className="size-3.5" /> {busy ? 'Uploading…' : 'Upload new'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => { void logo(e.target.files?.[0]); e.target.value = ''; }} /></label>
              {s.hero.logoPath && <button onClick={() => setS((p) => ({ ...p, hero: { ...p.hero, logoPath: undefined } }))} className={chip(false)}><RotateCcw className="size-3.5" /> Use default</button>}
            </div>
          </div>
          {err && <p role="alert" className="mt-2 text-sm text-red-400">{err}</p>}
        </div>
        <Switch on={Boolean(s.hero.hideLogo)} onChange={(v) => setS((p) => ({ ...p, hero: { ...p.hero, hideLogo: v || undefined } }))}>Hide the glass logo</Switch>
        <Switch on={Boolean(s.hero.hideTagline)} onChange={(v) => setS((p) => ({ ...p, hero: { ...p.hero, hideTagline: v || undefined } }))}>Hide the tagline</Switch>
      </section>

      <section className={`${card} lg:col-span-2`}>
        <h2 className="font-semibold text-white">Home page sections</h2>
        <p className="-mt-2 text-xs text-neutral-500">Rename the three sections of the home page, or hide one completely (its boxes stay reachable from the menu and by link).</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {HUB_SECTIONS.map((sec) => {
            const o = s.site.sections?.[sec.id] ?? {};
            return (
              <div key={sec.id} className="space-y-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: sec.accent }}>{sec.title}</p>
                <div><label className={label} htmlFor={`st-${sec.id}`}>Heading</label><input id={`st-${sec.id}`} className={input} maxLength={40} placeholder={sec.title} value={o.title ?? ''} onChange={(e) => setSection(sec.id, { title: e.target.value })} /></div>
                <div><label className={label} htmlFor={`ss-${sec.id}`}>Subheading</label><input id={`ss-${sec.id}`} className={input} maxLength={120} placeholder={sec.subtitle} value={o.subtitle ?? ''} onChange={(e) => setSection(sec.id, { subtitle: e.target.value })} /></div>
                <Switch on={Boolean(o.hidden)} onChange={(v) => setSection(sec.id, { hidden: v })}>Hide this section</Switch>
              </div>
            );
          })}
        </div>
      </section>

      <section className={`${card} lg:col-span-2`}>
        <h2 className="font-semibold text-white">Footer</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className={label} htmlFor="f-email">Contact email</label><input id="f-email" className={input} maxLength={120} placeholder="Info@YaakovEisenberger.com" value={foot.email ?? ''} onChange={(e) => setFoot({ email: e.target.value })} /></div>
          <div><label className={label} htmlFor="f-phone">Phone</label><input id="f-phone" className={input} maxLength={40} placeholder="(732) 569-7959" value={foot.phone ?? ''} onChange={(e) => setFoot({ phone: e.target.value })} /></div>
          <div><label className={label} htmlFor="f-note">Line under the copyright</label><input id="f-note" className={input} maxLength={160} placeholder="Designed & built with precision for the modern web." value={foot.note ?? ''} onChange={(e) => setFoot({ note: e.target.value })} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Switch on={Boolean(foot.hideQuoteBar)} onChange={(v) => setFoot({ hideQuoteBar: v })}>Hide the “Request a Quote” bar</Switch>
          <Switch on={Boolean(foot.hideSubscribe)} onChange={(v) => setFoot({ hideSubscribe: v })}>Hide the email sign-up form</Switch>
          <Switch on={Boolean(foot.hideLegal)} onChange={(v) => setFoot({ hideLegal: v })}>Hide the legal notice</Switch>
          <Switch on={Boolean(foot.hideNameReveal)} onChange={(v) => setFoot({ hideNameReveal: v })}>Hide the big name at the foot</Switch>
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ photos

function PhotosTab({ s, setS, cards, blobReady, cat: chosen, setCat }: { s: SiteSettings; setS: React.Dispatch<React.SetStateAction<SiteSettings>>; cards: CardView[]; blobReady: boolean; cat: string; setCat: (id: string) => void }) {
  const cats = cards.filter((c) => c.gallery);
  const cat = cats.some((c) => c.id === chosen) ? chosen : (cats[0]?.id ?? '');
  const [busy, setBusy] = useState<string>();
  const [err, setErr] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const photos = s.photos[cat] ?? [];
  const current = cats.find((c) => c.id === cat);

  const setPhotos = (fn: (p: typeof photos) => typeof photos) => setS((p) => ({ ...p, photos: { ...p.photos, [cat]: fn(p.photos[cat] ?? []) } }));

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setErr(undefined);
    for (const [i, file] of [...files].entries()) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      try {
        const r = await uploadImage(`photos/${cat}`, file);
        setPhotos((p) => [...p, { id: crypto.randomUUID(), pathname: r.pathname, caption: '' }]);
      } catch (e) {
        setErr(`${file.name}: ${e instanceof Error ? e.message : 'upload failed'}`);
      }
    }
    setBusy(undefined);
    if (fileRef.current) fileRef.current.value = '';
  }
  const swap = (i: number, d: number) => setPhotos((p) => { const a = [...p]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a; });

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        {cats.map((c) => <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={chip(cat === c.id)}>{c.title} <span className="opacity-70">({(s.photos[c.id] ?? []).length})</span></button>)}
      </div>

      {current && (
        <div className="mt-5 rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-400">{current.locked ? 'This box is locked — photos are only visible to people you approve.' : 'This box is open — photos are public.'} Changes apply when you press <b className="text-white">Save changes</b>.</p>
            <label className={`${chip(true)} cursor-pointer ${!blobReady || busy ? 'pointer-events-none opacity-50' : ''}`}>
              <ImagePlus className="size-4" /> {busy ?? 'Add photos'}
              <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => void add(e.target.files)} />
            </label>
          </div>
          {err && <p role="alert" className="mt-3 text-sm text-red-400">{err}</p>}

          {photos.length === 0 ? <p className="mt-6 text-center text-sm text-neutral-500">No photos in {current.title} yet.</p> : (
            <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((p, i) => (
                <li key={p.id} className="overflow-hidden rounded-xl bg-neutral-950 ring-1 ring-white/10">
                  <img src={mediaUrl(p.pathname)} alt={p.caption} loading="lazy" className="aspect-square w-full object-cover" />
                  <div className="space-y-2 p-2">
                    <input className={input} placeholder="Caption" maxLength={200} value={p.caption} onChange={(e) => setPhotos((all) => all.map((x) => (x.id === p.id ? { ...x, caption: e.target.value } : x)))} />
                    <div className="flex items-center justify-between">
                      <span className="flex gap-1">
                        <button aria-label="Move earlier" disabled={i === 0} onClick={() => swap(i, -1)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 disabled:opacity-30"><ArrowUp className="size-4 -rotate-90" /></button>
                        <button aria-label="Move later" disabled={i === photos.length - 1} onClick={() => swap(i, 1)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 disabled:opacity-30"><ArrowDown className="size-4 -rotate-90" /></button>
                      </span>
                      <button aria-label="Delete photo" onClick={() => setPhotos((all) => all.filter((x) => x.id !== p.id))} className="rounded-lg p-1.5 text-red-400 hover:bg-red-400/10"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ account

function AccountTab({ email, hasPrevious, saved, apply, draft }: { email: string; hasPrevious: boolean; saved: string; apply: (next: SiteSettings, msg: string) => void; draft: (next: SiteSettings, msg: string) => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  const [busy, startBusy] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; msg: string }>();
  const [prev, setPrev] = useState(hasPrevious);

  const restore = () => startBusy(async () => {
    const res = await restorePrevious();
    if (res.ok && res.settings) { apply(res.settings as SiteSettings, 'Restored the previous version.'); setNote({ ok: true, msg: 'Restored the version you had before your last save.' }); }
    else setNote({ ok: false, msg: res.error ?? 'Could not restore.' });
    setPrev(Boolean(res.ok));
  });
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(JSON.parse(saved), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `site-settings-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = settingsSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error('not a settings backup');
      draft(sanitizeSettings(parsed.data), 'Backup loaded as a draft — check it, then press Save changes.');
      setNote({ ok: true, msg: 'Backup loaded as a draft. Press Save changes to publish it.' });
    } catch { setNote({ ok: false, msg: 'That file isn’t a valid settings backup.' }); }
  };

  return (
    <div className="mt-6 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
      <section className="space-y-3 rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10 sm:col-span-2">
        <h2 className="flex items-center gap-2 font-semibold text-white"><History className="size-4 text-[#c8a96a]" /> Backups &amp; undo</h2>
        <p className="text-xs text-neutral-500">Every save keeps the version before it. Download a copy any time, or load one back in.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={restore} disabled={!prev || busy} className={`${chip(false)} disabled:opacity-40`}><RotateCcw className="size-3.5" /> {busy ? 'Restoring…' : 'Restore previous version'}</button>
          <button onClick={download} className={chip(false)}><Download className="size-3.5" /> Download backup</button>
          <label className={`${chip(false)} cursor-pointer`}><Upload className="size-3.5" /> Load a backup<input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} /></label>
        </div>
        {note && <p role="status" className={`text-xs ${note.ok ? 'text-emerald-300' : 'text-red-400'}`}>{note.msg}</p>}
      </section>
      <form action={action} className="space-y-4 rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10">
        <h2 className="font-semibold text-white">Change password</h2>
        <p className="text-xs text-neutral-500">Signed in as {email || 'admin'}. Changing the password signs you out everywhere.</p>
        <div><label className={label} htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required className={input} /></div>
        <div><label className={label} htmlFor="next">New password (10+ characters)</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required className={input} /></div>
        {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        <button disabled={pending} className={chip(true)}>{pending ? 'Saving…' : 'Change password'}</button>
      </form>
      <form action={logoutAction} className="rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10">
        <h2 className="font-semibold text-white">Sign out</h2>
        <p className="mt-2 text-xs text-neutral-500">Ends this browser’s admin session.</p>
        <button className={`${chip(false)} mt-4`}><LogOut className="size-3.5" /> Sign out</button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ preview

/**
 * Two previews. "Draft" is a faithful miniature of the home page built from the settings you're editing right now (hero,
 * announcement, section headings and tiles, laid out at the width the real page uses on a phone, tablet or desktop and
 * scaled to fit). "Real site" loads the actual live home page in a frame, scroll effects and all, and reloads itself after
 * every save so you see exactly what visitors get.
 */
function PreviewFrame({ cards, device, s, reload }: { cards: CardView[]; device: 1 | 2 | 4; s: SiteSettings; reload: number }) {
  const [mode, setMode] = useState<'draft' | 'live'>('draft');
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 560, height: 0 });
  useEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o) return;
    const ro = new ResizeObserver(() => setSize({ width: o.clientWidth, height: i?.offsetHeight ?? 0 }));
    ro.observe(o);
    if (i) ro.observe(i);
    return () => ro.disconnect();
  }, [mode]);
  const virtual = { 1: 343, 2: 720, 4: 1232 }[device]; // the width of the real grid on a phone / tablet / desktop
  const scale = Math.min(1, size.width / virtual);
  const groups = groupCards(cards);
  const frameW = { 1: 390, 2: 820, 4: 1280 }[device];
  const frameScale = Math.min(1, size.width / frameW);
  const frameH = 720;
  return (
    <>
      <div className="mb-2 flex gap-1.5" role="group" aria-label="Preview type">
        <button onClick={() => setMode('draft')} aria-pressed={mode === 'draft'} className={chip(mode === 'draft')}>Draft (your edits)</button>
        <button onClick={() => setMode('live')} aria-pressed={mode === 'live'} className={chip(mode === 'live')}>Real site</button>
      </div>
      {mode === 'live' ? (
        <div className="rounded-2xl bg-neutral-950 p-3 ring-1 ring-white/10">
          <div ref={outer} className="w-full overflow-hidden rounded-xl" style={{ height: frameH * frameScale }}>
            <iframe key={`${reload}-${device}`} title="Your live home page" src="/" style={{ width: frameW, height: frameH, transform: `scale(${frameScale})`, transformOrigin: 'top left', border: 0 }} className="bg-neutral-950" />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500"><RefreshCw className="size-3" /> Shows what is saved. It reloads each time you save. You’re signed in as admin, so locked boxes open for you here.</p>
        </div>
      ) : (
        <div className="max-h-[calc(100vh-11rem)] overflow-y-auto rounded-2xl bg-neutral-950 ring-1 ring-white/10">
          <div ref={outer} className="w-full overflow-hidden" style={{ height: size.height * scale }} aria-label="Preview of your home page" role="img">
            <div ref={inner} style={{ width: virtual, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="pointer-events-none select-none bg-neutral-950 text-neutral-100">
              <Announcement site={s.site} />
              <HubHero tagline={s.hero.tagline} logoSrc={s.hero.logoPath ? mediaUrl(s.hero.logoPath) : undefined} hideLogo={s.hero.hideLogo} hideTagline={s.hero.hideTagline} />
              <div className="space-y-8 px-3 pb-8">
                {HUB_SECTIONS.filter((sec) => groups[sec.id].length && !s.site.sections?.[sec.id]?.hidden).map((sec) => {
                  const o = s.site.sections?.[sec.id];
                  return (
                    <section key={sec.id}>
                      <div className="mb-4 flex items-baseline gap-3 py-2">
                        <span className="h-px w-8 self-center" style={{ background: sec.accent }} />
                        <span className="font-mono text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: sec.accent }}>{o?.title || sec.title}</span>
                        {device !== 1 && <span className="truncate text-sm text-neutral-500">{o?.subtitle ?? sec.subtitle}</span>}
                      </div>
                      {sec.id === 'personal' ? (
                        <Directory cards={groups[sec.id]} cols={device} render={(c) => <CategoryCard key={c.id} category={c} cols={device} plain />} />
                      ) : (
                        <ul className={`grid grid-flow-dense ${gridClass(sec.id === 'news', device)}`}>
                          {groups[sec.id].map((c) => <CategoryCard key={c.id} category={c} cols={device} single={sec.id === 'news'} />)}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
