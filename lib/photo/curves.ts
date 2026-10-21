import type { CurveChannel, Point } from './params';

/** Smooth curve through the points that never overshoots (monotone cubic / Fritsch–Carlson), sampled at 256 steps. */
export function sampleCurve(points: Point[]): Float32Array {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  const out = new Float32Array(256);
  if (n < 2) { for (let i = 0; i < 256; i++) out[i] = i / 255; return out; }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]));
  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let seg = 0;
  for (let k = 0; k < 256; k++) {
    const x = k / 255;
    if (x <= xs[0]) { out[k] = ys[0]; continue; }
    if (x >= xs[n - 1]) { out[k] = ys[n - 1]; continue; }
    while (seg < n - 2 && x > xs[seg + 1]) seg++;
    const h = xs[seg + 1] - xs[seg];
    const t = (x - xs[seg]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    out[k] = (2 * t3 - 3 * t2 + 1) * ys[seg] + (t3 - 2 * t2 + t) * h * m[seg] + (-2 * t3 + 3 * t2) * ys[seg + 1] + (t3 - t2) * h * m[seg + 1];
  }
  for (let k = 0; k < 256; k++) out[k] = Math.min(1, Math.max(0, out[k]));
  return out;
}

/** 256×1 RGBA lookup table: each channel's own curve applied after the master curve. */
export function curvesLut(c: Record<CurveChannel, Point[]>): Uint8Array {
  const master = sampleCurve(c.master);
  const ch = [sampleCurve(c.r), sampleCurve(c.g), sampleCurve(c.b)];
  const at = (lut: Float32Array, v: number) => { const x = v * 255; const i = Math.min(254, Math.floor(x)); return lut[i] + (lut[i + 1] - lut[i]) * (x - i); };
  const out = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const m = master[i];
    for (let k = 0; k < 3; k++) out[i * 4 + k] = Math.round(at(ch[k], m) * 255);
    out[i * 4 + 3] = 255;
  }
  return out;
}

export const isLine = (p: Point[]) => p.length === 2 && p[0][0] === 0 && p[0][1] === 0 && p[1][0] === 1 && p[1][1] === 1;
