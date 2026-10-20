import type { NextRequest } from 'next/server';
import { updateFundSession } from '@/lib/fund/supabase/proxy';

// If your site already has a proxy.ts / middleware.ts, call updateFundSession(request)
// from it for the paths below instead of adding this file.
export async function proxy(request: NextRequest) {
  return updateFundSession(request);
}

export const config = {
  matcher: ['/fund/admin/:path*', '/fund/portal/:path*', '/fund/login', '/fund/auth/:path*'],
};
