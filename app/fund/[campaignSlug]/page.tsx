import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CampaignExperience } from '@/components/fund/campaign/campaign-experience';
import { getPublicCampaign } from '@/lib/fund/data';
import { SITE_URL, isStripeClientConfigured, isStripeServerConfigured, serverEnv } from '@/lib/fund/env';
import { formatMoney } from '@/lib/fund/format';

export async function generateMetadata({ params }: PageProps<'/fund/[campaignSlug]'>): Promise<Metadata> {
  const { campaignSlug } = await params;
  const data = await getPublicCampaign(campaignSlug);
  if (!data) return { title: 'Campaign not found' };
  const { campaign, totals, organization } = data;
  const description =
    campaign.tagline ?? `${formatMoney(totals.total_cents, campaign.currency)} raised of ${formatMoney(campaign.goal_cents, campaign.currency)} for ${organization.name}.`;
  return {
    title: campaign.title,
    description,
    alternates: { canonical: `${SITE_URL}/fund/${campaign.slug}` },
    openGraph: {
      title: campaign.title,
      description,
      url: `${SITE_URL}/fund/${campaign.slug}`,
      type: 'website',
      images: campaign.hero_image_url ? [{ url: campaign.hero_image_url }] : undefined,
    },
    twitter: { card: campaign.hero_image_url ? 'summary_large_image' : 'summary', title: campaign.title, description },
    robots: ['active', 'paused', 'completed'].includes(campaign.status) ? undefined : { index: false },
  };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CampaignPage({ params, searchParams }: PageProps<'/fund/[campaignSlug]'>) {
  const { campaignSlug } = await params;
  const data = await getPublicCampaign(campaignSlug);
  if (!data) notFound();

  const sp = await searchParams;
  const amount = Number(first(sp.amount));
  const linkId = first(sp.lnk);
  const env = serverEnv();

  return (
    <CampaignExperience
      initial={data}
      siteUrl={SITE_URL}
      paymentsEnabled={isStripeServerConfigured() && isStripeClientConfigured}
      feeConfig={{ percent: env.stripeFeePercent, fixedCents: env.stripeFeeFixedCents }}
      params={{
        amountCents: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : undefined,
        teamSlug: first(sp.team)?.toLowerCase(),
        ambassadorCode: first(sp.ref)?.toLowerCase(),
        linkId: linkId && /^[0-9a-f-]{36}$/i.test(linkId) ? linkId : undefined,
        openCheckout: first(sp.donate) === '1',
        completed: first(sp.donation) === 'complete' || first(sp.redirect_status) === 'succeeded',
      }}
    />
  );
}
