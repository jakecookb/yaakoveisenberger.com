import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createFundServerClient } from '@/lib/fund/supabase/server';
import { getFundSession } from '@/lib/fund/auth';
import { safeNext } from '@/lib/fund/connect';

/** Handles magic-link / invite / recovery emails (PKCE `code` or `token_hash`). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'), '/fund/portal');
  const supabase = await createFundServerClient();

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error('Missing auth code') };

  if (error) return NextResponse.redirect(new URL(`/fund/login?error=${encodeURIComponent(error.message)}`, url));

  await supabase.rpc('fund_claim_invites');
  const session = await getFundSession(); // also promotes FUND_PLATFORM_ADMIN_EMAILS
  const destination = next === '/fund/portal' && session?.isPlatformAdmin ? '/fund/admin' : next;
  return NextResponse.redirect(new URL(destination, url));
}
