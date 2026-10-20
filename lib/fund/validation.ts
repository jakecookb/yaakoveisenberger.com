import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => !v || /^https?:\/\//i.test(v), 'Must start with http:// or https://');
const optionalIso = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date');
const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .optional()
  .nullable()
  .transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => !v || z.email().safeParse(v).success, 'Invalid email');
const cents = z.number().int().nonnegative().max(10_000_000_000);
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/, 'Use 3–64 lowercase letters, numbers and dashes');

export const RESERVED_SLUGS = new Set([
  'admin', 'portal', 'display', 'api', 'login', 'logout', 'auth', 'l', 'stripe', 'new', 'demo', 'account', 'settings', 'static',
]);

export const OrganizationSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(160),
  slug,
  ein: optionalText(20),
  contact_email: optionalEmail,
  website_url: optionalUrl,
  logo_url: optionalUrl,
  platform_fee_bps: z.number().int().min(0).max(3000),
  status: z.enum(['active', 'suspended']).default('active'),
});

export const MemberSchema = z.object({
  orgId: z.uuid(),
  email: z.email().trim().toLowerCase(),
  role: z.enum(['owner', 'manager', 'viewer']),
});

export const CampaignSchema = z
  .object({
    id: z.uuid().optional(),
    org_id: z.uuid(),
    slug: slug.refine((s) => !RESERVED_SLUGS.has(s), 'That URL is reserved'),
    title: z.string().trim().min(3).max(160),
    tagline: optionalText(280),
    description: optionalText(20000),
    hero_image_url: optionalUrl,
    logo_url: optionalUrl,
    video_url: optionalUrl,
    theme_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #4f46e5'),
    goal_cents: cents.min(100),
    bonus_goal_cents: cents.nullable().optional().transform((v) => v || null),
    starts_at: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid start date'),
    ends_at: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid end date'),
    status: z.enum(['draft', 'pending_review', 'active', 'paused', 'completed', 'archived']),
    preset_amounts: z.array(z.number().int().min(100)).min(1).max(8),
    min_donation_cents: z.number().int().min(100),
    max_donation_cents: z.number().int().min(200),
    allow_anonymous: z.boolean(),
    allow_fee_cover: z.boolean(),
    platform_fee_bps: z.number().int().min(0).max(3000).nullable().optional(),
    display_settings: z
      .object({
        headline: optionalText(120),
        ticker_message: optionalText(200),
        rotate_seconds: z.number().int().min(5).max(120).optional(),
        show_qr: z.boolean().optional(),
      })
      .default({ headline: null, ticker_message: null }),
  })
  .refine((c) => Date.parse(c.ends_at) > Date.parse(c.starts_at), { message: 'End must be after start', path: ['ends_at'] })
  .refine((c) => !c.bonus_goal_cents || c.bonus_goal_cents > c.goal_cents, {
    message: 'Bonus goal must exceed the main goal',
    path: ['bonus_goal_cents'],
  })
  .refine((c) => c.max_donation_cents > c.min_donation_cents, { message: 'Max must exceed min', path: ['max_donation_cents'] });

export const MatcherSchema = z.object({
  id: z.uuid().optional(),
  campaignId: z.uuid(),
  name: z.string().trim().min(1).max(160),
  display_name: optionalText(160),
  is_anonymous: z.boolean(),
  logo_url: optionalUrl,
  message: optionalText(500),
  ratio: z.number().positive().max(20),
  pledge_cents: cents.min(100),
  priority: z.number().int().min(0).max(10_000),
  starts_at: optionalIso,
  ends_at: optionalIso,
  status: z.enum(['active', 'paused']),
  pledge_status: z.enum(['pledged', 'invoiced', 'collected']),
  contact_name: optionalText(160),
  contact_email: optionalEmail,
  contact_phone: optionalText(40),
  notes: optionalText(4000),
});

export const TeamSchema = z.object({
  id: z.uuid().optional(),
  campaignId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, 'Lowercase letters, numbers and dashes only'),
  captain_name: optionalText(120),
  description: optionalText(1000),
  avatar_url: optionalUrl,
  goal_cents: cents.nullable().optional().transform((v) => v || null),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(10_000).default(0),
});

export const AmbassadorSchema = z.object({
  id: z.uuid().optional(),
  campaignId: z.uuid(),
  team_id: z.uuid().nullable().optional().transform((v) => v || null),
  name: z.string().trim().min(1).max(120),
  email: optionalEmail,
  phone: optionalText(40),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, '3–40 lowercase letters, numbers and dashes'),
  avatar_url: optionalUrl,
  message: optionalText(500),
  goal_cents: cents.nullable().optional().transform((v) => v || null),
  is_active: z.boolean(),
});

export const LinkSchema = z.object({
  campaignId: z.uuid(),
  label: z.string().trim().min(1).max(120),
  team_id: z.uuid().nullable().optional().transform((v) => v || null),
  ambassador_id: z.uuid().nullable().optional().transform((v) => v || null),
  preset_amount_cents: z.number().int().min(100).nullable().optional().transform((v) => v || null),
  utm_source: optionalText(80),
  utm_medium: optionalText(80),
  utm_campaign: optionalText(80),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{4,40}$/, '4–40 letters, numbers, dashes or underscores')
    .optional()
    .nullable()
    .or(z.literal('')),
});

export const OutreachSchema = z.object({
  id: z.uuid().optional(),
  campaignId: z.uuid(),
  ambassador_id: z.uuid().nullable().optional().transform((v) => v || null),
  contact_name: z.string().trim().min(1).max(160),
  contact_email: optionalEmail,
  contact_phone: optionalText(40),
  channel: z.enum(['call', 'email', 'sms', 'whatsapp', 'in_person', 'other']),
  outcome: z.enum(['no_answer', 'left_message', 'follow_up', 'pledged', 'donated', 'declined']),
  pledge_cents: z.number().int().min(100).nullable().optional().transform((v) => v || null),
  notes: optionalText(4000),
  follow_up_at: optionalIso,
});

export const OfflineDonationSchema = z.object({
  campaignId: z.uuid(),
  amount_cents: z.number().int().min(1).max(10_000_000_000),
  source: z.enum(['cash', 'check', 'wire', 'daf', 'other']),
  reference: optionalText(120),
  donor_name: optionalText(160),
  donor_email: optionalEmail,
  donor_phone: optionalText(40),
  is_anonymous: z.boolean(),
  message: optionalText(500),
  team_id: z.uuid().nullable().optional().transform((v) => v || null),
  ambassador_id: z.uuid().nullable().optional().transform((v) => v || null),
  apply_match: z.boolean(),
  received_at: optionalIso,
  notes: optionalText(2000),
});

// Partial update: omitted fields stay undefined (and untouched).
const patchText = (max: number) => z.string().trim().max(max).nullable().optional();
export const DonationOverrideSchema = z.object({
  id: z.uuid(),
  status: z.enum(['pending', 'succeeded', 'failed', 'canceled', 'refunded', 'disputed']).optional(),
  amount_cents: z.number().int().min(1).optional(),
  is_flagged: z.boolean().optional(),
  flag_reason: patchText(500),
  notes: patchText(2000),
  is_anonymous: z.boolean().optional(),
  donor_name: patchText(160),
  message: patchText(500),
});

export function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return 'Invalid input';
  const field = issue.path.filter((p) => typeof p === 'string').join('.');
  return field ? `${field.replace(/_/g, ' ')}: ${issue.message}` : issue.message;
}
