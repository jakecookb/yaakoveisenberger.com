import { readFileSync } from 'node:fs';
import type { NextConfig } from 'next';

const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : '';
  } catch {
    return '';
  }
})();
const supabaseWs = supabaseOrigin.replace(/^http/, 'ws');
const isDev = process.env.NODE_ENV !== 'production';

// Content-Security-Policy for the /fund platform. Stripe Elements and Turnstile run
// in iframes from their own origins, so card data never touches this site (PCI SAQ-A).
const csp = (frameAncestors: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://*.stripe.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.stripe.com https://*.stripe.network https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com ${supabaseOrigin} ${supabaseWs}`.trim(),
    'frame-src https://*.stripe.com https://*.stripe.network https://challenges.cloudflare.com https://www.youtube-nocookie.com https://player.vimeo.com',
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

// The Cookbook app (separate repo + Vercel project, built with base '/cookbook/') is served
// under this site at /cookbook — Vercel proxies the requests, so it shares this domain.
const cookbookOrigin = (process.env.COOKBOOK_ORIGIN ?? 'https://cookbook-roan-ten.vercel.app').replace(/\/$/, '');

// The ONNX Runtime version names the folder its files are served from (see scripts/copy-ort.mjs), so they can be cached for a year.
const ortVersion = (() => {
  try {
    return JSON.parse(readFileSync('node_modules/onnxruntime-web/package.json', 'utf8')).version as string;
  } catch {
    return 'unknown';
  }
})();

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_ORT_VERSION: ortVersion },
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: '/cookbook', destination: `${cookbookOrigin}/cookbook/` },
      { source: '/cookbook/:path*', destination: `${cookbookOrigin}/cookbook/:path*` },
    ];
  },
  async headers() {
    return [
      {
        // Everything under /fund except the big screen (which OBS / signage players may embed).
        source: '/fund/:path((?!display).*)',
        headers: [...securityHeaders, { key: 'Content-Security-Policy', value: csp("'none'") }, { key: 'X-Frame-Options', value: 'DENY' }],
      },
      {
        source: '/fund/display/:path*',
        headers: [...securityHeaders, { key: 'Content-Security-Policy', value: csp('*') }],
      },
      {
        // Admin area, access checks and gated media: never cached, never indexed.
        source: '/:path(admin|api/admin|api/access|api/category|media)/:rest*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
      {
        // The audio separator runs a neural network in the browser. Cross-origin isolation lets WebAssembly use several
        // CPU threads (about 3x faster). It only applies to this page, which loads nothing from other sites except the
        // one-off model download (served with CORS).
        source: '/:path(separator|editor)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
      {
        // A worker started from a cross-origin-isolated page must itself carry the isolation header, otherwise the browser
        // blocks it. This covers the page's own worker chunks and the ONNX Runtime files (which start threads of their own).
        source: '/_next/static/:path*',
        headers: [{ key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }, { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }],
      },
      {
        source: '/ort/:path*',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/api/fund/:path*',
        headers: [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex' }],
      },
    ];
  },
};

export default nextConfig;
