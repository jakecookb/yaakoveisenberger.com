// Before the Cloudflare build: Workers static assets max out at 25 MiB per file, so any bigger file under public/ort
// (the ONNX Runtime WebGPU build, ~28 MB) is moved to .cf-large/ and uploaded to R2 by cf-upload-large.mjs instead;
// app/ort/[version]/[file]/route.ts serves it from there.
import { mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LIMIT = 24 * 1024 * 1024;
let n = 0;
for (const v of readdirSync('public/ort', { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const f of readdirSync(join('public/ort', v.name))) {
    const p = join('public/ort', v.name, f);
    if (statSync(p).size <= LIMIT) continue;
    mkdirSync(join('.cf-large/ort', v.name), { recursive: true });
    renameSync(p, join('.cf-large/ort', v.name, f));
    n++;
  }
}
console.log(`[cf-prepare] moved ${n} large file(s) to .cf-large`);
