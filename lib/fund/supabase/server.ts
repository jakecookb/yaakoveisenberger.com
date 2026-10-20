import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isSupabaseConfigured, serverEnv } from '../env';

/** Request-scoped client acting as the signed-in user — every query is bound by RLS. */
export async function createFundServerClient(): Promise<SupabaseClient> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; proxy.ts refreshes sessions.
        }
      },
    },
  });
}

/** Anonymous client for public RPCs from the server (no cookies => cacheable). */
let anonClient: SupabaseClient | null = null;
export function createFundAnonClient(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  anonClient ??= createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonClient;
}

/**
 * Service-role client. Bypasses RLS — use ONLY in trusted server code paths
 * (Stripe webhooks, checkout, rate limiting) after doing your own authorization.
 */
let serviceClient: SupabaseClient | null = null;
export function createFundServiceClient(): SupabaseClient {
  const { supabaseSecretKey } = serverEnv();
  if (!isSupabaseConfigured || !supabaseSecretKey) {
    throw new Error('SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not configured');
  }
  serviceClient ??= createClient(SUPABASE_URL, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}
