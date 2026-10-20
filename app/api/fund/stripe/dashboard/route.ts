import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeOrgAction } from '@/lib/fund/auth';
import { createDashboardLink, syncAccount } from '@/lib/fund/connect';
import { sameOrigin } from '@/lib/fund/security';

const Body = z.object({ orgId: z.uuid(), action: z.enum(['dashboard', 'sync']).default('dashboard') });

/** Express dashboard login link (payouts, bank details) or a manual status sync. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const auth = await authorizeOrgAction(parsed.data.orgId);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 403 });
  try {
    if (parsed.data.action === 'sync') return NextResponse.json({ status: await syncAccount(parsed.data.orgId) });
    return NextResponse.json({ url: await createDashboardLink(parsed.data.orgId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stripe error' }, { status: 502 });
  }
}
