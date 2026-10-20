/// <reference lib="webworker" />
import { separateMdx, makeStems } from '@/lib/separator/mdx';
import { AI_MODELS, type AiModel } from '@/lib/separator/models';
import { quickSeparate } from '@/lib/separator/quick';
import type { FromWorker, Mp3Request, SeparateRequest, ToWorker } from './protocol';

// Runs off the main thread so the page stays responsive during the (long) separation.
// Everything stays on the visitor's device: the only network request is the one-off model download.

const post = (m: FromWorker, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);
let cancelled = false;

// ONNX Runtime Web is served from this site (/ort/*, copied at install time) and loaded at run time, not bundled.
async function loadOrt(gpu: boolean, threads: number): Promise<any> {
  const url = gpu ? '/ort/ort.webgpu.min.mjs' : '/ort/ort.wasm.min.mjs';
  const ort: any = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url);
  ort.env.wasm.wasmPaths = '/ort/';
  ort.env.wasm.numThreads = threads;
  ort.env.wasm.simd = true;
  return ort;
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function verify(bytes: Uint8Array<ArrayBuffer>, m: AiModel) {
  if (bytes.byteLength !== m.bytes) return false;
  return hex(await crypto.subtle.digest('SHA-256', bytes)) === m.sha256;
}

/** The model file, from this browser's cache if it's already there, otherwise downloaded once and cached. */
async function getModel(m: AiModel): Promise<Uint8Array<ArrayBuffer>> {
  const key = new Request(`${self.location.origin}/__separator-models/${m.file}`);
  const cache = await caches.open('separator-models-v1').catch(() => null);
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) {
    post({ type: 'status', text: 'Loading the AI model from this device…' });
    const bytes = new Uint8Array(await hit.arrayBuffer());
    if (await verify(bytes, m)) return bytes;
    await cache?.delete(key);
  }
  let lastError = 'no download address worked';
  for (const url of m.urls) {
    try {
      post({ type: 'status', text: 'Downloading the AI model (one time, 63 MB)…' });
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const buf = new Uint8Array(m.bytes);
      let at = 0;
      const reader = res.body.getReader();
      for (;;) {
        if (cancelled) throw new Error('cancelled');
        const { done, value } = await reader.read();
        if (done) break;
        if (at + value.length > buf.length) throw new Error('file is larger than expected');
        buf.set(value, at);
        at += value.length;
        post({ type: 'download', loaded: at, total: m.bytes });
      }
      post({ type: 'status', text: 'Checking the download…' });
      if (at !== m.bytes || !(await verify(buf, m))) throw new Error('the file did not match its checksum');
      await cache?.put(key, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {});
      return buf;
    } catch (e) {
      if (e instanceof Error && e.message === 'cancelled') throw e;
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Could not download the AI model (${lastError}). Check your connection and try again.`);
}

async function runAi(req: SeparateRequest) {
  const model = AI_MODELS[req.mode as 'vocals' | 'instrumental'];
  const bytes = await getModel(model);
  if (cancelled) throw new Error('cancelled');

  let backend = req.gpu ? 'graphics card' : `CPU (${req.threads} thread${req.threads === 1 ? '' : 's'})`;
  let ort = await loadOrt(req.gpu, req.threads);
  const create = async (gpu: boolean) =>
    ort.InferenceSession.create(bytes, { executionProviders: gpu ? ['webgpu', 'wasm'] : ['wasm'], graphOptimizationLevel: 'all' });
  post({ type: 'status', text: 'Starting the AI model…' });
  let session: any;
  try {
    session = await create(req.gpu);
  } catch (e) {
    if (!req.gpu) throw e;
    ort = await loadOrt(false, req.threads);
    backend = `CPU (${req.threads} threads; the graphics card was not usable)`;
    session = await create(false);
  }
  const inputName: string = session.inputNames[0];
  const dims = [1, 4, model.dimF, 2 ** model.dimTPow];
  let usingGpu = req.gpu && backend === 'graphics card';

  const runOnce = async (input: Float32Array) => {
    const out = await session.run({ [inputName]: new ort.Tensor('float32', input, dims) });
    const t = out[session.outputNames[0]];
    return new Float32Array(t.data as Float32Array);
  };
  let first = true;
  const runModel = async (input: Float32Array) => {
    let y = await runOnce(input);
    if (first) {
      first = false;
      // Safety net for the experimental graphics-card path: if it returns garbage, redo on the CPU.
      let sum = 0, inSum = 0, bad = false;
      for (let i = 0; i < y.length; i += 13) { if (!Number.isFinite(y[i])) { bad = true; break; } sum += Math.abs(y[i]); inSum += Math.abs(input[i]); }
      if (usingGpu && (bad || sum === 0 || sum > inSum * 20)) {
        ort = await loadOrt(false, req.threads);
        session = await create(false);
        usingGpu = false;
        backend = `CPU (${req.threads} threads; the graphics card gave unusable results)`;
        y = await runOnce(input);
      }
    }
    return y;
  };

  const startedAt = Date.now();
  const [pL, pR] = await separateMdx(
    req.left, req.right, model, runModel,
    (p) => post({ type: 'progress', chunk: p.chunk, chunks: p.chunks, startedAt, backend }),
    () => cancelled,
  );
  post({ type: 'status', text: 'Finishing up…' });
  const stems = makeStems(req.left, req.right, pL, pR, model.primary);
  return { ...stems, backend };
}

async function handleSeparate(req: SeparateRequest) {
  cancelled = false;
  try {
    let result: { vocals: [Float32Array, Float32Array]; instrumental: [Float32Array, Float32Array]; backend: string };
    if (req.mode === 'quick') {
      post({ type: 'status', text: 'Separating…' });
      result = { ...quickSeparate(req.left, req.right, req.sampleRate), backend: 'instant preview' };
    } else {
      result = await runAi(req);
    }
    const bufs = [...result.vocals, ...result.instrumental].map((a) => a.buffer);
    post({ type: 'done', vocals: result.vocals, instrumental: result.instrumental, backend: result.backend }, bufs);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    post({ type: 'error', message: message === 'cancelled' ? 'cancelled' : message });
  }
}

async function handleMp3(req: Mp3Request) {
  try {
    const { Mp3Encoder } = await import('@breezystack/lamejs');
    const enc = new Mp3Encoder(2, req.sampleRate, req.kbps);
    const toInt = (x: Float32Array, a: number, b: number) => {
      const o = new Int16Array(b - a);
      for (let i = a; i < b; i++) { const s = Math.max(-1, Math.min(1, x[i])); o[i - a] = s < 0 ? s * 32768 : s * 32767; }
      return o;
    };
    const parts: Uint8Array[] = [];
    const block = 1152 * 20;
    for (let i = 0; i < req.left.length; i += block) {
      const end = Math.min(i + block, req.left.length);
      const out = enc.encodeBuffer(toInt(req.left, i, end), toInt(req.right, i, end));
      if (out.length) parts.push(out);
    }
    parts.push(enc.flush());
    const total = parts.reduce((n, p) => n + p.length, 0);
    const all = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { all.set(p, o); o += p.length; }
    post({ type: 'mp3', buffer: all.buffer }, [all.buffer]);
  } catch (e) {
    post({ type: 'error', message: `Could not make the MP3: ${e instanceof Error ? e.message : e}` });
  }
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if (m.type === 'cancel') cancelled = true;
  else if (m.type === 'separate') void handleSeparate(m);
  else if (m.type === 'mp3') void handleMp3(m);
};
