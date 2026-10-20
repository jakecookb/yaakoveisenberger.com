'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AudioLines, Check, Download, FileAudio, Loader2, Lock, Mic2, Music2, Sparkles, Upload, X } from 'lucide-react';
import { MODES, SAMPLE_RATE, type ModeId } from '@/lib/separator/models';
import { stereoWidth } from '@/lib/separator/quick';
import { encodeWav } from '@/lib/separator/wav';
import type { FromWorker, ToWorker } from './protocol';

// What this browser can do. The server (and the first client render) assume the minimum, then it updates, so the HTML always matches.
interface Caps { threads: number; isolated: boolean; hasGpu: boolean }
const SERVER_CAPS: Caps = { threads: 1, isolated: false, hasGpu: false };
let clientCaps: Caps | undefined;
const getCaps = (): Caps => {
  if (!clientCaps) {
    const isolated = window.crossOriginIsolated === true;
    clientCaps = { isolated, threads: isolated ? Math.max(1, Math.min(navigator.hardwareConcurrency || 2, 8)) : 1, hasGpu: 'gpu' in navigator };
  }
  return clientCaps;
};
const noopSubscribe = () => () => {};

const MAX_MINUTES = 15;
const MAX_BYTES = 120 * 1024 * 1024;

interface Decoded { left: Float32Array; right: Float32Array; seconds: number; name: string }
interface Stem { url: string; left: Float32Array; right: Float32Array }
interface Results { vocals: Stem; instrumental: Stem; backend: string }
type Phase = 'idle' | 'decoding' | 'running' | 'done';

const fmtTime = (s: number) => (s < 90 ? `${Math.max(1, Math.round(s))} sec` : `${Math.round(s / 60)} min`);
const baseName = (n: string) => n.replace(/\.[^.]+$/, '') || 'song';

/** Rough speed on this device: a 5.9 s chunk takes ~17 s with 4 CPU threads, ~50 s with 1. */
function estimateSeconds(mode: ModeId, seconds: number, threads: number, gpu: boolean) {
  if (mode === 'quick') return Math.max(2, seconds / 20);
  if (gpu) return seconds * 0.7 + 20;
  const ratio = threads >= 4 ? 3 : threads >= 2 ? 5 : 8.5;
  return seconds * ratio + 25;
}

