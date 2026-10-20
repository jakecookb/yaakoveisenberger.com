import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { DisplayBoard } from '@/components/fund/display/display-board';
import { getPublicCampaign } from '@/lib/fund/data';
import { SITE_URL } from '@/lib/fund/env';

export async function generateMetadata({ params }: PageProps<'/fund/display/[campaignSlug]'>): Promise<Metadata> {
  const { campaignSlug } = await params;
  const data = await getPublicCampaign(campaignSlug);
  return { title: data ? `${data.campaign.title} — Live` : 'Live display', robots: { index: false, follow: false } };
}

export const viewport: Viewport = { themeColor: '#020617', width: 'device-width', initialScale: 1 };

/**
 * Big-screen scoreboard for live events. Renders as a fixed, full-viewport layer
 * above any site navbar/footer from the root layout. Query params:
 *   ?big=1000  dollar threshold for full-screen popups (default $1,000)
 */
export default async function DisplayPage({ params, searchParams }: PageProps<'/fund/display/[campaignSlug]'>) {
  const { campaignSlug } = await params;
  const data = await getPublicCampaign(campaignSlug);
  if (!data) notFound();
  const sp = await searchParams;
  const big = Number(Array.isArray(sp.big) ? sp.big[0] : sp.big);
  return <DisplayBoard initial={data} siteUrl={SITE_URL} bigGiftCents={Number.isFinite(big) && big > 0 ? big * 100 : 100_000} />;
}
