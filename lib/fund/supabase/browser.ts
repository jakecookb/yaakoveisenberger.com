'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isSupabaseConfigured } from '../env';

let client: SupabaseClient | null = null;

/** Singleton browser client (one WebSocket per tab, shared by every component). */
export function getFundBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    realtime: { params: { eventsPerSecond: 20 }, heartbeatIntervalMs: 15_000 },
  });
  return client;
}
