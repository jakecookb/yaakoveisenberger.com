'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, AudioWaveform, Download, FileAudio, GripVertical, LoaderCircle, Magnet, Pause, Play, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { analyse, loudness, type Analysis } from '@/lib/remix/analyze';
import { layout, renderMix, type Placement } from '@/lib/remix/render';
import { encodeWav } from '@/lib/separator/wav';
import { fmtTime, Waveform } from './waveform';
import type { Mp3In, Mp3Out } from './mp3.worker';

type Role = 'low' | 'bridge' | 'high' | 'custom';
const ROLES: { id: Role; label: string; color: string }[] = [
  { id: 'low', label: 'Low part', color: '#60a5fa' },
  { id: 'bridge', label: 'Bridge / middle', color: '#a78bfa' },
  { id: 'high', label: 'High part', color: '#f472b6' },
  { id: 'custom', label: 'Custom', color: '#fbbf24' },
];
const roleOf = (r: Role) => ROLES.find((x) => x.id === r)!;

interface Clip {
  id: string;
  name: string;
  buffer: AudioBuffer;
  an: Analysis;
  bpmMul: 0.5 | 1 | 2;
  role: Role;
  label: string;
  start: number;
  end: number;
  markers: number[];
  included: boolean;
}

type FadeChoice = 'auto' | 0 | 1 | 2 | 4 | 8 | 16;
const ACCENT = '#c084fc';
const TARGET_LUFS = -14;
const MAX_SECONDS = 20 * 60;

const bpmOf = (c: Clip) => c.an.bpm * c.bpmMul;
const beatLen = (c: Clip) => 60 / bpmOf(c);
const beatsOf = (c: Clip) => { const out: number[] = []; const b = beatLen(c); let t = c.an.firstBeat % b; while (t < c.buffer.duration) { out.push(t); t += b; } return out; };
const nearestBeat = (c: Clip, t: number, every = 1) => { const b = beatLen(c) * every; const k = Math.round((t - c.an.firstBeat) / b); return Math.min(c.buffer.duration, Math.max(0, c.an.firstBeat + k * b)); };

/** Same tempo family (allowing half/double time), as a fraction apart. */
function tempoGap(a: number, b: number) {
  let r = b / a;
  while (r > 1.5) r /= 2;
  while (r < 0.75) r *= 2;
  return Math.abs(1 - r);
}
/** "AI" blend length in beats: long, smooth blends when the tempos agree; short ones when they don't. */
const autoBeats = (a: Clip, b: Clip) => { const gap = tempoGap(bpmOf(a), bpmOf(b)); return gap <= 0.03 ? 8 : gap <= 0.08 ? 4 : 2; };

const btn = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-40';
const ghost = `${btn} text-neutral-300 ring-white/10 hover:bg-white/10 hover:text-white`;
const chip = (on: boolean) => `${btn} h-8 px-2.5 text-xs ${on ? 'bg-white/10 text-white ring-white/30' : 'text-neutral-400 ring-white/10 hover:text-white'}`;

/** One shared audio output: plays a buffer (a clip or the mix) and reports where the playhead is. */
function usePlayer() {
  const [play, setPlay] = useState<{ what: string; t: number } | null>(null); // what = clip id or 'mix'
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const clockRef = useRef<{ what: string; ctxStart: number; offset: number; until: number } | null>(null);
  const audio = useCallback(() => (ctxRef.current ??= new AudioContext()), []);
  const stop = useCallback(() => {
    try { srcRef.current?.stop(); } catch {}
    srcRef.current = null;
    clockRef.current = null;
    setPlay(null);
  }, []);
  const startPlayback = useCallback((buffer: AudioBuffer, what: string, from: number, to = buffer.duration) => {
    stop();
    const ctx = audio();
    void ctx.resume();
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.connect(ctx.destination);
    s.start(0, from, Math.max(0.01, to - from));
    s.onended = () => { if (srcRef.current === s) stop(); };
    srcRef.current = s;
    clockRef.current = { what, ctxStart: ctx.currentTime, offset: from, until: to };
    setPlay({ what, t: from });
  }, [audio, stop]);
  const playing = play?.what;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const c = clockRef.current;
      if (!c || !ctxRef.current) return;
      setPlay({ what: c.what, t: Math.min(c.until, c.offset + ctxRef.current.currentTime - c.ctxStart) });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  useEffect(() => () => { stop(); void ctxRef.current?.close(); }, [stop]);
  return { play, startPlayback, stop, audio };
}

