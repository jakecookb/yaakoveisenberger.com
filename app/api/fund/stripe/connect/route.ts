import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeOrgAction } from '@/lib/fund/auth';
import { createOnboardingLink, safeNext } from '@/lib/fund/connect';
import { isServiceRoleConfigured, isStripeServerConfigured } from '@/lib/fund/env';
import { requestOrigin, sameOrigin } from '@/lib/fund/security';

const Body = z.object({ orgId: z.uuid(), next: z.string().max(300).optional() });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  if (!isStripeServerConfigured() || !isServiceRoleConfigured()) {
    return NextResponse.json({ error: 'Add STRIPE_SECRET_KEY and SUPABASE_SECRET_KEY to enable Connect onboarding.' }, { status: 503 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const auth = await authorizeOrgAction(parsed.data.orgId);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 403 });
  try {
    const url = await createOnboardingLink(parsed.data.orgId, requestOrigin(request), safeNext(parsed.data.next));
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stripe error' }, { status: 502 });
  }
}
