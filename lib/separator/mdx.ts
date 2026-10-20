import { MdxDsp } from './mdx-dsp';
import type { AiModel } from './models';

export interface SeparateProgress {
  chunk: number;
  chunks: number;
}

/**
 * Runs an MDX-Net model over a whole song, following Ultimate Vocal Remover's method: the (zero-padded) song is cut into
 * fixed-length chunks that overlap by the transform's edge region; each chunk goes through STFT → network → iSTFT and the
 * clean middle of every result is stitched back together. `runModel` receives/returns tensors laid out as [4, dimF, dimT].
 * Returns the stem the model predicts (already multiplied by the model's volume compensation).
 */
export async function separateMdx(
  left: Float32Array,
  right: Float32Array,
  model: AiModel,
  runModel: (input: Float32Array) => Promise<Float32Array>,
  onProgress?: (p: SeparateProgress) => void,
  isCancelled?: () => boolean,
): Promise<[Float32Array, Float32Array]> {
  const dimT = 2 ** model.dimTPow;
  const dsp = new MdxDsp(model.nFft, model.hop, model.dimF, dimT);
  const { chunk } = dsp;
  const trim = model.nFft >> 1;
  const gen = chunk - 2 * trim;
  const n = left.length;
  const chunks = Math.floor(n / gen) + 1;

  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  const segL = new Float32Array(chunk), segR = new Float32Array(chunk);
  const input = new Float32Array(4 * model.dimF * dimT);
  const yL = new Float32Array(chunk), yR = new Float32Array(chunk);

  for (let i = 0; i < chunks; i++) {
    if (isCancelled?.()) throw new Error('cancelled');
    onProgress?.({ chunk: i, chunks });
    // Sample s of the padded song is song[s - trim] (zeros outside the song).
    const start = i * gen - trim;
    for (let j = 0; j < chunk; j++) {
      const k = start + j;
      const inside = k >= 0 && k < n;
      segL[j] = inside ? left[k] : 0;
      segR[j] = inside ? right[k] : 0;
    }
    dsp.forward(segL, segR, input);
    const pred = await runModel(input);
    dsp.inverse(pred, yL, yR);
    const dst = i * gen;
    const take = Math.min(gen, n - dst);
    for (let j = 0; j < take; j++) {
      outL[dst + j] = yL[trim + j] * model.compensate;
      outR[dst + j] = yR[trim + j] * model.compensate;
    }
  }
  onProgress?.({ chunk: chunks, chunks });
  return [outL, outR];
}

/** Turns the model's stem into the two outputs; both are scaled together so neither clips. */
export function makeStems(
  mixL: Float32Array,
  mixR: Float32Array,
  predL: Float32Array,
  predR: Float32Array,
  primary: 'vocals' | 'instrumental',
) {
  const n = mixL.length;
  const subL = new Float32Array(n), subR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    subL[i] = mixL[i] - predL[i];
    subR[i] = mixR[i] - predR[i];
  }
  const stems = primary === 'vocals'
    ? { vocals: [predL, predR], instrumental: [subL, subR] }
    : { vocals: [subL, subR], instrumental: [predL, predR] };
  let peak = 0;
  for (const s of [stems.vocals, stems.instrumental]) for (const ch of s) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(ch[i]));
  if (peak > 0.99) {
    const g = 0.99 / peak;
    for (const s of [stems.vocals, stems.instrumental]) for (const ch of s) for (let i = 0; i < n; i++) ch[i] *= g;
  }
  return stems as { vocals: [Float32Array, Float32Array]; instrumental: [Float32Array, Float32Array] };
}
