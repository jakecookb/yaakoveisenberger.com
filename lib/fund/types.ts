// Shapes returned by the public RPC (fund_get_public_campaign) and broadcast on
// the Realtime topic campaign_donations_<campaignId>.

export type CampaignStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'completed' | 'archived';

export interface PublicCampaignInfo {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  hero_image_url: string | null;
  logo_url: string | null;
  video_url: string | null;
  theme_color: string;
  currency: string;
  goal_cents: number;
  bonus_goal_cents: number | null;
  starts_at: string;
  ends_at: string;
  status: CampaignStatus;
  preset_amounts: number[];
  min_donation_cents: number;
  max_donation_cents: number;
  allow_anonymous: boolean;
  allow_fee_cover: boolean;
  display_settings: DisplaySettings;
}

export interface DisplaySettings {
  headline?: string;
  ticker_message?: string;
  rotate_seconds?: number;
  show_qr?: boolean;
}

export interface CampaignTotals {
  campaign_id: string;
  raised_cents: number;
  matched_cents: number;
  total_cents: number;
  donation_count: number;
  goal_cents: number;
  bonus_goal_cents: number | null;
  status: CampaignStatus;
  last_donation_at: string | null;
  match_pledged_cents: number;
  match_remaining_cents: number;
  current_ratio: number | null;
  server_time: string;
}

export interface PublicMatcher {
  id: string;
  name: string;
  logo_url: string | null;
  message: string | null;
  ratio: number;
  pledge_cents: number;
  matched_cents: number;
  remaining_cents: number;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  status: 'active' | 'paused';
  is_live: boolean;
}

export interface PublicTeam {
  id: string;
  slug: string;
  name: string;
  captain_name: string | null;
  description: string | null;
  avatar_url: string | null;
  goal_cents: number | null;
  raised_cents: number;
  donation_count: number;
}

export interface PublicAmbassador {
  id: string;
  code: string;
  name: string;
  team_id: string | null;
  avatar_url: string | null;
  message: string | null;
  goal_cents: number | null;
  raised_cents: number;
  donation_count: number;
}

export interface PublicDonation {
  id: string;
  name: string;
  is_anonymous: boolean;
  amount_cents: number;
  matched_cents: number;
  message: string | null;
  team_id: string | null;
  team_name: string | null;
  ambassador_id: string | null;
  ambassador_name: string | null;
  offline: boolean;
  created_at: string;
}

export interface PublicCampaign {
  campaign: PublicCampaignInfo;
  organization: { name: string; logo_url: string | null; website_url: string | null; ein: string | null };
  accepting_online: boolean;
  totals: CampaignTotals;
  matchers: PublicMatcher[];
  teams: PublicTeam[];
  ambassadors: PublicAmbassador[];
  recent: PublicDonation[];
  top: PublicDonation[];
  server_time: string;
  demo?: boolean;
}

export interface DonationBroadcast {
  donation: PublicDonation;
  totals: CampaignTotals;
  team: { id: string; raised_cents: number; donation_count: number } | null;
  ambassador: { id: string; raised_cents: number; donation_count: number } | null;
}

export interface RefreshBroadcast {
  reason: string;
  totals: CampaignTotals | null;
}

export interface PublicCampaignListItem {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  hero_image_url: string | null;
  theme_color: string;
  goal_cents: number;
  total_cents: number;
  donation_count: number;
  starts_at: string;
  ends_at: string;
  status: CampaignStatus;
  organization: string;
}

// ---- Admin / portal row types (subset of columns used by the UI) ----

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  ein: string | null;
  contact_email: string | null;
  website_url: string | null;
  logo_url: string | null;
  status: 'active' | 'suspended';
  platform_fee_bps: number;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_details_submitted: boolean;
  stripe_requirements: { currently_due?: string[]; disabled_reason?: string | null } | null;
  stripe_updated_at: string | null;
  created_at: string;
}

export interface CampaignRow {
  id: string;
  org_id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  hero_image_url: string | null;
  logo_url: string | null;
  video_url: string | null;
  theme_color: string;
  currency: string;
  goal_cents: number;
  bonus_goal_cents: number | null;
  starts_at: string;
  ends_at: string;
  status: CampaignStatus;
  approved_at: string | null;
  preset_amounts: number[];
  min_donation_cents: number;
  max_donation_cents: number;
  allow_anonymous: boolean;
  allow_fee_cover: boolean;
  platform_fee_bps: number | null;
  display_settings: DisplaySettings;
  raised_cents: number;
  matched_cents: number;
  donation_count: number;
  last_donation_at: string | null;
  created_at: string;
}

