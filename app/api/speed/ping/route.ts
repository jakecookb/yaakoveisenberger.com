export const dynamic = 'force-dynamic';

/** An empty answer, as fast as possible: the browser times how long the round trip takes. */
export function GET() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
export const HEAD = GET;
