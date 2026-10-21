// Everything the photo editor can change, as plain data (so undo/redo is just a list of these).

export type Aspect = 'original' | '1:1' | '4:5' | '3:2' | '16:9' | '9:16';
export type BgMode = 'keep' | 'transparent' | 'color' | 'blur';
export type CurveChannel = 'master' | 'r' | 'g' | 'b';
export type Point = [number, number]; // 0..1 in, 0..1 out

export interface Params {
  // light
  exposure: number; // EV, -3..3
  contrast: number; // -100..100
  highlights: number;
  shadows: number;
  // colour
  temp: number;
  tint: number;
  vibrance: number;
  saturation: number;
  curves: Record<CurveChannel, Point[]>;
  // detail & effects
  clarity: number;
  sharpen: number; // 0..100
  grain: number; // 0..100
  vignette: number; // -100..100
  telephoto: number; // -100 (wide/barrel) .. 100 (telephoto/pincushion)
  // grade
  preset: string;
  presetAmount: number; // 0..100
  // geometry
  rotate: 0 | 1 | 2 | 3; // quarter turns clockwise
  straighten: number; // degrees, -45..45
  flipH: boolean;
  flipV: boolean;
  aspect: Aspect;
  zoom: number; // 1..4
  panX: number; // -1..1
  panY: number;
  // background
  bg: BgMode;
  bgColor: string;
  edge: number; // 0..100 edge softness of the cut-out
}

export const LINE: Point[] = [[0, 0], [1, 1]];

export const DEFAULTS: Params = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0,
  temp: 0, tint: 0, vibrance: 0, saturation: 0,
  curves: { master: LINE, r: LINE, g: LINE, b: LINE },
  clarity: 0, sharpen: 0, grain: 0, vignette: 0, telephoto: 0,
  preset: 'none', presetAmount: 100,
  rotate: 0, straighten: 0, flipH: false, flipV: false, aspect: 'original', zoom: 1, panX: 0, panY: 0,
  bg: 'keep', bgColor: '#ffffff', edge: 35,
};

export const ASPECTS: { id: Aspect; label: string; ratio?: number }[] = [
  { id: 'original', label: 'Original' },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
];

/** A colour grade: lift/gamma/gain per channel, split toning, fade and saturation — mixed in by `presetAmount`. */
export interface Grade {
  lift: [number, number, number];
  gamma: [number, number, number];
  gain: [number, number, number];
  shadowTint: [number, number, number];
  highTint: [number, number, number];
  fade: number;
  sat: number; // multiplier
  contrast: number; // extra, -1..1
  mono?: boolean;
}

export const NEUTRAL_GRADE: Grade = { lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], shadowTint: [0, 0, 0], highTint: [0, 0, 0], fade: 0, sat: 1, contrast: 0 };

export interface Preset { id: string; name: string; swatch: [string, string]; grade: Grade }

const g = (p: Partial<Grade>): Grade => ({ ...NEUTRAL_GRADE, ...p });

export const PRESETS: Preset[] = [
  { id: 'none', name: 'Original', swatch: ['#525252', '#a3a3a3'], grade: NEUTRAL_GRADE },
  { id: 'cinematic', name: 'Cinematic', swatch: ['#0f766e', '#f59e0b'], grade: g({ shadowTint: [-0.05, 0.02, 0.07], highTint: [0.07, 0.02, -0.06], contrast: 0.18, sat: 0.92, lift: [0.0, 0.01, 0.02] }) },
  { id: 'golden', name: 'Golden Hour', swatch: ['#b45309', '#fde68a'], grade: g({ gain: [1.08, 1.0, 0.88], highTint: [0.05, 0.02, -0.04], sat: 1.12, contrast: 0.06 }) },
  { id: 'film', name: 'Film', swatch: ['#57534e', '#e7e5e4'], grade: g({ fade: 0.35, sat: 0.85, shadowTint: [0.0, 0.02, 0.03], highTint: [0.03, 0.02, -0.01], contrast: -0.05, gamma: [1.0, 1.02, 0.98] }) },
  { id: 'moody', name: 'Moody', swatch: ['#1e293b', '#64748b'], grade: g({ gain: [0.95, 0.97, 1.02], sat: 0.7, contrast: 0.22, shadowTint: [-0.02, 0.0, 0.04], fade: 0.12 }) },
  { id: 'vivid', name: 'Vivid', swatch: ['#db2777', '#22d3ee'], grade: g({ sat: 1.35, contrast: 0.15 }) },
  { id: 'cool', name: 'Nordic', swatch: ['#0c4a6e', '#bae6fd'], grade: g({ gain: [0.93, 1.0, 1.08], sat: 0.85, fade: 0.08, highTint: [-0.02, 0.0, 0.04] }) },
  { id: 'noir', name: 'Noir', swatch: ['#0a0a0a', '#f5f5f5'], grade: g({ mono: true, contrast: 0.3, sat: 0 }) },
  { id: 'silver', name: 'Silver', swatch: ['#404040', '#d4d4d4'], grade: g({ mono: true, fade: 0.2, contrast: 0.05, sat: 0, highTint: [0.02, 0.015, 0.0] }) },
  { id: 'retro', name: 'Retro', swatch: ['#9a3412', '#fef3c7'], grade: g({ fade: 0.25, sat: 0.9, gain: [1.06, 1.0, 0.86], shadowTint: [0.04, 0.0, 0.06], contrast: 0.05 }) },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: number[], b: number[], t: number) => a.map((v, i) => mix(v, b[i], t)) as [number, number, number];

/** The preset's grade, faded towards neutral by the amount slider. */
export function gradeFor(p: Params): Grade {
  const pr = presetById(p.preset).grade;
  const t = p.presetAmount / 100;
  return {
    lift: mix3(NEUTRAL_GRADE.lift, pr.lift, t),
    gamma: mix3(NEUTRAL_GRADE.gamma, pr.gamma, t),
    gain: mix3(NEUTRAL_GRADE.gain, pr.gain, t),
    shadowTint: mix3(NEUTRAL_GRADE.shadowTint, pr.shadowTint, t),
    highTint: mix3(NEUTRAL_GRADE.highTint, pr.highTint, t),
    fade: mix(0, pr.fade, t),
    sat: mix(1, pr.sat, t),
    contrast: mix(0, pr.contrast, t),
    mono: pr.mono && t > 0,
  };
}
