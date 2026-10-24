// Cookbook deep links (/cookbook/recipes/…): real files in public/cookbook are served first; any other path is one of the
// single-page app's own routes, so it gets the app shell.
export async function GET(request: Request) {
  const shell = new URL('/cookbook/index.html', request.url);
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const assets = (getCloudflareContext().env as unknown as { ASSETS: { fetch(u: URL): Promise<Response> } }).ASSETS;
    const res = await assets.fetch(shell);
    return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' } });
  } catch {
    return fetch(shell); // next dev / next start
  }
}
