import 'server-only';
import Stripe from 'stripe';
import { serverEnv } from './env';
import { feeCoverCents } from './matching';

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const { stripeSecretKey } = serverEnv();
  if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  stripe ??= new Stripe(stripeSecretKey, {
    appInfo: { name: 'yaakoveisenberger-fund', url: 'https://yaakoveisenberger.com/fund' },
    maxNetworkRetries: 2,
  });
  return stripe;
}

export interface FeeBreakdown {
  amountCents: number;
  feeCoverCents: number;
  totalCents: number;
  platformFeeCents: number;
  /** Stripe application_fee_amount (platform fee + estimated processing when the org pays it). */
  applicationFeeCents: number;
}

/**
 * Destination charges: Stripe debits processing fees from the platform balance,
 * so the application fee recovers them — from the donor when they opt to cover
 * fees, otherwise from the nonprofit (configurable via FUND_ORG_PAYS_PROCESSING_FEES).
 */
export function computeFees(amountCents: number, coverFees: boolean, platformFeeBps: number): FeeBreakdown {
  const env = serverEnv();
  const cover = coverFees ? feeCoverCents(amountCents, env.stripeFeePercent, env.stripeFeeFixedCents) : 0;
  const totalCents = amountCents + cover;
  const platformFeeCents = Math.round((amountCents * platformFeeBps) / 10_000);
  const processing = Math.round(totalCents * (env.stripeFeePercent / 100) + env.stripeFeeFixedCents);
  const recovered = coverFees ? cover : env.orgPaysProcessingFees ? processing : 0;
  const applicationFeeCents = Math.min(totalCents - 1, platformFeeCents + recovered);
  return { amountCents, feeCoverCents: cover, totalCents, platformFeeCents, applicationFeeCents: Math.max(0, applicationFeeCents) };
}

/** Normalized Connect status persisted on fund_organizations. */
export function accountStatus(account: Stripe.Account) {
  return {
    stripe_account_id: account.id,
    stripe_charges_enabled: Boolean(account.charges_enabled),
    stripe_payouts_enabled: Boolean(account.payouts_enabled),
    stripe_details_submitted: Boolean(account.details_submitted),
    stripe_requirements: {
      currently_due: account.requirements?.currently_due ?? [],
      past_due: account.requirements?.past_due ?? [],
      disabled_reason: account.requirements?.disabled_reason ?? null,
    },
    stripe_updated_at: new Date().toISOString(),
  };
}
