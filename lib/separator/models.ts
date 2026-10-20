// The separation options shown to visitors. The two AI models are the open-source MDX-Net networks from the
// Ultimate Vocal Remover project, run entirely inside the visitor's browser (nothing is uploaded anywhere).
// Parameters come from UVR's own model table (keyed by the model file's hash); sizes and SHA-256 are checked after
// download so a changed or corrupted file is rejected rather than run.

export type ModeId = 'vocals' | 'instrumental' | 'quick';

export interface AiModel {
  id: 'vocals' | 'instrumental';
  /** What the network outputs directly; the other stem is "mix minus that". */
  primary: 'vocals' | 'instrumental';
  file: string;
  urls: string[];
  bytes: number;
  sha256: string;
  dimF: number;
  /** Frames per chunk is 2^dimTPow. */
  dimTPow: number;
  nFft: number;
  hop: number;
  compensate: number;
}

// Hugging Face hosts the files and lets browsers read them. These repos hold byte-identical copies (same SHA-256), so
// if one is down the next is tried; the download is rejected unless its hash matches.
const HF = 'https://huggingface.co/';
const mirrors = (kim: string, inst: string, file: 'kim' | 'inst') => {
  const f = file === 'kim' ? kim : inst;
  return [
    `${HF}seanghay/uvr_models/resolve/main/${f}`,
    `${HF}Politrees/UVR_resources/resolve/main/models/MDXNet/${f}`,
    `${HF}Eddycrack864/audio-separator-models/resolve/main/mdx-net/${f}`,
    `${HF}Blane187/all_public_uvr_models/resolve/main/${f}`,
  ];
};

export const AI_MODELS: Record<'vocals' | 'instrumental', AiModel> = {
  vocals: {
    id: 'vocals',
    primary: 'vocals',
    file: 'Kim_Vocal_2.onnx',
    urls: mirrors('Kim_Vocal_2.onnx', 'UVR-MDX-NET-Inst_HQ_3.onnx', 'kim'),
    bytes: 66759214,
    sha256: 'ce74ef3b6a6024ce44211a07be9cf8bc6d87728cc852a68ab34eb8e58cde9c8b',
    dimF: 3072,
    dimTPow: 8,
    nFft: 7680,
    hop: 1024,
    compensate: 1.009,
  },
  instrumental: {
    id: 'instrumental',
    primary: 'instrumental',
    file: 'UVR-MDX-NET-Inst_HQ_3.onnx',
    urls: mirrors('Kim_Vocal_2.onnx', 'UVR-MDX-NET-Inst_HQ_3.onnx', 'inst'),
    bytes: 66759214,
    sha256: '317554b07fe1ea5279a77f2b1520a41ea4b93432560c4ffd08792c30fddf9adc',
    dimF: 3072,
    dimTPow: 8,
    nFft: 6144,
    hop: 1024,
    compensate: 1.022,
  },
};

export interface ModeInfo {
  id: ModeId;
  name: string;
  tagline: string;
  details: string[];
  recommended?: boolean;
}

export const MODES: ModeInfo[] = [
  {
    id: 'vocals',
    name: 'Best overall',
    tagline: 'Kim Vocal 2 — the cleanest vocals',
    recommended: true,
    details: [
      'High-quality AI model (open-source MDX-Net). Pulls the voice out with the least backing-music left in it.',
      'The instrumental is everything that remains, so it can keep a faint trace of the voice.',
      'Downloads once (63 MB), then stays on your device.',
    ],
  },
  {
    id: 'instrumental',
    name: 'Best backing track',
    tagline: 'UVR Inst HQ 3 — the cleanest instrumental',
    details: [
      'High-quality AI model built to remove the voice cleanly: the pick for karaoke and backing tracks.',
      'The vocal stem is the difference, so it can carry a little drum or reverb bleed.',
      'Downloads once (63 MB), then stays on your device.',
    ],
  },
  {
    id: 'quick',
    name: 'Instant preview',
    tagline: 'Done in seconds — lower quality',
    details: [
      'No AI and no download: it removes whatever sits in the exact centre of a stereo mix.',
      'Rough: some vocals stay in the instrumental, and centred bass and kick drum get thinner.',
      'Needs a stereo song. Good for a quick check, not for finished work.',
    ],
  },
];

export const SAMPLE_RATE = 44100;
