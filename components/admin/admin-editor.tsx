'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { upload } from '@vercel/blob/client';
import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, FileText, ImagePlus, Link2, Lock, LogOut, Plus, RotateCcw, Save, Trash2, Unlock, Users } from 'lucide-react';
import { categories } from '@/data/navigation';
import { ICON_KEYS, ICONS } from '@/data/icons';
import { changePassword, logoutAction, saveSettings, type FormState } from '@/app/admin/actions';
import { CategoryCard } from '@/components/hub/category-card';
import {
  BOX_HEIGHTS, BOX_WIDTHS, ICON_SIZES, mediaUrl, resolveCards, type BoxHeight, type BoxWidth, type CardOverride, type CardView, type IconSize, type SiteSettings,
} from '@/lib/site/settings';

type Tab = 'cards' | 'text' | 'photos' | 'account';

const input = 'h-10 w-full rounded-xl bg-neutral-950 px-3 text-sm text-white ring-1 ring-white/15 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#c8a96a]';
const area = 'w-full rounded-xl bg-neutral-950 px-3 py-2 text-sm text-white ring-1 ring-white/15 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#c8a96a]';
const chip = (on: boolean) => `inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition ${on ? 'bg-[#c8a96a] text-neutral-950 ring-[#c8a96a]' : 'bg-white/5 text-neutral-300 ring-white/10 hover:bg-white/10'}`;
const label = 'mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500';

const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;

/** Resizes in the browser (max 2400px) so uploads are fast and stay well under the size limit. */
async function prepare(file: File): Promise<{ blob: Blob; ext: string }> {
  if (file.type === 'image/gif') return { blob: file, ext: 'gif' };
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
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
  return upload(`${folder}/${name}`, blob, { access: 'private', handleUploadUrl: '/api/admin/upload', contentType: blob.type });
}

export function AdminEditor({ initial, blobReady, pending, email }: { initial: SiteSettings; blobReady: boolean; pending: number; email: string }) {
  const [s, setS] = useState<SiteSettings>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [tab, setTab] = useState<Tab>('cards');
  const [status, setStatus] = useState<{ ok?: boolean; msg: string }>();
  const [saving, startSave] = useTransition();
  const dirty = JSON.stringify(s) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const cards = useMemo(() => resolveCards(s, { includeHidden: true }), [s]);

  const setCard = (id: string, patch: Partial<Record<keyof CardOverride, CardOverride[keyof CardOverride] | undefined>>) =>
    setS((p) => ({ ...p, cards: { ...p.cards, [id]: clean({ ...p.cards[id], ...patch }) as CardOverride } }));
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

  function save() {
    setStatus(undefined);
    startSave(async () => {
      const res = await saveSettings(s);
      if (res.ok) {
        setSaved(JSON.stringify(s));
        setStatus({ ok: true, msg: 'Saved — the site updates within a few seconds.' });
      } else setStatus({ ok: false, msg: res.error ?? 'Could not save.' });
    });
  }

  const tabs: [Tab, string][] = [['cards', 'Boxes'], ['text', 'Text & hero'], ['photos', 'Photos'], ['account', 'Account']];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-neutral-950/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-white">Site editor</h1>
          <Link href="/" target="_blank" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white">View site <ExternalLink className="size-3" /></Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/access" className={chip(pending > 0)}><Users className="size-3.5" /> Access requests{pending > 0 && ` (${pending})`}</Link>
          {status && <span role="status" className={`text-xs ${status.ok ? 'text-emerald-300' : 'text-red-400'}`}>{status.msg}</span>}
          <button onClick={save} disabled={!dirty || saving || !blobReady} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#c8a96a] px-4 text-sm font-semibold text-neutral-950 transition hover:bg-[#d8bc82] disabled:opacity-40">
            <Save className="size-4" /> {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </header>

      {!blobReady && <p className="mt-4 rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-200 ring-1 ring-amber-400/30">Storage (Vercel Blob) isn’t connected to this deployment, so changes and photos can’t be saved yet.</p>}

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Editor sections">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={chip(tab === k)} aria-pressed={tab === k}>{l}</button>)}
      </nav>

      {tab === 'cards' && <CardsTab cards={cards} custom={s.custom} setCard={setCard} resetCard={resetCard} move={move} addBox={addBox} removeBox={removeBox} setUrl={setUrl} />}
      {tab === 'text' && <TextTab s={s} setS={setS} blobReady={blobReady} />}
      {tab === 'photos' && <PhotosTab s={s} setS={setS} cards={cards} blobReady={blobReady} />}
      {tab === 'account' && <AccountTab email={email} />}
    </div>
  );
}

