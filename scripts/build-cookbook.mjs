// Builds the Cookbook app (github.com/jakecookb/cookbook, a Vite single-page app with base '/cookbook/') and copies it into
// public/cookbook so it ships with this site at yaakoveisenberger.com/cookbook.
// Uses COOKBOOK_DIR if set (a local checkout), otherwise clones the repo. Needs VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY in the environment (public, browser-side values).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, VITE_LEGACY_ORIGIN: '' } });
let dir = process.env.COOKBOOK_DIR;
if (!dir) {
  dir = path.join(mkdtempSync(path.join(tmpdir(), 'cookbook-')), 'cookbook');
  run(`git clone --depth 1 https://github.com/jakecookb/cookbook.git ${dir}`);
}
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) console.warn('build-cookbook: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — recipes will not load.');
run('npm ci --no-audit --no-fund', dir);
run('npx vite build', dir);
const out = path.join(dir, 'dist', 'cookbook');
if (!existsSync(path.join(out, 'index.html'))) throw new Error('build-cookbook: dist/cookbook/index.html missing');
rmSync('public/cookbook', { recursive: true, force: true });
cpSync(out, 'public/cookbook', { recursive: true });
for (const d of ['.well-known', 'downloads']) if (existsSync(path.join(dir, 'public', d))) cpSync(path.join(dir, 'public', d), path.join('public/cookbook', d), { recursive: true });
console.log('build-cookbook: copied to public/cookbook');
