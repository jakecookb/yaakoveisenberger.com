// Builds the saved news files the website reads: for each topic, its list of stories and the readable page for each story.
// Run by .github/workflows/news-refresh.yml every 30 minutes (GitHub Actions is free and has no tight CPU limit), then
// uploaded to the site's R2 storage. The website itself never fetches or parses publishers' pages: a visitor's request only
// reads these small files, which is what keeps it under the Cloudflare free plan's 10 ms CPU limit.
//   npx tsx scripts/build-news.ts            builds and uploads (needs CLOUDFLARE_API_TOKEN)
//   npx tsx scripts/build-news.ts --dry      builds only and prints what it would upload
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildCars, buildStories, buildTech, buildWeapons } from '@/lib/news/build';
import type { NewsTopic } from '@/lib/news/slug';
import type { CarItem } from '@/lib/cars/types';

const dry = process.argv.includes('--dry') || !process.env.CLOUDFLARE_API_TOKEN;
const BUCKET = 've-store';
const OUT = path.resolve('.news-out');
const now = Date.now();

const topics: { id: NewsTopic; build: () => Promise<object | null>; shown: (v: never) => CarItem[] }[] = [
  { id: 'cars', build: () => buildCars(now), shown: (v: { thisWeek: CarItem[]; earlier: CarItem[] }) => [...v.thisWeek, ...v.earlier] },
  { id: 'tech', build: () => buildTech(now), shown: (v: { samsung: CarItem[]; apple: CarItem[]; more: CarItem[] }) => [...v.samsung, ...v.apple, ...v.more] },
  { id: 'weapons', build: () => buildWeapons(now), shown: (v: Record<string, CarItem[]>) => Object.values(v).flat() },
] as never;

async function save(key: string, data: unknown) {
  const file = path.join(OUT, key);
  await mkdir(path.dirname(file), { recursive: true });
  const body = JSON.stringify(data);
  await writeFile(file, body);
  console.log(`${key}: ${(body.length / 1024).toFixed(1)} KB`);
  if (!dry) execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, `--file=${file}`, '--content-type=application/json', '--remote'], { stdio: 'inherit' });
}

let failed = 0;
for (const t of topics) {
  const t0 = Date.now();
  const sel = await t.build();
  if (!sel) { console.log(`${t.id}: too few stories came back, keeping the saved list`); failed++; continue; }
  const stories = await buildStories(t.id, t.shown(sel as never));
  await save(`news/${t.id}-feed.json`, { at: now, v: sel });
  if (Object.keys(stories).length) await save(`news/${t.id}-stories.json`, stories);
  console.log(`${t.id}: ${Object.keys(stories).length} stories in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
if (failed === topics.length) { console.error('Every topic failed'); process.exit(1); }
