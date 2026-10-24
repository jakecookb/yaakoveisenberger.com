// Uploads the files cf-prepare.mjs set aside to the site's R2 bucket (same key as their URL path, e.g. ort/1.30.0/x.wasm).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
if (existsSync('.cf-large')) {
  for (const f of walk('.cf-large')) {
    const key = relative('.cf-large', f).split('\\').join('/');
    execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `ve-store/${key}`, '--file', f, '--content-type', 'application/wasm', '--remote'], { stdio: 'inherit' });
  }
}
