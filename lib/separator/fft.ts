// Mixed-radix complex FFT for any length whose prime factors are small (the MDX models use 6144 = 2^11·3 and
// 7680 = 2^9·3·5, which a power-of-two FFT can't do). Decimation-in-time, out of place, Float64 working buffers.

export class FFT {
  readonly n: number;
  private readonly factors: number[];
  private readonly twRe: Float64Array;
  private readonly twIm: Float64Array;
  private readonly outRe: Float64Array;
  private readonly outIm: Float64Array;
  private readonly tmpRe: Float64Array;
  private readonly tmpIm: Float64Array;

  constructor(n: number) {
    this.n = n;
    this.factors = factorize(n);
    this.twRe = new Float64Array(n);
    this.twIm = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const a = (-2 * Math.PI * k) / n;
      this.twRe[k] = Math.cos(a);
      this.twIm[k] = Math.sin(a);
    }
    this.outRe = new Float64Array(n);
    this.outIm = new Float64Array(n);
    const maxP = Math.max(...this.factors, 2);
    this.tmpRe = new Float64Array(maxP);
    this.tmpIm = new Float64Array(maxP);
  }

  /** In-place forward transform: X[k] = Σ x[j]·e^(-2πi·jk/n). */
  forward(re: Float64Array, im: Float64Array): void {
    this.work(0, re, im, 0, 1, 0, this.n);
    re.set(this.outRe);
    im.set(this.outIm);
  }

  private work(oo: number, inRe: Float64Array, inIm: Float64Array, io: number, stride: number, fi: number, n: number): void {
    const outRe = this.outRe, outIm = this.outIm;
    if (n === 1) {
      outRe[oo] = inRe[io];
      outIm[oo] = inIm[io];
      return;
    }
    const p = this.factors[fi];
    const m = n / p;
    if (m === 1) {
      for (let q = 0; q < p; q++) {
        outRe[oo + q] = inRe[io + q * stride];
        outIm[oo + q] = inIm[io + q * stride];
      }
    } else {
      for (let q = 0; q < p; q++) this.work(oo + q * m, inRe, inIm, io + q * stride, stride * p, fi + 1, m);
    }
    this.butterfly(oo, m, p, stride);
  }

  /** Combine p sub-transforms of length m (stored consecutively at `oo`) into one of length p·m. */
  private butterfly(oo: number, m: number, p: number, twStep: number): void {
    const { outRe, outIm, twRe, twIm, tmpRe, tmpIm, n: N } = this;
    if (p === 2) {
      for (let k = 0; k < m; k++) {
        const a = oo + k, b = a + m, t = k * twStep;
        const wr = twRe[t], wi = twIm[t];
        const br = outRe[b] * wr - outIm[b] * wi;
        const bi = outRe[b] * wi + outIm[b] * wr;
        const ar = outRe[a], ai = outIm[a];
        outRe[a] = ar + br; outIm[a] = ai + bi;
        outRe[b] = ar - br; outIm[b] = ai - bi;
      }
      return;
    }
    const pStep = N / p;
    for (let k = 0; k < m; k++) {
      for (let q = 0; q < p; q++) {
        const idx = oo + k + q * m;
        const t = (q * k * twStep) % N;
        const wr = twRe[t], wi = twIm[t];
        tmpRe[q] = outRe[idx] * wr - outIm[idx] * wi;
        tmpIm[q] = outRe[idx] * wi + outIm[idx] * wr;
      }
      for (let j = 0; j < p; j++) {
        let sr = tmpRe[0], si = tmpIm[0];
        for (let q = 1; q < p; q++) {
          const t = ((j * q) % p) * pStep;
          const wr = twRe[t], wi = twIm[t];
          sr += tmpRe[q] * wr - tmpIm[q] * wi;
          si += tmpRe[q] * wi + tmpIm[q] * wr;
        }
        outRe[oo + k + j * m] = sr;
        outIm[oo + k + j * m] = si;
      }
    }
  }
}

function factorize(n: number): number[] {
  const f: number[] = [];
  let r = n;
  for (const p of [4, 2, 3, 5]) while (r % p === 0) { f.push(p); r /= p; }
  for (let p = 7; r > 1; p += 2) while (r % p === 0) { f.push(p); r /= p; }
  if (n === 1) f.push(1);
  return f;
}
