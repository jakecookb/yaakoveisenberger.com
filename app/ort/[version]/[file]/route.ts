import { readFileStream } from '@/lib/admin/store';

// ONNX Runtime files too big for static hosting (see scripts/cf-prepare.mjs) are served from storage. The folder is
// versioned, so they're cached for a year.
export async function GET(request: Request, { params }: { params: Promise<{ version: string; file: string }> }) {
  const { version, file } = await params;
  if (!/^[\d.]+$/.test(version) || !/^ort-[\w.-]+\.wasm$/.test(file)) return new Response('Not found', { status: 404 });
  const res = await readFileStream(`ort/${version}/${file}`, request.headers.get('if-none-match') ?? undefined).catch(() => null);
  if (!res) return new Response('Not found', { status: 404 });
  const headers = { 'Cache-Control': 'public, max-age=31536000, immutable', 'Cross-Origin-Resource-Policy': 'same-origin', ...(res.etag ? { ETag: res.etag } : {}) };
  if (res.status === 304) return new Response(null, { status: 304, headers });
  return new Response(res.body, { headers: { ...headers, 'Content-Type': 'application/wasm' } });
}