export function SeparatorTool() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [audio, setAudio] = useState<Decoded>();
  const [mode, setMode] = useState<ModeId>('vocals');
  const [scope, setScope] = useState<'full' | 'sample'>('full');
  const [gpu, setGpu] = useState(false);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState('');
  const [download, setDownload] = useState<{ loaded: number; total: number }>();
  const [progress, setProgress] = useState<{ chunk: number; chunks: number; startedAt: number }>();
  const [results, setResults] = useState<Results>();
  const [mp3, setMp3] = useState<Partial<Record<'vocals' | 'instrumental', string | 'busy'>>>({});
  const [dragging, setDragging] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const worker = useRef<Worker | null>(null);
  const urls = useRef<string[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const caps = useSyncExternalStore(noopSubscribe, getCaps, () => SERVER_CAPS);

  // Multi-threaded WebAssembly needs the page to be cross-origin isolated, which the browser only applies on a full page
  // load. If we got here by in-app navigation (so we're not isolated), reload once. After a reload that still isn't isolated
  // (an unsupported browser) we stop and simply run on one thread.
  useEffect(() => {
    if (window.crossOriginIsolated) return;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type !== 'reload') window.location.reload();
  }, []);

  const revokeAll = useCallback(() => { urls.current.forEach(URL.revokeObjectURL); urls.current = []; }, []);
  useEffect(() => () => { worker.current?.terminate(); revokeAll(); }, [revokeAll]);
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const seconds = audio ? (scope === 'sample' ? Math.min(30, audio.seconds) : audio.seconds) : 0;
  const mono = audio ? stereoWidth(audio.left, audio.right) < 0.0005 : false;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(undefined); setResults(undefined); setMp3({}); revokeAll();
    if (file.size > MAX_BYTES) return setError(`That file is larger than ${Math.round(MAX_BYTES / 1048576)} MB. Try a shorter or smaller version.`);
    setPhase('decoding');
    try {
      const ctx = new OfflineAudioContext(2, SAMPLE_RATE, SAMPLE_RATE);
      const buf = await ctx.decodeAudioData(await file.arrayBuffer());
      if (buf.duration > MAX_MINUTES * 60) throw new Error(`That song is ${Math.round(buf.duration / 60)} minutes long. The limit is ${MAX_MINUTES} minutes.`);
      const left = buf.getChannelData(0).slice();
      const right = (buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)).slice();
      setAudio({ left, right, seconds: buf.duration, name: file.name });
      setPhase('idle');
    } catch (e) {
      setAudio(undefined);
      setPhase('idle');
      setError(e instanceof Error && /minutes long/.test(e.message) ? e.message : 'Could not read that file. Please use an MP3 or WAV song.');
    }
  }

  function start() {
    if (!audio) return;
    setError(undefined); setResults(undefined); setMp3({}); revokeAll();
    setProgress(undefined); setDownload(undefined); setStatus('Getting ready…'); setNow(Date.now());
    setPhase('running');
    const n = Math.min(audio.left.length, scope === 'sample' ? 30 * SAMPLE_RATE : audio.left.length);
    const left = audio.left.slice(0, n), right = audio.right.slice(0, n);
    const w = new Worker(new URL('./separator.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === 'status') { setStatus(m.text); if (m.text.startsWith('Starting') || m.text.startsWith('Loading') || m.text.startsWith('Finishing')) setDownload(undefined); }
      else if (m.type === 'download') setDownload({ loaded: m.loaded, total: m.total });
      else if (m.type === 'progress') { setDownload(undefined); setStatus(`Separating on your ${m.backend}`); setProgress({ chunk: m.chunk, chunks: m.chunks, startedAt: m.startedAt }); }
      else if (m.type === 'done') {
        const mk = ([l, r]: [Float32Array, Float32Array]): Stem => { const url = URL.createObjectURL(encodeWav(l, r, SAMPLE_RATE)); urls.current.push(url); return { url, left: l, right: r }; };
        setResults({ vocals: mk(m.vocals), instrumental: mk(m.instrumental), backend: m.backend });
        setPhase('done');
        w.terminate(); worker.current = null;
      } else if (m.type === 'error') {
        if (m.message !== 'cancelled') setError(m.message);
        setPhase('idle');
        w.terminate(); worker.current = null;
      }
    };
    w.onerror = () => { setError('Something went wrong while separating. Please try again.'); setPhase('idle'); w.terminate(); worker.current = null; };
    const req: ToWorker = { type: 'separate', mode, left, right, sampleRate: SAMPLE_RATE, gpu: gpu && caps.hasGpu, threads: caps.threads };
    w.postMessage(req, [left.buffer, right.buffer]);
  }

  function cancel() {
    worker.current?.postMessage({ type: 'cancel' } satisfies ToWorker);
    setTimeout(() => { worker.current?.terminate(); worker.current = null; setPhase('idle'); }, 400);
  }

  function makeMp3(which: 'vocals' | 'instrumental') {
    if (!results) return;
    // The separation worker has already finished; MP3 encoding gets its own short-lived worker.
    const w = new Worker(new URL('./separator.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === 'mp3') {
        const url = URL.createObjectURL(new Blob([m.buffer], { type: 'audio/mpeg' }));
        urls.current.push(url);
        setMp3((p) => ({ ...p, [which]: url }));
      } else if (m.type === 'error') {
        setError(m.message);
        setMp3((p) => ({ ...p, [which]: undefined }));
      }
      w.terminate();
    };
    setMp3((p) => ({ ...p, [which]: 'busy' }));
    const s = results[which];
    w.postMessage({ type: 'mp3', left: s.left.slice(), right: s.right.slice(), sampleRate: SAMPLE_RATE, kbps: 320 } satisfies ToWorker);
  }

  function reset() {
    worker.current?.terminate(); worker.current = null;
    revokeAll(); setResults(undefined); setMp3({}); setAudio(undefined); setError(undefined); setPhase('idle');
    if (input.current) input.current.value = '';
  }

  const eta = (() => {
    if (!progress || progress.chunk < 1) return undefined;
    const per = (now - progress.startedAt) / progress.chunk;
    return (per * (progress.chunks - progress.chunk)) / 1000;
  })();
  const pct = progress ? Math.round((progress.chunk / progress.chunks) * 100) : 0;
  const busy = phase === 'running' || phase === 'decoding';
  const card = 'rounded-3xl bg-neutral-900/70 ring-1 ring-white/10';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 text-left">
      {/* 1 · the song */}
      <section className={`${card} p-5 sm:p-7`} aria-labelledby="step-song">
        <h2 id="step-song" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#c8a96a]"><span className="grid size-6 place-items-center rounded-full bg-[#c8a96a] text-xs text-neutral-950">1</span> Your song</h2>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) void pick(e.dataTransfer.files[0]); }}
          className={`mt-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? 'border-[#c8a96a] bg-[#c8a96a]/10' : 'border-white/15 hover:border-white/30'}`}
        >
          {audio ? (
            <>
              <FileAudio className="size-8 text-[#c8a96a]" aria-hidden />
              <p className="font-medium text-white">{audio.name}</p>
              <p className="text-sm text-neutral-400">{fmtTime(audio.seconds)} long{mono ? ' · mono' : ''}</p>
            </>
          ) : (
            <>
              <Upload className="size-8 text-neutral-400" aria-hidden />
              <p className="font-medium text-white">Drop an MP3 or WAV here</p>
              <p className="text-sm text-neutral-400">or choose a file from your device · up to {MAX_MINUTES} minutes</p>
            </>
          )}
          <label className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            {phase === 'decoding' ? <><Loader2 className="size-4 animate-spin" /> Reading…</> : audio ? 'Choose a different song' : 'Choose a song'}
            <input ref={input} id="song-file" type="file" accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav,audio/*" className="sr-only" disabled={busy} onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-neutral-500"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Your song never leaves your device. Everything happens right here in your browser. Please only use music you have the right to use.</p>
      </section>

      {/* 2 · the quality */}
      <section className={`${card} p-5 sm:p-7`} aria-labelledby="step-quality">
        <h2 id="step-quality" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#c8a96a]"><span className="grid size-6 place-items-center rounded-full bg-[#c8a96a] text-xs text-neutral-950">2</span> Pick the quality</h2>
        <div role="radiogroup" aria-labelledby="step-quality" className="mt-4 space-y-3">
          {MODES.map((m) => {
            const on = mode === m.id;
            const est = audio ? estimateSeconds(m.id, seconds, caps.threads, gpu && caps.hasGpu) : undefined;
            return (
              <label key={m.id} className={`block cursor-pointer rounded-2xl p-4 ring-1 transition ${on ? 'bg-[#c8a96a]/10 ring-[#c8a96a]' : 'bg-white/[0.03] ring-white/10 hover:ring-white/25'} ${busy ? 'pointer-events-none opacity-60' : ''}`}>
                <input type="radio" name="mode" value={m.id} checked={on} onChange={() => setMode(m.id)} className="sr-only" />
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`grid size-5 place-items-center rounded-full ring-1 ${on ? 'bg-[#c8a96a] text-neutral-950 ring-[#c8a96a]' : 'ring-white/30'}`}>{on && <Check className="size-3.5" />}</span>
                  <span className="font-semibold text-white">{m.name}</span>
                  {m.recommended && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">Recommended</span>}
                  {est !== undefined && <span className="ml-auto text-xs text-neutral-400">≈ {fmtTime(est)} for this song</span>}
                </span>
                <span className="mt-1 block pl-8 text-sm text-neutral-300">{m.tagline}</span>
                <ul className="mt-2 list-disc space-y-1 pl-12 text-xs leading-relaxed text-neutral-400">{m.details.map((d) => <li key={d}>{d}</li>)}</ul>
              </label>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="text-xs font-medium uppercase tracking-wider text-neutral-500">How much of the song</legend>
            {([['full', 'The whole song'], ['sample', 'Just the first 30 seconds (a quick test)']] as const).map(([v, l]) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-200"><input type="radio" name="scope" checked={scope === v} onChange={() => setScope(v)} className="accent-[#c8a96a]" /> {l}</label>
            ))}
          </fieldset>
          {mode !== 'quick' && caps.hasGpu && (
            <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-200">
              <input type="checkbox" checked={gpu} onChange={(e) => setGpu(e.target.checked)} disabled={busy} className="mt-1 accent-[#c8a96a]" />
              <span>Use my graphics card <span className="block text-xs text-neutral-500">Much faster on supported devices (Chrome/Edge). Experimental; it switches back to the processor by itself if anything looks wrong.</span></span>
            </label>
          )}
        </div>

        {mode !== 'quick' && !caps.isolated && <p className="mt-4 rounded-xl bg-amber-400/10 p-3 text-xs text-amber-200 ring-1 ring-amber-400/30">This browser is running in single-processor mode, so the AI options will be slower than the estimates (try a recent Chrome, Edge or Firefox).</p>}
        {mode === 'quick' && mono && <p className="mt-4 rounded-xl bg-amber-400/10 p-3 text-xs text-amber-200 ring-1 ring-amber-400/30">This song is mono (both sides identical), so the instant preview can’t separate it. Pick one of the AI options.</p>}

        <button onClick={start} disabled={!audio || busy || (mode === 'quick' && mono)} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#c8a96a] font-semibold text-neutral-950 transition hover:bg-[#d8bc82] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-8">
          <Sparkles className="size-4" /> {scope === 'sample' ? 'Separate the first 30 seconds' : 'Separate vocals & instrumental'}
        </button>
      </section>

      {error && <p role="alert" className="rounded-2xl bg-red-400/10 p-4 text-sm text-red-300 ring-1 ring-red-400/30">{error}</p>}

      {/* progress */}
      {phase === 'running' && (
        <section className={`${card} p-5 sm:p-7`} role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-medium text-white"><Loader2 className="size-4 animate-spin text-[#c8a96a]" /> {status}</p>
            <button onClick={cancel} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-neutral-300 ring-1 ring-white/15 hover:bg-white/10"><X className="size-3.5" /> Cancel</button>
          </div>
          {download && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#c8a96a] transition-all" style={{ width: `${Math.round((download.loaded / download.total) * 100)}%` }} /></div>
              <p className="mt-2 text-xs text-neutral-400">{Math.round(download.loaded / 1048576)} of {Math.round(download.total / 1048576)} MB · only needed the first time</p>
            </div>
          )}
          {progress && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[#c8a96a] transition-all" style={{ width: `${pct}%` }} /></div>
              <p className="mt-2 text-xs text-neutral-400">{pct}% · part {Math.min(progress.chunk + 1, progress.chunks)} of {progress.chunks}{eta !== undefined ? ` · about ${fmtTime(eta)} left` : ' · working out the time left…'}</p>
            </div>
          )}
          <p className="mt-4 text-xs text-neutral-500">Keep this tab open. You can switch to another tab, but it may run slower in the background.</p>
        </section>
      )}

      {/* results */}
      {phase === 'done' && results && audio && (
        <section className={`${card} p-5 sm:p-7`} aria-labelledby="step-result">
          <h2 id="step-result" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#c8a96a]"><span className="grid size-6 place-items-center rounded-full bg-emerald-400 text-xs text-neutral-950"><Check className="size-3.5" /></span> Done — {fmtTime(seconds)} separated on your {results.backend}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {([['vocals', 'Vocals', Mic2], ['instrumental', 'Instrumental', Music2]] as const).map(([k, label, Icon]) => (
              <div key={k} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                <p className="flex items-center gap-2 font-semibold text-white"><Icon className="size-4 text-[#c8a96a]" /> {label}</p>
                <audio controls preload="metadata" src={results[k].url} className="mt-3 w-full" aria-label={`${label} preview`} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={results[k].url} download={`${baseName(audio.name)} (${label.toLowerCase()}).wav`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#c8a96a] px-4 text-xs font-semibold text-neutral-950 hover:bg-[#d8bc82]"><Download className="size-3.5" /> WAV (lossless)</a>
                  {typeof mp3[k] === 'string' && mp3[k] !== 'busy' ? (
                    <a href={mp3[k]} download={`${baseName(audio.name)} (${label.toLowerCase()}).mp3`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-4 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"><Download className="size-3.5" /> Download MP3</a>
                  ) : (
                    <button onClick={() => makeMp3(k)} disabled={mp3[k] === 'busy'} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-4 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/15 disabled:opacity-60">{mp3[k] === 'busy' ? <><Loader2 className="size-3.5 animate-spin" /> Making MP3…</> : <><AudioLines className="size-3.5" /> MP3 (320 kbps)</>}</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button onClick={reset} className="mt-5 text-sm text-neutral-400 underline-offset-4 hover:text-white hover:underline">Separate another song</button>
        </section>
      )}
    </div>
  );
}
