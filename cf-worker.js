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

import { jwtVerify } from 'jose';
import worker from './.open-next/worker.js';
import { cleanMaintenance, isOpenWhileClosed, MAINTENANCE_PATH, renderMaintenance } from './lib/maintenance/page.ts';

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

// ---- "Closed for now" (maintenance) mode, switched on in /admin/maintenance ----
// While it's on, visitors get the closed page; the owner (a valid admin session) still sees the whole site.

let maint = { m: null, at: 0 };
async function maintenance(env) {
  if (Date.now() - maint.at < 10_000) return maint.m;
  const obj = await env.STORE.get(MAINTENANCE_PATH).catch(() => null);
  const m = obj ? cleanMaintenance(await obj.json().catch(() => null)) : null;
  maint = { m: m?.enabled ? m : null, at: Date.now() };
  return maint.m;
}

const admins = new Map();
async function isAdmin(request, env) {
  const token = /(?:^|;\s*)(?:__Host-ve_admin|ve_admin)=([^;]+)/.exec(request.headers.get('cookie') ?? '')?.[1];
  const secret = env.ADMIN_SESSION_SECRET ?? '';
  if (!token || secret.length < 32) return false;
  const hit = admins.get(token);
  if (hit && hit.exp > Date.now()) return hit.ok;
  let ok = false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'], subject: 'admin' });
    // Same rule as the app: changing the password signs every session out.
    const saved = await env.STORE.get('site/admin.json').then((o) => o?.json()).catch(() => null);
    const hash = saved?.hash || env.ADMIN_PASSWORD_HASH || '';
    const fp = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hash)))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
    ok = payload.pv === fp;
  } catch { ok = false; }
  if (admins.size > 200) admins.clear();
  admins.set(token, { ok, exp: Date.now() + 30_000 });
  return ok;
}

const edgeCache = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const closed = await maintenance(env).catch(() => null);
    if (closed && !isOpenWhileClosed(url.pathname, closed) && !(await isAdmin(request, env))) {
      return new Response(request.method === 'HEAD' ? null : renderMaintenance(closed), {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Retry-After': '3600',
          'X-Robots-Tag': 'noindex',
          'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; form-action 'self'; frame-ancestors 'self'; base-uri 'none'",
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
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

// ---- Inbox: mail to the domain (Cloudflare Email Routing → "Send to a Worker") ----
// Saved privately for the admin inbox (/admin/inbox) and still forwarded to the owner's mailbox (MAIL_FORWARD_TO). Kept
// deliberately light (no parsing here) so even a big email stays within the free plan's CPU limit.
edgeCache.email = async function email(message, env) {
  const now = new Date();
  const id = `${String(9_999_999_999_999 - now.getTime()).padStart(13, '0')}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  let saved = true;
  try {
    const raw = await new Response(message.raw).arrayBuffer();
    await env.STORE.put(`site/mail/raw/${id}.eml`, raw, { httpMetadata: { contentType: 'message/rfc822' } });
  } catch { saved = false; }
  const forwarded = [];
  let forwardError = '';
  for (const to of (env.MAIL_FORWARD_TO ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    try { await message.forward(to); forwarded.push(to); } catch (e) { forwardError = String(e?.message ?? e).slice(0, 200); }
  }
  if (!saved) {
    if (!forwarded.length) message.setReject('Mailbox temporarily unavailable'); // nothing kept anywhere: let the sender know
    return;
  }
  const h = (k) => (message.headers.get(k) ?? '').slice(0, 500);
  const meta = { id, from: message.from, fromHeader: h('from'), to: message.to, subject: h('subject'), date: h('date') || now.toUTCString(), messageId: h('message-id'), size: message.rawSize, read: false, at: now.toISOString(), forwarded, ...(forwardError ? { forwardError } : {}) };
  await env.STORE.put(`site/mail/inbox/${id}.json`, JSON.stringify(meta), { httpMetadata: { contentType: 'application/json' } });
};

export default edgeCache;
