import 'server-only';
import { get, put } from '@vercel/blob';

// Everything the admin area persists lives in private Vercel Blob objects: nothing is
// reachable by URL, only through the server (and the permission-checked /media route).

export const isBlobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function readJson<T>(pathname: string): Promise<T | null> {
  if (!isBlobConfigured) return null;
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
  const res = await get(pathname, { access: 'private', useCache: false });
  if (!res) return null;
  if (res.statusCode !== 200) throw new Error(`Unexpected status ${res.statusCode}`);
  return JSON.parse(await new Response(res.stream).text()) as T;
}

export async function writeJson(pathname: string, data: unknown) {
  await put(pathname, JSON.stringify(data), {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}
