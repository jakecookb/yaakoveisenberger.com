import { NextResponse } from 'next/server';
import { getPublicCampaign } from '@/lib/fund/data';

/**
 * Public campaign snapshot used by clients to resync after reconnects. Cached at
 * the CDN for a few seconds so thousands of viewers resyncing at once cost one
 * database call; live deltas arrive over Realtime between snapshots.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/fund/campaigns/[campaignSlug]'>) {
  const { campaignSlug } = await ctx.params;
  const data = await getPublicCampaign(campaignSlug);
  if (!data || !['active', 'paused', 'completed'].includes(data.campaign.status)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=10' } });
  }
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3, stale-while-revalidate=30' },
  });
}
