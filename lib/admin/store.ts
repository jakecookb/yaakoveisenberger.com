import 'server-only';
import { del, get, list, put } from '@vercel/blob';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Everything the admin area persists lives in private Vercel Blob objects: nothing is
// reachable by URL, only through the server (and the permission-checked /media route).

// For local testing only: LOCAL_STORE_DIR keeps the same JSON files on disk instead (never used on Vercel).
const LOCAL = !process.env.VERCEL && process.env.LOCAL_STORE_DIR ? path.resolve(process.env.LOCAL_STORE_DIR) : null;
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
  if (LOCAL) return void (await rm(local(pathname), { force: true }));
  await del(pathname);
}

export async function readJson<T>(pathname: string): Promise<T | null> {
  if (!isBlobConfigured) return null;
  if (LOCAL) return readFile(local(pathname), 'utf8').then((t) => JSON.parse(t) as T, () => null);
  try {
    const res = await get(pathname, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return JSON.parse(await new Response(res.stream).text()) as T;
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
  const res = await get(pathname, { access: 'private', useCache: false });
  if (!res) return null;
  if (res.statusCode !== 200) throw new Error(`Unexpected status ${res.statusCode}`);
  return JSON.parse(await new Response(res.stream).text()) as T;
}

export async function writeJson(pathname: string, data: unknown) {
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
