import { FFT } from '@/lib/separator/fft';

// Audio analysis for the remix timeline, all in the browser:
//  - tempo (BPM) and beat grid: spectral-flux onset strength → autocorrelation (tempo) → comb filter (beat phase)
//  - loudness: ITU-R BS.1770 integrated loudness (K-weighting, 400 ms blocks, absolute + relative gating), in LUFS
//  - peaks for drawing the waveform

export interface Analysis {
  bpm: number;
  /** Time of the first beat (seconds); beats repeat every 60/bpm. */
  firstBeat: number;
  /** 0..1 — how clearly the tempo stood out. */
  confidence: number;
  peaks: Float32Array; // max |sample| per bucket, PEAK_BUCKETS buckets across the whole file
}

export const PEAK_BUCKETS = 4000;

function mono(buf: AudioBuffer, from = 0, to = buf.length): Float32Array {
  const out = new Float32Array(to - from);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = from; i < to; i++) out[i - from] += d[i] / buf.numberOfChannels;
  }
  return out;
}

export function peaksOf(buf: AudioBuffer): Float32Array {
  const out = new Float32Array(PEAK_BUCKETS);
  const per = buf.length / PEAK_BUCKETS;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let b = 0; b < PEAK_BUCKETS; b++) {
      const a = Math.floor(b * per);
      const e = Math.min(d.length, Math.floor((b + 1) * per));
      let m = out[b];
      for (let i = a; i < e; i += 2) { const v = Math.abs(d[i]); if (v > m) m = v; }
      out[b] = m;
    }
  }
  return out;
}

/** Onset strength (log-magnitude spectral flux), one value per hop. */
function onsets(x: Float32Array, sr: number) {
  const N = 1024;
  const hop = 512;
  const fft = new FFT(N);
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const frames = Math.max(0, Math.floor((x.length - N) / hop));
  const flux = new Float32Array(frames);
  const lowFlux = new Float32Array(frames);
  const prev = new Float64Array(N / 2);
  const lowBin = Math.max(2, Math.round((180 / sr) * N)); // kick drum and bass
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const maxBin = Math.min(N / 2, Math.round((8000 / sr) * N)); // ignore the hiss above ~8 kHz
  for (let f = 0; f < frames; f++) {
    const o = f * hop;
    for (let i = 0; i < N; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
    fft.forward(re, im);
    let s = 0;
    let lo = 0;
    for (let k = 1; k < maxBin; k++) {
      const m = Math.log1p(100 * Math.hypot(re[k], im[k]));
      const d = m - prev[k];
      if (d > 0) { s += d; if (k <= lowBin) lo += d; }
      prev[k] = m;
    }
    flux[f] = s;
    lowFlux[f] = lo;
  }
  // Remove the slowly-varying level so only the "hits" remain.
  const w = Math.round((0.4 * sr) / hop);
  const detrend = (x: Float32Array) => {
    const o = new Float32Array(frames);
    let acc = 0;
    for (let i = 0; i < frames; i++) {
      acc += x[i];
      if (i > 2 * w) acc -= x[i - 2 * w - 1];
      o[i] = Math.max(0, x[i] - acc / Math.min(i + 1, 2 * w + 1));
    }
    return o;
  };
  const out = detrend(flux);
  const low = detrend(lowFlux);
  // For placing the beat, the kick/bass hits count most (off-beat hi-hats would otherwise pull it half a beat late).
  const norm = (x: Float32Array) => { let m = 0; for (const v of x) m += v; return m / Math.max(1, x.length) || 1; };
  const a = norm(out), b = norm(low);
  const beatEnv = out.map((v, i) => v / a + (2 * low[i]) / b);
  return { env: out, beatEnv, fps: sr / hop, latency: N / 2 / sr };
}

/** Tempo and beat grid. Analyses up to the first 3 minutes. */
export function detectTempo(buf: AudioBuffer): { bpm: number; firstBeat: number; confidence: number } {
  const sr = buf.sampleRate;
  const x = mono(buf, 0, Math.min(buf.length, Math.round(sr * 180)));
  const { env, beatEnv, fps, latency } = onsets(x, sr);
  if (env.length < fps * 4) return { bpm: 120, firstBeat: 0, confidence: 0 };
  const ac = (lag: number) => {
    const L = Math.floor(lag);
    const t = lag - L;
    let s = 0;
    for (let i = 0; i + L + 1 < env.length; i++) s += env[i] * (env[i + L] * (1 - t) + env[i + L + 1] * t);
    return s;
  };
  const minLag = Math.floor((60 * fps) / 200);
  const maxLag = Math.ceil((60 * fps) / 60);
  const scores: number[] = [];
  let best = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fps) / lag;
    // Most dance and wedding music sits near 120; the prior breaks octave ties (60 vs 120 vs 240).
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
    const s = (ac(lag) + 0.5 * ac(lag * 2)) * prior;
    scores.push(s);
    if (s > bestScore) { bestScore = s; best = lag; }
  }
  // Parabolic refinement around the peak.
  const i = best - minLag;
  let lag = best;
  if (i > 0 && i < scores.length - 1) {
    const a = scores[i - 1], b = scores[i], c = scores[i + 1];
    const d = a - 2 * b + c;
    if (d < 0) lag = best + (0.5 * (a - c)) / d;
  }
  let bpm = (60 * fps) / lag;
  while (bpm < 70) bpm *= 2;
  while (bpm >= 180) bpm /= 2;
  const mean = scores.reduce((p, q) => p + q, 0) / scores.length;
  const confidence = Math.max(0, Math.min(1, (bestScore / Math.max(mean, 1e-9) - 1) / 3));
  // Beat grid: refine tempo and phase together (a tiny tempo error adds up over a whole song), keeping the
  // combination whose comb of beats collects the most onset energy.
  const comb = (period: number, off: number) => {
    let s = 0;
    for (let k = off; k < beatEnv.length; k += period) { const j = Math.round(k); s += beatEnv[j] + 0.5 * (beatEnv[j - 1] ?? 0) + 0.5 * (beatEnv[j + 1] ?? 0); }
    return s;
  };
  let bestOff = 0;
  let bestSum = -1;
  let bestBpm = bpm;
  for (let b = bpm * 0.98; b <= bpm * 1.02; b += bpm * 0.0005) {
    const period = (60 * fps) / b;
    for (let off = 0; off < period; off += 0.5) {
      const s = comb(period, off);
      if (s > bestSum) { bestSum = s; bestOff = off; bestBpm = b; }
    }
  }
  bpm = bestBpm;
  const firstBeat = Math.max(0, bestOff / fps + latency);
  return { bpm: Math.round(bpm * 10) / 10, firstBeat, confidence };
}

