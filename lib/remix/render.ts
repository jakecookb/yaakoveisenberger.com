// Builds the final mix offline (faster than real time) with the Web Audio API:
//  - each clip plays its trimmed region; consecutive clips overlap by the crossfade length
//  - equal-power crossfades (no dip in the middle), optional "bass swap" filter sweep like a DJ transition
//  - per-clip gain to a common loudness target
//  - a look-ahead peak limiter on the master so nothing clips

export interface MixClip {
  buffer: AudioBuffer;
  start: number; // seconds in the source
  end: number;
  gainDb: number;
}

export interface MixPlan {
  clips: MixClip[];
  /** fade[i] = crossfade length (s) between clip i and i+1 */
  fades: number[];
  bassSwap: boolean;
  fadeOutEnd: number; // seconds of fade-out at the very end (0 = none)
  limiter: boolean;
  sampleRate?: number;
}

export interface Placement { at: number; dur: number }

/** Where each clip lands on the timeline (seconds), and the total length. */
export function layout(plan: Pick<MixPlan, 'clips' | 'fades'>): { places: Placement[]; total: number } {
  const places: Placement[] = [];
  let t = 0;
  plan.clips.forEach((c, i) => {
    const dur = Math.max(0.05, c.end - c.start);
    if (i > 0) t -= plan.fades[i - 1] ?? 0;
    places.push({ at: Math.max(0, t), dur });
    t = Math.max(0, t) + dur;
  });
  return { places, total: t };
}

const curve = (n: number, f: (x: number) => number) => Float32Array.from({ length: n }, (_, i) => f(i / (n - 1)));

export async function renderMix(plan: MixPlan): Promise<{ buffer: AudioBuffer; reductionDb: number }> {
  const sr = plan.sampleRate ?? 44100;
  const { places, total } = layout(plan);
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * sr)), sr);
  plan.clips.forEach((c, i) => {
    const { at, dur } = places[i];
    const src = ctx.createBufferSource();
    src.buffer = c.buffer;
    const gain = ctx.createGain();
    const g = 10 ** (c.gainDb / 20);
    const fadeIn = i > 0 ? Math.min(plan.fades[i - 1] ?? 0, dur / 2) : 0;
    const fadeOut = i < plan.clips.length - 1 ? Math.min(plan.fades[i] ?? 0, dur / 2) : Math.min(plan.fadeOutEnd, dur / 2);
    const micro = 0.008; // tiny ramp so hard cuts never click
    const eps = 0.002; // automation curves must not touch each other
    gain.gain.setValueAtTime(0, at);
    let t = at;
    if (fadeIn > 0.02) { gain.gain.setValueCurveAtTime(curve(64, (x) => g * Math.sin((x * Math.PI) / 2)), at, fadeIn); t = at + fadeIn; }
    else { gain.gain.linearRampToValueAtTime(g, at + micro); t = at + micro; }
    const outLen = fadeOut > 0.02 ? fadeOut : micro;
    const outStart = Math.max(at + dur - outLen, t + eps);
    if (outStart - t > 2 * eps) gain.gain.setValueAtTime(g, t + eps);
    if (fadeOut > 0.02) gain.gain.setValueCurveAtTime(curve(64, (x) => g * Math.cos((x * Math.PI) / 2)), outStart, Math.max(0.01, at + dur - outStart));
    else gain.gain.linearRampToValueAtTime(0, at + dur);
    let node: AudioNode = src;
    if (plan.bassSwap && (fadeIn > 0.5 || (i < plan.clips.length - 1 && fadeOut > 0.5))) {
      // Bass swap: the incoming track starts without its low end and gets it back across the blend, while the outgoing
      // track loses its low end — so two kick drums and basslines never pile up.
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.Q.value = 0.7;
      hp.frequency.setValueAtTime(fadeIn > 0.5 ? 260 : 10, at);
      if (fadeIn > 0.5) hp.frequency.exponentialRampToValueAtTime(10, at + fadeIn);
      if (i < plan.clips.length - 1 && fadeOut > 0.5) {
        hp.frequency.setValueAtTime(10, outStart);
        hp.frequency.exponentialRampToValueAtTime(260, outStart + fadeOut);
      }
      src.connect(hp);
      node = hp;
    }
    node.connect(gain).connect(ctx.destination);
    src.start(at, c.start, dur);
  });
  const buffer = await ctx.startRendering();
  const reductionDb = plan.limiter ? limit(buffer, -1) : 0;
  return { buffer, reductionDb };
}

/**
 * Look-ahead peak limiter (in place). Gain = the smallest gain needed anywhere in the next few milliseconds, smoothed so
 * it starts dipping before a peak arrives and recovers gently afterwards. Returns the deepest reduction in dB.
 */
export function limit(buf: AudioBuffer, ceilingDb: number): number {
  const sr = buf.sampleRate;
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const n = L.length;
  const ceil = 10 ** (ceilingDb / 20);
  const la = Math.max(1, Math.round(0.005 * sr));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(R[i])); need[i] = p > ceil ? ceil / p : 1; }
  // Minimum over the next `la` samples (monotonic deque).
  const ahead = new Float32Array(n);
  const dq = new Int32Array(n);
  let h = 0, t = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (t > h && need[dq[t - 1]] >= need[i]) t--;
    dq[t++] = i;
    while (dq[h] > i + la) h++;
    ahead[i] = need[dq[h]];
  }
  // Average over the previous `la` samples: still ≤ what each peak needs, but without steps.
  const rel = 1 - Math.exp(-1 / (0.12 * sr));
  let acc = 0;
  let g = 1;
  let minG = 1;
  for (let i = 0; i < n; i++) {
    acc += ahead[i];
    if (i >= la) acc -= ahead[i - la];
    const target = acc / Math.min(i + 1, la);
    g = target < g ? target : g + (target - g) * rel;
    if (g < minG) minG = g;
    L[i] *= g;
    if (R !== L) R[i] *= g;
  }
  return minG < 1 ? 20 * Math.log10(minG) : 0;
}
