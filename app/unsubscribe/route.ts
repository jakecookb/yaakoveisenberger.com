import { unsubscribe } from '@/lib/subscribers';

export const dynamic = 'force-dynamic';

const page = (msg: string) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0a;color:#e5e5e5;font-family:system-ui,sans-serif"><div style="text-align:center;padding:24px"><p style="font-size:20px">${msg}</p><a href="/" style="color:#c8a96a">Back to yaakoveisenberger.com</a></div>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

/** One-click unsubscribe from the link in every email (GET from the link, POST from mail apps' unsubscribe button). */
async function handle(req: Request) {
  const u = new URL(req.url);
  const ok = await unsubscribe(u.searchParams.get('k') ?? '', u.searchParams.get('t') ?? '').catch(() => false);
  return page(ok ? 'You’re unsubscribed. Sorry to see you go!' : 'That unsubscribe link isn’t valid.');
}
export const GET = handle;
export const POST = handle;
