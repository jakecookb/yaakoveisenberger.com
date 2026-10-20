import { FFT } from './fft';

/**
 * "Instant preview": a classic centre-channel extraction, done per frequency so bass stays in the instrumental.
 * Whatever is identical in the left and right channel (usually the lead vocal) is treated as the vocal; the instrumental is
 * the original minus that, so the two always add back up to the song. Needs a genuinely stereo song.
 */
export function quickSeparate(left: Float32Array, right: Float32Array, sampleRate: number) {
  const N = 4096, hop = 1024;
  const n = left.length;
  const fft = new FFT(N);
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const lo = (150 / sampleRate) * N, hi = (9000 / sampleRate) * N;
  const ramp = (f: number) => (f < lo * 0.7 ? 0 : f < lo ? (f - lo * 0.7) / (lo * 0.3) : f <= hi ? 1 : f < hi * 1.2 ? 1 - (f - hi) / (hi * 0.2) : 0);
  const band = new Float64Array(N / 2 + 1);
  for (let f = 0; f <= N / 2; f++) band[f] = ramp(f);

  const pad = N;
  const total = n + 2 * pad;
  const voc = new Float64Array(total), env = new Float64Array(total);
  const Lr = new Float64Array(N), Li = new Float64Array(N), Rr = new Float64Array(N), Ri = new Float64Array(N);
  const Vr = new Float64Array(N), Vi = new Float64Array(N);
  const get = (x: Float32Array, k: number) => (k >= 0 && k < n ? x[k] : 0);

  for (let s = -pad; s < n + pad - N + hop; s += hop) {
    for (let j = 0; j < N; j++) {
      Lr[j] = get(left, s + j) * win[j]; Li[j] = 0;
      Rr[j] = get(right, s + j) * win[j]; Ri[j] = 0;
    }
    fft.forward(Lr, Li);
    fft.forward(Rr, Ri);
    for (let f = 0; f <= N / 2; f++) {
      const mr = (Lr[f] + Rr[f]) / 2, mi = (Li[f] + Ri[f]) / 2; // centre
      const sr = (Lr[f] - Rr[f]) / 2, si = (Li[f] - Ri[f]) / 2; // sides
      const pm = mr * mr + mi * mi, ps = sr * sr + si * si;
      const centred = pm / (pm + ps + 1e-12);
      const g = band[f] * centred * centred;
      Vr[f] = mr * g; Vi[f] = mi * g;
      if (f > 0 && f < N / 2) { Vr[N - f] = Vr[f]; Vi[N - f] = -Vi[f]; }
    }
    Vi[0] = 0; Vi[N / 2] = 0;
    for (let f = 0; f < N; f++) Vi[f] = -Vi[f];
    fft.forward(Vr, Vi);
    for (let j = 0; j < N; j++) {
      const k = s + j + pad;
      if (k >= 0 && k < total) { voc[k] += (Vr[j] / N) * win[j]; env[k] += win[j] * win[j]; }
    }
  }
  const vocals = new Float32Array(n), instL = new Float32Array(n), instR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = voc[i + pad] / Math.max(env[i + pad], 1e-9);
    vocals[i] = v;
    instL[i] = left[i] - v;
    instR[i] = right[i] - v;
  }
  return { vocals: [vocals, vocals.slice()] as [Float32Array, Float32Array], instrumental: [instL, instR] as [Float32Array, Float32Array] };
}

/** How different the two channels are (0 = identical/mono, so the quick mode has nothing to work with). */
export function stereoWidth(left: Float32Array, right: Float32Array) {
  let d = 0, s = 0;
  for (let i = 0; i < left.length; i += 7) { d += (left[i] - right[i]) ** 2; s += left[i] ** 2 + right[i] ** 2; }
  return s === 0 ? 0 : d / s;
}
