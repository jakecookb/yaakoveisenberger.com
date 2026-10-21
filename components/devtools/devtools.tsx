'use client';

import { useEffect, useMemo, useState } from 'react';
import { Binary, Braces, Check, Copy, GitBranch, Layers, Search } from 'lucide-react';
import { jsonToTs } from '@/lib/devtools/json-to-ts';

const ACCENT = '#2dd4bf';
type Tool = 'json' | 'style' | 'git' | 'encode';
const TOOLS: { id: Tool; label: string; icon: typeof Braces }[] = [
  { id: 'json', label: 'JSON → TypeScript', icon: Braces },
  { id: 'style', label: 'Glass style builder', icon: Layers },
  { id: 'git', label: 'Git cheat sheet', icon: GitBranch },
  { id: 'encode', label: 'Base64 & URL', icon: Binary },
];

const panel = 'rounded-3xl bg-neutral-900/70 p-4 ring-1 ring-white/10 sm:p-5';
const area = 'w-full resize-y rounded-2xl bg-neutral-950/80 p-4 font-mono text-[13px] leading-relaxed text-neutral-100 outline-none ring-1 ring-white/10 placeholder:text-neutral-600 focus:ring-2 focus:ring-[#2dd4bf]';
const label = 'text-xs font-medium uppercase tracking-wider text-neutral-400';

export function CopyButton({ text, className = '', small }: { text: string; className?: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  };
  return (
    <button type="button" onClick={copy} disabled={!text} aria-label="Copy to clipboard" className={`inline-flex items-center gap-1.5 rounded-lg font-medium ring-1 transition disabled:opacity-40 ${small ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-sm'} ${done ? 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30' : 'bg-white/5 text-neutral-200 ring-white/10 hover:bg-white/10'} ${className}`}>
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {done ? 'Copied' : 'Copy'}
    </button>
  );
}

