import { randomFillSync } from 'node:crypto';

export const dynamic = 'force-dynamic';

const CHUNK = 256 * 1024;
const MAX = 32 * 1024 * 1024;
// Random bytes, so no proxy or browser can compress or cache them into a faster-looking test.
const block = randomFillSync(Buffer.allocUnsafe(CHUNK));

/** Streams `bytes` bytes of random data (capped) for the download test. */
export function GET(req: Request) {
  const asked = Number(new URL(req.url).searchParams.get('bytes'));
  const total = Math.min(MAX, Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : 8 * 1024 * 1024);
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const n = Math.min(CHUNK, total - sent);
      if (n <= 0) return controller.close();
      controller.enqueue(n === CHUNK ? block : block.subarray(0, n));
      sent += n;
    },
  });
  return new Response(body, {
    headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(total), 'Cache-Control': 'no-store, no-transform', 'Content-Encoding': 'identity' },
  });
}
