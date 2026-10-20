import type { ModeId } from '@/lib/separator/models';

export interface SeparateRequest {
  type: 'separate';
  mode: ModeId;
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  /** Use the graphics card (WebGPU) when available. Falls back to the CPU by itself if it misbehaves. */
  gpu: boolean;
  threads: number;
}
export interface Mp3Request {
  type: 'mp3';
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  kbps: number;
}
export type ToWorker = SeparateRequest | Mp3Request | { type: 'cancel' };

export type FromWorker =
  | { type: 'status'; text: string }
  | { type: 'download'; loaded: number; total: number }
  | { type: 'progress'; chunk: number; chunks: number; startedAt: number; backend: string }
  | { type: 'done'; vocals: [Float32Array, Float32Array]; instrumental: [Float32Array, Float32Array]; backend: string }
  | { type: 'mp3'; buffer: ArrayBuffer }
  | { type: 'error'; message: string };
