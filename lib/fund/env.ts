// Central place for /fund configuration. Every integration degrades gracefully:
// missing Supabase -> demo mode, missing Stripe -> "online giving not enabled",
// missing Turnstile -> bot check skipped (edge WAF still applies).

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yaakoveisenberger.com').replace(/\/$/, '');
export const FUND_BASE_PATH = '/fund';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);
export const isStripeClientConfigured = Boolean(STRIPE_PUBLISHABLE_KEY);
export const isDemoEnabled = !isSupabaseConfigured || process.env.NEXT_PUBLIC_FUND_ENABLE_DEMO === 'true';
export const DEMO_SLUG = 'demo';

/** Server-only settings. Never import values from here into client components. */
export function serverEnv() {
  return {
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecrets: [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
      (s): s is string => Boolean(s),
    ),
    turnstileSecret: process.env.TURNSTILE_SECRET_KEY ?? '',
    platformAdminEmails: (process.env.FUND_PLATFORM_ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    stripeFeePercent: Number(process.env.FUND_STRIPE_FEE_PERCENT ?? 2.9),
    stripeFeeFixedCents: Number(process.env.FUND_STRIPE_FEE_FIXED_CENTS ?? 30),
    orgPaysProcessingFees: process.env.FUND_ORG_PAYS_PROCESSING_FEES !== 'false',
    allowDirectCharges: process.env.FUND_STRIPE_DIRECT_CHARGES_FALLBACK === 'true',
    largeGiftReviewCents: Number(process.env.FUND_LARGE_GIFT_REVIEW_CENTS ?? 1_000_000),
    stripeCountry: process.env.FUND_STRIPE_CONNECT_COUNTRY ?? 'US',
  };
}

export function isServiceRoleConfigured() {
  return isSupabaseConfigured && Boolean(serverEnv().supabaseSecretKey);
}

export function isStripeServerConfigured() {
  return Boolean(serverEnv().stripeSecretKey);
}
