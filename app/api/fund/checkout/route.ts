import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createFundServiceClient } from '@/lib/fund/supabase/server';
import { computeFees, getStripe } from '@/lib/fund/stripe';
import { getClientIp, getCountry, isIpBlocked, rateLimit, sameOrigin, verifyTurnstile } from '@/lib/fund/security';
import { isServiceRoleConfigured, isStripeServerConfigured, serverEnv } from '@/lib/fund/env';

const CheckoutSchema = z.object({
  campaignId: z.uuid(),
  amountCents: z.number().int().positive().max(100_000_000),
  coverFees: z.boolean().default(false),
  donorName: z.string().trim().min(1, 'Name is required').max(160),
  donorEmail: z.email('Enter a valid email').max(254),
  donorPhone: z.string().trim().max(40).optional(),
  isAnonymous: z.boolean().default(false),
  message: z.string().trim().max(500).optional(),
  teamId: z.uuid().nullish(),
  ambassadorId: z.uuid().nullish(),
  linkId: z.uuid().nullish(),
  turnstileToken: z.string().max(4096).optional(),
});

type CampaignForCheckout = {
  id: string;
  slug: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string;
  currency: string;
  min_donation_cents: number;
  max_donation_cents: number;
  allow_anonymous: boolean;
  allow_fee_cover: boolean;
  platform_fee_bps: number | null;
  org: {
    id: string;
    name: string;
    status: string;
    stripe_account_id: string | null;
    stripe_charges_enabled: boolean;
    platform_fee_bps: number;
  };
};

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * Creates the pending donation + PaymentIntent for the Payment Element
 * (deferred-intent flow: the card form renders first, the intent is created on submit).
 * Funds settle to the nonprofit's connected account via a destination charge; the
 * platform keeps application_fee_amount. Card data only ever touches Stripe's iframe.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, 'Cross-origin request rejected');
  if (!isStripeServerConfigured() || !isServiceRoleConfigured()) {
    return fail(503, 'Online giving is not configured yet.');
  }

  const ip = getClientIp(request.headers);
  const ipKey = ip ?? 'unknown';
  const [perMinute, perHour] = await Promise.all([
    rateLimit(`checkout:min:${ipKey}`, 8, 60),
    rateLimit(`checkout:hour:${ipKey}`, 40, 3600),
  ]);
  if (!perMinute || !perHour) return fail(429, 'Too many attempts. Please wait a minute and try again.');
  if (await isIpBlocked(ip)) return fail(403, 'This connection has been blocked. Please contact the organizer.');

  const parsed = CheckoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? 'Invalid request');
  const input = parsed.data;

  if (!(await verifyTurnstile(input.turnstileToken, ip))) return fail(400, 'Bot check failed. Please refresh and try again.');

  const db = createFundServiceClient();
  const { data: campaign } = await db
    .from('fund_campaigns')
    .select(
      'id, slug, title, status, starts_at, ends_at, currency, min_donation_cents, max_donation_cents, allow_anonymous, allow_fee_cover, platform_fee_bps, org:fund_organizations!inner(id, name, status, stripe_account_id, stripe_charges_enabled, platform_fee_bps)',
    )
    .eq('id', input.campaignId)
    .maybeSingle<CampaignForCheckout>();

  if (!campaign) return fail(404, 'Campaign not found');
  const now = Date.now();
  if (campaign.status !== 'active') return fail(409, 'This campaign is not accepting donations right now.');
  if (now < new Date(campaign.starts_at).getTime()) return fail(409, 'This campaign has not started yet.');
  if (now > new Date(campaign.ends_at).getTime()) return fail(409, 'This campaign has ended.');
  if (input.amountCents < campaign.min_donation_cents || input.amountCents > campaign.max_donation_cents) {
    return fail(400, `Donations must be between $${campaign.min_donation_cents / 100} and $${campaign.max_donation_cents / 100}.`);
  }

  const env = serverEnv();
  const org = campaign.org;
  const connected = Boolean(org.stripe_account_id && org.stripe_charges_enabled && org.status === 'active');
  if (!connected && !env.allowDirectCharges) {
    return fail(409, `${org.name} hasn't finished connecting their payout account yet.`);
  }

  const fees = computeFees(
    input.amountCents,
    input.coverFees && campaign.allow_fee_cover,
    campaign.platform_fee_bps ?? org.platform_fee_bps,
  );

  // Lightweight risk signals; Stripe Radar adds its own on charge.succeeded.
  const flags: string[] = [];
  if (input.amountCents >= env.largeGiftReviewCents) flags.push('Large gift — manual review');
  if (ip) {
    const since = new Date(now - 3_600_000).toISOString();
    const { count } = await db
      .from('fund_donations')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gte('created_at', since);
    if ((count ?? 0) >= 5) flags.push(`High velocity — ${count} attempts from this IP in 1h`);
  }

  const { data: donation, error: insertError } = await db
    .from('fund_donations')
    .insert({
      campaign_id: campaign.id,
      team_id: input.teamId ?? null,
      ambassador_id: input.ambassadorId ?? null,
      link_id: input.linkId ?? null,
      amount_cents: fees.amountCents,
      fee_cover_cents: fees.feeCoverCents,
      platform_fee_cents: fees.platformFeeCents,
      currency: campaign.currency,
      donor_name: input.donorName,
      donor_email: input.donorEmail.toLowerCase(),
      donor_phone: input.donorPhone || null,
      is_anonymous: campaign.allow_anonymous && input.isAnonymous,
      message: input.message || null,
      source: 'online',
      status: 'pending',
      ip_address: ip,
      user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
      country: getCountry(request.headers),
      is_flagged: flags.length > 0,
      flag_reason: flags.join('; ') || null,
    })
    .select('id')
    .single<{ id: string }>();

  if (insertError || !donation) {
    // Composite FKs reject a team/ambassador that belongs to another campaign.
    const fk = insertError?.code === '23503';
    if (!fk) console.error('[fund] checkout insert failed', insertError?.message);
    return fail(400, fk ? 'Selected team or ambassador is not part of this campaign.' : 'Could not start checkout.');
  }

  try {
    const intent = await getStripe().paymentIntents.create(
      {
        amount: fees.totalCents,
        currency: campaign.currency,
        automatic_payment_methods: { enabled: true },
        receipt_email: input.donorEmail,
        description: `Donation to ${campaign.title}`,
        metadata: {
          donation_id: donation.id,
          campaign_id: campaign.id,
          campaign_slug: campaign.slug,
          org_id: org.id,
          fund_platform: 'yaakoveisenberger',
        },
        ...(connected
          ? { application_fee_amount: fees.applicationFeeCents, transfer_data: { destination: org.stripe_account_id! } }
          : {}),
      },
      { idempotencyKey: `fund-donation-${donation.id}` },
    );

    await Promise.all([
      db.from('fund_donations').update({ stripe_payment_intent_id: intent.id, livemode: intent.livemode }).eq('id', donation.id),
      db.rpc('fund_track_checkout_start', { p_campaign_id: campaign.id }),
    ]);

    return NextResponse.json(
      { clientSecret: intent.client_secret, donationId: donation.id, totalCents: fees.totalCents },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment could not be started';
    await db.from('fund_donations').update({ status: 'failed', failure_message: message.slice(0, 500) }).eq('id', donation.id);
    console.error('[fund] PaymentIntent create failed', message);
    return fail(502, 'Payment could not be started. Please try again.');
  }
}
