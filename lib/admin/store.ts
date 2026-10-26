import 'server-only';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Everything the admin area persists lives in private storage objects: nothing is reachable by URL, only through the
// server (and the permission-checked /media route). Two interchangeable backends:
//  - R2    on Cloudflare (STORAGE=r2, the `STORE` bucket binding) — the live site; reads are effectively free.
//  - disk  everywhere else (LOCAL_STORE_DIR, default .local-store), so local testing makes zero external calls.

const R2 = process.env.STORAGE === 'r2';
const LOCAL = R2 ? null : path.resolve(process.env.LOCAL_STORE_DIR || '.local-store');
/** True only on the live site (analytics writes are skipped elsewhere). */
export const isLiveStore = R2;
export const isBlobConfigured = true;

interface R2Object { body: ReadableStream; etag: string; httpEtag: string; httpMetadata?: { contentType?: string }; text(): Promise<string> }
interface R2Bucket {
  get(key: string, opts?: { onlyIf?: { etagDoesNotMatch: string } }): Promise<R2Object | { etag: string; httpEtag: string } | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | string | Blob, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
  list(opts: { prefix: string; limit?: number; cursor?: string }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
}
async function bucket(): Promise<R2Bucket> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  return (getCloudflareContext().env as unknown as { STORE: R2Bucket }).STORE;
}

const local = (pathname: string) => {
  const p = path.resolve(LOCAL!, pathname);
  if (!p.startsWith(LOCAL! + path.sep)) throw new Error('bad path');
  return p;
};

// Site settings are memoised per server instance for 10 seconds (writes here refresh it). Everything else (access records,
// credentials) is always read fresh: an approval saved on one instance must be seen at once by every other one.
const READ_TTL = 10_000;
const CACHED = new Set(['site/settings.json']);
const reads = new Map<string, { text: string | null; exp: number }>();
async function cachedText(pathname: string, fetchText: () => Promise<string | null>) {
  if (!CACHED.has(pathname)) return fetchText();
  const hit = reads.get(pathname);
  if (hit && hit.exp > Date.now()) return hit.text;
  const text = await fetchText();
  if (reads.size > 1000) reads.clear();
  reads.set(pathname, { text, exp: Date.now() + READ_TTL });
  return text;
}
const forget = (pathname: string) => reads.delete(pathname);

/** Pathnames under a prefix (e.g. "site/access/"). */
export async function listPaths(prefix: string, limit = 1000): Promise<string[]> {
  if (R2) {
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const r = await (await bucket()).list({ prefix, limit: Math.min(1000, limit - out.length), cursor });
      out.push(...r.objects.map((o) => o.key));
      cursor = r.truncated ? r.cursor : undefined;
    } while (cursor && out.length < limit);
    return out;
  }
  {
    const dir = local(prefix.endsWith('/') ? prefix : path.dirname(prefix));
    const names = await readdir(dir).catch(() => [] as string[]);
    return names.map((n) => `${prefix.endsWith('/') ? prefix : path.dirname(prefix) + '/'}${n}`).filter((p) => p.startsWith(prefix) && !p.endsWith('.type')).slice(0, limit);
  }
}

export async function removePath(pathname: string | string[]) {
  const all = Array.isArray(pathname) ? pathname : [pathname];
  if (!all.length) return;
  all.forEach(forget);
  if (R2) return (await bucket()).delete(all);
  await Promise.all(all.map((p) => rm(local(p), { force: true })));
}

/** Raw text of a stored file; null when missing. Throws on other failures. */
async function readText(pathname: string): Promise<string | null> {
  if (R2) {
    const o = await (await bucket()).get(pathname);
    return o && 'text' in o ? o.text() : null;
  }
  try { return await readFile(local(pathname), 'utf8'); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
}

export async function readJson<T>(pathname: string): Promise<T | null> {
  if (!isBlobConfigured) return null;
  try {
    const text = await cachedText(pathname, () => readText(pathname));
    return text === null ? null : (JSON.parse(text) as T);
  } catch {
    return null;
  }
}

/** Like readJson, but only a missing file gives null — any other failure throws (so callers can fail closed). */
export async function readJsonStrict<T>(pathname: string): Promise<T | null> {
  if (!isBlobConfigured) return null;
  const text = await cachedText(pathname, () => readText(pathname));
  return text === null ? null : (JSON.parse(text) as T);
}

export async function writeJson(pathname: string, data: unknown) {
  forget(pathname);
  await putFile(pathname, JSON.stringify(data), 'application/json', true);
}

/** Stores a file (photos, logos, JSON). `overwrite: false` refuses to replace an existing one. */
export async function putFile(pathname: string, body: string | Blob | ArrayBuffer, contentType: string, overwrite = false) {
  if (R2) return void (await (await bucket()).put(pathname, body, { httpMetadata: { contentType } }));
  {
    const p = local(pathname);
    if (!overwrite && (await stat(p).catch(() => null))) throw new Error('exists');
    await mkdir(path.dirname(p), { recursive: true });
    const data = typeof body === 'string' ? body : Buffer.from(body instanceof Blob ? await body.arrayBuffer() : body);
    await writeFile(p, data);
    if (contentType !== 'application/json') await writeFile(`${p}.type`, contentType);
  }
}

/** A stored file as a stream, honouring If-None-Match (status 304 with no body when unchanged). */
export async function readFileStream(pathname: string, ifNoneMatch?: string): Promise<{ status: 200 | 304; body?: ReadableStream; contentType?: string; etag?: string } | null> {
  if (R2) {
    const o = await (await bucket()).get(pathname, ifNoneMatch ? { onlyIf: { etagDoesNotMatch: ifNoneMatch.replace(/^W\//, '').replace(/"/g, '') } } : undefined);
    if (!o) return null;
    if (!('body' in o)) return { status: 304, etag: o.httpEtag };
    return { status: 200, body: o.body, contentType: o.httpMetadata?.contentType, etag: o.httpEtag };
  }
  {
    const p = local(pathname);
    const buf = await readFile(p).catch(() => null);
    if (!buf) return null;
    const etag = `"${(await stat(p)).mtimeMs.toString(36)}"`;
    if (ifNoneMatch === etag) return { status: 304, etag };
    const contentType = await readFile(`${p}.type`, 'utf8').catch(() => undefined);
    return { status: 200, body: new Response(buf).body!, contentType, etag };
  }
}
