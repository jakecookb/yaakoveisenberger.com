/// <reference lib="webworker" />
// MP3 encoding (LAME, 320 kbps) off the main thread so the page stays responsive.
export type Mp3In = { left: Float32Array; right: Float32Array; sampleRate: number; kbps: number };
export type Mp3Out = { type: 'progress'; pct: number } | { type: 'done'; buffer: ArrayBuffer } | { type: 'error'; message: string };

const post = (m: Mp3Out, t: Transferable[] = []) => (self as unknown as Worker).postMessage(m, t);

self.onmessage = async (e: MessageEvent<Mp3In>) => {
  try {
    const { left, right, sampleRate, kbps } = e.data;
    const { Mp3Encoder } = await import('@breezystack/lamejs');
    const enc = new Mp3Encoder(2, sampleRate, kbps);
    const toInt = (x: Float32Array, a: number, b: number) => {
      const o = new Int16Array(b - a);
      for (let i = a; i < b; i++) { const s = Math.max(-1, Math.min(1, x[i])); o[i - a] = s < 0 ? s * 32768 : s * 32767; }
      return o;
    };
    const parts: Uint8Array[] = [];
    const block = 1152 * 40;
    for (let i = 0; i < left.length; i += block) {
      const end = Math.min(i + block, left.length);
      const out = enc.encodeBuffer(toInt(left, i, end), toInt(right, i, end));
      if (out.length) parts.push(out);
      if ((i / block) % 20 === 0) post({ type: 'progress', pct: end / left.length });
    }
    parts.push(enc.flush());
    const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) { all.set(p, o); o += p.length; }
    post({ type: 'done', buffer: all.buffer }, [all.buffer]);
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
