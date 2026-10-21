'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, RotateCcw, Square } from 'lucide-react';
import { measureDownload, measurePing, measureUpload, type Live } from '@/lib/speed/measure';

type Phase = 'idle' | 'ping' | 'down' | 'up' | 'done' | 'error';
interface Result { ping?: number; jitter?: number; down?: number; up?: number }

const ACCENT = '#22d3ee';
const fmt = (n?: number) => (n === undefined ? '—' : n >= 100 ? n.toFixed(0) : n.toFixed(1));
const NOTE: Record<Phase, string> = { idle: 'Ready', ping: 'Testing ping…', down: 'Testing download…', up: 'Testing upload…', done: 'Done', error: 'Something went wrong — try again' };

function Gauge({ value, label, active }: { value: number; label: string; active: boolean }) {
  // The arc fills on a log-like scale so both slow and gigabit connections look right.
  const pct = Math.min(1, Math.log10(1 + value) / Math.log10(1 + 1000));
  const R = 108;
  const C = 2 * Math.PI * R * 0.75;
  return (
    <div className="relative mx-auto size-72 sm:size-80">
      <svg viewBox="0 0 260 260" className="size-full" aria-hidden><g transform="rotate(135 130 130)">
        <circle cx="130" cy="130" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${C} 999`} />
        <circle cx="130" cy="130" r={R} fill="none" stroke={ACCENT} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${C * pct} 999`} className="transition-[stroke-dasharray] duration-200" style={{ filter: active ? `drop-shadow(0 0 10px ${ACCENT})` : undefined }} />
      </g></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-6xl font-semibold tabular-nums tracking-tight text-white sm:text-7xl" aria-live="off">{fmt(value)}</span>
        <span className="mt-1 text-sm font-medium uppercase tracking-widest text-neutral-400">{label}</span>
      </div>
    </div>
  );
}

export function SpeedTest() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [live, setLive] = useState(0);
  const [res, setRes] = useState<Result>({});
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => () => ctl.current?.abort(), []);

  const onLive = (l: Live) => { if (l.mbps !== undefined) setLive(l.mbps); };

  async function run() {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setRes({}); setLive(0);
    try {
      setPhase('ping');
      const { ping, jitter } = await measurePing(c.signal, () => {});
      setRes({ ping, jitter });
      setPhase('down');
      const down = await measureDownload(c.signal, onLive);
      setRes((r) => ({ ...r, down })); setLive(0);
      setPhase('up');
      const up = await measureUpload(c.signal, onLive);
      setRes((r) => ({ ...r, up })); setLive(up);
      setPhase('done');
    } catch {
      setPhase(c.signal.aborted ? 'idle' : 'error');
    }
  }
  const stop = () => { ctl.current?.abort(); setPhase('idle'); setLive(0); };

  const running = phase === 'ping' || phase === 'down' || phase === 'up';
  const gaugeValue = phase === 'done' ? res.down ?? 0 : live;
  const gaugeLabel = phase === 'up' ? 'Mbps up' : phase === 'done' ? 'Mbps down' : 'Mbps down';

  return (
    <div className="mx-auto max-w-2xl text-center">
      <Gauge value={phase === 'up' ? live : gaugeValue} label={gaugeLabel} active={running} />
      <p className="mt-2 h-5 text-sm text-neutral-400" role="status">{NOTE[phase]}</p>

      <div className="mt-6 flex justify-center">
        {running ? (
          <button onClick={stop} className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 px-7 font-semibold text-white transition hover:bg-white/5"><Square className="size-4" /> Stop</button>
        ) : (
          <button onClick={run} className="inline-flex h-12 items-center gap-2 rounded-full px-8 font-semibold text-neutral-950 transition hover:brightness-110 active:scale-95" style={{ background: ACCENT }}>
            {phase === 'done' || phase === 'error' ? <><RotateCcw className="size-4" /> Test again</> : 'Start test'}
          </button>
        )}
      </div>

      <dl className="mt-10 grid grid-cols-3 gap-3 text-left">
        {[
          { k: 'Download', v: res.down, u: 'Mbps', Icon: ArrowDown },
          { k: 'Upload', v: res.up, u: 'Mbps', Icon: ArrowUp },
          { k: 'Ping', v: res.ping, u: 'ms', Icon: Activity, sub: res.jitter !== undefined ? `${fmt(res.jitter)} ms jitter` : undefined },
        ].map(({ k, v, u, Icon, sub }) => (
          <div key={k} className="rounded-3xl bg-neutral-900/70 p-4 ring-1 ring-white/10 sm:p-5">
            <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-400"><Icon className="size-3.5" style={{ color: ACCENT }} /> {k}</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums text-white sm:text-3xl">{fmt(v)} <span className="text-xs font-medium text-neutral-500">{u}</span></dd>
            {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
          </div>
        ))}
      </dl>
      <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-neutral-500">Measures the connection between your device and this website&apos;s server — a good picture of your real-world speed, though it can differ from tools that test against your internet provider&apos;s own servers.</p>
    </div>
  );
}
