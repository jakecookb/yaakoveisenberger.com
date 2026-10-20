import { NextResponse } from 'next/server';
import { authorizeOrgAction } from '@/lib/fund/auth';
import { createOnboardingLink, safeNext } from '@/lib/fund/connect';
import { requestOrigin } from '@/lib/fund/security';

/** Account links are single-use and expire; Stripe redirects here to mint a new one. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get('org') ?? '';
  const next = safeNext(url.searchParams.get('next'));
  const auth = await authorizeOrgAction(orgId);
  if ('error' in auth) return NextResponse.redirect(new URL(`/fund/login?next=${encodeURIComponent(next)}`, url));
  try {
    return NextResponse.redirect(await createOnboardingLink(orgId, requestOrigin(request), next));
  } catch {
    return NextResponse.redirect(new URL(`${next}?stripe=error`, url));
  }
}