function biquad(x: Float64Array, b: number[], a: number[]) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2) / a[0];
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/** BS.1770 K-weighting (high shelf +4 dB @1.5 kHz, high pass @38 Hz), designed for any sample rate. */
function kWeight(x: Float64Array, sr: number) {
  let w0 = (2 * Math.PI * 1500) / sr;
  const A = 10 ** (4 / 40);
  let alpha = Math.sin(w0) / (2 / Math.SQRT2);
  let c = Math.cos(w0);
  const sa = 2 * Math.sqrt(A) * alpha;
  const shelfB = [A * (A + 1 + (A - 1) * c + sa), -2 * A * (A - 1 + (A + 1) * c), A * (A + 1 + (A - 1) * c - sa)];
  const shelfA = [A + 1 - (A - 1) * c + sa, 2 * (A - 1 - (A + 1) * c), A + 1 - (A - 1) * c - sa];
  w0 = (2 * Math.PI * 38) / sr;
  alpha = Math.sin(w0) / (2 * 0.5);
  c = Math.cos(w0);
  const hpB = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const hpA = [1 + alpha, -2 * c, 1 - alpha];
  return biquad(biquad(x, shelfB, shelfA), hpB, hpA);
}

/** Integrated loudness (LUFS) of [from, to) seconds. Returns -70 for silence. */
export function loudness(buf: AudioBuffer, from = 0, to = buf.duration): number {
  const sr = buf.sampleRate;
  const a = Math.max(0, Math.floor(from * sr));
  const b = Math.min(buf.length, Math.floor(to * sr));
  if (b - a < sr * 0.4) return -70;
  const chans: Float64Array[] = [];
  for (let ch = 0; ch < Math.min(2, buf.numberOfChannels); ch++) chans.push(kWeight(Float64Array.from(buf.getChannelData(ch).subarray(a, b)), sr));
  const block = Math.round(0.4 * sr);
  const step = Math.round(0.1 * sr);
  const z: number[] = [];
  for (let s = 0; s + block <= b - a; s += step) {
    let sum = 0;
    for (const y of chans) { let m = 0; for (let i = s; i < s + block; i++) m += y[i] * y[i]; sum += m / block; }
    if (chans.length === 1) sum *= 2; // mono plays from both speakers
    z.push(sum);
  }
  const lk = (v: number) => -0.691 + 10 * Math.log10(v);
  const abs = z.filter((v) => lk(v) > -70);
  if (!abs.length) return -70;
  const rel = lk(abs.reduce((p, q) => p + q, 0) / abs.length) - 10;
  const gated = abs.filter((v) => lk(v) > rel);
  return lk(gated.reduce((p, q) => p + q, 0) / Math.max(1, gated.length));
}

export function analyse(buf: AudioBuffer): Analysis {
  return { ...detectTempo(buf), peaks: peaksOf(buf) };
}