export function RemixStudio() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [fades, setFades] = useState<Record<string, FadeChoice>>({}); // key: `${aId}>${bId}`
  const [snap, setSnap] = useState(true);
  const [normalize, setNormalize] = useState(true);
  const [bassSwap, setBassSwap] = useState(true);
  const [limiter, setLimiter] = useState(true);
  const [fadeOutEnd, setFadeOutEnd] = useState(3);
  const [mix, setMix] = useState<{ buffer: AudioBuffer; places: Placement[]; ids: string[]; reduction: number; gains: number[] } | null>(null);
  const [dirty, setDirty] = useState(true);
  const [note, setNote] = useState<string>();
  const [exporting, setExporting] = useState<string>();
  const [dragId, setDragId] = useState<string>();
  const { play, startPlayback, stop, audio } = usePlayer();
  const touch = () => { setDirty(true); };
  const update = (id: string, patch: Partial<Clip>) => { setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c))); touch(); };

  const seq = useMemo(() => clips.filter((c) => c.included), [clips]);
  const fadeKey = (a: Clip, b: Clip) => `${a.id}>${b.id}`;
  const fadeBeats = useCallback((a: Clip, b: Clip) => { const f = fades[`${a.id}>${b.id}`] ?? 'auto'; return f === 'auto' ? autoBeats(a, b) : f; }, [fades]);
  const fadeSeconds = useCallback((a: Clip, b: Clip) => {
    const beats = fadeBeats(a, b);
    return Math.min(beats * beatLen(a), (a.end - a.start) / 2, (b.end - b.start) / 2);
  }, [fadeBeats]);
  const plan = useMemo(() => layout({ clips: seq.map((c) => ({ buffer: c.buffer, start: c.start, end: c.end, gainDb: 0 })), fades: seq.slice(1).map((b, i) => fadeSeconds(seq[i], b)) }), [seq, fadeSeconds]);

  // ---------------------------------------------------------------- upload
  const addFiles = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => /audio\/|\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(f.type + f.name));
    if (!list.length) return setError('Please choose WAV or MP3 files.');
    setError(undefined);
    for (const f of list) {
      setBusy(`Reading “${f.name}” and finding its tempo…`);
      try {
        const buffer = await audio().decodeAudioData(await f.arrayBuffer());
        if (buffer.duration > MAX_SECONDS) { setError(`“${f.name}” is longer than 20 minutes — trim it first.`); continue; }
        await new Promise((r) => setTimeout(r, 20)); // let the status paint before the analysis
        const an = analyse(buffer);
        setClips((cs) => {
          const role: Role = cs.length === 0 ? 'low' : cs.length === 1 ? 'high' : 'bridge';
          const start = an.confidence > 0 ? Math.max(0, an.firstBeat) : 0;
          return [...cs, { id: Math.random().toString(36).slice(2, 9), name: f.name.replace(/\.[^.]+$/, ''), buffer, an, bpmMul: 1, role, label: '', start, end: buffer.duration, markers: [], included: true }];
        });
        touch();
      } catch {
        setError(`“${f.name}” couldn’t be read. Try a standard WAV or MP3.`);
      }
    }
    setBusy(undefined);
  };

  // ---------------------------------------------------------------- order
  const applyTemplate = (order: Role[]) => {
    setClips((cs) => {
      const picked: Clip[] = [];
      for (const r of order) { const c = cs.find((x) => x.role === r && !picked.includes(x)); if (c) picked.push(c); }
      const rest = cs.filter((c) => !picked.includes(c)).map((c) => ({ ...c, included: false }));
      return [...picked.map((c) => ({ ...c, included: true })), ...rest];
    });
    touch();
  };
  const move = (id: string, d: -1 | 1) => { setClips((cs) => { const i = cs.findIndex((c) => c.id === id); const j = i + d; if (j < 0 || j >= cs.length) return cs; const n = [...cs]; [n[i], n[j]] = [n[j], n[i]]; return n; }); touch(); };
  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setClips((cs) => { const from = cs.findIndex((c) => c.id === dragId); const to = cs.findIndex((c) => c.id === targetId); const n = [...cs]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; });
    touch();
  };

  // ---------------------------------------------------------------- AI auto-blend
  const autoBlend = () => {
    setClips((cs) => cs.map((c) => {
      if (!c.included) return c;
      const start = nearestBeat(c, c.start);
      let end = nearestBeat(c, c.end, 4); // leave on a bar line
      if (end <= start + beatLen(c) * 4) end = nearestBeat(c, c.end);
      if (end > c.buffer.duration) end -= beatLen(c) * 4;
      return { ...c, start, end: Math.max(start + 1, end) };
    }));
    setFades({});
    setNormalize(true);
    setBassSwap(true);
    setLimiter(true);
    touch();
    setNote('Auto-blend snapped every in-point to a beat and every out-point to a bar line, chose blend lengths from how closely the tempos match, matched loudness and turned on the limiter.');
  };

  // ---------------------------------------------------------------- build mix
  const build = async () => {
    if (!seq.length) return null;
    setBusy('Building the mix…');
    await new Promise((r) => setTimeout(r, 20));
    try {
      const gains = seq.map((c) => (normalize ? Math.max(-12, Math.min(12, TARGET_LUFS - loudness(c.buffer, c.start, c.end))) : 0));
      const fadesS = seq.slice(1).map((b, i) => fadeSeconds(seq[i], b));
      const { buffer, reductionDb } = await renderMix({ clips: seq.map((c, i) => ({ buffer: c.buffer, start: c.start, end: c.end, gainDb: gains[i] })), fades: fadesS, bassSwap, fadeOutEnd, limiter });
      const m = { buffer, places: layout({ clips: seq.map((c) => ({ buffer: c.buffer, start: c.start, end: c.end, gainDb: 0 })), fades: fadesS }).places, ids: seq.map((c) => c.id), reduction: reductionDb, gains };
      setMix(m);
      setDirty(false);
      return m;
    } catch (e) {
      setError(e instanceof Error ? `Couldn’t build the mix: ${e.message}` : 'Couldn’t build the mix.');
      return null;
    } finally {
      setBusy(undefined);
    }
  };
  const playMix = async (from = 0) => {
    if (play?.what === 'mix') return stop();
    const m = dirty || !mix ? await build() : mix;
    if (m) startPlayback(m.buffer, 'mix', from);
  };
  const previewTransition = async (i: number) => {
    const m = dirty || !mix ? await build() : mix;
    if (!m) return;
    const boundary = m.places[i + 1].at;
    startPlayback(m.buffer, 'mix', Math.max(0, boundary - 6), Math.min(m.buffer.duration, boundary + fadeSeconds(seq[i], seq[i + 1]) + 6));
  };

  const exportAs = async (kind: 'wav' | 'mp3') => {
    const m = dirty || !mix ? await build() : mix;
    if (!m) return;
    setExporting(kind);
    try {
      const L = m.buffer.getChannelData(0);
      const R = m.buffer.numberOfChannels > 1 ? m.buffer.getChannelData(1) : L;
      let blob: Blob;
      if (kind === 'wav') blob = encodeWav(L, R, m.buffer.sampleRate);
      else {
        blob = await new Promise<Blob>((resolve, reject) => {
          const w = new Worker(new URL('./mp3.worker.ts', import.meta.url), { type: 'module' });
          w.onmessage = (e: MessageEvent<Mp3Out>) => {
            if (e.data.type === 'done') { resolve(new Blob([e.data.buffer], { type: 'audio/mpeg' })); w.terminate(); }
            else if (e.data.type === 'error') { reject(new Error(e.data.message)); w.terminate(); }
          };
          const msg: Mp3In = { left: L.slice(), right: R.slice(), sampleRate: m.buffer.sampleRate, kbps: 320 };
          w.postMessage(msg, [msg.left.buffer, msg.right.buffer]);
        });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wedding-intro-mix.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      setNote(`Saved ${kind.toUpperCase()} — ${fmtTime(m.buffer.duration)} long, ${(blob.size / 1048576).toFixed(1)} MB.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(undefined);
    }
  };

  // ---------------------------------------------------------------- UI
  const total = plan.total;
  const mixPos = play?.what === 'mix' ? play.t : null;

  return (
    <div className="space-y-6">
      {/* upload */}
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files); }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-white/15 bg-neutral-900/50 px-6 py-8 text-center transition hover:border-[#c084fc]/60 hover:bg-neutral-900/80"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl text-neutral-950" style={{ background: ACCENT }}><Upload className="size-6" /></span>
        <span className="font-semibold text-white">{clips.length ? 'Add more songs' : 'Drop your songs here'}</span>
        <span className="text-sm text-neutral-400">WAV or MP3 · everything stays on your device</span>
        <input type="file" accept="audio/*,.wav,.mp3" multiple className="sr-only" onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ''; }} />
      </label>
      {busy && <p className="flex items-center gap-2 text-sm text-neutral-300" role="status"><LoaderCircle className="size-4 animate-spin" /> {busy}</p>}
      {error && <p role="alert" className="flex items-start justify-between gap-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">{error}<button type="button" aria-label="Dismiss" onClick={() => setError(undefined)}><X className="size-4" /></button></p>}

      {clips.length > 0 && (
        <>
          {/* sequence controls */}
          <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-neutral-900/70 p-3 ring-1 ring-white/10">
            <span className="px-1 text-xs font-medium uppercase tracking-wider text-neutral-400">Order</span>
            <button type="button" className={ghost} onClick={() => applyTemplate(['low', 'high'])}>Low → High</button>
            <button type="button" className={ghost} onClick={() => applyTemplate(['low', 'bridge', 'high'])}>Low → Bridge → High</button>
            <span className="text-xs text-neutral-500">or drag to any order</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => setSnap(!snap)} aria-pressed={snap} className={chip(snap)}><Magnet className="size-3.5" /> Snap to beat</button>
              <button type="button" onClick={autoBlend} className={`${btn} bg-[#c084fc] text-neutral-950 ring-[#c084fc] hover:brightness-110`}><Sparkles className="size-4" /> AI auto-blend</button>
            </div>
          </div>

          {/* clips + transitions */}
          <ol className="space-y-3">
            {clips.map((c, idx) => {
              const r = roleOf(c.role);
              const seqIdx = seq.indexOf(c);
              const next = seqIdx >= 0 ? seq[seqIdx + 1] : undefined;
              const pos = play?.what === c.id ? play.t : null;
              const beats = beatsOf(c);
              const nudge = (which: 'start' | 'end', d: number) => {
                const v = Math.min(c.buffer.duration, Math.max(0, c[which] + d));
                update(c.id, which === 'start' ? { start: Math.min(v, c.end - 0.25) } : { end: Math.max(v, c.start + 0.25) });
              };
              return (
                <li key={c.id}>
                  <div
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={() => { dropOn(c.id); setDragId(undefined); }}
                    className={`rounded-3xl bg-neutral-900/70 p-4 ring-1 transition ${c.included ? 'ring-white/10' : 'opacity-50 ring-white/5'} ${dragId === c.id ? 'ring-[#c084fc]' : ''}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span draggable onDragStart={() => setDragId(c.id)} onDragEnd={() => setDragId(undefined)} className="cursor-grab text-neutral-500 active:cursor-grabbing" title="Drag to reorder"><GripVertical className="size-5" /></span>
                      <span className="size-2.5 rounded-full" style={{ background: r.color }} />
                      <span className="min-w-[9rem] flex-1 truncate font-semibold text-white" title={c.name}>{c.name}</span>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-xs text-neutral-300 ring-1 ring-white/10" title={`Tempo detected from the audio (confidence ${Math.round(c.an.confidence * 100)}%)`}>{bpmOf(c).toFixed(1)} BPM</span>
                      <button type="button" onClick={() => update(c.id, { bpmMul: c.bpmMul === 2 ? 1 : 2 })} className={chip(c.bpmMul === 2)} title="Tempo is really double">×2</button>
                      <button type="button" onClick={() => update(c.id, { bpmMul: c.bpmMul === 0.5 ? 1 : 0.5 })} className={chip(c.bpmMul === 0.5)} title="Tempo is really half">÷2</button>
                      <button type="button" aria-label="Move up" onClick={() => move(c.id, -1)} disabled={idx === 0} className={`${ghost} h-8 w-8 px-0`}><ArrowUp className="size-4" /></button>
                      <button type="button" aria-label="Move down" onClick={() => move(c.id, 1)} disabled={idx === clips.length - 1} className={`${ghost} h-8 w-8 px-0`}><ArrowDown className="size-4" /></button>
                      <button type="button" aria-label={`Remove ${c.name}`} onClick={() => { setClips((cs) => cs.filter((x) => x.id !== c.id)); touch(); }} className={`${ghost} h-8 w-8 px-0`}><Trash2 className="size-4" /></button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {ROLES.map((x) => <button key={x.id} type="button" onClick={() => update(c.id, { role: x.id })} aria-pressed={c.role === x.id} className={chip(c.role === x.id)} style={c.role === x.id ? { color: x.color } : undefined}>{x.label}</button>)}
                      {c.role === 'custom' && <input value={c.label} onChange={(e) => update(c.id, { label: e.target.value.slice(0, 30) })} placeholder="Name this part" className="h-8 w-36 rounded-xl bg-neutral-950 px-2.5 text-xs text-white ring-1 ring-white/15 outline-none focus:ring-[#c084fc]" />}
                      <button type="button" onClick={() => update(c.id, { included: !c.included })} aria-pressed={c.included} className={`${chip(c.included)} ml-auto`}>{c.included ? 'In the mix' : 'Left out'}</button>
                    </div>
                    <div className="mt-3">
                      <Waveform
                        peaks={c.an.peaks} duration={c.buffer.duration} start={c.start} end={c.end} color={r.color}
                        beats={beats} markers={c.markers} playhead={pos} snap={snap}
                        onTrim={(s, e) => update(c.id, { start: s, end: e })} onTrimEnd={() => {}}
                        onSeek={(t) => startPlayback(c.buffer, c.id, t, c.end > t ? c.end : c.buffer.duration)}
                      />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      {(['start', 'end'] as const).map((w) => (
                        <div key={w} className="flex flex-wrap items-center gap-1.5">
                          <span className="w-8 font-medium text-neutral-400">{w === 'start' ? 'In' : 'Out'}</span>
                          <span className="w-16 font-mono text-white">{fmtTime(c[w])}</span>
                          <button type="button" className={`${ghost} h-7 px-2 text-xs`} onClick={() => nudge(w, -beatLen(c))} aria-label={`${w} back one beat`}>−beat</button>
                          <button type="button" className={`${ghost} h-7 px-2 text-xs`} onClick={() => nudge(w, -0.01)} aria-label={`${w} back 10 ms`}>−.01</button>
                          <button type="button" className={`${ghost} h-7 px-2 text-xs`} onClick={() => nudge(w, 0.01)} aria-label={`${w} forward 10 ms`}>+.01</button>
                          <button type="button" className={`${ghost} h-7 px-2 text-xs`} onClick={() => nudge(w, beatLen(c))} aria-label={`${w} forward one beat`}>+beat</button>
                          {pos !== null && <button type="button" className={`${ghost} h-7 px-2 text-xs`} onClick={() => update(c.id, w === 'start' ? { start: Math.min(pos, c.end - 0.25) } : { end: Math.max(pos, c.start + 0.25) })}>Set at playhead</button>}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" className={ghost} onClick={() => (pos !== null ? stop() : startPlayback(c.buffer, c.id, c.start, c.end))}>{pos !== null ? <Pause className="size-4" /> : <Play className="size-4" />} {pos !== null ? 'Stop' : 'Play selection'}</button>
                      <button type="button" className={ghost} disabled={pos === null} onClick={() => pos !== null && update(c.id, { markers: [...c.markers, pos].sort((a, b) => a - b) })}><Plus className="size-4" /> Cut marker</button>
                      {c.markers.map((m, mi) => (
                        <span key={mi} className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 py-0.5 pl-2.5 pr-1 font-mono text-[11px] text-amber-200 ring-1 ring-amber-400/30">
                          <button type="button" onClick={() => startPlayback(c.buffer, c.id, m)}>{fmtTime(m)}</button>
                          <button type="button" aria-label="Remove marker" onClick={() => update(c.id, { markers: c.markers.filter((_, k) => k !== mi) })} className="rounded-full p-0.5 hover:bg-white/10"><X className="size-3" /></button>
                        </span>
                      ))}
                      <span className="ml-auto text-xs text-neutral-500">Selection {fmtTime(c.end - c.start)} · click the wave to listen · drag the white handles to trim</span>
                    </div>
                  </div>
                  {c.included && next && (() => {
                    const k = fadeKey(c, next);
                    const choice = fades[k] ?? 'auto';
                    const beatsN = fadeBeats(c, next);
                    const secs = fadeSeconds(c, next);
                    const gap = tempoGap(bpmOf(c), bpmOf(next));
                    return (
                      <div className="mx-4 flex flex-wrap items-center gap-2 border-l-2 border-dashed border-[#c084fc]/40 py-3 pl-4 text-xs">
                        <AudioWaveform className="size-4 text-[#c084fc]" />
                        <span className="text-neutral-300">{beatsN === 0 ? 'Hard cut' : `Blend ${beatsN} beat${beatsN === 1 ? '' : 's'} (${secs.toFixed(1)} s)`}{bassSwap && beatsN >= 2 ? ' · bass swap' : ''} · tempos {gap < 0.005 ? 'match' : `${(gap * 100).toFixed(1)}% apart`}</span>
                        <select value={String(choice)} onChange={(e) => { setFades({ ...fades, [k]: e.target.value === 'auto' ? 'auto' : (Number(e.target.value) as FadeChoice) }); touch(); }} className="h-7 rounded-lg bg-neutral-950 px-2 text-xs text-white ring-1 ring-white/15" aria-label="Blend length">
                          <option value="auto">AI ({autoBeats(c, next)} beats)</option>
                          {[0, 1, 2, 4, 8, 16].map((n) => <option key={n} value={n}>{n === 0 ? 'Hard cut' : `${n} beats`}</option>)}
                        </select>
                        <button type="button" className={`${ghost} h-7 px-2 text-xs`} onClick={() => void previewTransition(seq.indexOf(c))}><Play className="size-3.5" /> Hear this transition</button>
                      </div>
                    );
                  })()}
                </li>
              );
            })}
          </ol>

          {/* master */}
          <section className="rounded-3xl bg-neutral-900/70 p-4 ring-1 ring-white/10 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-sm font-semibold uppercase tracking-[0.2em] text-[#c084fc]">Master</h2>
              <button type="button" onClick={() => { setNormalize(!normalize); touch(); }} aria-pressed={normalize} className={chip(normalize)} title={`Match every part to ${TARGET_LUFS} LUFS`}>Match loudness</button>
              <button type="button" onClick={() => { setBassSwap(!bassSwap); touch(); }} aria-pressed={bassSwap} className={chip(bassSwap)}>Bass swap</button>
              <button type="button" onClick={() => { setLimiter(!limiter); touch(); }} aria-pressed={limiter} className={chip(limiter)}>Peak limiter</button>
              <label className="flex items-center gap-1.5 text-xs text-neutral-400">Fade-out
                <select value={fadeOutEnd} onChange={(e) => { setFadeOutEnd(Number(e.target.value)); touch(); }} className="h-8 rounded-lg bg-neutral-950 px-2 text-xs text-white ring-1 ring-white/15">
                  {[0, 1, 2, 3, 5, 8].map((n) => <option key={n} value={n}>{n ? `${n} s` : 'None'}</option>)}
                </select>
              </label>
            </div>
            {/* overview */}
            <div
              className="relative mt-4 h-14 cursor-pointer overflow-hidden rounded-xl bg-neutral-950/80 ring-1 ring-white/10"
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); void playMix(((e.clientX - r.left) / r.width) * (mix && !dirty ? mix.buffer.duration : total)); }}
              role="img" aria-label="Mix timeline — click to play from there"
            >
              {seq.map((c, i) => {
                const p = plan.places[i];
                if (!p || !total) return null;
                return (
                  <div key={c.id} className="absolute inset-y-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-neutral-950" style={{ left: `${(p.at / total) * 100}%`, width: `${(p.dur / total) * 100}%`, background: `linear-gradient(90deg, ${roleOf(c.role).color}${i ? '66' : 'ff'}, ${roleOf(c.role).color} ${i ? '12%' : '0%'}, ${roleOf(c.role).color} 88%, ${roleOf(c.role).color}${i < seq.length - 1 ? '66' : 'ff'})`, zIndex: i }}>
                    <span className="block truncate">{c.role === 'custom' ? c.label || 'Custom' : roleOf(c.role).label}</span>
                  </div>
                );
              })}
              {mixPos !== null && total > 0 && <div className="absolute inset-y-0 z-50 w-0.5 bg-cyan-300" style={{ left: `${(mixPos / (mix?.buffer.duration || total)) * 100}%` }} />}
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-neutral-500">
              <span>{seq.length} part{seq.length === 1 ? '' : 's'} · {fmtTime(total)}</span>
              {mix && !dirty && <span>{normalize ? `Loudness matched to ${TARGET_LUFS} LUFS` : 'Original levels'}{limiter ? ` · limiter ${mix.reduction < -0.1 ? `caught peaks (${mix.reduction.toFixed(1)} dB)` : 'idle — no peaks over −1 dB'}` : ''}</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={!seq.length || Boolean(busy)} onClick={() => void playMix(0)} className={`${btn} h-11 bg-white px-5 text-neutral-950 ring-white hover:bg-neutral-200`}>
                {play?.what === 'mix' ? <Pause className="size-4" /> : <Play className="size-4" />} {play?.what === 'mix' ? 'Stop' : 'Play the mix'}
              </button>
              <button type="button" disabled={!seq.length || Boolean(exporting) || Boolean(busy)} onClick={() => void exportAs('mp3')} className={`${btn} h-11 bg-[#c084fc] px-5 text-neutral-950 ring-[#c084fc] hover:brightness-110`}>
                {exporting === 'mp3' ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} Export MP3 (320 kbps)
              </button>
              <button type="button" disabled={!seq.length || Boolean(exporting) || Boolean(busy)} onClick={() => void exportAs('wav')} className={`${btn} h-11 px-5 text-white ring-white/20 hover:bg-white/10`}>
                {exporting === 'wav' ? <LoaderCircle className="size-4 animate-spin" /> : <FileAudio className="size-4" />} Export WAV
              </button>
            </div>
            {note && <p className="mt-3 text-sm text-neutral-400" role="status">{note}</p>}
          </section>
        </>
      )}
    </div>
  );
}
