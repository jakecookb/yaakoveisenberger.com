'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Aperture, Crop, Download, Eraser, FlipHorizontal2, FlipVertical2, ImagePlus, LoaderCircle, Palette, Redo2, RotateCcw, RotateCw,
  SlidersHorizontal, Sparkles, SunMedium, Undo2, WandSparkles,
} from 'lucide-react';
import { autoEnhance, matchGrade } from '@/lib/photo/auto';
import { geometry, PhotoEngine, type Histogram } from '@/lib/photo/engine';
import { ASPECTS, DEFAULTS, PRESETS, type BgMode, type Params } from '@/lib/photo/params';
import { isLine } from '@/lib/photo/curves';
import { ACCENT, CurvesEditor, HistogramView, Slider } from './controls';
import type { SegIn, SegOut } from './segment.worker';

type Tab = 'ai' | 'light' | 'color' | 'effects' | 'crop' | 'export';
const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'light', label: 'Light', icon: SunMedium },
  { id: 'color', label: 'Color', icon: Palette },
  { id: 'effects', label: 'Effects', icon: Aperture },
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'export', label: 'Export', icon: Download },
];

type Format = 'png' | 'jpeg' | 'webp';
const MIME: Record<Format, 'image/png' | 'image/jpeg' | 'image/webp'> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
const SIZES = [{ v: 0, l: 'Full' }, { v: 4096, l: '4K' }, { v: 2048, l: '2048' }, { v: 1080, l: '1080' }];

const btn = 'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-40';
const ghost = `${btn} text-neutral-300 ring-white/10 hover:bg-white/10 hover:text-white`;
const chip = (on: boolean) => `${btn} ${on ? 'bg-white/10 text-white ring-white/30' : 'text-neutral-400 ring-white/10 hover:bg-white/5 hover:text-white'}`;

