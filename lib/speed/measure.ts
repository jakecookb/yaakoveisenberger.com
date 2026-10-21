// Browser-side speed test. Everything is measured against this site's own server: 1) ping, 2) download over several
// parallel streams, 3) upload in several parallel requests. Speeds are in megabits per second (Mbps).

export interface Live { phase: 'ping' | 'down' | 'up'; mbps?: number; ms?: number }

const WARMUP_MS = 1000;
const mbps = (bytes: number, ms: number) => (bytes * 8) / (ms / 1000) / 1_000_000;

export async function measurePing(signal: AbortSignal, onLive: (l: Live) => void) {
  const times: number[] = [];
  for (let i = 0; i < 12; i++) {
    const t = performance.now();
    await fetch(`/api/speed/ping?t=${Math.random()}`, { cache: 'no-store', signal });
    const dt = performance.now() - t;
    if (i > 0) { times.push(dt); onLive({ phase: 'ping', ms: dt }); } // the first request also pays for the connection set-up
  }
  const sorted = [...times].sort((a, b) => a - b);
  const ping = sorted[Math.floor(sorted.length / 2)];
  const jitter = times.slice(1).reduce((s, v, i) => s + Math.abs(v - times[i]), 0) / Math.max(1, times.length - 1);
  return { ping, jitter };
}

export async function measureDownload(signal: AbortSignal, onLive: (l: Live) => void, durationMs = 7000, streams = 4) {
  const start = performance.now();
  let total = 0;
  let counted = 0;
  let countFrom = 0;
  const tick = setInterval(() => {
    const now = performance.now();
    if (!countFrom && now - start >= WARMUP_MS) { countFrom = now; counted = 0; }
    if (countFrom && now - countFrom > 200) onLive({ phase: 'down', mbps: mbps(counted, now - countFrom) });
  }, 120);
  const stop = new AbortController();
  const onAbort = () => stop.abort();
  signal.addEventListener('abort', onAbort);
  const end = setTimeout(() => stop.abort(), durationMs);
  const worker = async () => {
    while (!stop.signal.aborted) {
      try {
        const res = await fetch(`/api/speed/down?bytes=${16 * 1024 * 1024}&t=${Math.random()}`, { cache: 'no-store', signal: stop.signal });
        const reader = res.body!.getReader();
        for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; counted += value.byteLength; }
      } catch { break; }
    }
  };
  await Promise.all(Array.from({ length: streams }, worker));
  clearInterval(tick); clearTimeout(end); signal.removeEventListener('abort', onAbort);
  signal.throwIfAborted();
  const from = countFrom || start;
  return mbps(countFrom ? counted : total, Math.max(1, performance.now() - from));
}

const PAYLOAD = (() => {
  const buf = new Uint8Array(2 * 1024 * 1024);
  for (let i = 0; i < buf.length; i += 65536) crypto.getRandomValues(buf.subarray(i, i + 65536));
  return buf;
})();

function post(signal: AbortSignal, onBytes: (n: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let last = 0;
    xhr.open('POST', `/api/speed/up?t=${Math.random()}`);
    xhr.upload.onprogress = (e) => { onBytes(e.loaded - last); last = e.loaded; };
    xhr.onloadend = () => resolve();
    signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(PAYLOAD);
  });
}

export async function measureUpload(signal: AbortSignal, onLive: (l: Live) => void, durationMs = 6000, streams = 3) {
  const start = performance.now();
  let counted = 0;
  let countFrom = 0;
  const stop = new AbortController();
  const onAbort = () => stop.abort();
  signal.addEventListener('abort', onAbort);
  const end = setTimeout(() => stop.abort(), durationMs);
  const tick = setInterval(() => {
    const now = performance.now();
    if (!countFrom && now - start >= WARMUP_MS) { countFrom = now; counted = 0; }
    if (countFrom && now - countFrom > 200) onLive({ phase: 'up', mbps: mbps(counted, now - countFrom) });
  }, 120);
  const worker = async () => { while (!stop.signal.aborted) await post(stop.signal, (n) => { counted += n; }); };
  await Promise.all(Array.from({ length: streams }, worker));
  clearInterval(tick); clearTimeout(end); signal.removeEventListener('abort', onAbort);
  signal.throwIfAborted();
  return mbps(counted, Math.max(1, performance.now() - (countFrom || start)));
}
