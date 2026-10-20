import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isSupabaseConfigured } from '../env';

/**
 * Refreshes the Supabase auth session cookie for /fund/admin and /fund/portal.
 * Call it from your root proxy.ts (Next 16) or middleware.ts (Next <=15).
 */
export async function updateFundSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Validates the JWT with Supabase Auth and rotates the refresh token when needed.
  await supabase.auth.getUser();
  return response;
}