export function PhotoSuite() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engine = useRef<PhotoEngine | null>(null);
  const [error, setError] = useState<string>();
  const [file, setFile] = useState<{ name: string; w: number; h: number; scaled: boolean } | null>(null);
  const [p, setP] = useState<Params>(DEFAULTS);
  const [past, setPast] = useState<Params[]>([]);
  const [future, setFuture] = useState<Params[]>([]);
  const pending = useRef<Params | null>(null);
  const [tab, setTab] = useState<Tab>('ai');
  const [hist, setHist] = useState<Histogram | null>(null);
  const [compare, setCompare] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [seg, setSeg] = useState<{ state: 'idle' | 'busy' | 'ready' | 'error'; text?: string; pct?: number; ms?: number; device?: 'gpu' | 'cpu' }>({ state: 'idle' });
  const [note, setNote] = useState<string>();
  const [fmt, setFmt] = useState<Format>('png');
  const [quality, setQuality] = useState(92);
  const [long, setLong] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const worker = useRef<Worker | null>(null);
  const bitmap = useRef<ImageBitmap | HTMLCanvasElement | null>(null);

  // ---- history: a slider drag or a button press is one undo step
  const latest = useRef(p);
  useLayoutEffect(() => { latest.current = p; }, [p]);
  const begin = useCallback(() => { if (!pending.current) pending.current = latest.current; }, []);
  const end = useCallback(() => {
    const before = pending.current;
    pending.current = null;
    if (before && JSON.stringify(before) !== JSON.stringify(latest.current)) { setPast((h) => [...h.slice(-79), before]); setFuture([]); }
  }, []);
  const apply = useCallback((patch: Partial<Params>) => {
    const cur = latest.current;
    setPast((h) => [...h.slice(-79), cur]);
    setFuture([]);
    setP({ ...cur, ...patch });
  }, []);
  const live = (patch: Partial<Params>) => setP((cur) => ({ ...cur, ...patch }));
  const undo = useCallback(() => {
    if (!past.length) return;
    setFuture([latest.current, ...future]);
    setP(past[past.length - 1]);
    setPast(past.slice(0, -1));
  }, [past, future]);
  const redo = useCallback(() => {
    if (!future.length) return;
    setPast([...past, latest.current]);
    setP(future[0]);
    setFuture(future.slice(1));
  }, [past, future]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ---- engine (created as soon as the canvas exists)
  const attachCanvas = useCallback((c: HTMLCanvasElement | null) => {
    canvasRef.current = c;
    if (!c || engine.current) return;
    try {
      engine.current = new PhotoEngine(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setError('The graphics card reset. Reload the page to keep editing.'); });
  }, []);
  useEffect(() => () => worker.current?.terminate(), []);
  // Background removal runs faster on several CPU threads, which needs a cross-origin-isolated page — only applied on a
  // full page load. If we arrived by in-app navigation, reload once (as the audio separator does).
  useEffect(() => {
    if (window.crossOriginIsolated) return;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type !== 'reload') window.location.reload();
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the crop into the stage, then draw. Histogram follows a moment later.
  const out = useMemo(() => {
    if (!file) return null;
    const g = geometry(file.w, file.h, p);
    return { w: Math.max(1, Math.round(g.cropW)), h: Math.max(1, Math.round(g.cropH)) };
  }, [file, p]);
  const fit = useMemo(() => {
    if (!out || !stage.w || !stage.h) return null;
    const s = Math.min(stage.w / out.w, stage.h / out.h, 1);
    return { w: Math.max(1, Math.floor(out.w * s)), h: Math.max(1, Math.floor(out.h * s)) };
  }, [out?.w, out?.h, stage.w, stage.h]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const eng = engine.current;
    const c = canvasRef.current;
    if (!eng || !c || !fit || !file) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(fit.w * dpr);
    const h = Math.round(fit.h * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const raf = requestAnimationFrame(() => eng.render(p, { bypass: compare }));
    const t = setTimeout(() => setHist(eng.histogram(p)), 60);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [p, fit, compare, file, seg.state]);

  // ---- open a photo
  const open = useCallback(async (blob: Blob, name: string) => {
    const eng = engine.current;
    if (!eng) return;
    setError(undefined);
    let bmp: ImageBitmap | HTMLCanvasElement;
    try {
      bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      setError('That file couldn’t be opened. Try a JPEG, PNG, WebP or HEIC (on iPhone/Safari) photo.');
      return;
    }
    let scaled = false;
    const max = eng.maxSize;
    if (bmp.width > max || bmp.height > max) {
      const s = max / Math.max(bmp.width, bmp.height);
      const cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * s);
      cv.height = Math.round(bmp.height * s);
      cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height);
      bmp.close();
      bmp = cv;
      scaled = true;
    }
    eng.setImage(bmp);
    bitmap.current = bmp;
    setSeg({ state: 'idle' });
    setP(DEFAULTS);
    setPast([]);
    setFuture([]);
    setNote(undefined);
    setFile({ name: name.replace(/\.[^.]+$/, '') || 'photo', w: bmp.width, h: bmp.height, scaled });
  }, []);

  const onFiles = (files: FileList | null) => { const f = files?.[0]; if (f) open(f, f.name); };
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => { const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/')); if (f) open(f, f.name || 'pasted'); };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open]);
  const sample = async () => { const r = await fetch('/images/home/memories-of-shmuel.jpg'); open(await r.blob(), 'sample'); };

  // ---- AI
  const removeBg = () => {
    const src = bitmap.current;
    if (!src) return;
    const S = 1024;
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0, S, S);
    const px = ctx.getImageData(0, 0, S, S).data;
    const input = new Float32Array(3 * S * S);
    for (let i = 0; i < S * S; i++) { input[i] = px[i * 4] / 255; input[S * S + i] = px[i * 4 + 1] / 255; input[2 * S * S + i] = px[i * 4 + 2] / 255; }
    if (!worker.current) worker.current = new Worker(new URL('./segment.worker.ts', import.meta.url), { type: 'module' });
    const w = worker.current;
    setSeg({ state: 'busy', text: 'Getting ready…' });
    w.onmessage = (e: MessageEvent<SegOut>) => {
      const m = e.data;
      if (m.type === 'progress') setSeg({ state: 'busy', text: m.text, pct: m.total ? (m.loaded ?? 0) / m.total : undefined });
      else if (m.type === 'error') setSeg({ state: 'error', text: m.message });
      else {
        engine.current?.setMask(m.mask, m.size, m.size);
        setSeg({ state: 'ready', ms: m.ms, device: m.device });
        apply({ bg: 'transparent' });
        if (fmt === 'jpeg') setFmt('png');
      }
    };
    const threads = window.crossOriginIsolated ? Math.max(1, Math.min(navigator.hardwareConcurrency || 2, 8)) : 1;
    const forceGpu = new URLSearchParams(window.location.search).get('ai') === 'gpu';
    w.postMessage({ type: 'run', input, threads, forceGpu } satisfies SegIn, [input.buffer]);
  };

  const neutralSample = () => engine.current!.sample({ ...DEFAULTS, rotate: p.rotate, flipH: p.flipH, flipV: p.flipV, straighten: p.straighten, aspect: p.aspect, zoom: p.zoom, panX: p.panX, panY: p.panY, bg: p.bg === 'transparent' ? 'transparent' : 'keep' }, 320).data;
  const enhance = () => { apply({ ...autoEnhance(neutralSample()), curves: p.curves }); setNote('Auto-Enhance balanced exposure, white balance, contrast and detail. Fine-tune any slider.'); };
  const grade = () => { const g = matchGrade(neutralSample()); apply({ preset: g.preset, presetAmount: g.presetAmount }); setNote(`Color Match: the photo looks ${g.why}.`); };

  // ---- crop: drag the photo inside the frame
  const panDrag = useRef<{ x: number; y: number; start: Params } | null>(null);
  const onStageDown = (e: React.PointerEvent) => {
    if (tab !== 'crop' || !file) return;
    panDrag.current = { x: e.clientX, y: e.clientY, start: p };
    begin();
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onStageMove = (e: React.PointerEvent) => {
    const d = panDrag.current;
    const eng = engine.current;
    if (!d || !eng || !fit) return;
    const g = eng.geometry(d.start);
    const perPx = g.cropW / fit.w; // source pixels per screen pixel
    const dx = ((e.clientX - d.x) * perPx);
    const dy = ((e.clientY - d.y) * perPx);
    // Moving the photo right moves the crop window left (in the photo's own, possibly rotated/flipped, frame).
    const sx = d.start.flipH ? -1 : 1;
    const sy = d.start.flipV ? -1 : 1;
    const th = (d.start.straighten * Math.PI) / 180;
    const rx = Math.cos(th) * dx - Math.sin(th) * dy;
    const ry = Math.sin(th) * dx + Math.cos(th) * dy;
    live({
      panX: g.slackX ? Math.max(-1, Math.min(1, d.start.panX - (sx * rx) / g.slackX)) : 0,
      panY: g.slackY ? Math.max(-1, Math.min(1, d.start.panY - (sy * ry) / g.slackY)) : 0,
    });
  };
  const onStageUp = () => { if (panDrag.current) { panDrag.current = null; end(); } };

  // ---- export
  const doExport = async () => {
    const eng = engine.current;
    if (!eng || !file) return;
    setExporting(true);
    try {
      const { blob, w, h } = await eng.export(p, { type: MIME[fmt], quality: quality / 100, long });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name}-edited.${fmt === 'jpeg' ? 'jpg' : fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setNote(`Saved ${w}×${h} ${fmt.toUpperCase()} (${(blob.size / 1048576).toFixed(1)} MB).`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const S = (k: keyof Params, label: string, min = -100, max = 100, step = 1, unit = '', gradient?: string) => (
    <Slider key={k} label={label} value={p[k] as number} min={min} max={max} step={step} unit={unit} gradient={gradient} onStart={begin} onEnd={end} onChange={(v) => live({ [k]: v } as Partial<Params>)} />
  );
  const edited = JSON.stringify(p) !== JSON.stringify(DEFAULTS);
  const exportSize = out ? (long && Math.max(out.w, out.h) > long ? { w: Math.round(out.w * (long / Math.max(out.w, out.h))), h: Math.round(out.h * (long / Math.max(out.w, out.h))) } : out) : null;
  const transparent = p.bg === 'transparent' && seg.state === 'ready';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ---------- stage ---------- */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${btn} cursor-pointer bg-[#fda4af] text-neutral-950 ring-[#fda4af] hover:brightness-110`}>
            <ImagePlus className="size-4" /> {file ? 'Open another' : 'Open photo'}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <button type="button" className={ghost} onClick={undo} disabled={!past.length} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 className="size-4" /></button>
          <button type="button" className={ghost} onClick={redo} disabled={!future.length} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Redo2 className="size-4" /></button>
          <button
            type="button" className={chip(compare)} disabled={!file || !edited}
            onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)} onPointerLeave={() => setCompare(false)}
            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setCompare(true)} onKeyUp={() => setCompare(false)}
            title="Hold to see the original"
          >
            <SlidersHorizontal className="size-4" /> Hold for before
          </button>
          <button type="button" className={ghost} disabled={!edited} onClick={() => apply({ ...DEFAULTS })}><RotateCcw className="size-4" /> Reset all</button>
          <div className="ml-auto flex items-center gap-2">
            {file && <span className="hidden text-xs text-neutral-500 sm:inline">{file.w}×{file.h}{file.scaled ? ' (scaled to fit your graphics card)' : ''}</span>}
            <button type="button" className={`${btn} bg-white text-neutral-950 ring-white hover:bg-neutral-200`} disabled={!file || exporting} onClick={doExport}>
              {exporting ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} Export
            </button>
          </div>
        </div>

        <div
          ref={stageRef}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
          style={{ '--ar': out ? `${out.w} / ${out.h}` : '4 / 3' } as React.CSSProperties}
          // Phones: the stage takes the photo's shape (no empty bands); larger screens: a fixed workspace.
          className={`relative flex aspect-[var(--ar)] max-h-[62vh] min-h-56 w-full items-center justify-center overflow-hidden rounded-3xl bg-neutral-950/80 ring-1 lg:aspect-auto lg:h-[calc(100vh-13rem)] lg:max-h-none ${dragOver ? 'ring-2 ring-[#fda4af]' : 'ring-white/10'}`}
        >
          <div
            className={`relative ${file ? '' : 'hidden'} ${transparent && !compare ? 'photo-checker' : ''} ${tab === 'crop' ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
            style={fit ? { width: fit.w, height: fit.h } : undefined}
            onPointerDown={onStageDown} onPointerMove={onStageMove} onPointerUp={onStageUp} onPointerCancel={onStageUp}
          >
            <canvas ref={attachCanvas} className="block size-full" aria-label="Photo preview" />
            {tab === 'crop' && (
              <div className="pointer-events-none absolute inset-0 ring-1 ring-white/60">
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" /><div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/30" /><div className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
              </div>
            )}
            {compare && <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">Before</span>}
          </div>
          {!file && (
            <div className="flex max-w-sm flex-col items-center px-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-3xl text-neutral-950" style={{ background: ACCENT }}><WandSparkles className="size-8" /></span>
              <h2 className="mt-5 text-xl font-semibold text-white">Drop a photo to start</h2>
              <p className="mt-2 text-sm text-neutral-400">Or open one, or paste from your clipboard. Everything happens on this device — nothing is uploaded.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <label className={`${btn} cursor-pointer bg-[#fda4af] text-neutral-950 ring-[#fda4af]`}><ImagePlus className="size-4" /> Open photo<input type="file" accept="image/*" className="sr-only" onChange={(e) => onFiles(e.target.files)} /></label>
                <button type="button" className={ghost} onClick={sample}>Try a sample</button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="absolute inset-x-4 bottom-4 rounded-xl bg-red-500/15 p-3 text-center text-sm text-red-200 ring-1 ring-red-400/30">{error}</p>}
        </div>
        {note && <p className="text-sm text-neutral-400" role="status">{note}</p>}
      </div>

      {/* ---------- panel ---------- */}
      <aside className="flex min-w-0 flex-col gap-4 rounded-3xl bg-neutral-900/70 p-4 ring-1 ring-white/10 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
        <HistogramView h={file ? hist : null} />
        <div role="tablist" aria-label="Tools" className="grid grid-cols-6 gap-1 rounded-2xl bg-neutral-950/70 p-1 ring-1 ring-white/10">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${tab === id ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'}`}>
              <Icon className="size-4" style={tab === id ? { color: ACCENT } : undefined} /> {label}
            </button>
          ))}
        </div>

        <fieldset disabled={!file} className="space-y-4 disabled:opacity-40" role="tabpanel">
          {tab === 'ai' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={enhance} className="group flex flex-col items-start gap-1 rounded-2xl bg-gradient-to-br from-[#fda4af]/20 to-transparent p-3 text-left ring-1 ring-white/10 transition hover:ring-[#fda4af]/60">
                  <WandSparkles className="size-5" style={{ color: ACCENT }} /><span className="text-sm font-semibold text-white">Auto-Enhance</span><span className="text-xs text-neutral-400">Exposure, color, detail</span>
                </button>
                <button type="button" onClick={grade} className="group flex flex-col items-start gap-1 rounded-2xl bg-gradient-to-br from-sky-400/15 to-transparent p-3 text-left ring-1 ring-white/10 transition hover:ring-sky-300/60">
                  <Palette className="size-5 text-sky-300" /><span className="text-sm font-semibold text-white">Color Match</span><span className="text-xs text-neutral-400">Picks a grade for this photo</span>
                </button>
              </div>

              <div className="rounded-2xl bg-neutral-950/60 p-3 ring-1 ring-white/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-white"><Eraser className="size-4" style={{ color: ACCENT }} /> Background removal</span>
                  {seg.state !== 'ready' && (
                    <button type="button" onClick={removeBg} disabled={seg.state === 'busy'} className={`${btn} h-8 bg-white/10 text-white ring-white/20 hover:bg-white/20`}>
                      {seg.state === 'busy' ? <LoaderCircle className="size-4 animate-spin" /> : null} {seg.state === 'error' ? 'Try again' : 'Remove'}
                    </button>
                  )}
                </div>
                {seg.state === 'busy' && (
                  <div className="mt-3">
                    <p className="text-xs text-neutral-400">{seg.text}</p>
                    {seg.pct !== undefined && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.round(seg.pct * 100)}%`, background: ACCENT }} /></div>}
                  </div>
                )}
                {seg.state === 'error' && <p className="mt-2 text-xs text-red-300">{seg.text}</p>}
                {seg.state === 'idle' && <p className="mt-2 text-xs text-neutral-500">An AI model finds the subject and cuts it out. The first time, the model downloads once (42–84 MB) and then works offline.</p>}
                {seg.state === 'ready' && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['keep', 'transparent', 'color', 'blur'] as BgMode[]).map((m) => (
                        <button key={m} type="button" onClick={() => apply({ bg: m })} aria-pressed={p.bg === m} className={`${chip(p.bg === m)} h-8 justify-center px-1 text-xs`}>{{ keep: 'Original', transparent: 'Clear', color: 'Color', blur: 'Blur' }[m]}</button>
                      ))}
                    </div>
                    {p.bg === 'color' && (
                      <label className="flex items-center gap-3 text-xs text-neutral-300">Background <input type="color" value={p.bgColor} onChange={(e) => apply({ bgColor: e.target.value })} className="h-8 w-14 cursor-pointer rounded-lg bg-transparent" /></label>
                    )}
                    {p.bg !== 'keep' && S('edge', 'Edge softness', 0, 100)}
                    {seg.ms !== undefined && <p className="text-[11px] text-neutral-500">Subject found in {(seg.ms / 1000).toFixed(1)} s on this device{seg.device === 'gpu' ? ' (graphics card)' : ''}.</p>}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-neutral-300">Color grades</p>
                <div className="grid grid-cols-5 gap-2">
                  {PRESETS.map((pr) => (
                    <button key={pr.id} type="button" onClick={() => apply({ preset: pr.id, presetAmount: pr.id === p.preset ? p.presetAmount : 100 })} aria-pressed={p.preset === pr.id} className="group flex flex-col items-center gap-1">
                      <span className={`block aspect-square w-full rounded-xl ring-2 transition ${p.preset === pr.id ? 'ring-[#fda4af]' : 'ring-transparent group-hover:ring-white/30'}`} style={{ background: `linear-gradient(135deg, ${pr.swatch[0]}, ${pr.swatch[1]})` }} />
                      <span className={`text-[10px] leading-tight ${p.preset === pr.id ? 'text-white' : 'text-neutral-500'}`}>{pr.name}</span>
                    </button>
                  ))}
                </div>
                {p.preset !== 'none' && <div className="mt-3">{S('presetAmount', 'Grade strength', 0, 100)}</div>}
              </div>
            </>
          )}

          {tab === 'light' && (
            <>
              {S('exposure', 'Exposure', -3, 3, 0.01, ' EV')}
              {S('contrast', 'Contrast')}
              {S('highlights', 'Highlights')}
              {S('shadows', 'Shadows')}
            </>
          )}

          {tab === 'color' && (
            <>
              {S('temp', 'Temperature', -100, 100, 1, '', 'linear-gradient(90deg,#3b82f6,#e5e5e5,#f59e0b)')}
              {S('tint', 'Tint', -100, 100, 1, '', 'linear-gradient(90deg,#22c55e,#e5e5e5,#d946ef)')}
              {S('vibrance', 'Vibrance')}
              {S('saturation', 'Saturation')}
              <CurvesEditor curves={p.curves} hist={hist} onStart={begin} onEnd={end} onChange={(curves) => live({ curves })} />
              {(['master', 'r', 'g', 'b'] as const).some((c) => !isLine(p.curves[c])) && <p className="text-[11px] text-neutral-500">Double-tap a point to remove it.</p>}
            </>
          )}

          {tab === 'effects' && (
            <>
              {S('clarity', 'Clarity')}
              {S('sharpen', 'Sharpen', 0, 100)}
              {S('grain', 'Grain', 0, 100)}
              {S('vignette', 'Vignette')}
              {S('telephoto', 'Telephoto / wide lens')}
              <p className="text-[11px] leading-relaxed text-neutral-500">Telephoto (right) gently flattens features like a long lens; left adds a wide-angle bulge.</p>
            </>
          )}

          {tab === 'crop' && (
            <>
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-300">Aspect ratio</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {ASPECTS.map((a) => <button key={a.id} type="button" onClick={() => apply({ aspect: a.id, panX: 0, panY: 0 })} aria-pressed={p.aspect === a.id} className={`${chip(p.aspect === a.id)} justify-center`}>{a.id === '9:16' ? '9:16 Story' : a.id === '16:9' ? '16:9 Wide' : a.label}</button>)}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button type="button" className={`${ghost} justify-center`} aria-label="Rotate left" onClick={() => apply({ rotate: ((p.rotate + 3) % 4) as Params['rotate'], panX: 0, panY: 0 })}><RotateCcw className="size-4" /></button>
                <button type="button" className={`${ghost} justify-center`} aria-label="Rotate right" onClick={() => apply({ rotate: ((p.rotate + 1) % 4) as Params['rotate'], panX: 0, panY: 0 })}><RotateCw className="size-4" /></button>
                <button type="button" className={`${chip(p.flipH)} justify-center`} aria-label="Flip horizontally" aria-pressed={p.flipH} onClick={() => apply({ flipH: !p.flipH })}><FlipHorizontal2 className="size-4" /></button>
                <button type="button" className={`${chip(p.flipV)} justify-center`} aria-label="Flip vertically" aria-pressed={p.flipV} onClick={() => apply({ flipV: !p.flipV })}><FlipVertical2 className="size-4" /></button>
              </div>
              {S('straighten', 'Straighten', -45, 45, 0.1, '°')}
              {S('zoom', 'Zoom', 1, 4, 0.01, '×')}
              <p className="text-[11px] text-neutral-500">Drag the photo to position it inside the frame.</p>
              <button type="button" className={ghost} onClick={() => apply({ rotate: 0, straighten: 0, flipH: false, flipV: false, aspect: 'original', zoom: 1, panX: 0, panY: 0 })}><RotateCcw className="size-4" /> Reset crop</button>
            </>
          )}

          {tab === 'export' && (
            <>
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-300">Format</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['png', 'jpeg', 'webp'] as Format[]).map((f) => <button key={f} type="button" onClick={() => setFmt(f)} aria-pressed={fmt === f} className={`${chip(fmt === f)} justify-center uppercase`}>{f === 'jpeg' ? 'JPEG' : f}</button>)}
                </div>
                {fmt === 'jpeg' && transparent && <p className="mt-2 text-[11px] text-amber-200/80">JPEG can’t be see-through — the background will be white. Use PNG or WebP to keep it clear.</p>}
              </div>
              {fmt !== 'png' && <Slider label="Quality" value={quality} min={50} max={100} def={92} onStart={() => {}} onEnd={() => {}} onChange={setQuality} />}
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-300">Size (longest side)</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {SIZES.map((s) => <button key={s.v} type="button" onClick={() => setLong(s.v)} aria-pressed={long === s.v} className={`${chip(long === s.v)} justify-center`}>{s.l}</button>)}
                </div>
              </div>
              {exportSize && <p className="text-sm text-neutral-300">Output: <b className="text-white">{exportSize.w} × {exportSize.h}</b> px</p>}
              <button type="button" disabled={exporting} onClick={doExport} className={`${btn} h-11 w-full justify-center bg-[#fda4af] text-base font-semibold text-neutral-950 ring-[#fda4af] hover:brightness-110`}>
                {exporting ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} Download {fmt === 'jpeg' ? 'JPEG' : fmt.toUpperCase()}
              </button>
            </>
          )}
        </fieldset>
      </aside>
    </div>
  );
}