// ------------------------------------------------------------------ boxes

function CardsTab({ cards, custom, setCard, resetCard, move, addBox, removeBox, setUrl }: { cards: CardView[]; custom: SiteSettings['custom']; setCard: (id: string, p: Partial<Record<keyof CardOverride, CardOverride[keyof CardOverride] | undefined>>) => void; resetCard: (id: string) => void; move: (id: string, d: -1 | 1) => void; addBox: (kind: 'page' | 'link') => string; removeBox: (id: string) => void; setUrl: (id: string, url: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [device, setDevice] = useState<1 | 2 | 4>(4);
  const gridCols = { 1: 'grid-cols-1', 2: 'grid-cols-2', 4: 'grid-cols-4' }[device];
  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div>
      <p className="mb-3 text-sm text-neutral-400">Click a box to edit it. Use the <Lock className="inline size-3.5" /> button to make a box private — visitors must type their name and you approve them first.</p>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-neutral-900/60 p-3 ring-1 ring-white/10">
        <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-white"><Plus className="size-4" /> Add a box</span>
        <button onClick={() => setOpen(addBox('page'))} className={chip(false)}><FileText className="size-3.5" /> Page (text &amp; photos)</button>
        <button onClick={() => setOpen(addBox('link'))} className={chip(false)}><Link2 className="size-3.5" /> Link to another website</button>
      </div>
      <ul className="space-y-3">
        {cards.map((c, i) => {
          const Icon = ICONS[c.iconKey];
          const isOpen = open === c.id;
          const def = categories.find((x) => x.id === c.id);
          const url = custom.find((x) => x.id === c.id)?.url ?? '';
          return (
            <li key={c.id} className={`rounded-2xl bg-neutral-900/60 ring-1 ring-white/10 ${c.hidden ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-neutral-950" style={{ background: c.accent }}><Icon className="size-5" /></span>
                <button onClick={() => setOpen(isOpen ? null : c.id)} className="min-w-0 flex-1 text-left" aria-expanded={isOpen}>
                  <span className="block truncate font-medium text-white">{c.title}</span>
                  <span className="block truncate text-xs text-neutral-500">{c.locked ? 'Private · ' : ''}{c.hidden ? 'Hidden · ' : ''}{{ normal: 'Normal', wide: 'Wide', full: 'Full row' }[c.width]} · {{ compact: 'Compact', standard: 'Standard', tall: 'Tall', xl: 'Extra tall' }[c.height]} · {c.kind === 'link' ? url || 'no web address yet' : c.href}</span>
                </button>
                {c.lockable ? (
                  <button aria-label={c.locked ? `Unlock ${c.title}` : `Lock ${c.title}`} aria-pressed={c.locked} onClick={() => setCard(c.id, { locked: !c.locked })} className={`rounded-lg p-2 ring-1 ${c.locked ? 'bg-[#c8a96a] text-neutral-950 ring-[#c8a96a]' : 'text-neutral-400 ring-white/10 hover:bg-white/10'}`} title={c.locked ? 'Private — click to open to everyone' : 'Open to everyone — click to make private'}>{c.locked ? <Lock className="size-4" /> : <Unlock className="size-4" />}</button>
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
                  <div><label className={label}>Title</label><input className={input} value={c.title} maxLength={60} onChange={(e) => setCard(c.id, { title: e.target.value || undefined })} /></div>
                  <div><label className={label}>Short description</label><textarea className={area} rows={2} maxLength={200} value={c.teaser} onChange={(e) => setCard(c.id, { teaser: e.target.value || undefined })} /></div>
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
                      <button onClick={() => setCard(c.id, { locked: !c.locked })} aria-pressed={c.locked} className={chip(c.locked)}>{c.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />} {c.locked ? 'Locked — approval needed' : 'Open to everyone'}</button>
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
        <ul className={`pointer-events-none grid select-none grid-flow-dense ${gridCols} gap-3 lg:max-h-[75vh] lg:overflow-y-auto`}>
          {cards.filter((c) => !c.hidden).map((c) => <CategoryCard key={c.id} category={c} cols={device} />)}
        </ul>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ text & hero

function TextTab({ s, setS, blobReady }: { s: SiteSettings; setS: React.Dispatch<React.SetStateAction<SiteSettings>>; blobReady: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const cards = resolveCards(s, { includeHidden: true }).filter((c) => c.gallery);

  async function logo(file?: File) {
    if (!file) return;
    setBusy(true); setErr(undefined);
    try { const r = await uploadImage('hero', file); setS((p) => ({ ...p, hero: { ...p.hero, logoPath: r.pathname } })); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed'); }
    setBusy(false);
  }
  const setPage = (id: string, k: 'heading' | 'body', v: string) =>
    setS((p) => ({ ...p, pages: { ...p.pages, [id]: clean({ ...p.pages[id], [k]: v }) } }));

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-2">
      <section className="space-y-5 rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10">
        <h2 className="font-semibold text-white">Home page hero</h2>
        <div><label className={label} htmlFor="tagline">Tagline under your name</label><textarea id="tagline" className={area} rows={2} maxLength={160} value={s.hero.tagline} onChange={(e) => setS((p) => ({ ...p, hero: { ...p.hero, tagline: e.target.value } }))} /></div>
        <div>
          <span className={label}>Logo image</span>
          <div className="flex items-center gap-4">
            {s.hero.logoPath ? <img src={mediaUrl(s.hero.logoPath)} alt="" className="size-20 rounded-2xl object-cover ring-1 ring-white/10" /> : <span className="flex size-20 items-center justify-center rounded-2xl bg-white/5 text-xs text-neutral-500 ring-1 ring-white/10">Default</span>}
            <div className="flex flex-wrap gap-2">
              <label className={`${chip(false)} cursor-pointer ${!blobReady || busy ? 'pointer-events-none opacity-50' : ''}`}><ImagePlus className="size-3.5" /> {busy ? 'Uploading…' : 'Upload new'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => { void logo(e.target.files?.[0]); e.target.value = ''; }} /></label>
              {s.hero.logoPath && <button onClick={() => setS((p) => ({ ...p, hero: { tagline: p.hero.tagline } }))} className={chip(false)}><RotateCcw className="size-3.5" /> Use default</button>}
            </div>
          </div>
          {err && <p role="alert" className="mt-2 text-sm text-red-400">{err}</p>}
        </div>
      </section>

      <section className="space-y-5 rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10">
        <h2 className="font-semibold text-white">Page headings & text</h2>
        <p className="text-xs text-neutral-500">Shown at the top of each page. On locked pages the text is only shown after approval.</p>
        {cards.map((c) => (
          <div key={c.id} className="space-y-2 border-t border-white/10 pt-4">
            <p className="text-sm font-medium text-white">{c.title}</p>
            <input className={input} placeholder={`Heading (default: ${c.title})`} maxLength={80} value={s.pages[c.id]?.heading ?? ''} onChange={(e) => setPage(c.id, 'heading', e.target.value)} />
            <textarea className={area} rows={3} placeholder="Text under the heading (optional)" maxLength={4000} value={s.pages[c.id]?.body ?? ''} onChange={(e) => setPage(c.id, 'body', e.target.value)} />
          </div>
        ))}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ photos

function PhotosTab({ s, setS, cards, blobReady }: { s: SiteSettings; setS: React.Dispatch<React.SetStateAction<SiteSettings>>; cards: CardView[]; blobReady: boolean }) {
  const cats = cards.filter((c) => c.gallery);
  const [cat, setCat] = useState(cats[0]?.id ?? '');
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

function AccountTab({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  return (
    <div className="mt-6 grid max-w-3xl gap-6 sm:grid-cols-2">
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
