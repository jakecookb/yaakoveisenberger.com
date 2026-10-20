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

export async function writeJson(pathname: string, data: unknown) {
  await put(pathname, JSON.stringify(data), {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}
