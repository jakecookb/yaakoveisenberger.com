export const dynamic = 'force-dynamic';

/** Reads and throws away whatever the browser sends, for the upload test (hosting limits uploads to about 4 MB each). */
export async function POST(req: Request) {
  let bytes = 0;
  const reader = req.body?.getReader();
  if (reader) for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; }
  return Response.json({ bytes }, { headers: { 'Cache-Control': 'no-store' } });
}