export interface MatcherRow {
  id: string;
  campaign_id: string;
  name: string;
  display_name: string | null;
  is_anonymous: boolean;
  logo_url: string | null;
  message: string | null;
  ratio: number;
  pledge_cents: number;
  matched_cents: number;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  status: 'active' | 'paused';
  pledge_status: 'pledged' | 'invoiced' | 'collected';
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface TeamRow {
  id: string;
  campaign_id: string;
  name: string;
  slug: string;
  captain_name: string | null;
  description: string | null;
  avatar_url: string | null;
  goal_cents: number | null;
  raised_cents: number;
  donation_count: number;
  is_active: boolean;
  sort_order: number;
}

export interface AmbassadorRow {
  id: string;
  campaign_id: string;
  team_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  code: string;
  avatar_url: string | null;
  message: string | null;
  goal_cents: number | null;
  raised_cents: number;
  donation_count: number;
  is_active: boolean;
}

export interface LinkRow {
  id: string;
  campaign_id: string;
  code: string;
  label: string;
  team_id: string | null;
  ambassador_id: string | null;
  preset_amount_cents: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  click_count: number;
  donation_count: number;
  raised_cents: number;
  created_at: string;
}

export type DonationSource = 'online' | 'cash' | 'check' | 'wire' | 'daf' | 'other';
export type DonationStatus = 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded' | 'disputed';

export interface DonationRow {
  id: string;
  campaign_id: string;
  team_id: string | null;
  ambassador_id: string | null;
  link_id: string | null;
  amount_cents: number;
  fee_cover_cents: number;
  platform_fee_cents: number;
  matched_cents: number;
  currency: string;
  donor_name: string | null;
  donor_email: string | null;
  donor_phone: string | null;
  is_anonymous: boolean;
  message: string | null;
  source: DonationSource;
  reference: string | null;
  apply_match: boolean;
  status: DonationStatus;
  failure_code: string | null;
  failure_message: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  livemode: boolean | null;
  ip_address: string | null;
  country: string | null;
  risk_level: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  notes: string | null;
  received_at: string | null;
  succeeded_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

export interface OutreachRow {
  id: string;
  campaign_id: string;
  ambassador_id: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  channel: 'call' | 'email' | 'sms' | 'whatsapp' | 'in_person' | 'other';
  outcome: 'no_answer' | 'left_message' | 'follow_up' | 'pledged' | 'donated' | 'declined';
  pledge_cents: number | null;
  notes: string | null;
  follow_up_at: string | null;
  created_at: string;
}

export interface WebhookEventRow {
  id: string;
  type: string;
  account: string | null;
  livemode: boolean | null;
  status: 'received' | 'processed' | 'failed' | 'ignored';
  attempts: number;
  error: string | null;
  related_donation_id: string | null;
  received_at: string;
  processed_at: string | null;
}

export interface FlaggedIpRow {
  ip: string;
  reason: string | null;
  is_blocked: boolean;
  hit_count: number;
  expires_at: string | null;
  created_at: string;
}

export interface AuditRow {
  id: number;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  campaign_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface CampaignDashboard {
  totals: CampaignTotals;
  page_views: number;
  checkout_starts: number;
  online_donations: number;
  visit_conversion: number | null;
  checkout_conversion: number | null;
  unique_donors: number;
  average_gift_cents: number;
  by_source: Record<string, { count: number; amount_cents: number }>;
  failed_count: number;
  hourly: { hour: string; amount_cents: number; count: number }[];
}

export interface PlatformMetrics {
  gross_cents: number;
  online_gross_cents: number;
  matched_cents: number;
  platform_fees_cents: number;
  fee_cover_cents: number;
  live_campaigns: number;
  active_campaigns: number;
  pending_review: number;
  match_locked_cents: number;
  match_remaining_cents: number;
  donations_24h: number;
  gross_24h_cents: number;
  failed_24h: number;
  flagged_open: number;
  webhooks_failed_24h: number;
  blocked_ips: number;
  organizations: number;
  organizations_onboarded: number;
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