const Toggle = ({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${on ? 'bg-[#2dd4bf]/15 text-[#5eead4] ring-[#2dd4bf]/40' : 'text-neutral-400 ring-white/10 hover:text-white'}`}>{children}</button>
);

// ---------------------------------------------------------------- JSON → TS
const SAMPLE = `{
  "id": 42,
  "name": "Yaakov",
  "email": "hello@example.com",
  "verified": true,
  "tags": ["video", "events"],
  "address": { "city": "Lakewood", "zip": "08701" },
  "bookings": [
    { "id": 1, "date": "2026-10-21", "total": 450 },
    { "id": 2, "date": "2026-11-02", "total": 600, "notes": "Evening set" }
  ],
  "manager": null
}`;

function JsonTool() {
  const [src, setSrc] = useState(SAMPLE);
  const [root, setRoot] = useState('Root');
  const [useType, setUseType] = useState(false);
  const [exportAll, setExportAll] = useState(true);
  const [readonly, setReadonly] = useState(false);
  const [optionalNulls, setOptionalNulls] = useState(false);
  const result = useMemo(() => {
    if (!src.trim()) return { out: '', err: '' };
    try { return { out: jsonToTs(src, { rootName: root, useType, exportAll, readonly, optionalNulls }), err: '' }; }
    catch (e) { return { out: '', err: e instanceof Error ? e.message : 'Invalid JSON' }; }
  }, [src, root, useType, exportAll, readonly, optionalNulls]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={panel}>
        <div className="mb-2 flex items-center justify-between"><span className={label}>JSON</span><button type="button" onClick={() => { try { setSrc(JSON.stringify(JSON.parse(src), null, 2)); } catch {} }} className="text-xs text-neutral-400 hover:text-white">Format</button></div>
        <textarea value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} rows={18} className={area} aria-label="JSON input" placeholder="Paste JSON here" />
        {result.err && <p role="alert" className="mt-2 text-sm text-red-300">{result.err}</p>}
      </div>
      <div className={panel}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-neutral-400">Root name <input value={root} onChange={(e) => setRoot(e.target.value)} className="h-7 w-28 rounded-lg bg-neutral-950 px-2 font-mono text-xs text-white ring-1 ring-white/15 outline-none focus:ring-[#2dd4bf]" /></label>
          <Toggle on={useType} set={setUseType}>type</Toggle>
          <Toggle on={exportAll} set={setExportAll}>export</Toggle>
          <Toggle on={readonly} set={setReadonly}>readonly</Toggle>
          <Toggle on={optionalNulls} set={setOptionalNulls}>null → optional</Toggle>
          <CopyButton text={result.out} className="ml-auto" />
        </div>
        <pre className="max-h-[30rem] overflow-auto rounded-2xl bg-neutral-950/80 p-4 font-mono text-[13px] leading-relaxed text-[#99f6e4] ring-1 ring-white/10" aria-label="TypeScript output">{result.out || '// TypeScript appears here'}</pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Glass style builder
const BACKDROPS = [
  'radial-gradient(circle at 20% 20%, #f472b6, transparent 45%), radial-gradient(circle at 80% 30%, #60a5fa, transparent 45%), radial-gradient(circle at 50% 90%, #c8a96a, transparent 50%), #0a0a0a',
  'linear-gradient(135deg, #0f766e, #1e1b4b 60%, #7c2d12)',
  'url("/images/home/machaneh-retzufos-2025.jpg") center/cover',
];

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function StyleTool() {
  const [s, setS] = useState({ blur: 16, tint: '#ffffff', opacity: 10, border: 20, radius: 24, shadow: 30, saturate: 160, padding: 32 });
  const [bg, setBg] = useState(0);
  const set = (k: keyof typeof s, v: number | string) => setS((x) => ({ ...x, [k]: v }));
  const tw = [
    `backdrop-blur-[${s.blur}px]`, `backdrop-saturate-[${s.saturate / 100}]`, `bg-[${hexA(s.tint, s.opacity / 100).replace(/ /g, '')}]`,
    `border`, `border-[${hexA('#ffffff', s.border / 100).replace(/ /g, '')}]`, `rounded-[${s.radius}px]`,
    s.shadow ? `shadow-[0_8px_32px_${hexA('#000000', s.shadow / 100).replace(/ /g, '')}]` : '', `p-[${s.padding}px]`,
  ].filter(Boolean).join(' ');
  const css = `.glass {
  background: ${hexA(s.tint, s.opacity / 100)};
  backdrop-filter: blur(${s.blur}px) saturate(${s.saturate}%);
  -webkit-backdrop-filter: blur(${s.blur}px) saturate(${s.saturate}%);
  border: 1px solid ${hexA('#ffffff', s.border / 100)};
  border-radius: ${s.radius}px;${s.shadow ? `\n  box-shadow: 0 8px 32px ${hexA('#000000', s.shadow / 100)};` : ''}
  padding: ${s.padding}px;
}`;
  const sliders: [keyof typeof s, string, number, number, string][] = [
    ['blur', 'Blur', 0, 40, 'px'], ['opacity', 'Fill opacity', 0, 60, '%'], ['border', 'Border opacity', 0, 60, '%'], ['saturate', 'Saturation', 100, 250, '%'],
    ['radius', 'Corner radius', 0, 48, 'px'], ['shadow', 'Shadow', 0, 80, '%'], ['padding', 'Padding', 8, 56, 'px'],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="relative flex min-h-80 items-center justify-center overflow-hidden rounded-3xl p-6 ring-1 ring-white/10" style={{ background: BACKDROPS[bg] }}>
          <div style={{ background: hexA(s.tint, s.opacity / 100), backdropFilter: `blur(${s.blur}px) saturate(${s.saturate}%)`, WebkitBackdropFilter: `blur(${s.blur}px) saturate(${s.saturate}%)`, border: `1px solid ${hexA('#ffffff', s.border / 100)}`, borderRadius: s.radius, boxShadow: s.shadow ? `0 8px 32px ${hexA('#000000', s.shadow / 100)}` : undefined, padding: s.padding }} className="w-full max-w-sm text-white">
            <p className="text-xs uppercase tracking-[0.25em] text-white/70">Preview</p>
            <p className="mt-2 text-xl font-semibold">Liquid glass card</p>
            <p className="mt-1 text-sm text-white/75">Tweak the sliders — the code updates live.</p>
          </div>
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            {BACKDROPS.map((b, i) => <button key={i} type="button" aria-label={`Backdrop ${i + 1}`} aria-pressed={bg === i} onClick={() => setBg(i)} className={`size-6 rounded-full ring-2 ${bg === i ? 'ring-white' : 'ring-white/20'}`} style={{ background: b }} />)}
          </div>
        </div>
        <div className={panel}>
          <div className="mb-2 flex items-center justify-between"><span className={label}>Tailwind classes</span><CopyButton text={tw} small /></div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-neutral-950/80 p-3 font-mono text-xs text-[#99f6e4] ring-1 ring-white/10">{tw}</pre>
          <div className="mb-2 mt-4 flex items-center justify-between"><span className={label}>CSS</span><CopyButton text={css} small /></div>
          <pre className="overflow-x-auto rounded-xl bg-neutral-950/80 p-3 font-mono text-xs text-[#99f6e4] ring-1 ring-white/10">{css}</pre>
        </div>
      </div>
      <div className={`${panel} space-y-4`}>
        <label className="flex items-center justify-between text-sm text-neutral-300">Tint <input type="color" value={s.tint} onChange={(e) => set('tint', e.target.value)} className="h-8 w-14 cursor-pointer rounded-lg bg-transparent" /></label>
        {sliders.map(([k, l, min, max, u]) => (
          <label key={k} className="block">
            <span className="flex justify-between text-xs text-neutral-400"><span>{l}</span><span className="font-mono text-neutral-200">{s[k]}{u}</span></span>
            <input type="range" min={min} max={max} value={s[k] as number} onChange={(e) => set(k, Number(e.target.value))} className="mt-1.5 w-full accent-[#2dd4bf]" />
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Git cheat sheet
const GIT: { group: string; items: [string, string][] }[] = [
  { group: 'Start', items: [['git init', 'Start a repository in this folder'], ['git clone <url>', 'Copy a repository from GitHub'], ['git status', 'What changed and what is staged']] },
  { group: 'Branches', items: [['git switch -c <branch>', 'Create a branch and switch to it'], ['git switch <branch>', 'Switch to an existing branch'], ['git branch -d <branch>', 'Delete a merged branch'], ['git branch -a', 'List local and remote branches']] },
  { group: 'Save work', items: [['git add -A', 'Stage every change'], ['git add -p', 'Stage changes piece by piece'], ['git commit -m "<message>"', 'Commit what is staged'], ['git commit --amend --no-edit', 'Add staged changes to the last commit'], ['git stash push -m "<message>"', 'Put work aside for later'], ['git stash pop', 'Bring the latest stash back']] },
  { group: 'Sync', items: [['git fetch origin', 'Download new commits without changing your files'], ['git pull --rebase origin <branch>', 'Update your branch, replaying your commits on top'], ['git push -u origin <branch>', 'Push a branch and track it'], ['git push --force-with-lease', 'Force-push, but refuse if someone else pushed']] },
  { group: 'Fix mistakes', items: [['git restore <file>', 'Throw away unstaged changes in a file'], ['git restore --staged <file>', 'Unstage a file (keep the changes)'], ['git reset --soft HEAD~1', 'Undo the last commit, keep its changes staged'], ['git revert <commit>', 'Make a new commit that undoes an old one'], ['git reflog', 'Find "lost" commits after a bad reset']] },
  { group: 'Inspect', items: [['git log --oneline --graph --decorate -20', 'Compact history with branches'], ['git diff', 'Unstaged changes'], ['git diff --staged', 'Staged changes'], ['git blame <file>', 'Who last changed each line'], ['git show <commit>', 'One commit in full']] },
  { group: 'Combine', items: [['git merge <branch>', 'Merge a branch into the current one'], ['git rebase origin/<branch>', 'Replay your commits on the latest version of a branch'], ['git cherry-pick <commit>', 'Copy one commit onto this branch'], ['git rebase --abort', 'Give up a rebase that went wrong']] },
];

function GitTool() {
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState('feature/new-page');
  const fill = (c: string) => c.replace(/<branch>/g, branch || '<branch>');
  const groups = GIT.map((g) => ({ ...g, items: g.items.filter(([c, d]) => !q || `${c} ${d}`.toLowerCase().includes(q.toLowerCase())) })).filter((g) => g.items.length);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="relative min-w-56 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search commands…" className="h-10 w-full rounded-xl bg-neutral-900/70 pl-9 pr-3 text-sm text-white ring-1 ring-white/10 outline-none focus:ring-[#2dd4bf]" /></label>
        <label className="flex items-center gap-2 text-sm text-neutral-400">Branch <input value={branch} onChange={(e) => setBranch(e.target.value.replace(/\s/g, '-'))} className="h-10 w-48 rounded-xl bg-neutral-900/70 px-3 font-mono text-sm text-white ring-1 ring-white/10 outline-none focus:ring-[#2dd4bf]" /></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.group} className={panel}>
            <h3 className={label}>{g.group}</h3>
            <ul className="mt-3 space-y-2">
              {g.items.map(([c, d]) => (
                <li key={c} className="flex items-center gap-3 rounded-xl bg-neutral-950/60 p-2.5 ring-1 ring-white/5">
                  <div className="min-w-0 flex-1"><code className="block truncate font-mono text-[13px] text-[#99f6e4]" title={fill(c)}>{fill(c)}</code><span className="text-xs text-neutral-500">{d}</span></div>
                  <CopyButton text={fill(c)} small />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!groups.length && <p className="text-sm text-neutral-500">No command matches “{q}”.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Base64 & URL
const b64enc = (s: string, urlSafe: boolean) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const out = btoa(bin);
  return urlSafe ? out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : out;
};
const b64dec = (s: string) => {
  let t = s.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

function Codec({ title, encode, decode, sample, options }: { title: string; encode: (s: string) => string; decode: (s: string) => string; sample: string; options?: React.ReactNode }) {
  const [plain, setPlain] = useState(sample);
  const [coded, setCoded] = useState(() => { try { return encode(sample); } catch { return ''; } });
  const [err, setErr] = useState('');
  const fromPlain = (v: string) => { setPlain(v); try { setCoded(encode(v)); setErr(''); } catch { setErr('Can’t encode that.'); } };
  const fromCoded = (v: string) => { setCoded(v); try { setPlain(decode(v)); setErr(''); } catch { setErr('That isn’t valid — check for missing or extra characters.'); } };
  // When an option changes the encoder (URL-safe, whole URL), re-encode the current text.
  const [lastEncode, setLastEncode] = useState(() => encode);
  if (lastEncode !== encode) {
    setLastEncode(() => encode);
    try { setCoded(encode(plain)); } catch {}
  }
  return (
    <section className={panel}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">{title}</h3>{options}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <div><div className="mb-1.5 flex items-center justify-between"><span className={label}>Text</span><CopyButton text={plain} small /></div><textarea value={plain} onChange={(e) => fromPlain(e.target.value)} rows={6} spellCheck={false} className={area} aria-label={`${title}: text`} /></div>
        <div><div className="mb-1.5 flex items-center justify-between"><span className={label}>Encoded</span><CopyButton text={coded} small /></div><textarea value={coded} onChange={(e) => fromCoded(e.target.value)} rows={6} spellCheck={false} className={area} aria-label={`${title}: encoded`} /></div>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red-300">{err}</p>}
      <p className="mt-2 text-xs text-neutral-500">Type in either box — the other updates. Handles emoji and Hebrew (UTF-8).</p>
    </section>
  );
}

function EncodeTool() {
  const [urlSafe, setUrlSafe] = useState(false);
  const [full, setFull] = useState(false);
  const enc64 = useMemo(() => (s: string) => b64enc(s, urlSafe), [urlSafe]);
  const encUrl = useMemo(() => (full ? encodeURI : encodeURIComponent), [full]);
  const decUrl = useMemo(() => (full ? decodeURI : decodeURIComponent), [full]);
  return (
    <div className="space-y-4">
      <Codec title="Base64" encode={enc64} decode={b64dec} sample="Shalom 👋 — yaakoveisenberger.com" options={<Toggle on={urlSafe} set={setUrlSafe}>URL-safe (base64url)</Toggle>} />
      <Codec title="URL encoding" encode={encUrl} decode={decUrl} sample="https://example.com/search?q=wedding intro&city=Lakewood, NJ" options={<Toggle on={full} set={setFull}>Whole URL (keep :/?&=)</Toggle>} />
    </div>
  );
}

export function DevTools() {
  const [tool, setTool] = useState<Tool>('json');
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1) as Tool; if (TOOLS.some((t) => t.id === h)) setTool(h); };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const choose = (t: Tool) => { setTool(t); history.replaceState(null, '', `#${t}`); };
  return (
    <div>
      <div role="tablist" aria-label="Tools" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {TOOLS.map(({ id, label: l, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tool === id} onClick={() => choose(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 transition ${tool === id ? 'bg-[#2dd4bf] text-neutral-950 ring-[#2dd4bf]' : 'bg-neutral-900/70 text-neutral-300 ring-white/10 hover:text-white'}`}>
            <Icon className="size-4" /> {l}
          </button>
        ))}
      </div>
      <div role="tabpanel" style={{ '--accent': ACCENT } as React.CSSProperties}>
        {tool === 'json' && <JsonTool />}
        {tool === 'style' && <StyleTool />}
        {tool === 'git' && <GitTool />}
        {tool === 'encode' && <EncodeTool />}
      </div>
    </div>
  );
}
