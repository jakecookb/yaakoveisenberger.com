'use client';

import { useMemo, useState, useTransition } from 'react';
import { Monitor, Plus, Power, Save, Smartphone, Trash2 } from 'lucide-react';
import { saveMaintenance } from '@/app/admin/maintenance/actions';
import { cleanMaintenance, renderMaintenance, type Maintenance } from '@/lib/maintenance/page';

const label = 'block text-xs font-medium text-neutral-400';
const input = 'mt-1 w-full rounded-xl bg-neutral-900 px-3 py-2 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-neutral-600 focus:ring-[#c8a96a]';
const ACCENTS = ['#c8a96a', '#f4895f', '#22d3ee', '#34d399', '#f472b6', '#fbbf24', '#e5e5e5'];

/** ISO → the value a datetime-local box wants (in this browser's time zone). */
const toLocal = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-neutral-900/60 p-5 ring-1 ring-white/10">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[#c8a96a]">{title}</h2>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Toggle({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-neutral-200">
      <span>{children}</span>
      <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-[#c8a96a]' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

function Choice<T extends string>({ value, set, options }: { value: T; set: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => set(v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${value === v ? 'bg-[#c8a96a] text-neutral-950 ring-[#c8a96a]' : 'bg-white/5 text-neutral-300 ring-white/10 hover:bg-white/10'}`}>{l}</button>
      ))}
    </div>
  );
}

export function MaintenanceEditor({ initial, sections, photos }: { initial: Maintenance; sections: { href: string; title: string }[]; photos: string[] }) {
  const [m, setM] = useState<Maintenance>(initial);
  const [saved, setSaved] = useState<Maintenance>(initial);
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const set = <K extends keyof Maintenance>(k: K, v: Maintenance[K]) => setM((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify({ ...m, updatedAt: '' }) !== JSON.stringify({ ...saved, updatedAt: '' });
  const html = useMemo(() => renderMaintenance(cleanMaintenance({ ...m, enabled: true }), { preview: true }), [m]);

  const save = (next: Maintenance, note: string) =>
    start(async () => {
      const res = await saveMaintenance(next);
      if (res.ok && res.saved) { setM(res.saved); setSaved(res.saved); setMsg({ ok: true, text: note }); }
      else setMsg({ ok: false, text: res.error ?? 'Could not save.' });
    });

  const toggle = () => {
    const on = !saved.enabled;
    if (on && !confirm('Close the site now? Visitors will see this page instead of the site (you will still see everything).')) return;
    save({ ...m, enabled: on }, on ? 'The site is closed. Visitors see this page within about 10 seconds.' : 'The site is open again.');
  };

  const links = m.links.length ? m.links : [];
  return (
    <div className="mt-6">
      {/* the switch */}
      <div className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 ring-1 ${saved.enabled ? 'bg-red-500/10 ring-red-400/30' : 'bg-emerald-500/5 ring-emerald-400/20'}`}>
        <div>
          <p className="font-semibold text-white">{saved.enabled ? 'The site is closed right now' : 'The site is open'}</p>
          <p className="text-sm text-neutral-400">{saved.enabled ? 'Visitors see the page below. You (signed in) still see the real site.' : 'Design the page below, then close the site when you’re ready.'}</p>
        </div>
        <button type="button" disabled={busy} onClick={toggle} className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:opacity-50 ${saved.enabled ? 'bg-emerald-400 text-neutral-950 hover:bg-emerald-300' : 'bg-red-500 text-white hover:bg-red-400'}`}>
          <Power className="size-4" /> {saved.enabled ? 'Open the site again' : 'Close the site'}
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="space-y-5">
          <Section title="Top">
            <div><span className={label}>Logo</span><div className="mt-2"><Choice value={m.logo} set={(v) => set('logo', v)} options={[['wordmark', 'Name logo'], ...(initial.heroLogoUrl ? [['hero', 'My uploaded logo'] as ['hero', string]] : []), ['none', 'No logo']]} /></div></div>
            <label className="block"><span className={label}>Small line under the logo (optional)</span><input className={input} value={m.topText} maxLength={80} placeholder="e.g. Fish Boards · Events · Photography" onChange={(e) => set('topText', e.target.value)} /></label>
          </Section>

          <Section title="Message">
            <label className="block"><span className={label}>Headline</span><input className={input} value={m.headline} maxLength={120} onChange={(e) => set('headline', e.target.value)} /></label>
            <label className="block"><span className={label}>Message</span><textarea className={`${input} min-h-28`} value={m.message} maxLength={1500} onChange={(e) => set('message', e.target.value)} /></label>
          </Section>

          <Section title="When it’s back" hint="Optional. Leave empty if you don’t know yet. Shown in New York time.">
            <div className="flex gap-2">
              <input type="datetime-local" className={input} value={toLocal(m.backAt)} onChange={(e) => set('backAt', e.target.value ? new Date(e.target.value).toISOString() : '')} />
              {m.backAt && <button type="button" onClick={() => set('backAt', '')} className="mt-1 rounded-xl px-3 text-xs text-neutral-400 ring-1 ring-white/10 hover:text-white">Clear</button>}
            </div>
            <Toggle on={m.showCountdown} set={(v) => set('showCountdown', v)}>Show a live countdown</Toggle>
          </Section>

          <Section title="Contact & sign-up">
            <label className="block"><span className={label}>Email button (optional)</span><input className={input} type="email" value={m.email} placeholder="info@yaakoveisenberger.com" onChange={(e) => set('email', e.target.value)} /></label>
            <label className="block"><span className={label}>Phone button (optional)</span><input className={input} type="tel" value={m.phone} placeholder="(555) 123-4567" onChange={(e) => set('phone', e.target.value)} /></label>
            <Toggle on={m.notify} set={(v) => set('notify', v)}>“Notify me when it’s back” sign-up (adds them to your subscribers)</Toggle>
          </Section>

          <Section title="Links" hint="Up to 6 — Instagram, WhatsApp, the Cookbook, anything.">
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input className={`${input} w-2/5`} value={l.label} placeholder="Label" maxLength={40} onChange={(e) => set('links', links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className={input} value={l.url} placeholder="https://…" onChange={(e) => set('links', links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                <button type="button" aria-label="Remove link" onClick={() => set('links', links.filter((_, j) => j !== i))} className="mt-1 rounded-xl px-3 text-neutral-400 ring-1 ring-white/10 hover:text-red-300"><Trash2 className="size-4" /></button>
              </div>
            ))}
            {links.length < 6 && <button type="button" onClick={() => set('links', [...links, { label: '', url: '' }])} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-300 ring-1 ring-white/10 hover:bg-white/10"><Plus className="size-3.5" /> Add a link</button>}
          </Section>

          <Section title="Bottom">
            <label className="block"><span className={label}>Footer text (optional)</span><input className={input} value={m.footerText} maxLength={200} onChange={(e) => set('footerText', e.target.value)} /></label>
            <Toggle on={m.showLogin} set={(v) => set('showLogin', v)}>Small “Owner login” link</Toggle>
          </Section>

          <Section title="Look">
            <div><span className={label}>Background</span><div className="mt-2"><Choice value={m.theme} set={(v) => set('theme', v)} options={[['dark', 'Dark'], ['light', 'Light']]} /></div></div>
            <div>
              <span className={label}>Accent color</span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {ACCENTS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => set('accent', c)} className={`size-8 rounded-full ring-2 transition ${m.accent === c ? 'ring-white' : 'ring-transparent'}`} style={{ background: c }} />)}
                <input type="color" aria-label="Custom color" value={m.accent} onChange={(e) => set('accent', e.target.value)} className="size-8 cursor-pointer rounded-full bg-transparent" />
              </div>
            </div>
            <div>
              <span className={label}>Background photo (optional)</span>
              <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-6">
                <button type="button" onClick={() => set('bgPhoto', '')} className={`aspect-square rounded-xl text-[11px] font-semibold text-neutral-400 ring-2 ${!m.bgPhoto ? 'ring-[#c8a96a]' : 'ring-white/10'}`}>None</button>
                {photos.map((p) => (
                  <button key={p} type="button" onClick={() => set('bgPhoto', p)} className={`overflow-hidden rounded-xl ring-2 ${m.bgPhoto === p ? 'ring-[#c8a96a]' : 'ring-transparent'}`}><img src={p} alt="" loading="lazy" className="aspect-square w-full object-cover" /></button>
                ))}
              </div>
              {photos.length === 0 && <p className="mt-2 text-xs text-neutral-500">Photos from open boxes show up here.</p>}
            </div>
          </Section>

          <Section title="What stays open" hint="Everything is closed unless you tick it here. People can still reach a ticked section by its direct link (the home page stays closed).">
            <div className="grid gap-2 sm:grid-cols-2">
              {sections.map((s) => {
                const on = m.keepOpen.includes(s.href);
                return (
                  <label key={s.href} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-neutral-200 ring-1 ring-white/10 hover:bg-white/5">
                    <input type="checkbox" checked={on} onChange={() => set('keepOpen', on ? m.keepOpen.filter((x) => x !== s.href) : [...m.keepOpen, s.href])} className="accent-[#c8a96a]" />
                    {s.title} <span className="ml-auto text-xs text-neutral-500">{s.href}</span>
                  </label>
                );
              })}
            </div>
          </Section>
        </div>

        {/* live preview */}
        <div className="lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Preview</p>
            <div className="flex gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
              <button type="button" onClick={() => setDevice('phone')} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${device === 'phone' ? 'bg-white text-neutral-950' : 'text-neutral-400'}`}><Smartphone className="size-3.5" /> Phone</button>
              <button type="button" onClick={() => setDevice('desktop')} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${device === 'desktop' ? 'bg-white text-neutral-950' : 'text-neutral-400'}`}><Monitor className="size-3.5" /> Computer</button>
            </div>
          </div>
          <div className="mt-3 flex justify-center overflow-hidden rounded-3xl bg-neutral-900 p-3 ring-1 ring-white/10">
            <iframe title="Preview of the closed page" sandbox="allow-scripts" srcDoc={html} className={`h-[680px] rounded-2xl bg-black transition-all ${device === 'phone' ? 'w-[375px] max-w-full' : 'w-full'}`} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy || !dirty} onClick={() => save(m, saved.enabled ? 'Saved — visitors see the new page within about 10 seconds.' : 'Saved. The site is still open.')} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#c8a96a] px-5 text-sm font-semibold text-neutral-950 transition hover:bg-[#d8bc82] disabled:opacity-40">
              <Save className="size-4" /> {busy ? 'Saving…' : dirty ? 'Save page' : 'Saved'}
            </button>
            {msg && <span role="status" className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-400'}`}>{msg.text}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
