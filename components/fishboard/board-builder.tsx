'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useSpring, useTransform } from 'framer-motion';
import { Check, Dices, LoaderCircle, Minus, MousePointerClick, Plus, RotateCcw, RotateCw, Send, Share2, Trash2, Undo2, X } from 'lucide-react';
import { requestBoard } from '@/app/fishboard-actions';
import {
  AMOUNTS, BOARDS, DEFAULT_DESIGN, FISH, GARNISHES, LAYOUTS, MESSAGE_STYLES, PLACEMENTS, PRESETS, SIZES, TOPPINGS,
  cleanDesign, describe, price, type Amount, type BoardKind, type Design, type Fish, type Garnish, type Layout, type MessageStyle, type Placement, type Size, type Topping,
} from '@/lib/fishboard/model';
import { BoardArt, tex, VIEW_H, VIEW_W } from './board-art';
import { ChopFX, type Chop } from './chop-fx';

const STEPS = ['Size', 'Fish', 'Toppings', 'Fun'] as const;
type Step = (typeof STEPS)[number];
const DRAFT_KEY = 've-fishboard-draft';
const noop = () => () => {};

const pill = (on: boolean) => `rounded-2xl px-3 py-2.5 text-left text-sm ring-1 transition active:scale-[0.98] ${on ? 'bg-[var(--accent)]/15 text-white ring-[var(--accent)]' : 'bg-white/[0.03] text-neutral-300 ring-white/10 hover:bg-white/[0.06]'}`;
const label = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500';

/* ---------- small pictures for the option buttons ---------- */

/** A round photo of the ingredient (whole, before it's cut) with its name under it. */
function PhotoChip({ src, name, on, badge }: { src: string; name: string; on: boolean; badge?: string }) {
  return (
    <span className="flex w-16 flex-col items-center gap-1 text-center">
      <span className={`relative block size-14 rounded-full bg-cover bg-center shadow-md ring-2 transition ${on ? 'ring-[var(--accent)] ring-offset-2 ring-offset-neutral-900' : 'ring-white/10'}`} style={{ backgroundImage: `url(${src})` }}>
        {badge && <span className="absolute -right-1 -top-1 rounded-full bg-neutral-950 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)] ring-1 ring-white/15">{badge}</span>}
        {on && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30"><Check className="size-5 text-white" /></span>}
      </span>
      <span className={`text-[11px] leading-tight ${on ? 'text-white' : 'text-neutral-400'}`}>{name}</span>
    </span>
  );
}
const fishPhoto = (f: Fish) => tex(FISH[f].photo);
const topPhoto = (t: Topping) => tex(TOPPINGS[t].photo);
const fishBadge = (f: Fish, size: Design['size']) => (FISH[f].extra[size] ? `+$${FISH[f].extra[size]}` : undefined);

/* ---------- animated price ---------- */

function Price({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 160, damping: 22 });
  const shown = useTransform(spring, (v) => `$${Math.round(v)}`);
  useEffect(() => { spring.set(value); }, [spring, value]);
  return <motion.span className="tabular-nums">{shown}</motion.span>;
}

/* ---------- picture for the email ---------- */

