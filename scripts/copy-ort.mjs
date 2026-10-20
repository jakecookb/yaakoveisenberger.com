// Copies the ONNX Runtime Web files the audio separator needs into public/ort, so the site serves them itself
// (no third-party CDN at run time). Runs after `npm install`; the copied files are git-ignored.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const dest = join(root, 'public', 'ort');
if (!existsSync(src)) {
  console.log('[copy-ort] onnxruntime-web not installed; skipping');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
const wanted = new Set([
  'ort.wasm.min.mjs',
  'ort.webgpu.min.mjs',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
]);
let n = 0;
for (const f of readdirSync(src)) if (wanted.has(f)) { cpSync(join(src, f), join(dest, f)); n++; }
console.log(`[copy-ort] copied ${n}/${wanted.size} files to public/ort`);
