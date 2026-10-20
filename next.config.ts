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

const nextConfig: NextConfig = {
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
        source: '/api/fund/:path*',
        headers: [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex' }],
      },
    ];
  },
};

export default nextConfig;