async function snapshot(svg: SVGSVGElement, width: number, quality: number): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('.fb-ui').forEach((n) => n.remove());
  const h = Math.round((width * VIEW_H) / VIEW_W);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(h));
  // An SVG drawn into a canvas can't load other files, so every photo it uses is put inside it first.
  const cache = new Map<string, Promise<string>>();
  const inline = (url: string) => {
    if (!cache.has(url)) cache.set(url, fetch(url).then((r) => r.blob()).then((b) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(b); })));
    return cache.get(url)!;
  };
  await Promise.all([...clone.querySelectorAll('image')].map(async (el) => { const href = el.getAttribute('href'); if (href && !href.startsWith('data:')) el.setAttribute('href', await inline(href)); }));
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = '*{animation:none!important}';
  clone.insertBefore(style, clone.firstChild);
  const img = new Image();
  img.decoding = 'async';
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const bg = ctx.createRadialGradient(width / 2, h * 0.4, 50, width / 2, h / 2, width * 0.75);
  bg.addColorStop(0, '#26221f');
  bg.addColorStop(1, '#0d0c0b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, h);
  ctx.drawImage(img, 0, 0, width, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/* ---------- the builder ---------- */

function randomDesign(): Design {
  const any = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
  const fishKeys = Object.keys(FISH) as Fish[];
  const topKeys = Object.keys(TOPPINGS) as Topping[];
  const garn = Object.keys(GARNISHES) as Garnish[];
  return cleanDesign({
    ...DEFAULT_DESIGN,
    size: any(['standard', 'large'] as const),
    board: any(Object.keys(BOARDS) as BoardKind[]),
    layout: any(Object.keys(LAYOUTS) as Layout[]),
    placement: Math.random() < 0.75 ? 'bands' : 'lines',
    fish: Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => any(fishKeys)),
    toppings: ['onion', ...Array.from({ length: Math.floor(Math.random() * 3) }, () => any(topKeys))],
    border: Math.random() < 0.4 ? any(topKeys) : 'none',
    saltPepper: Math.random() < 0.8,
    garnishes: Array.from({ length: Math.floor(Math.random() * 4) }, () => ({ g: any(garn), x: 0.15 + Math.random() * 0.7, y: 0.18 + Math.random() * 0.64, r: Math.random() * 60 - 30, s: 0.9 + Math.random() * 0.3 })),
  });
}

function loadStart(): Design {
  try {
    const hash = new URLSearchParams(window.location.hash.slice(1)).get('board');
    if (hash) return cleanDesign(JSON.parse(decodeURIComponent(escape(atob(hash)))));
  } catch {}
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) return cleanDesign(JSON.parse(saved));
  } catch {}
  return DEFAULT_DESIGN;
}

