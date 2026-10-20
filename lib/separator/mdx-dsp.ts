import { FFT } from './fft';

/**
 * The STFT / inverse STFT the MDX-Net models expect (identical to torch.stft / torch.istft with center=True and a
 * periodic Hann window, as used by Ultimate Vocal Remover). A chunk of `hop·(dimT−1)` samples per channel becomes a
 * model input of shape [4, dimF, dimT]: channels are [left re, left im, right re, right im].
 */
export class MdxDsp {
  readonly chunk: number;
  readonly frames: number;
  private readonly fft: FFT;
  private readonly win: Float64Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;

  constructor(readonly nFft: number, readonly hop: number, readonly dimF: number, readonly dimT: number) {
    this.chunk = hop * (dimT - 1);
    this.frames = 1 + Math.floor(this.chunk / hop);
    this.fft = new FFT(nFft);
    this.win = new Float64Array(nFft);
    for (let i = 0; i < nFft; i++) this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / nFft);
    this.re = new Float64Array(nFft);
    this.im = new Float64Array(nFft);
  }

  /**
   * `left`/`right` hold exactly `chunk` samples. Writes `4·dimF·dimT` floats into `out`.
   * Two real frames are transformed per complex FFT (frame a in the real part, frame b in the imaginary part).
   */
  forward(left: Float32Array, right: Float32Array, out: Float32Array): void {
    const { nFft, hop, dimF, frames: T, re, im, win } = this;
    const pad = nFft >> 1;
    const len = this.chunk;
    const reflect = (i: number) => (i < 0 ? -i : i >= len ? 2 * (len - 1) - i : i);
    for (let c = 0; c < 2; c++) {
      const x = c === 0 ? left : right;
      const base = c * 2 * dimF;
      for (let t = 0; t < T; t += 2) {
        const hasB = t + 1 < T;
        const sa = t * hop - pad, sb = (t + 1) * hop - pad;
        for (let j = 0; j < nFft; j++) {
          re[j] = x[reflect(sa + j)] * win[j];
          im[j] = hasB ? x[reflect(sb + j)] * win[j] : 0;
        }
        this.fft.forward(re, im);
        for (let f = 3; f < dimF; f++) {
          const g = f === 0 ? 0 : nFft - f;
          const zr = re[f], zi = im[f], nr = re[g], ni = im[g];
          out[(base + f) * T + t] = (zr + nr) / 2;
          out[(base + dimF + f) * T + t] = (zi - ni) / 2;
          if (hasB) {
            out[(base + f) * T + t + 1] = (zi + ni) / 2;
            out[(base + dimF + f) * T + t + 1] = (nr - zr) / 2;
          }
        }
        for (let f = 0; f < 3 && f < dimF; f++) {
          // UVR zeroes the three lowest bins before the model
          out[(base + f) * T + t] = 0;
          out[(base + dimF + f) * T + t] = 0;
          if (hasB) {
            out[(base + f) * T + t + 1] = 0;
            out[(base + dimF + f) * T + t + 1] = 0;
          }
        }
      }
    }
  }

  /** Inverse of `forward` for a model output of the same layout. Writes `chunk` samples per channel. */
  inverse(spec: Float32Array, outLeft: Float32Array, outRight: Float32Array): void {
    const { nFft, hop, dimF, frames: T, re, im, win } = this;
    const pad = nFft >> 1;
    const total = nFft + hop * (T - 1);
    const y = new Float64Array(total);
    const env = new Float64Array(total);
    const half = nFft >> 1;
    for (let c = 0; c < 2; c++) {
      y.fill(0);
      env.fill(0);
      const base = c * 2 * dimF;
      for (let t = 0; t < T; t += 2) {
        const hasB = t + 1 < T;
        // Z = A + i·B where A, B are the (Hermitian) spectra of frames t and t+1; one inverse FFT yields both frames.
        re.fill(0);
        im.fill(0);
        const lim = Math.min(dimF, half + 1);
        for (let f = 0; f < lim; f++) {
          const edge = f === 0 || (nFft % 2 === 0 && f === half); // DC / Nyquist bins are real
          const ar = spec[(base + f) * T + t], ai = edge ? 0 : spec[(base + dimF + f) * T + t];
          const br = hasB ? spec[(base + f) * T + t + 1] : 0, bi = hasB && !edge ? spec[(base + dimF + f) * T + t + 1] : 0;
          re[f] = ar - bi;
          im[f] = ai + br;
          if (f > 0 && f < half + (nFft % 2)) {
            re[nFft - f] = ar + bi;
            im[nFft - f] = -ai + br;
          }
        }
        for (let f = 0; f < nFft; f++) im[f] = -im[f]; // forward FFT of the conjugate = n · inverse FFT
        this.fft.forward(re, im);
        const oa = t * hop, ob = (t + 1) * hop;
        for (let j = 0; j < nFft; j++) {
          y[oa + j] += (re[j] / nFft) * win[j];
          env[oa + j] += win[j] * win[j];
          if (hasB) {
            y[ob + j] += (-im[j] / nFft) * win[j];
            env[ob + j] += win[j] * win[j];
          }
        }
      }
      const out = c === 0 ? outLeft : outRight;
      for (let i = 0; i < this.chunk; i++) out[i] = y[pad + i] / Math.max(env[pad + i], 1e-11);
    }
  }
}
