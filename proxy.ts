import { NextResponse, type NextRequest } from 'next/server';
import { lockedPaths, mayEnter } from '@/lib/access/gate';
import { VISITOR_COOKIE, visitorCookieOptions } from '@/lib/access/visitor';
import { ADMIN_COOKIE } from '@/lib/admin/session';
import { updateFundSession } from '@/lib/fund/supabase/proxy';

// Two jobs: (1) keep the /fund session fresh; (2) gate locked boxes. Unapproved visitors are sent to
// /access/<id> ("type your name") before the page — or the separate site behind it, like /cookbook —
// is ever reached. Keep `matcher` in sync with the lockable built-in pages in data/navigation.ts
// (boxes created in the editor live under /p/<id> and /go/<id>, which are always matched).

// Only these /fund paths need the Supabase session refresh; the rest of /fund is matched just for the lock.
const needsFundSession = (p: string) => p.startsWith('/fund/admin') || p.startsWith('/fund/portal') || p === '/fund/login' || p.startsWith('/fund/auth');

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let id: string | undefined;
  let renew: string | undefined; // the visitor cookie to extend, if an approved visitor is using their access
  for (const [prefix, boxId] of await lockedPaths()) if (pathname === prefix || pathname.startsWith(prefix + '/')) id = boxId;
  if (id) {
    const visitor = request.cookies.get(VISITOR_COOKIE)?.value;
    const who = await mayEnter(id, visitor, request.cookies.get(ADMIN_COOKIE)?.value);
    if (who === 'visitor') renew = visitor;
    if (!who) {
      const url = request.nextUrl.clone();
      url.pathname = id === '*' ? '/' : `/access/${id}`; // '*' = settings unreadable, gate fails closed
      url.search = '';
      const res = NextResponse.redirect(url);
      res.headers.set('Cache-Control', 'private, no-store');
      return res;
    }
  }
  const res = needsFundSession(pathname) ? await updateFundSession(request) : NextResponse.next();
  if (renew) res.cookies.set(VISITOR_COOKIE, renew, visitorCookieOptions());
  return res;
}

export const config = {
  matcher: [
    '/fund', '/fund/:path*', '/fund/admin/:path*', '/fund/portal/:path*', '/fund/login', '/fund/auth/:path*',
    '/video/:path*', '/contact/:path*', '/cookbook/:path*', '/p/:path*', '/go/:path*',
    '/editing/:path*', '/photography/:path*', '/tech/:path*', '/bookbinding/:path*', '/fishboards/:path*', '/meatboards/:path*', '/music/:path*', '/separator/:path*', '/cars/:path*',
  ],
};