export function BoardBuilder({ accent }: { accent: string }) {
  const [design, setDesign] = useState<Design>(DEFAULT_DESIGN);
  const [history, setHistory] = useState<Design[]>([]);
  const [step, setStep] = useState<Step>('Size');
  const [placing, setPlacing] = useState<Garnish | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [shared, setShared] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ i: number; moved: boolean } | null>(null);

  // Start from a shared link or the last unsent draft (after the first paint, so the page itself is the same for everyone).
  useEffect(() => {
    const start = loadStart();
    if (start !== DEFAULT_DESIGN) queueMicrotask(() => setDesign(start));
  }, []);
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(design)); } catch {}
  }, [design]);

  const update = useCallback((patch: Partial<Design> | ((d: Design) => Partial<Design>), record = true) => {
    setDesign((d) => {
      if (record) setHistory((h) => [...h.slice(-29), d]);
      return cleanDesign({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) });
    });
  }, []);
  // Picking an ingredient plays the chop animation first; the board takes the change when the pieces land.
  const [chop, setChop] = useState<Chop | null>(null);
  const pending = useRef<Parameters<typeof update>[0] | null>(null);
  const finishChop = useCallback(() => {
    if (pending.current) update(pending.current);
    pending.current = null;
    setChop(null);
  }, [update]);
  const chopThen = (c: Omit<Chop, 'id'>, patch: Parameters<typeof update>[0]) => {
    if (pending.current) update(pending.current); // a new pick while one is still landing: finish that one at once
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { update(patch); return; }
    pending.current = patch;
    setChop({ ...c, id: Date.now() });
  };
  const undo = () => setHistory((h) => { if (!h.length) return h; setDesign(h[h.length - 1]); setSelected(null); return h.slice(0, -1); });

  const toBoard = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.min(1, Math.max(0, p.x / VIEW_W)), y: Math.min(1, Math.max(0, p.y / VIEW_H)) };
  };

  const onBoardDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current) return;
    if (placing) {
      const { x, y } = toBoard(e);
      update((d) => ({ garnishes: [...d.garnishes, { g: placing, x, y, r: Math.round(Math.random() * 40 - 20), s: 1 }] }));
      setSelected(design.garnishes.length);
    } else setSelected(null);
  };
  const onGarnishDown = (i: number, e: React.PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    if (placing) return onBoardDown(e as unknown as React.PointerEvent<SVGSVGElement>);
    setSelected(i);
    drag.current = { i, moved: false };
    (e.currentTarget.ownerSVGElement ?? e.currentTarget).setPointerCapture?.(e.pointerId);
    setHistory((h) => [...h.slice(-29), design]);
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const g = drag.current;
      if (!g || !svgRef.current) return;
      g.moved = true;
      const { x, y } = toBoard(e);
      setDesign((d) => ({ ...d, garnishes: d.garnishes.map((p, i) => (i === g.i ? { ...p, x, y } : p)) }));
    };
    const up = () => { drag.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, []);

  const changeSelected = (fn: (p: Design['garnishes'][number]) => Design['garnishes'][number] | null) => {
    if (selected === null) return;
    update((d) => ({ garnishes: d.garnishes.flatMap((p, i) => (i === selected ? (fn(p) ? [fn(p)!] : []) : [p])) }));
  };

  const share = async () => {
    const link = `${window.location.origin}${window.location.pathname}#board=${btoa(unescape(encodeURIComponent(JSON.stringify(design))))}`;
    try {
      if (navigator.share) await navigator.share({ title: 'My fish board', url: link });
      else { await navigator.clipboard.writeText(link); setShared(true); setTimeout(() => setShared(false), 2000); }
    } catch {}
  };

  const total = price(design);
  const ingredient = (key: 'fish' | 'toppings', v: string): Omit<Chop, 'id'> => key === 'fish'
    ? { src: fishPhoto(v as Fish), label: FISH[v as Fish].label, kind: 'slice' }
    : { src: topPhoto(v as Topping), label: TOPPINGS[v as Topping].label, kind: 'dice' };
  const setSlot = (key: 'fish' | 'toppings', i: number, v: string) => chopThen(ingredient(key, v), (d) => ({ [key]: (d[key] as string[]).map((x, k) => (k === i ? v : x)) }));
  const addSlot = (key: 'fish' | 'toppings') => update((d) => ({ [key]: [...(d[key] as string[]), (d[key] as string[])[0]].slice(0, 4) }));
  const removeSlot = (key: 'fish' | 'toppings', i: number) => update((d) => ({ [key]: (d[key] as string[]).filter((_, k) => k !== i) }));

  return (
    <section id="builder" style={{ '--accent': accent } as React.CSSProperties} className="relative mt-14 scroll-mt-20 text-left">
      <div className="text-center">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: accent }}>Board builder</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Design your own fish board</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-400">Pick a size, line up your fish and toppings, drop on a few fun extras — the board redraws as you go. Send it, and I’ll get a picture of exactly what you want.</p>
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
        {/* preview */}
        <div className="sticky top-[57px] z-20 -mx-4 bg-neutral-950/85 px-4 pb-2 pt-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-20 lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(120%_90%_at_50%_30%,#26221f,#0d0c0b)] ring-1 ring-white/10 shadow-2xl">
            <BoardArt ref={svgRef} design={design} selected={selected} onBoardPointerDown={onBoardDown} onGarnishPointerDown={onGarnishDown} className={`block h-auto w-full touch-none select-none ${placing ? 'cursor-crosshair' : ''}`} />
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/90 backdrop-blur">{SIZES[design.size].label}{design.amount !== 'classic' ? ` · ${AMOUNTS[design.amount].label}` : ''}</div>
            <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-base font-semibold text-white backdrop-blur"><Price value={total} /></div>
            {chop && <ChopFX key={chop.id} chop={chop} onDone={finishChop} />}
            <AnimatePresence>
              {placing && (
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-2xl bg-black/70 px-3 py-2 text-sm text-white backdrop-blur">
                  <span className="inline-flex items-center gap-2"><MousePointerClick className="size-4" style={{ color: accent }} /> Tap the board to drop a {GARNISHES[placing].toLowerCase()}</span>
                  <button type="button" onClick={() => setPlacing(null)} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-950">Done</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {selected !== null && design.garnishes[selected] ? (
              <>
                <span className="mr-1 text-xs text-neutral-400">{GARNISHES[design.garnishes[selected].g]}:</span>
                <Tool onClick={() => changeSelected((p) => ({ ...p, r: ((p.r + 210) % 360) - 180 }))} icon={<RotateCw className="size-3.5" />}>Turn</Tool>
                <Tool onClick={() => changeSelected((p) => ({ ...p, s: Math.min(1.6, p.s + 0.15) }))} icon={<Plus className="size-3.5" />}>Bigger</Tool>
                <Tool onClick={() => changeSelected((p) => ({ ...p, s: Math.max(0.6, p.s - 0.15) }))} icon={<Minus className="size-3.5" />}>Smaller</Tool>
                <Tool onClick={() => { changeSelected(() => null); setSelected(null); }} icon={<Trash2 className="size-3.5" />}>Remove</Tool>
              </>
            ) : (
              <>
                <Tool onClick={undo} disabled={!history.length} icon={<Undo2 className="size-3.5" />} compact>Undo</Tool>
                <Tool onClick={() => { update(randomDesign()); setSelected(null); }} icon={<Dices className="size-3.5" />}>Surprise me</Tool>
                <Tool onClick={share} icon={shared ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />} compact>{shared ? 'Link copied' : 'Share'}</Tool>
                <Tool onClick={() => { update(DEFAULT_DESIGN); setSelected(null); }} icon={<RotateCcw className="size-3.5" />} compact>Start over</Tool>
              </>
            )}
          </div>
        </div>

        {/* controls */}
        <div className="rounded-3xl bg-neutral-900/60 p-4 ring-1 ring-white/10 sm:p-5">
          <p className={label}>Start from</p>
          <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
            {PRESETS.map((p) => (
              <button key={p.name} type="button" onClick={() => { update({ ...p.design, garnishes: [], message: '' }); setSelected(null); }} className="shrink-0 rounded-full bg-white/[0.04] px-3.5 py-2 text-sm text-neutral-200 ring-1 ring-white/10 transition hover:bg-white/10 active:scale-95">
                <span className="mr-1.5">{p.emoji}</span>{p.name}
              </button>
            ))}
          </div>

          <div role="tablist" className="mt-4 grid grid-cols-4 gap-1 rounded-full bg-black/40 p-1 ring-1 ring-white/10">
            {STEPS.map((s, i) => (
              <button key={s} role="tab" aria-selected={step === s} type="button" onClick={() => setStep(s)} className={`relative rounded-full py-2 text-xs font-semibold transition sm:text-sm ${step === s ? 'text-neutral-950' : 'text-neutral-400 hover:text-white'}`}>
                {step === s && <motion.span layoutId="fb-tab" className="absolute inset-0 rounded-full" style={{ background: accent }} transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                <span className="relative">{i + 1}. {s}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="mt-5 space-y-5">
              {step === 'Size' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(SIZES) as Size[]).map((s) => (
                      <button key={s} type="button" onClick={() => update({ size: s })} className={pill(design.size === s)}>
                        <span className="flex items-baseline justify-between"><b className="text-base text-white">{SIZES[s].label}</b><span className="font-semibold">${SIZES[s].price}</span></span>
                        <span className="mt-0.5 block text-xs text-neutral-400">{SIZES[s].blurb}</span>
                      </button>
                    ))}
                  </div>
                  <div>
                    <p className={label}>How much fish</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(Object.keys(AMOUNTS) as Amount[]).map((a) => (
                        <button key={a} type="button" onClick={() => update({ amount: a })} className={pill(design.amount === a)}>
                          <b className="block text-white">{AMOUNTS[a].label}</b>
                          <span className="block text-xs text-neutral-400">{AMOUNTS[a].add[design.size] ? `+$${AMOUNTS[a].add[design.size]}` : 'Included'}</span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-neutral-500">{AMOUNTS[design.amount].blurb}. Watch the rows get thicker.</p>
                  </div>
                  <div>
                    <p className={label}>Board</p>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {(Object.keys(BOARDS) as BoardKind[]).map((b) => (
                        <button key={b} type="button" onClick={() => update({ board: b })} className={`${pill(design.board === b)} flex flex-col items-center gap-1.5 !px-1 text-center text-xs`}>
                          <span className="block h-7 w-full rounded-lg ring-1 ring-black/30" style={{ background: `linear-gradient(135deg, ${BOARDS[b].a}, ${BOARDS[b].b})` }} />
                          {BOARDS[b].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 'Fish' && (
                <>
                  <div>
                    <p className={label}>Layout</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(Object.keys(LAYOUTS) as Layout[]).map((l) => (
                        <button key={l} type="button" onClick={() => update({ layout: l })} className={`${pill(design.layout === l)} flex items-center gap-2`}>
                          <svg viewBox="0 0 24 16" className="h-4 w-6 shrink-0" aria-hidden><g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">{l === 'rows' ? [3, 8, 13].map((y) => <line key={y} x1="2" x2="22" y1={y} y2={y} />) : l === 'strips' ? [4, 10, 16, 22].map((x) => <line key={x} x1={x} x2={x} y1="2" y2="14" />) : [0, 7, 14].map((x) => <line key={x} x1={x + 2} x2={x + 10} y1="14" y2="2" />)}</g></svg>
                          {LAYOUTS[l]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Lineup title="Fish lineup" hint="Rows repeat this order. Add up to 4 to alternate." items={design.fish} options={Object.keys(FISH) as Fish[]} name={(f) => FISH[f].label} photo={fishPhoto} badge={(f) => fishBadge(f, design.size)} onSet={(i, v) => setSlot('fish', i, v)} onAdd={() => addSlot('fish')} onRemove={(i) => removeSlot('fish', i)} />
                </>
              )}

              {step === 'Toppings' && (
                <>
                  <div>
                    <p className={label}>Placement</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(Object.keys(PLACEMENTS) as Placement[]).map((p) => <button key={p} type="button" onClick={() => update({ placement: p })} className={pill(design.placement === p)}>{PLACEMENTS[p]}</button>)}
                    </div>
                  </div>
                  <Lineup title="Topping lineup" hint="White onion is the classic. Mix in colour for stripes." items={design.toppings} options={Object.keys(TOPPINGS) as Topping[]} name={(t) => TOPPINGS[t].label} photo={topPhoto} onSet={(i, v) => setSlot('toppings', i, v)} onAdd={() => addSlot('toppings')} onRemove={(i) => removeSlot('toppings', i)} />
                  <div>
                    <p className={label}>Border around the board</p>
                    <div className="mt-2 flex flex-wrap gap-x-1 gap-y-2">
                      <button type="button" aria-label="No border" onClick={() => update({ border: 'none' })} className="rounded-2xl p-1 transition hover:bg-white/5 active:scale-95"><span className="flex w-16 flex-col items-center gap-1 text-center"><span className={`flex size-14 items-center justify-center rounded-full bg-white/[0.04] ring-2 ${design.border === 'none' ? 'ring-[var(--accent)] ring-offset-2 ring-offset-neutral-900' : 'ring-white/10'}`}><X className="size-5 text-neutral-400" /></span><span className={`text-[11px] ${design.border === 'none' ? 'text-white' : 'text-neutral-400'}`}>None</span></span></button>
                      {(Object.keys(TOPPINGS) as Topping[]).map((t) => <button key={t} type="button" aria-label={TOPPINGS[t].label} onClick={() => design.border !== t && chopThen({ src: topPhoto(t), label: TOPPINGS[t].label, kind: 'dice' }, { border: t })} className="rounded-2xl p-1 transition hover:bg-white/5 active:scale-95"><PhotoChip src={topPhoto(t)} name={TOPPINGS[t].label} on={design.border === t} /></button>)}
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-neutral-200 ring-1 ring-white/10">
                    Salt & cracked black pepper
                    <input type="checkbox" checked={design.saltPepper} onChange={(e) => update({ saltPepper: e.target.checked })} className="size-5 accent-[var(--accent)]" />
                  </label>
                </>
              )}

              {step === 'Fun' && (
                <>
                  <div>
                    <p className={label}>Drop garnishes anywhere</p>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {(Object.keys(GARNISHES) as Garnish[]).map((g) => (
                        <button key={g} type="button" onClick={() => { setPlacing(placing === g ? null : g); setSelected(null); }} className={`${pill(placing === g)} flex flex-col items-center gap-1 !px-1 text-center text-[11px] leading-tight`}>
                          <img src={tex(`g-${g}`, 'png')} alt="" className="size-10 object-contain drop-shadow" />
                          {GARNISHES[g]}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-neutral-500">Pick one, then tap the board. Drag to move; tap one to turn, resize or remove it.</p>
                    {design.garnishes.length > 0 && <button type="button" onClick={() => { update({ garnishes: [] }); setSelected(null); }} className="mt-2 text-xs text-neutral-400 underline-offset-4 hover:text-white hover:underline">Clear all garnishes</button>}
                  </div>
                  <div>
                    <p className={label}>Write on the board</p>
                    <input value={design.message} onChange={(e) => update({ message: e.target.value }, false)} maxLength={14} placeholder="e.g. MAZEL TOV, SARAH 40" className="mt-2 h-12 w-full rounded-xl bg-neutral-950 px-4 text-base uppercase text-white ring-1 ring-white/15 outline-none placeholder:normal-case placeholder:text-neutral-600 focus:ring-2 focus:ring-[var(--accent)] sm:text-sm" />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(Object.keys(MESSAGE_STYLES) as MessageStyle[]).map((m) => <button key={m} type="button" onClick={() => update({ messageStyle: m })} className={`${pill(design.messageStyle === m)} !py-2 text-center text-xs`}>{MESSAGE_STYLES[m]}</button>)}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-semibold text-white"><Price value={total} /></p>
              <p className="text-xs text-neutral-500">Estimated price</p>
            </div>
            {step !== 'Fun' && <button type="button" onClick={() => setStep(STEPS[STEPS.indexOf(step) + 1])} className="h-12 rounded-full px-4 text-sm font-semibold text-neutral-300 ring-1 ring-white/15 hover:bg-white/5">Next</button>}
            <button type="button" onClick={() => { setPlacing(null); setSelected(null); setSheet(true); }} className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold text-neutral-950 shadow-[0_0_30px_-8px_var(--accent)] transition active:scale-[0.98]" style={{ background: accent }}>
              <Send className="size-4" /> Request this board
            </button>
          </div>
        </div>
      </div>

      <OrderSheet open={sheet} onClose={() => setSheet(false)} design={design} svg={svgRef} accent={accent} />
    </section>
  );
}

function Tool({ children, icon, onClick, disabled, compact }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; disabled?: boolean; compact?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.04] px-3 text-xs font-semibold text-neutral-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white disabled:opacity-35">{icon}<span className={compact ? 'max-sm:sr-only' : ''}>{children}</span></button>;
}

/** The order rows repeat in: tap a slot, then pick what goes in it. One picker for all slots keeps it short on a phone. */
function Lineup<T extends string>({ title, hint, items, options, name, photo, badge, onSet, onAdd, onRemove }: { title: string; hint: string; items: T[]; options: T[]; name: (v: T) => string; photo: (v: T) => string; badge?: (v: T) => string | undefined; onSet: (i: number, v: T) => void; onAdd: () => void; onRemove: (i: number) => void }) {
  const [active, setActive] = useState(0);
  const cur = Math.min(active, items.length - 1);
  return (
    <div>
      <p className={label}>{title}</p>
      <p className="mt-1 text-xs text-neutral-500">{hint}</p>
      <div className="mt-3 flex flex-wrap items-start gap-1">
        {items.map((v, i) => (
          <button key={i} type="button" onClick={() => setActive(i)} aria-pressed={i === cur} aria-label={`Slot ${i + 1}: ${name(v)}`} className={`relative rounded-2xl p-1 transition ${i === cur ? 'bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/60' : 'hover:bg-white/5'}`}>
            <PhotoChip src={photo(v)} name={items.length > 1 ? `${i + 1}. ${name(v)}` : name(v)} on={false} badge={badge?.(v)} />
            {items.length > 1 && i === cur && <span role="button" tabIndex={0} aria-label={`Remove ${name(v)}`} onClick={(e) => { e.stopPropagation(); onRemove(i); setActive(Math.max(0, i - 1)); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemove(i); setActive(Math.max(0, i - 1)); } }} className="absolute -left-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-neutral-950 text-neutral-300 ring-1 ring-white/20 hover:text-white"><X className="size-3" /></span>}
          </button>
        ))}
        {items.length < 4 && (
          <button type="button" onClick={() => { onAdd(); setActive(items.length); }} className="flex w-16 flex-col items-center gap-1 rounded-2xl p-1 text-[11px] text-neutral-400 hover:bg-white/5 hover:text-white">
            <span className="flex size-14 items-center justify-center rounded-full ring-2 ring-dashed ring-white/20"><Plus className="size-5" /></span>
            Alternate
          </button>
        )}
      </div>
      <div className="mt-3 rounded-2xl bg-white/[0.03] p-2 ring-1 ring-white/10">
        <p className="px-1 pb-1.5 text-xs text-neutral-400">{items.length > 1 ? `Slot ${cur + 1}: ` : ''}tap to swap in</p>
        <div className="flex flex-wrap gap-x-1 gap-y-2">
          {options.map((o) => <button key={o} type="button" aria-label={name(o)} aria-pressed={o === items[cur]} onClick={() => o !== items[cur] && onSet(cur, o)} className="rounded-2xl p-1 transition hover:bg-white/5 active:scale-95"><PhotoChip src={photo(o)} name={name(o)} on={o === items[cur]} badge={badge?.(o)} /></button>)}
        </div>
      </div>
    </div>
  );
}

/* ---------- send ---------- */

const f = 'h-12 w-full rounded-xl bg-neutral-950 px-4 text-base text-white ring-1 ring-white/15 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-[var(--accent)] sm:text-sm';

function OrderSheet({ open, onClose, design, svg, accent }: { open: boolean; onClose: () => void; design: Design; svg: React.RefObject<SVGSVGElement | null>; accent: string }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [pic, setPic] = useState<string>();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open || !svg.current) return;
    let live = true;
    (async () => {
      // Keep the picture small enough to send: try a big one, step down if needed.
      let shot = await snapshot(svg.current!, 1400, 0.84).catch(() => '');
      if (shot.length > 900_000) shot = await snapshot(svg.current!, 1100, 0.74).catch(() => '');
      if (live) setPic(shot);
    })();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { live = false; document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, svg, onClose]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pic) return setError('Still drawing your board — one second.');
    setState('busy'); setError(undefined);
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    const res = await requestBoard({ ...fields, design }, pic).catch(() => ({ ok: false, error: 'Something went wrong — please try again.' }));
    if (res.ok) { setState('done'); try { localStorage.removeItem(DRAFT_KEY); } catch {} } else { setState('idle'); setError(res.error); }
  }
  const close = () => { onClose(); if (state === 'done') setState('idle'); };

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} style={{ '--accent': accent } as React.CSSProperties}>
          <motion.div role="dialog" aria-modal aria-label="Request this board" onClick={(e) => e.stopPropagation()} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-neutral-900 p-5 text-left ring-1 ring-white/10 sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">{state === 'done' ? 'Your board is on its way 🎉' : 'Request this board'}</h3>
                <p className="mt-1 text-sm text-neutral-400">{state === 'done' ? 'Yaakov got the picture and every detail. A copy is in your email — reply to it to change anything.' : 'Yaakov gets this exact picture with your details, and confirms the date and price with you.'}</p>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="rounded-full p-2 text-neutral-400 hover:bg-white/10 hover:text-white"><X className="size-5" /></button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
              {pic ? <img src={pic} alt="Your board design" className="block h-auto w-full" /> : <div className="flex aspect-[1000/680] items-center justify-center text-sm text-neutral-500"><LoaderCircle className="mr-2 size-4 animate-spin" /> Plating your board…</div>}
            </div>

            {state === 'done' ? (
              <button type="button" onClick={close} className="mt-5 h-12 w-full rounded-full font-semibold text-neutral-950" style={{ background: accent }}>Done</button>
            ) : (
              <>
                <details className="mt-3 rounded-2xl bg-white/[0.03] px-4 py-2 text-sm ring-1 ring-white/10">
                  <summary className="cursor-pointer py-1 text-neutral-300">What’s on it · <b className="text-white">${price(design)}</b></summary>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pb-2 text-xs">
                    {describe(design).map(([k, v]) => <div key={k} className="contents"><dt className="text-neutral-500">{k}</dt><dd className="text-neutral-200">{v}</dd></div>)}
                  </dl>
                </details>
                <form onSubmit={submit} className="mt-4 space-y-3">
                  <input name="name" required maxLength={80} autoComplete="name" placeholder="Your name" className={f} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="Email" className={f} />
                    <input name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="Phone" className={f} />
                  </div>
                  <label className="block text-xs text-neutral-400">When do you need it? (optional)<input name="date" type="date" className={`${f} mt-1 [color-scheme:dark]`} /></label>
                  <textarea name="message" rows={3} maxLength={2000} placeholder="Anything else? Allergies, pickup or delivery, extra requests…" className={`${f} h-auto py-3`} />
                  <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                  {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                  <button disabled={state === 'busy' || !pic} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold text-neutral-950 disabled:opacity-60" style={{ background: accent }}>
                    {state === 'busy' ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Send my board · ${price(design)}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
