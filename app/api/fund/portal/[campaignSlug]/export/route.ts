import { NextResponse } from 'next/server';
import { getFundSession } from '@/lib/fund/auth';
import { csvResponse } from '@/lib/fund/csv';
import { donationsCsv } from '@/lib/fund/exports';

/** Campaign managers' donor export. RLS limits rows to campaigns the user belongs to. */
export async function GET(request: Request, ctx: RouteContext<'/api/fund/portal/[campaignSlug]/export'>) {
  const { campaignSlug } = await ctx.params;
  const session = await getFundSession();
  if (!session) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const { data: campaign } = await session.supabase.from('fund_campaigns').select('id, slug').eq('slug', campaignSlug).maybeSingle();
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const status = new URL(request.url).searchParams.get('status') ?? 'succeeded';
  const csv = await donationsCsv(session.supabase, { campaignId: campaign.id, status: status === 'all' ? undefined : status });
  return csvResponse(`${campaign.slug}-donations-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
