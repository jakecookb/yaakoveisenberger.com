import 'server-only';
import { del, get, list, put } from '@vercel/blob';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Everything the admin area persists lives in private Vercel Blob objects: nothing is
// reachable by URL, only through the server (and the permission-checked /media route).

// Only the production deployment talks to Blob (it bills per operation). Local dev and preview deploys keep the same JSON
// files on disk instead (LOCAL_STORE_DIR, default .local-store; /tmp on Vercel previews), so testing costs nothing.
const LIVE = process.env.VERCEL_ENV === 'production';
const LOCAL = LIVE ? null : path.resolve(process.env.VERCEL ? '/tmp/ve-store' : process.env.LOCAL_STORE_DIR || '.local-store');
export const isLiveStore = LIVE;

// Reads are memoised per server instance for a minute (writes and deletes here refresh it), so busy pages don't re-read.
const READ_TTL = 60_000;
const reads = new Map<string, { text: string | null; exp: number }>();
async function cachedText(pathname: string, fetchText: () => Promise<string | null>) {
  const hit = reads.get(pathname);
  if (hit && hit.exp > Date.now()) return hit.text;
  const text = await fetchText();
  if (reads.size > 1000) reads.clear();
  reads.set(pathname, { text, exp: Date.now() + READ_TTL });
  return text;
}
const forget = (pathname: string) => reads.delete(pathname);
const local = (pathname: string) => {
  const p = path.resolve(LOCAL!, pathname);
  if (!p.startsWith(LOCAL! + path.sep)) throw new Error('bad path');
  return p;
};

export const isBlobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN || LOCAL);

/** Pathnames under a prefix (e.g. "site/access/"). */
export async function listPaths(prefix: string, limit = 1000): Promise<string[]> {
  if (LOCAL) {
    const dir = local(prefix.endsWith('/') ? prefix : path.dirname(prefix));
    const names = await readdir(dir).catch(() => [] as string[]);
    return names.map((n) => `${prefix.endsWith('/') ? prefix : path.dirname(prefix) + '/'}${n}`).filter((p) => p.startsWith(prefix)).slice(0, limit);
  }
  const { blobs } = await list({ prefix, limit });
  return blobs.map((b) => b.pathname);
}

export async function removePath(pathname: string) {
  forget(pathname);
  if (LOCAL) return void (await rm(local(pathname), { force: true }));
  await del(pathname);
}

export async function readJson<T>(pathname: string): Promise<T | null> {
  if (!isBlobConfigured) return null;
  if (LOCAL) return readFile(local(pathname), 'utf8').then((t) => JSON.parse(t) as T, () => null);
  try {
    const text = await cachedText(pathname, async () => {
      const res = await get(pathname, { access: 'private', useCache: false });
      return res && res.statusCode === 200 ? new Response(res.stream).text() : null;
    });
    return text === null ? null : (JSON.parse(text) as T);
  } catch {
    return null;
  }
}

/** Like readJson, but only a missing file gives null — any other failure throws (so callers can fail closed). */
export async function readJsonStrict<T>(pathname: string): Promise<T | null> {
  if (!isBlobConfigured) return null;
  if (LOCAL) {
    try { return JSON.parse(await readFile(local(pathname), 'utf8')) as T; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
  }
  const text = await cachedText(pathname, async () => {
    const res = await get(pathname, { access: 'private', useCache: false });
    if (!res) return null;
    if (res.statusCode !== 200) throw new Error(`Unexpected status ${res.statusCode}`);
    return new Response(res.stream).text();
  });
  return text === null ? null : (JSON.parse(text) as T);
}

export async function writeJson(pathname: string, data: unknown) {
  forget(pathname);
  if (LOCAL) {
    await mkdir(path.dirname(local(pathname)), { recursive: true });
    return void (await writeFile(local(pathname), JSON.stringify(data)));
  }
  await put(pathname, JSON.stringify(data), {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}
