/// <reference lib="webworker" />
// Background removal, off the main thread. The model (ormbg, Apache-2.0) is downloaded once from Hugging Face, checked
// against its SHA-256, kept in this browser's cache, and run with ONNX Runtime Web. Photos never leave the device.


// Two builds of the same network: a half-precision one for the graphics card (WebGPU — usually a few seconds) and a
// compressed 8-bit one for the CPU (works everywhere). The GPU one is used when the browser supports it; if it fails, the
// CPU one takes over.
interface ModelFile { name: string; url: string; bytes: number; sha256: string; mb: number }
const HF = 'https://huggingface.co/onnx-community/ormbg-ONNX/resolve/main/onnx/';
const CPU: ModelFile = { name: 'ormbg-int8.onnx', url: `${HF}model_int8.onnx`, bytes: 44315136, sha256: '905f6c0d4e10d64e9ee54216ab2ae0f6ee01f5ee017dadedaba120c4eb854714', mb: 42 };
const GPU: ModelFile = { name: 'ormbg-fp16.onnx', url: `${HF}model_fp16.onnx`, bytes: 88117930, sha256: '06e4236d2c2fae771f56b6e4723b6ed870a554b661ea4da4a74f650bbd53cf57', mb: 84 };
const SIZE = 1024;

/** `forceGpu` (from ?ai=gpu) tries the graphics card even without half-precision support — for testing the fallback. */
export type SegIn = { type: 'run'; input: Float32Array; threads: number; forceGpu?: boolean };
export type SegOut =
  | { type: 'progress'; text: string; loaded?: number; total?: number }
  | { type: 'done'; mask: Uint8Array; size: number; ms: number; device: 'gpu' | 'cpu' }
  | { type: 'error'; message: string };

const post = (m: SegOut, t: Transferable[] = []) => (self as unknown as Worker).postMessage(m, t);
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const ok = async (b: Uint8Array<ArrayBuffer>, m: ModelFile) => b.byteLength === m.bytes && hex(await crypto.subtle.digest('SHA-256', b)) === m.sha256;

async function model(m: ModelFile): Promise<Uint8Array<ArrayBuffer>> {
  const key = new Request(`${self.location.origin}/__photo-models/${m.name}`);
  const cache = await caches.open('photo-models-v1').catch(() => null);
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) {
    const b = new Uint8Array(await hit.arrayBuffer());
    if (await ok(b, m)) return b;
    await cache?.delete(key);
  }
  const text = `Downloading the AI model (one time, ${m.mb} MB)…`;
  post({ type: 'progress', text, loaded: 0, total: m.bytes });
  const res = await fetch(m.url, { mode: 'cors' });
  if (!res.ok || !res.body) throw new Error(`Could not download the AI model (HTTP ${res.status}).`);
  const buf = new Uint8Array(m.bytes);
  let at = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (at + value.length > buf.length) throw new Error('The AI model download was larger than expected.');
    buf.set(value, at);
    at += value.length;
    post({ type: 'progress', text, loaded: at, total: m.bytes });
  }
  if (!(await ok(buf, m))) throw new Error('The AI model download was damaged — please try again.');
  await cache?.put(key, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {});
  return buf;
}

async function gpuUsable() {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
    const a = gpu ? await gpu.requestAdapter() : null;
    return Boolean(a?.features.has('shader-f16'));
  } catch {
    return false;
  }
}

let session: any = null;
let ort: any = null;
let device: 'gpu' | 'cpu' = 'cpu';
const BASE = `/ort/${process.env.NEXT_PUBLIC_ORT_VERSION}/`;

async function start(threads: number, preferGpu: boolean) {
  if (preferGpu) {
    try {
      const bytes = await model(GPU);
      post({ type: 'progress', text: 'Starting the AI model on the graphics card…' });
      ort = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ BASE + 'ort.webgpu.min.mjs');
      ort.env.wasm.wasmPaths = BASE;
      ort.env.wasm.numThreads = threads;
      session = await ort.InferenceSession.create(bytes, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' });
      device = 'gpu';
      return;
    } catch {
      session = null;
    }
  }
  const bytes = await model(CPU);
  post({ type: 'progress', text: 'Starting the AI model…' });
  ort = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ BASE + 'ort.wasm.min.mjs');
  ort.env.wasm.wasmPaths = BASE;
  ort.env.wasm.numThreads = threads;
  session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  device = 'cpu';
}

async function infer(input: Float32Array) {
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
  return out[session.outputNames[0]].data as Float32Array;
}

self.onmessage = async (e: MessageEvent<SegIn>) => {
  if (e.data.type !== 'run') return;
  try {
    if (!session) await start(e.data.threads, e.data.forceGpu || (await gpuUsable()));
    post({ type: 'progress', text: device === 'gpu' ? 'Finding the subject (graphics card)…' : 'Finding the subject…' });
    const input = e.data.input.slice(); // keep a copy in case the GPU run fails and the CPU has to redo it
    const t0 = performance.now();
    let raw: Float32Array;
    try {
      raw = await infer(e.data.input);
      if (device === 'gpu' && !raw.some((v) => v !== 0 && Number.isFinite(v))) throw new Error('empty GPU result');
    } catch (err) {
      if (device !== 'gpu') throw err;
      session = null;
      await start(e.data.threads, false);
      raw = await infer(input);
    }
    const ms = performance.now() - t0;
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < raw.length; i++) { const v = raw[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    // Stretch to the full 0–1 range (as rembg does) unless the model is unsure everywhere, which would amplify noise.
    if (mx - mn < 0.3) { mn = 0; mx = 1; }
    const span = Math.max(1e-6, mx - mn);
    const mask = new Uint8Array(SIZE * SIZE);
    for (let i = 0; i < mask.length; i++) mask[i] = Math.round(Math.min(1, Math.max(0, (raw[i] - mn) / span)) * 255);
    post({ type: 'done', mask, size: SIZE, ms, device }, [mask.buffer]);
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
