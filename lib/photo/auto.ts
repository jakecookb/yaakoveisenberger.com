import type { Params } from './params';

// "Auto-Enhance" and "Color Match" read the photo's own statistics (brightness spread, clipping, the colour of
// near-neutral areas) and set the sliders the way an editor would — instantly, with no upload.

const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface Stats { p01: number; p05: number; p50: number; p99: number; clipHi: number; clipLo: number; neutral: [number, number, number] | null; avg: [number, number, number]; sat: number }

export function analyse(data: Uint8Array): Stats {
  const hist = new Uint32Array(256);
  let n = 0, clipHi = 0, clipLo = 0, satSum = 0;
  const avg = [0, 0, 0];
  const neu = [0, 0, 0];
  let nn = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    hist[Math.round(L * 255)]++;
    n++;
    if (L > 0.98) clipHi++;
    if (L < 0.02) clipLo++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx > 0 ? (mx - mn) / mx : 0;
    satSum += sat;
    avg[0] += lin(r); avg[1] += lin(g); avg[2] += lin(b);
    if (L > 0.15 && L < 0.92 && sat < 0.28) { neu[0] += lin(r); neu[1] += lin(g); neu[2] += lin(b); nn++; }
  }
  const pct = (q: number) => { let acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= q * n) return i / 255; } return 1; };
  return {
    p01: pct(0.01), p05: pct(0.05), p50: pct(0.5), p99: pct(0.99),
    clipHi: clipHi / Math.max(1, n), clipLo: clipLo / Math.max(1, n),
    neutral: nn > n * 0.02 ? [neu[0] / nn, neu[1] / nn, neu[2] / nn] : null,
    avg: [avg[0] / Math.max(1, n), avg[1] / Math.max(1, n), avg[2] / Math.max(1, n)],
    sat: satSum / Math.max(1, n),
  };
}

/** Slider values for a balanced, punchy version of the photo (measured on an unadjusted render). */
export function autoEnhance(data: Uint8Array): Partial<Params> {
  const s = analyse(data);
  const exposure = clamp(Math.log2(0.16 / Math.max(lin(s.p50), 0.004)), -1.5, 1.5) * 0.6;
  let temp = 0, tint = 0;
  if (s.neutral) {
    const [r, g, b] = s.neutral;
    const q = b / Math.max(r, 1e-4);
    const t = clamp((q - 1) / (0.35 * (q + 1)), -0.6, 0.6);
    const rb = (r * (1 + 0.35 * t) + b * (1 - 0.35 * t)) / 2;
    const m = clamp((1 - rb / Math.max(g, 1e-4)) / 0.25, -0.6, 0.6);
    temp = t * 100 * 0.6;
    tint = m * 100 * 0.6;
  }
  const spread = s.p99 - s.p01;
  return {
    exposure: Math.round(exposure * 100) / 100,
    temp: Math.round(temp),
    tint: Math.round(tint),
    contrast: Math.round(clamp((0.85 - spread) * 80, -10, 30)),
    highlights: Math.round(s.clipHi > 0.01 ? -clamp(s.clipHi * 400, 15, 60) : s.p99 > 0.93 ? -15 : 0),
    shadows: Math.round(s.clipLo > 0.02 || s.p05 < 0.04 ? clamp(25 + s.clipLo * 300, 15, 50) : 8),
    vibrance: s.sat < 0.35 ? 22 : 10,
    clarity: 12,
    sharpen: 25,
  };
}

/** Picks the colour grade that suits the photo's light and colour. */
export function matchGrade(data: Uint8Array): { preset: string; presetAmount: number; why: string } {
  const s = analyse(data);
  const [r, , b] = s.avg;
  if (s.sat < 0.08) return { preset: 'silver', presetAmount: 80, why: 'almost colourless, so a soft black & white' };
  if (s.p50 < 0.28) return { preset: 'moody', presetAmount: 70, why: 'dark and low-key, so a moody grade' };
  if (r > b * 1.25) return { preset: 'golden', presetAmount: 70, why: 'warm light, so a golden-hour grade' };
  if (b > r * 1.1) return { preset: 'cinematic', presetAmount: 70, why: 'cool tones, so a teal-and-orange cinematic grade' };
  if (s.sat > 0.35) return { preset: 'film', presetAmount: 60, why: 'already colourful, so a softer film look' };
  return { preset: 'vivid', presetAmount: 55, why: 'balanced light, so a little extra colour' };
}
