// The Worker entry (wrangler.jsonc "main"). It puts a small edge cache in front of the Next.js app built by OpenNext.
//
// Why: every page on the site renders per request (force-dynamic, so saved settings show at once), and the free Workers
// plan allows only 10 ms of CPU per request. A full Next.js render often goes over that and the visitor gets
// "Error 1102". A copy of a public page served from Cloudflare's cache costs almost no CPU.
//
// What is cached: GET page views (HTML and the RSC data Next.js fetches when you click around) and public photos, and only
// for visitors with no sign-in cookie. Admin, approved visitors and anyone signed in always get a fresh page. Each copy is
// keyed by the deploy version and the saved settings file's ETag, so a deploy or any save in the editor (including
// locking a box) switches to new copies at once. Copies also expire after an hour (the live-campaign count, news).

import worker from './.open-next/worker.js';

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';

const TTL = 3600;
// Never cached: admin, APIs, the fundraising platform (its own sign-in), sign-in links, link redirects, unsubscribe, the
// Cookbook (gated separately) and static files (already served without the Worker).
const SKIP = /^\/(admin|api|fund|access\/verify|go|unsubscribe|cookbook|ort|_next|cdn-cgi)(\/|$)/;
const SIGNED_IN = /(?:^|;\s*)(ve_visitor|ve_admin|__Host-ve_admin|ve_challenge|sb-[^=]*)=/;
const VARY = ['rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-router-segment-prefetch', 'next-url'];

let settings = { tag: '', at: 0 };
async function settingsTag(env) {
  if (Date.now() - settings.at < 10_000) return settings.tag;
  const head = await env.STORE.head('site/settings.json').catch(() => null);
  settings = { tag: head?.httpEtag ?? 'none', at: Date.now() };
  return settings.tag;
}

async function cacheKey(request, url, env) {
  const parts = VARY.map((h) => request.headers.get(h) ?? '').join('|');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(parts)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const k = new URL(url);
  k.searchParams.set('__v', `${env.CF_VERSION_METADATA?.id ?? 'dev'}.${await settingsTag(env)}.${hash}`.replace(/"/g, ''));
  return new Request(k.toString(), { method: 'GET' });
}

const edgeCache = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cacheable = (request.method === 'GET' || request.method === 'HEAD') && !SKIP.test(url.pathname) && !SIGNED_IN.test(request.headers.get('cookie') ?? '') && !request.headers.get('next-action');
    if (!cacheable) return worker.fetch(request, env, ctx);

    const media = url.pathname.startsWith('/media/');
    const key = await cacheKey(request, url, env).catch(() => null);
    if (!key) return worker.fetch(request, env, ctx);
    const cache = caches.default;
    const hit = await cache.match(key).catch(() => null);
    if (hit) {
      if (media) return hit;
      // Pages keep the app's own browser rule (don't store), so the browser always asks again and sees new saves.
      const res = new Response(request.method === 'HEAD' ? null : hit.body, hit);
      res.headers.set('Cache-Control', hit.headers.get('x-browser-cache') ?? 'private, no-store');
      res.headers.delete('x-browser-cache');
      res.headers.set('x-edge-cache', 'HIT');
      return res;
    }

    const res = await worker.fetch(request, env, ctx);
    const type = res.headers.get('content-type') ?? '';
    const cc = res.headers.get('cache-control') ?? '';
    const store =
      request.method === 'GET' && res.status === 200 && !res.headers.has('set-cookie') &&
      (media ? /\bpublic\b/.test(cc) : /^(text\/html|text\/x-component)/.test(type));
    if (!store) return res;
    const copy = new Response(res.clone().body, res);
    copy.headers.delete('vary'); // the key already includes everything the page varies on
    if (!media) {
      copy.headers.set('x-browser-cache', cc || 'private, no-store');
      copy.headers.set('Cache-Control', `public, s-maxage=${TTL}`);
    }
    ctx.waitUntil(cache.put(key, copy).catch(() => {}));
    return res;
  },
};

export default edgeCache;
