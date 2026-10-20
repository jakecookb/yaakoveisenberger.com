import { NextResponse } from 'next/server';
import { authorizeOrgAction } from '@/lib/fund/auth';
import { safeNext, syncAccount } from '@/lib/fund/connect';

/** Stripe sends the user here after onboarding; pull the latest account status. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get('org') ?? '';
  const next = safeNext(url.searchParams.get('next'));
  const auth = await authorizeOrgAction(orgId);
  if ('error' in auth) return NextResponse.redirect(new URL(`/fund/login?next=${encodeURIComponent(next)}`, url));
  let flag = 'stripe=updated';
  try {
    const status = await syncAccount(orgId);
    if (status?.stripe_charges_enabled) flag = 'stripe=connected';
  } catch {
    flag = 'stripe=error';
  }
  return NextResponse.redirect(new URL(`${next}${next.includes('?') ? '&' : '?'}${flag}`, url));
}
