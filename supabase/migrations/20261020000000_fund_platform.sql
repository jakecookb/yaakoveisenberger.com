-- =============================================================================
--  yaakoveisenberger.com/fund — Fundraising & Matching Platform
--  Supabase / PostgreSQL migration
--
--  * Every table has Row Level Security enabled.
--  * Public (anonymous) reads go exclusively through SECURITY DEFINER RPCs that
--    return sanitized JSON — donor PII never leaves the database for anon users.
--  * Matching, totals and leaderboards are settled atomically inside Postgres
--    (row locks on matcher pools), so concurrent donations can never overdraw a
--    match pool, regardless of whether they arrive via Stripe webhook, offline
--    entry or an admin override.
--  * Every settled donation is broadcast on the Realtime topic
--    `campaign_donations_<campaignId>` via realtime.send().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Utility functions
-- -----------------------------------------------------------------------------

create or replace function public.fund_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

-- Platform owners (super admins).
create table public.fund_platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Non-profit tenants.
create table public.fund_organizations (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null check (char_length(name) between 2 and 160),
  slug                      text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'),
  ein                       text check (ein is null or char_length(ein) <= 20),
  contact_email             text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  website_url               text,
  logo_url                  text,
  status                    text not null default 'active' check (status in ('active', 'suspended')),
  platform_fee_bps          integer not null default 500 check (platform_fee_bps between 0 and 3000),
  stripe_account_id         text unique,
  stripe_charges_enabled    boolean not null default false,
  stripe_payouts_enabled    boolean not null default false,
  stripe_details_submitted  boolean not null default false,
  stripe_requirements       jsonb not null default '{}'::jsonb,
  stripe_updated_at         timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Organization staff. user_id is null until the invited email signs in.
create table public.fund_org_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.fund_organizations (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,
  email       text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role        text not null default 'manager' check (role in ('owner', 'manager', 'viewer')),
  created_at  timestamptz not null default now(),
  unique (org_id, email)
);

create table public.fund_campaigns (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.fund_organizations (id) on delete restrict,
  slug                text not null unique
                        check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$')
                        check (slug not in ('admin', 'portal', 'display', 'api', 'login', 'logout', 'auth',
                                            'l', 'stripe', 'new', 'demo', 'account', 'settings', 'static')),
  title               text not null check (char_length(title) between 3 and 160),
  tagline             text check (tagline is null or char_length(tagline) <= 280),
  description         text check (description is null or char_length(description) <= 20000),
  hero_image_url      text,
  logo_url            text,
  video_url           text,
  theme_color         text not null default '#4f46e5' check (theme_color ~ '^#[0-9a-fA-F]{6}$'),
  currency            text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  goal_cents          bigint not null check (goal_cents > 0),
  bonus_goal_cents    bigint,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  status              text not null default 'draft'
                        check (status in ('draft', 'pending_review', 'active', 'paused', 'completed', 'archived')),
  approved_at         timestamptz,
  approved_by         uuid references auth.users (id) on delete set null,
  preset_amounts      integer[] not null default '{3600,10000,18000,36000,50000,100000}',
  min_donation_cents  integer not null default 500 check (min_donation_cents >= 100),
  max_donation_cents  integer not null default 2500000,
  allow_anonymous     boolean not null default true,
  allow_fee_cover     boolean not null default true,
  platform_fee_bps    integer check (platform_fee_bps is null or platform_fee_bps between 0 and 3000),
  display_settings    jsonb not null default '{}'::jsonb,
  -- Counters (maintained exclusively by fund_settle_donation / fund_unsettle_donation).
  raised_cents        bigint not null default 0,  -- donor dollars (online + offline), excludes fee cover
  matched_cents       bigint not null default 0,  -- match dollars applied from matcher pools
  donation_count      integer not null default 0,
  last_donation_at    timestamptz,
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint fund_campaigns_dates check (ends_at > starts_at),
  constraint fund_campaigns_bonus check (bonus_goal_cents is null or bonus_goal_cents > goal_cents),
  constraint fund_campaigns_donation_limits check (max_donation_cents > min_donation_cents)
);

-- Matching sponsors. ratio = match dollars per donor dollar ($1 = $(1+ratio)).
create table public.fund_matchers (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.fund_campaigns (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 160),
  display_name   text check (display_name is null or char_length(display_name) <= 160),
  is_anonymous   boolean not null default false,
  logo_url       text,
  message        text check (message is null or char_length(message) <= 500),
  ratio          numeric(6, 2) not null default 1 check (ratio > 0 and ratio <= 20),
  pledge_cents   bigint not null check (pledge_cents > 0),
  matched_cents  bigint not null default 0,
  priority       integer not null default 100,
  starts_at      timestamptz,
  ends_at        timestamptz,
  status         text not null default 'active' check (status in ('active', 'paused')),
  pledge_status  text not null default 'pledged' check (pledge_status in ('pledged', 'invoiced', 'collected')),
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  notes          text,
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint fund_matchers_pool check (matched_cents >= 0 and matched_cents <= pledge_cents),
  constraint fund_matchers_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.fund_teams (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.fund_campaigns (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  slug            text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'),
  captain_name    text,
  description     text check (description is null or char_length(description) <= 1000),
  avatar_url      text,
  goal_cents      bigint check (goal_cents is null or goal_cents > 0),
  raised_cents    bigint not null default 0,  -- includes matched dollars credited to the team
  donation_count  integer not null default 0,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (campaign_id, slug),
  unique (id, campaign_id)
);

create table public.fund_ambassadors (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.fund_campaigns (id) on delete cascade,
  team_id         uuid,
  name            text not null check (char_length(name) between 1 and 120),
  email           text,
  phone           text,
  code            text not null check (code ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  avatar_url      text,
  message         text check (message is null or char_length(message) <= 500),
  goal_cents      bigint check (goal_cents is null or goal_cents > 0),
  raised_cents    bigint not null default 0,  -- includes matched dollars
  donation_count  integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (campaign_id, code),
  unique (id, campaign_id),
  foreign key (team_id, campaign_id) references public.fund_teams (id, campaign_id) on delete set null (team_id)
);

-- Trackable custom links (short links at /fund/l/<code>).
create table public.fund_links (
  id                   uuid primary key default gen_random_uuid(),
  campaign_id          uuid not null references public.fund_campaigns (id) on delete cascade,
  code                 text not null unique check (code ~ '^[A-Za-z0-9_-]{4,40}$'),
  label                text not null check (char_length(label) between 1 and 120),
  team_id              uuid,
  ambassador_id        uuid,
  preset_amount_cents  integer check (preset_amount_cents is null or preset_amount_cents >= 100),
  utm_source           text,
  utm_medium           text,
  utm_campaign         text,
  click_count          integer not null default 0,
  donation_count       integer not null default 0,
  raised_cents         bigint not null default 0,
  created_by           uuid default auth.uid() references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  unique (id, campaign_id),
  foreign key (team_id, campaign_id) references public.fund_teams (id, campaign_id) on delete set null (team_id),
  foreign key (ambassador_id, campaign_id) references public.fund_ambassadors (id, campaign_id) on delete set null (ambassador_id)
);

create table public.fund_donations (
  id                        uuid primary key default gen_random_uuid(),
  campaign_id               uuid not null references public.fund_campaigns (id) on delete restrict,
  team_id                   uuid,
  ambassador_id             uuid,
  link_id                   uuid,
  amount_cents              bigint not null check (amount_cents > 0),
  fee_cover_cents           bigint not null default 0 check (fee_cover_cents >= 0),
  platform_fee_cents        bigint not null default 0 check (platform_fee_cents >= 0),
  matched_cents             bigint not null default 0,
  currency                  text not null default 'usd',
  donor_name                text check (donor_name is null or char_length(donor_name) <= 160),
  donor_email               text check (donor_email is null or char_length(donor_email) <= 254),
  donor_phone               text,
  is_anonymous              boolean not null default false,
  message                   text check (message is null or char_length(message) <= 500),
  source                    text not null default 'online'
                              check (source in ('online', 'cash', 'check', 'wire', 'daf', 'other')),
  reference                 text,  -- check number, wire reference, etc.
  apply_match               boolean not null default true,
  status                    text not null default 'pending'
                              check (status in ('pending', 'succeeded', 'failed', 'canceled', 'refunded', 'disputed')),
  failure_code              text,
  failure_message           text,
  stripe_payment_intent_id  text unique,
  stripe_charge_id          text,
  livemode                  boolean,
  ip_address                inet,
  user_agent                text,
  country                   text,
  risk_level                text,
  is_flagged                boolean not null default false,
  flag_reason               text,
  notes                     text,
  received_at               timestamptz,  -- date an offline gift was received
  succeeded_at              timestamptz,
  refunded_at               timestamptz,
  settled_at                timestamptz,  -- set while the gift is counted in totals
  created_by                uuid default auth.uid() references auth.users (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  foreign key (team_id, campaign_id) references public.fund_teams (id, campaign_id) on delete set null (team_id),
  foreign key (ambassador_id, campaign_id) references public.fund_ambassadors (id, campaign_id) on delete set null (ambassador_id),
  foreign key (link_id, campaign_id) references public.fund_links (id, campaign_id) on delete set null (link_id)
);

-- Ledger of match dollars drawn from each matcher pool (reversible on refund).
create table public.fund_donation_matches (
  id            bigint generated always as identity primary key,
  donation_id   uuid not null references public.fund_donations (id) on delete cascade,
  matcher_id    uuid not null references public.fund_matchers (id) on delete restrict,
  ratio         numeric(6, 2) not null,
  amount_cents  bigint not null check (amount_cents > 0),
  reversed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table public.fund_outreach_logs (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.fund_campaigns (id) on delete cascade,
  ambassador_id  uuid,
  contact_name   text not null check (char_length(contact_name) between 1 and 160),
  contact_email  text,
  contact_phone  text,
  channel        text not null default 'call'
                   check (channel in ('call', 'email', 'sms', 'whatsapp', 'in_person', 'other')),
  outcome        text not null default 'follow_up'
                   check (outcome in ('no_answer', 'left_message', 'follow_up', 'pledged', 'donated', 'declined')),
  pledge_cents   bigint check (pledge_cents is null or pledge_cents > 0),
  notes          text check (notes is null or char_length(notes) <= 4000),
  follow_up_at   timestamptz,
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  foreign key (ambassador_id, campaign_id) references public.fund_ambassadors (id, campaign_id) on delete set null (ambassador_id)
);

create table public.fund_campaign_daily_metrics (
  campaign_id      uuid not null references public.fund_campaigns (id) on delete cascade,
  day              date not null,
  page_views       integer not null default 0,
  checkout_starts  integer not null default 0,
  primary key (campaign_id, day)
);

-- Stripe webhook ledger: primary key on the Stripe event id gives idempotency.
create table public.fund_webhook_events (
  id                   text primary key,
  type                 text not null,
  account              text,
  livemode             boolean,
  status               text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  attempts             integer not null default 1,
  error                text,
  related_donation_id  uuid references public.fund_donations (id) on delete set null,
  payload              jsonb not null,
  received_at          timestamptz not null default now(),
  processed_at         timestamptz
);

create table public.fund_flagged_ips (
  ip          inet primary key,
  reason      text,
  is_blocked  boolean not null default true,
  hit_count   integer not null default 0,
  expires_at  timestamptz,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.fund_audit_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid,
  actor_email  text,
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  campaign_id  uuid,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- Fixed-window rate limiter state (UNLOGGED: fast, not crash-safe — fine for counters).
create unlogged table public.fund_rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (key, window_start)
);

-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------

create index fund_org_members_user_idx        on public.fund_org_members (user_id) where user_id is not null;
create index fund_org_members_pending_idx     on public.fund_org_members (email) where user_id is null;
create index fund_campaigns_org_idx           on public.fund_campaigns (org_id);
create index fund_campaigns_status_idx        on public.fund_campaigns (status, ends_at);
create index fund_matchers_campaign_idx       on public.fund_matchers (campaign_id, priority, created_at);
create index fund_teams_campaign_idx          on public.fund_teams (campaign_id, raised_cents desc);
create index fund_ambassadors_campaign_idx    on public.fund_ambassadors (campaign_id, raised_cents desc);
create index fund_ambassadors_team_idx        on public.fund_ambassadors (team_id) where team_id is not null;
create index fund_links_campaign_idx          on public.fund_links (campaign_id, created_at desc);
create index fund_donations_campaign_idx      on public.fund_donations (campaign_id, status, created_at desc);
create index fund_donations_feed_idx          on public.fund_donations (campaign_id, succeeded_at desc) where status = 'succeeded';
create index fund_donations_top_idx           on public.fund_donations (campaign_id, amount_cents desc) where status = 'succeeded';
create index fund_donations_team_idx          on public.fund_donations (team_id) where team_id is not null;
create index fund_donations_ambassador_idx    on public.fund_donations (ambassador_id) where ambassador_id is not null;
create index fund_donations_link_idx          on public.fund_donations (link_id) where link_id is not null;
create index fund_donations_ip_idx            on public.fund_donations (ip_address, created_at desc) where ip_address is not null;
create index fund_donations_flagged_idx       on public.fund_donations (created_at desc) where is_flagged;
create index fund_donations_failed_idx        on public.fund_donations (created_at desc) where status = 'failed';
create index fund_donations_charge_idx        on public.fund_donations (stripe_charge_id) where stripe_charge_id is not null;
create index fund_donation_matches_don_idx    on public.fund_donation_matches (donation_id);
create index fund_donation_matches_match_idx  on public.fund_donation_matches (matcher_id);
create index fund_outreach_campaign_idx       on public.fund_outreach_logs (campaign_id, created_at desc);
create index fund_outreach_followup_idx       on public.fund_outreach_logs (campaign_id, follow_up_at) where follow_up_at is not null;
create index fund_webhook_events_recent_idx   on public.fund_webhook_events (received_at desc);
create index fund_webhook_events_failed_idx   on public.fund_webhook_events (received_at desc) where status = 'failed';
create index fund_audit_log_recent_idx        on public.fund_audit_log (created_at desc);
create index fund_audit_log_campaign_idx      on public.fund_audit_log (campaign_id, created_at desc) where campaign_id is not null;
create index fund_rate_limits_window_idx      on public.fund_rate_limits (window_start);

-- -----------------------------------------------------------------------------
-- 3. Authorization helpers (used by RLS policies)
-- -----------------------------------------------------------------------------

create or replace function public.fund_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fund_platform_admins a where a.user_id = (select auth.uid())
  );
$$;

-- Campaign ids the current user can see (p_write = false) or manage (p_write = true).
create or replace function public.fund_my_campaign_ids(p_write boolean default false)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.fund_campaigns c
  join public.fund_org_members m on m.org_id = c.org_id
  where m.user_id = (select auth.uid())
    and (not p_write or m.role in ('owner', 'manager'));
$$;

create or replace function public.fund_my_org_ids(p_write boolean default false)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id
  from public.fund_org_members m
  where m.user_id = (select auth.uid())
    and (not p_write or m.role in ('owner', 'manager'));
$$;

create or replace function public.fund_my_owned_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.fund_org_members m
  where m.user_id = (select auth.uid()) and m.role = 'owner';
$$;

create or replace function public.fund_can_view_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fund_is_platform_admin()
      or p_campaign_id in (select public.fund_my_campaign_ids(false));
$$;

create or replace function public.fund_can_manage_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.fund_is_platform_admin()
      or p_campaign_id in (select public.fund_my_campaign_ids(true));
$$;

-- -----------------------------------------------------------------------------
-- 4. Guard triggers — protect counters & privileged columns from direct edits
--    (They run as the invoking role: 'authenticated' for end users, while the
--    settlement functions below run as the definer and are allowed through.)
-- -----------------------------------------------------------------------------

create or replace function public.fund_guard_campaign()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_admin boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  v_admin := public.fund_is_platform_admin();

  if tg_op = 'INSERT' then
    new.raised_cents := 0;
    new.matched_cents := 0;
    new.donation_count := 0;
    new.last_donation_at := null;
    if v_admin then
      if new.status = 'active' then
        new.approved_at := coalesce(new.approved_at, now());
        new.approved_by := coalesce(new.approved_by, auth.uid());
      end if;
    else
      if new.status not in ('draft', 'pending_review') then
        new.status := 'pending_review';
      end if;
      new.approved_at := null;
      new.approved_by := null;
      new.platform_fee_bps := null;
    end if;
    return new;
  end if;

  -- UPDATE: counters are never writable by end users (admins use fund_recalculate_campaign).
  new.raised_cents := old.raised_cents;
  new.matched_cents := old.matched_cents;
  new.donation_count := old.donation_count;
  new.last_donation_at := old.last_donation_at;

  if v_admin then
    if new.status = 'active' and old.status <> 'active' and new.approved_at is null then
      new.approved_at := now();
      new.approved_by := auth.uid();
    end if;
    return new;
  end if;

  new.org_id := old.org_id;
  new.slug := old.slug;
  new.platform_fee_bps := old.platform_fee_bps;
  new.approved_at := old.approved_at;
  new.approved_by := old.approved_by;

  if new.status is distinct from old.status then
    if not (
         (old.status = 'draft' and new.status = 'pending_review')
      or (old.status = 'pending_review' and new.status = 'draft')
      or (old.status = 'active' and new.status in ('paused', 'completed'))
      or (old.status = 'paused' and new.status in ('active', 'completed') and old.approved_at is not null)
    ) then
      raise exception 'Campaign status change % -> % requires a platform admin', old.status, new.status
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.fund_guard_counters()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if tg_table_name = 'fund_matchers' then
      new.matched_cents := 0;
    else
      new.raised_cents := 0;
      new.donation_count := 0;
    end if;
    if tg_table_name = 'fund_links' then
      new.click_count := 0;
    end if;
  else
    new.campaign_id := old.campaign_id;
    if tg_table_name = 'fund_matchers' then
      new.matched_cents := old.matched_cents;
      if new.pledge_cents < old.matched_cents then
        raise exception 'Pledge cannot be lowered below the % cents already matched', old.matched_cents
          using errcode = '23514';
      end if;
    else
      new.raised_cents := old.raised_cents;
      new.donation_count := old.donation_count;
    end if;
    if tg_table_name = 'fund_links' then
      new.click_count := old.click_count;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.fund_guard_donation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_admin boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  v_admin := public.fund_is_platform_admin();

  -- System-managed columns are never client-writable.
  if tg_op = 'INSERT' then
    new.matched_cents := 0;
    new.settled_at := null;
    new.created_by := auth.uid();
    if not v_admin then
      new.platform_fee_cents := 0;
      new.fee_cover_cents := 0;
      new.is_flagged := false;
      new.flag_reason := null;
      new.stripe_payment_intent_id := null;
      new.stripe_charge_id := null;
      new.ip_address := null;
      new.risk_level := null;
    end if;
    if new.source <> 'online' then
      if not v_admin or new.status = 'pending' then
        new.status := 'succeeded';
      end if;
      new.received_at := coalesce(new.received_at, now());
      new.succeeded_at := coalesce(new.succeeded_at, now());
    end if;
    return new;
  end if;

  new.matched_cents := old.matched_cents;
  new.settled_at := old.settled_at;
  new.campaign_id := old.campaign_id;
  new.stripe_payment_intent_id := old.stripe_payment_intent_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if v_admin then
    if new.status = 'succeeded' and old.status <> 'succeeded' then
      new.succeeded_at := coalesce(new.succeeded_at, now());
    end if;
    if new.status = 'refunded' and old.status <> 'refunded' then
      new.refunded_at := coalesce(new.refunded_at, now());
    end if;
    return new;
  end if;

  -- Campaign managers may correct or void OFFLINE gifts only.
  if old.source = 'online' or new.source = 'online' then
    raise exception 'Online donations can only be changed by Stripe or a platform admin' using errcode = '42501';
  end if;
  if new.status not in ('succeeded', 'canceled') then
    raise exception 'Offline donations can only be marked succeeded or canceled' using errcode = '42501';
  end if;
  new.platform_fee_cents := old.platform_fee_cents;
  new.fee_cover_cents := old.fee_cover_cents;
  new.stripe_charge_id := old.stripe_charge_id;
  new.ip_address := old.ip_address;
  new.is_flagged := old.is_flagged;
  new.flag_reason := old.flag_reason;
  new.risk_level := old.risk_level;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Realtime broadcast + public JSON shapes
-- -----------------------------------------------------------------------------

create or replace function public.fund_broadcast(p_campaign_id uuid, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    -- Public broadcast channel (private = false): any visitor may subscribe.
    perform realtime.send(p_payload, p_event, 'campaign_donations_' || p_campaign_id::text, false);
  exception when others then
    -- Never fail a donation because Realtime is unavailable; clients also poll.
    raise warning 'fund_broadcast(%): %', p_event, sqlerrm;
  end;
end;
$$;

-- Matcher whose pool is currently being drawn (first in the waterfall).
create or replace function public.fund_current_matcher(p_campaign_id uuid, p_at timestamptz default now())
returns public.fund_matchers
language sql
stable
security definer
set search_path = ''
as $$
  select m.*
  from public.fund_matchers m
  where m.campaign_id = p_campaign_id
    and m.status = 'active'
    and m.matched_cents < m.pledge_cents
    and (m.starts_at is null or m.starts_at <= p_at)
    and (m.ends_at is null or m.ends_at > p_at)
  order by m.priority asc, m.created_at asc, m.id asc
  limit 1;
$$;

create or replace function public.fund_campaign_totals(p_campaign_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'campaign_id',            c.id,
    'raised_cents',           c.raised_cents,
    'matched_cents',          c.matched_cents,
    'total_cents',            c.raised_cents + c.matched_cents,
    'donation_count',         c.donation_count,
    'goal_cents',             c.goal_cents,
    'bonus_goal_cents',       c.bonus_goal_cents,
    'status',                 c.status,
    'last_donation_at',       c.last_donation_at,
    'match_pledged_cents',    coalesce((
                                select sum(m.pledge_cents) from public.fund_matchers m
                                where m.campaign_id = c.id and m.status = 'active'), 0),
    'match_remaining_cents',  coalesce((
                                select sum(m.pledge_cents - m.matched_cents) from public.fund_matchers m
                                where m.campaign_id = c.id and m.status = 'active'
                                  and (m.ends_at is null or m.ends_at > now())), 0),
    'current_ratio',          (select (public.fund_current_matcher(c.id)).ratio),
    'server_time',            now()
  )
  from public.fund_campaigns c
  where c.id = p_campaign_id;
$$;

create or replace function public.fund_public_donation_json(d public.fund_donations)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',              d.id,
    'name',            case when d.is_anonymous or coalesce(btrim(d.donor_name), '') = '' then 'Anonymous'
                            else d.donor_name end,
    'is_anonymous',    d.is_anonymous,
    'amount_cents',    d.amount_cents,
    'matched_cents',   d.matched_cents,
    'message',         d.message,
    'team_id',         d.team_id,
    'team_name',       (select t.name from public.fund_teams t where t.id = d.team_id),
    'ambassador_id',   d.ambassador_id,
    'ambassador_name', (select a.name from public.fund_ambassadors a where a.id = d.ambassador_id),
    'offline',         d.source <> 'online',
    'created_at',      coalesce(d.succeeded_at, d.created_at)
  );
$$;

create or replace function public.fund_public_matcher_json(m public.fund_matchers)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',               m.id,
    'name',             case when m.is_anonymous then 'Anonymous Matcher' else coalesce(m.display_name, m.name) end,
    'logo_url',         case when m.is_anonymous then null else m.logo_url end,
    'message',          m.message,
    'ratio',            m.ratio,
    'pledge_cents',     m.pledge_cents,
    'matched_cents',    m.matched_cents,
    'remaining_cents',  m.pledge_cents - m.matched_cents,
    'priority',         m.priority,
    'starts_at',        m.starts_at,
    'ends_at',          m.ends_at,
    'status',           m.status,
    'is_live',          m.status = 'active' and m.matched_cents < m.pledge_cents
                        and (m.starts_at is null or m.starts_at <= now())
                        and (m.ends_at is null or m.ends_at > now())
  );
$$;

-- -----------------------------------------------------------------------------
-- 6. Settlement: the multi-tier matching waterfall
--
--    Active matchers are drawn in priority order (lowest first). Each matcher
--    covers as much of the gift as its remaining pool allows at its own ratio;
--    the uncovered remainder spills to the next matcher. Example:
--      Tier 1  priority 10  ratio 3 ($1 = $4)  "Power Hour" pool $5,000
--      Tier 2  priority 20  ratio 1 ($1 = $2)  base pool $100,000
--    A $1,000 gift with $1,500 left in tier 1 -> $500 x3 = $1,500 + $500 x1 = $500.
--    Rows are locked FOR UPDATE, so concurrent gifts serialize per pool and a
--    pool can never be overdrawn.
-- -----------------------------------------------------------------------------

create or replace function public.fund_settle_donation(p_donation_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  d            public.fund_donations%rowtype;
  m            record;
  v_at         timestamptz;
  v_left       bigint;
  v_remaining  bigint;
  v_portion    bigint;
  v_match      bigint;
  v_total      bigint := 0;
begin
  select * into d from public.fund_donations where id = p_donation_id for update;
  if not found or d.status <> 'succeeded' or d.settled_at is not null then
    return 0;
  end if;

  v_at := coalesce(d.received_at, d.created_at);
  v_left := d.amount_cents;

  if d.apply_match then
    for m in
      select mt.id, mt.ratio, mt.pledge_cents, mt.matched_cents
      from public.fund_matchers mt
      where mt.campaign_id = d.campaign_id
        and mt.status = 'active'
        and mt.matched_cents < mt.pledge_cents
        and (mt.starts_at is null or mt.starts_at <= v_at)
        and (mt.ends_at is null or mt.ends_at > v_at)
      order by mt.priority asc, mt.created_at asc, mt.id asc
      for update
    loop
      exit when v_left <= 0;
      v_remaining := m.pledge_cents - m.matched_cents;
      v_portion := least(v_left, ceil(v_remaining::numeric / m.ratio)::bigint);
      v_match := least(v_remaining, floor(v_portion * m.ratio)::bigint);
      continue when v_match <= 0;

      update public.fund_matchers set matched_cents = matched_cents + v_match where id = m.id;
      insert into public.fund_donation_matches (donation_id, matcher_id, ratio, amount_cents)
      values (d.id, m.id, m.ratio, v_match);

      v_total := v_total + v_match;
      v_left := v_left - v_portion;
    end loop;
  end if;

  update public.fund_donations
     set matched_cents = v_total, settled_at = now()
   where id = d.id;

  update public.fund_campaigns
     set raised_cents = raised_cents + d.amount_cents,
         matched_cents = matched_cents + v_total,
         donation_count = donation_count + 1,
         last_donation_at = greatest(coalesce(last_donation_at, '-infinity'::timestamptz), now())
   where id = d.campaign_id;

  if d.team_id is not null then
    update public.fund_teams
       set raised_cents = raised_cents + d.amount_cents + v_total, donation_count = donation_count + 1
     where id = d.team_id;
  end if;
  if d.ambassador_id is not null then
    update public.fund_ambassadors
       set raised_cents = raised_cents + d.amount_cents + v_total, donation_count = donation_count + 1
     where id = d.ambassador_id;
  end if;
  if d.link_id is not null then
    update public.fund_links
       set raised_cents = raised_cents + d.amount_cents, donation_count = donation_count + 1
     where id = d.link_id;
  end if;

  return v_total;
end;
$$;

-- Reverses a settlement using the values that were settled (passed explicitly so
-- edits to team/amount can be re-settled correctly).
create or replace function public.fund_unsettle_donation(
  p_donation_id   uuid,
  p_campaign_id   uuid,
  p_amount_cents  bigint,
  p_team_id       uuid,
  p_ambassador_id uuid,
  p_link_id       uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settled  timestamptz;
  v_matched  bigint;
  r          record;
begin
  select settled_at into v_settled from public.fund_donations where id = p_donation_id for update;
  if v_settled is null then
    return;
  end if;

  v_matched := 0;
  for r in
    select dm.id, dm.matcher_id, dm.amount_cents
    from public.fund_donation_matches dm
    join public.fund_matchers mt on mt.id = dm.matcher_id
    where dm.donation_id = p_donation_id and dm.reversed_at is null
    order by mt.priority asc, mt.created_at asc, mt.id asc
  loop
    update public.fund_matchers
       set matched_cents = greatest(matched_cents - r.amount_cents, 0)
     where id = r.matcher_id;
    update public.fund_donation_matches set reversed_at = now() where id = r.id;
    v_matched := v_matched + r.amount_cents;
  end loop;

  update public.fund_donations set matched_cents = 0, settled_at = null where id = p_donation_id;

  update public.fund_campaigns
     set raised_cents = greatest(raised_cents - p_amount_cents, 0),
         matched_cents = greatest(matched_cents - v_matched, 0),
         donation_count = greatest(donation_count - 1, 0)
   where id = p_campaign_id;

  if p_team_id is not null then
    update public.fund_teams
       set raised_cents = greatest(raised_cents - p_amount_cents - v_matched, 0),
           donation_count = greatest(donation_count - 1, 0)
     where id = p_team_id;
  end if;
  if p_ambassador_id is not null then
    update public.fund_ambassadors
       set raised_cents = greatest(raised_cents - p_amount_cents - v_matched, 0),
           donation_count = greatest(donation_count - 1, 0)
     where id = p_ambassador_id;
  end if;
  if p_link_id is not null then
    update public.fund_links
       set raised_cents = greatest(raised_cents - p_amount_cents, 0),
           donation_count = greatest(donation_count - 1, 0)
     where id = p_link_id;
  end if;
end;
$$;

-- Status/amount changes on a donation drive settlement + realtime broadcast.
create or replace function public.fund_on_donation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row        public.fund_donations%rowtype;
  v_settled    boolean := false;
  v_unsettled  boolean := false;
  v_payload    jsonb;
begin
  if tg_op = 'INSERT' then
    if new.status = 'succeeded' then
      perform public.fund_settle_donation(new.id);
      v_settled := true;
    end if;
  else
    if old.status = 'succeeded' and new.status <> 'succeeded' then
      perform public.fund_unsettle_donation(old.id, old.campaign_id, old.amount_cents,
                                            old.team_id, old.ambassador_id, old.link_id);
      v_unsettled := true;
    elsif old.status <> 'succeeded' and new.status = 'succeeded' then
      perform public.fund_settle_donation(new.id);
      v_settled := true;
    elsif new.status = 'succeeded' and (
         new.amount_cents is distinct from old.amount_cents
      or new.team_id is distinct from old.team_id
      or new.ambassador_id is distinct from old.ambassador_id
      or new.apply_match is distinct from old.apply_match) then
      -- Admin/manager correction of a settled gift: re-settle with new values.
      perform public.fund_unsettle_donation(old.id, old.campaign_id, old.amount_cents,
                                            old.team_id, old.ambassador_id, old.link_id);
      perform public.fund_settle_donation(new.id);
      v_unsettled := true;
    elsif new.status = 'succeeded' and (
         new.is_anonymous is distinct from old.is_anonymous
      or new.donor_name is distinct from old.donor_name
      or new.message is distinct from old.message) then
      v_unsettled := true;  -- public feed text changed -> ask clients to refresh
    end if;
  end if;

  if v_settled then
    select * into v_row from public.fund_donations where id = new.id;
    v_payload := jsonb_build_object(
      'donation', public.fund_public_donation_json(v_row),
      'totals', public.fund_campaign_totals(new.campaign_id),
      'team', (select jsonb_build_object('id', t.id, 'raised_cents', t.raised_cents, 'donation_count', t.donation_count)
                 from public.fund_teams t where t.id = v_row.team_id),
      'ambassador', (select jsonb_build_object('id', a.id, 'raised_cents', a.raised_cents, 'donation_count', a.donation_count)
                       from public.fund_ambassadors a where a.id = v_row.ambassador_id)
    );
    perform public.fund_broadcast(new.campaign_id, 'donation', v_payload);
  elsif v_unsettled then
    perform public.fund_broadcast(new.campaign_id, 'refresh',
      jsonb_build_object('reason', 'donation_updated', 'totals', public.fund_campaign_totals(new.campaign_id)));
  end if;
  return null;
end;
$$;

-- Configuration changes (matchers, teams, campaign status/goal) -> 'refresh'.
-- pg_trigger_depth() > 1 skips counter updates performed inside settlement.
create or replace function public.fund_on_config_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_table_name = 'fund_campaigns' then
    v_campaign_id := coalesce(new.id, old.id);
  else
    v_campaign_id := coalesce((to_jsonb(new) ->> 'campaign_id')::uuid, (to_jsonb(old) ->> 'campaign_id')::uuid);
  end if;
  if tg_op = 'DELETE' and tg_table_name = 'fund_campaigns' then
    return null;
  end if;
  perform public.fund_broadcast(v_campaign_id, 'refresh',
    jsonb_build_object('reason', tg_table_name, 'totals', public.fund_campaign_totals(v_campaign_id)));
  return null;
end;
$$;

-- Human (JWT-authenticated) changes are written to the audit log automatically.
create or replace function public.fund_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_new      jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old      jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_changes  jsonb := '{}'::jsonb;
  k          text;
begin
  if v_uid is null or pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if k not in ('updated_at', 'settled_at') and (v_new -> k) is distinct from (v_old -> k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;
    end if;
  elsif tg_op = 'INSERT' then
    v_changes := v_new - 'donor_email' - 'donor_phone' - 'contact_email' - 'contact_phone';
  else
    v_changes := v_old - 'donor_email' - 'donor_phone' - 'contact_email' - 'contact_phone';
  end if;

  insert into public.fund_audit_log (actor_id, actor_email, action, entity_type, entity_id, campaign_id, details)
  values (
    v_uid,
    auth.jwt() ->> 'email',
    lower(tg_op),
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id'),
    case when tg_table_name = 'fund_campaigns' then coalesce(v_new ->> 'id', v_old ->> 'id')::uuid
         else coalesce(v_new ->> 'campaign_id', v_old ->> 'campaign_id')::uuid end,
    v_changes
  );
  return null;
end;
$$;

-- Link pending org invitations when a user signs up with that email.
create or replace function public.fund_link_invites_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.fund_org_members
     set user_id = new.id
   where user_id is null and email = lower(new.email);
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Triggers
-- -----------------------------------------------------------------------------

create trigger fund_organizations_updated_at before update on public.fund_organizations
  for each row execute function public.fund_set_updated_at();
create trigger fund_campaigns_updated_at before update on public.fund_campaigns
  for each row execute function public.fund_set_updated_at();
create trigger fund_matchers_updated_at before update on public.fund_matchers
  for each row execute function public.fund_set_updated_at();
create trigger fund_teams_updated_at before update on public.fund_teams
  for each row execute function public.fund_set_updated_at();
create trigger fund_ambassadors_updated_at before update on public.fund_ambassadors
  for each row execute function public.fund_set_updated_at();
create trigger fund_donations_updated_at before update on public.fund_donations
  for each row execute function public.fund_set_updated_at();
create trigger fund_flagged_ips_updated_at before update on public.fund_flagged_ips
  for each row execute function public.fund_set_updated_at();

create trigger fund_campaigns_guard before insert or update on public.fund_campaigns
  for each row execute function public.fund_guard_campaign();
create trigger fund_matchers_guard before insert or update on public.fund_matchers
  for each row execute function public.fund_guard_counters();
create trigger fund_teams_guard before insert or update on public.fund_teams
  for each row execute function public.fund_guard_counters();
create trigger fund_ambassadors_guard before insert or update on public.fund_ambassadors
  for each row execute function public.fund_guard_counters();
create trigger fund_links_guard before insert or update on public.fund_links
  for each row execute function public.fund_guard_counters();
create trigger fund_donations_guard before insert or update on public.fund_donations
  for each row execute function public.fund_guard_donation();

create trigger fund_donations_settle after insert or update of status, amount_cents, team_id, ambassador_id,
  apply_match, is_anonymous, donor_name, message on public.fund_donations
  for each row execute function public.fund_on_donation_change();

create trigger fund_matchers_broadcast after insert or update or delete on public.fund_matchers
  for each row execute function public.fund_on_config_change();
create trigger fund_teams_broadcast after insert or update or delete on public.fund_teams
  for each row execute function public.fund_on_config_change();
create trigger fund_ambassadors_broadcast after insert or update or delete on public.fund_ambassadors
  for each row execute function public.fund_on_config_change();
create trigger fund_campaigns_broadcast after update on public.fund_campaigns
  for each row execute function public.fund_on_config_change();

create trigger fund_campaigns_audit after insert or update or delete on public.fund_campaigns
  for each row execute function public.fund_audit();
create trigger fund_matchers_audit after insert or update or delete on public.fund_matchers
  for each row execute function public.fund_audit();
create trigger fund_donations_audit after insert or update or delete on public.fund_donations
  for each row execute function public.fund_audit();
create trigger fund_organizations_audit after insert or update or delete on public.fund_organizations
  for each row execute function public.fund_audit();
create trigger fund_org_members_audit after insert or update or delete on public.fund_org_members
  for each row execute function public.fund_audit();
create trigger fund_flagged_ips_audit after insert or update or delete on public.fund_flagged_ips
  for each row execute function public.fund_audit();

create trigger fund_link_invites_on_signup after insert on auth.users
  for each row execute function public.fund_link_invites_on_signup();

-- -----------------------------------------------------------------------------
-- 8. Public & dashboard RPCs
-- -----------------------------------------------------------------------------

-- Everything the public campaign page / big screen needs, in one round trip.
create or replace function public.fund_get_public_campaign(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c  public.fund_campaigns%rowtype;
  o  public.fund_organizations%rowtype;
begin
  select * into c from public.fund_campaigns where slug = lower(p_slug);
  if not found then
    return null;
  end if;
  if c.status not in ('active', 'paused', 'completed') and not public.fund_can_view_campaign(c.id) then
    return null;  -- drafts are only visible to their managers (preview)
  end if;
  select * into o from public.fund_organizations where id = c.org_id;

  return jsonb_build_object(
    'campaign', jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'tagline', c.tagline, 'description', c.description,
      'hero_image_url', c.hero_image_url, 'logo_url', c.logo_url, 'video_url', c.video_url,
      'theme_color', c.theme_color, 'currency', c.currency, 'goal_cents', c.goal_cents,
      'bonus_goal_cents', c.bonus_goal_cents, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
      'status', c.status, 'preset_amounts', to_jsonb(c.preset_amounts),
      'min_donation_cents', c.min_donation_cents, 'max_donation_cents', c.max_donation_cents,
      'allow_anonymous', c.allow_anonymous, 'allow_fee_cover', c.allow_fee_cover,
      'display_settings', c.display_settings
    ),
    'organization', jsonb_build_object(
      'name', o.name, 'logo_url', o.logo_url, 'website_url', o.website_url, 'ein', o.ein
    ),
    'accepting_online', (o.status = 'active' and o.stripe_account_id is not null and o.stripe_charges_enabled),
    'totals', public.fund_campaign_totals(c.id),
    'matchers', coalesce((
      select jsonb_agg(public.fund_public_matcher_json(m) order by m.priority, m.created_at)
      from public.fund_matchers m where m.campaign_id = c.id
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'slug', t.slug, 'name', t.name, 'captain_name', t.captain_name,
        'description', t.description, 'avatar_url', t.avatar_url, 'goal_cents', t.goal_cents,
        'raised_cents', t.raised_cents, 'donation_count', t.donation_count
      ) order by t.raised_cents desc, t.sort_order, t.name)
      from public.fund_teams t where t.campaign_id = c.id and t.is_active
    ), '[]'::jsonb),
    'ambassadors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'code', a.code, 'name', a.name, 'team_id', a.team_id, 'avatar_url', a.avatar_url,
        'message', a.message, 'goal_cents', a.goal_cents, 'raised_cents', a.raised_cents,
        'donation_count', a.donation_count
      ) order by a.raised_cents desc, a.name)
      from public.fund_ambassadors a where a.campaign_id = c.id and a.is_active
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(public.fund_public_donation_json(d) order by d.succeeded_at desc nulls last)
      from public.fund_donations d
      where d.id in (
        select r.id from public.fund_donations r
        where r.campaign_id = c.id and r.status = 'succeeded'
        order by r.succeeded_at desc nulls last
        limit 60
      )
    ), '[]'::jsonb),
    'top', coalesce((
      select jsonb_agg(public.fund_public_donation_json(d) order by d.amount_cents desc)
      from public.fund_donations d
      where d.id in (
        select r.id from public.fund_donations r
        where r.campaign_id = c.id and r.status = 'succeeded'
        order by r.amount_cents desc
        limit 12
      )
    ), '[]'::jsonb),
    'server_time', now()
  );
end;
$$;

create or replace function public.fund_list_public_campaigns()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'title', c.title, 'tagline', c.tagline,
    'hero_image_url', c.hero_image_url, 'theme_color', c.theme_color,
    'goal_cents', c.goal_cents, 'total_cents', c.raised_cents + c.matched_cents,
    'donation_count', c.donation_count, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'status', c.status, 'organization', o.name
  ) order by c.ends_at), '[]'::jsonb)
  from public.fund_campaigns c
  join public.fund_organizations o on o.id = c.org_id
  where c.status = 'active' and c.ends_at > now() - interval '7 days';
$$;

create or replace function public.fund_track_page_view(p_campaign_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.fund_campaign_daily_metrics (campaign_id, day, page_views)
  select c.id, (now() at time zone 'utc')::date, 1
  from public.fund_campaigns c where c.id = p_campaign_id
  on conflict (campaign_id, day) do update set page_views = public.fund_campaign_daily_metrics.page_views + 1;
$$;

create or replace function public.fund_track_checkout_start(p_campaign_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.fund_campaign_daily_metrics (campaign_id, day, checkout_starts)
  values (p_campaign_id, (now() at time zone 'utc')::date, 1)
  on conflict (campaign_id, day) do update
    set checkout_starts = public.fund_campaign_daily_metrics.checkout_starts + 1;
$$;

-- Resolves a short link, counts the click and returns where to send the visitor.
create or replace function public.fund_resolve_link(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l  public.fund_links%rowtype;
begin
  update public.fund_links set click_count = click_count + 1 where code = p_code returning * into l;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'link_id', l.id,
    'slug', (select c.slug from public.fund_campaigns c where c.id = l.campaign_id),
    'team', (select t.slug from public.fund_teams t where t.id = l.team_id),
    'ref', (select a.code from public.fund_ambassadors a where a.id = l.ambassador_id),
    'amount_cents', l.preset_amount_cents,
    'utm_source', l.utm_source, 'utm_medium', l.utm_medium, 'utm_campaign', l.utm_campaign
  );
end;
$$;

-- Fixed-window rate limiter for API routes (service role only).
create or replace function public.fund_check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window  timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count   integer;
begin
  insert into public.fund_rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = public.fund_rate_limits.count + 1
  returning count into v_count;
  if random() < 0.01 then
    delete from public.fund_rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_count <= p_limit;
end;
$$;

-- Links any pending invitations for the signed-in user's email.
create or replace function public.fund_claim_invites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    return 0;
  end if;
  update public.fund_org_members
     set user_id = auth.uid()
   where user_id is null and email = lower(auth.jwt() ->> 'email');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.fund_platform_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.fund_is_platform_admin() then
    raise exception 'Platform admin only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'gross_cents',            coalesce((select sum(amount_cents) from public.fund_donations where status = 'succeeded'), 0),
    'online_gross_cents',     coalesce((select sum(amount_cents) from public.fund_donations where status = 'succeeded' and source = 'online'), 0),
    'matched_cents',          coalesce((select sum(matched_cents) from public.fund_campaigns), 0),
    'platform_fees_cents',    coalesce((select sum(platform_fee_cents) from public.fund_donations where status = 'succeeded'), 0),
    'fee_cover_cents',        coalesce((select sum(fee_cover_cents) from public.fund_donations where status = 'succeeded'), 0),
    'live_campaigns',         (select count(*) from public.fund_campaigns where status = 'active' and now() between starts_at and ends_at),
    'active_campaigns',       (select count(*) from public.fund_campaigns where status in ('active', 'paused')),
    'pending_review',         (select count(*) from public.fund_campaigns where status = 'pending_review'),
    'match_locked_cents',     coalesce((select sum(m.pledge_cents) from public.fund_matchers m
                                        join public.fund_campaigns c on c.id = m.campaign_id
                                        where c.status in ('active', 'paused') and m.status = 'active'), 0),
    'match_remaining_cents',  coalesce((select sum(m.pledge_cents - m.matched_cents) from public.fund_matchers m
                                        join public.fund_campaigns c on c.id = m.campaign_id
                                        where c.status in ('active', 'paused') and m.status = 'active'), 0),
    'donations_24h',          (select count(*) from public.fund_donations where status = 'succeeded' and succeeded_at > now() - interval '24 hours'),
    'gross_24h_cents',        coalesce((select sum(amount_cents) from public.fund_donations where status = 'succeeded' and succeeded_at > now() - interval '24 hours'), 0),
    'failed_24h',             (select count(*) from public.fund_donations where status = 'failed' and updated_at > now() - interval '24 hours'),
    'flagged_open',           (select count(*) from public.fund_donations where is_flagged and status in ('pending', 'succeeded', 'disputed')),
    'webhooks_failed_24h',    (select count(*) from public.fund_webhook_events where status = 'failed' and received_at > now() - interval '24 hours'),
    'blocked_ips',            (select count(*) from public.fund_flagged_ips where is_blocked and (expires_at is null or expires_at > now())),
    'organizations',          (select count(*) from public.fund_organizations),
    'organizations_onboarded',(select count(*) from public.fund_organizations where stripe_charges_enabled)
  );
end;
$$;

create or replace function public.fund_campaign_dashboard(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_views      bigint;
  v_starts     bigint;
  v_online     bigint;
begin
  if not public.fund_can_view_campaign(p_campaign_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select coalesce(sum(page_views), 0), coalesce(sum(checkout_starts), 0)
    into v_views, v_starts
    from public.fund_campaign_daily_metrics where campaign_id = p_campaign_id;
  select count(*) into v_online
    from public.fund_donations where campaign_id = p_campaign_id and status = 'succeeded' and source = 'online';

  return jsonb_build_object(
    'totals', public.fund_campaign_totals(p_campaign_id),
    'page_views', v_views,
    'checkout_starts', v_starts,
    'online_donations', v_online,
    'visit_conversion', case when v_views > 0 then round(v_online::numeric / v_views, 4) else null end,
    'checkout_conversion', case when v_starts > 0 then round(v_online::numeric / v_starts, 4) else null end,
    'unique_donors', (select count(distinct coalesce(lower(donor_email), id::text))
                        from public.fund_donations where campaign_id = p_campaign_id and status = 'succeeded'),
    'average_gift_cents', (select coalesce(round(avg(amount_cents)), 0)
                             from public.fund_donations where campaign_id = p_campaign_id and status = 'succeeded'),
    'by_source', coalesce((
      select jsonb_object_agg(source, jsonb_build_object('count', n, 'amount_cents', amt))
      from (select source, count(*) n, sum(amount_cents) amt from public.fund_donations
            where campaign_id = p_campaign_id and status = 'succeeded' group by source) s
    ), '{}'::jsonb),
    'failed_count', (select count(*) from public.fund_donations where campaign_id = p_campaign_id and status = 'failed'),
    'hourly', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h, 'amount_cents', amt, 'count', n) order by h)
      from (select date_trunc('hour', succeeded_at) h, sum(amount_cents + matched_cents) amt, count(*) n
            from public.fund_donations
            where campaign_id = p_campaign_id and status = 'succeeded' and succeeded_at > now() - interval '48 hours'
            group by 1) x
    ), '[]'::jsonb)
  );
end;
$$;

-- Admin repair tool: recompute every counter for a campaign from the ledger.
create or replace function public.fund_recalculate_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.fund_is_platform_admin()
     and session_user not in ('postgres', 'supabase_admin')
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Platform admin only' using errcode = '42501';
  end if;

  update public.fund_matchers m set matched_cents = coalesce((
    select sum(dm.amount_cents) from public.fund_donation_matches dm
    where dm.matcher_id = m.id and dm.reversed_at is null), 0)
  where m.campaign_id = p_campaign_id;

  update public.fund_campaigns c set
    raised_cents = coalesce((select sum(amount_cents) from public.fund_donations d where d.campaign_id = c.id and d.settled_at is not null), 0),
    matched_cents = coalesce((select sum(matched_cents) from public.fund_donations d where d.campaign_id = c.id and d.settled_at is not null), 0),
    donation_count = (select count(*) from public.fund_donations d where d.campaign_id = c.id and d.settled_at is not null)
  where c.id = p_campaign_id;

  update public.fund_teams t set
    raised_cents = coalesce((select sum(amount_cents + matched_cents) from public.fund_donations d where d.team_id = t.id and d.settled_at is not null), 0),
    donation_count = (select count(*) from public.fund_donations d where d.team_id = t.id and d.settled_at is not null)
  where t.campaign_id = p_campaign_id;

  update public.fund_ambassadors a set
    raised_cents = coalesce((select sum(amount_cents + matched_cents) from public.fund_donations d where d.ambassador_id = a.id and d.settled_at is not null), 0),
    donation_count = (select count(*) from public.fund_donations d where d.ambassador_id = a.id and d.settled_at is not null)
  where a.campaign_id = p_campaign_id;

  update public.fund_links l set
    raised_cents = coalesce((select sum(amount_cents) from public.fund_donations d where d.link_id = l.id and d.settled_at is not null), 0),
    donation_count = (select count(*) from public.fund_donations d where d.link_id = l.id and d.settled_at is not null)
  where l.campaign_id = p_campaign_id;

  perform public.fund_broadcast(p_campaign_id, 'refresh',
    jsonb_build_object('reason', 'recalculated', 'totals', public.fund_campaign_totals(p_campaign_id)));
  return public.fund_campaign_totals(p_campaign_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.fund_platform_admins        enable row level security;
alter table public.fund_organizations          enable row level security;
alter table public.fund_org_members            enable row level security;
alter table public.fund_campaigns              enable row level security;
alter table public.fund_matchers               enable row level security;
alter table public.fund_teams                  enable row level security;
alter table public.fund_ambassadors            enable row level security;
alter table public.fund_links                  enable row level security;
alter table public.fund_donations              enable row level security;
alter table public.fund_donation_matches       enable row level security;
alter table public.fund_outreach_logs          enable row level security;
alter table public.fund_campaign_daily_metrics enable row level security;
alter table public.fund_webhook_events         enable row level security;
alter table public.fund_flagged_ips            enable row level security;
alter table public.fund_audit_log              enable row level security;
alter table public.fund_rate_limits            enable row level security;

-- Platform admins
create policy "admins read admin list" on public.fund_platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.fund_is_platform_admin()));
create policy "admins manage admin list" on public.fund_platform_admins
  for all to authenticated
  using ((select public.fund_is_platform_admin()))
  with check ((select public.fund_is_platform_admin()));

-- Organizations
create policy "org members read org" on public.fund_organizations
  for select to authenticated
  using ((select public.fund_is_platform_admin()) or id in (select public.fund_my_org_ids(false)));
create policy "admins manage orgs" on public.fund_organizations
  for all to authenticated
  using ((select public.fund_is_platform_admin()))
  with check ((select public.fund_is_platform_admin()));

-- Org members
create policy "members read org roster" on public.fund_org_members
  for select to authenticated
  using ((select public.fund_is_platform_admin()) or org_id in (select public.fund_my_org_ids(false)));
create policy "admins manage members" on public.fund_org_members
  for all to authenticated
  using ((select public.fund_is_platform_admin()))
  with check ((select public.fund_is_platform_admin()));
create policy "owners manage members" on public.fund_org_members
  for all to authenticated
  using (org_id in (select public.fund_my_owned_org_ids()))
  with check (org_id in (select public.fund_my_owned_org_ids()));

-- Campaigns
create policy "members read campaigns" on public.fund_campaigns
  for select to authenticated
  using ((select public.fund_is_platform_admin()) or org_id in (select public.fund_my_org_ids(false)));
create policy "managers create campaigns" on public.fund_campaigns
  for insert to authenticated
  with check ((select public.fund_is_platform_admin()) or org_id in (select public.fund_my_org_ids(true)));
create policy "managers update campaigns" on public.fund_campaigns
  for update to authenticated
  using ((select public.fund_is_platform_admin()) or org_id in (select public.fund_my_org_ids(true)))
  with check ((select public.fund_is_platform_admin()) or org_id in (select public.fund_my_org_ids(true)));
create policy "admins delete campaigns" on public.fund_campaigns
  for delete to authenticated
  using ((select public.fund_is_platform_admin()));

-- Campaign-scoped tables managed by org managers
create policy "members read matchers" on public.fund_matchers for select to authenticated
  using ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(false)));
create policy "managers write matchers" on public.fund_matchers for all to authenticated
  using ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(true)))
  with check ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(true)));

create policy "members read teams" on public.fund_teams for select to authenticated
  using ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(false)));
create policy "managers write teams" on public.fund_teams for all to authenticated
  using ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(true)))
  with check ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(true)));

create policy "members read ambassadors" on public.fund_ambassadors for select to authenticated
  using ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(false)));
create policy "managers write ambassadors" on public.fund_ambassadors for all to authenticated
  using ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(true)))
  with check ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(true)));

create policy "members read links" on public.fund_links for select to authenticated
  using ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(false)));
create policy "managers write links" on public.fund_links for all to authenticated
  using ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(true)))
  with check ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(true)));

create policy "members read outreach" on public.fund_outreach_logs for select to authenticated
  using ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(false)));
create policy "managers write outreach" on public.fund_outreach_logs for all to authenticated
  using ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(true)))
  with check ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(true)));

create policy "members read metrics" on public.fund_campaign_daily_metrics for select to authenticated
  using ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(false)));

-- Donations: managers see their campaign's gifts (incl. donor contact info) and
-- may enter/void OFFLINE gifts; online gifts are written by the Stripe webhook.
create policy "members read donations" on public.fund_donations for select to authenticated
  using ((select public.fund_is_platform_admin()) or campaign_id in (select public.fund_my_campaign_ids(false)));
create policy "managers record offline donations" on public.fund_donations for insert to authenticated
  with check (
    (select public.fund_is_platform_admin())
    or (source <> 'online' and campaign_id in (select public.fund_my_campaign_ids(true)))
  );
create policy "managers correct offline donations" on public.fund_donations for update to authenticated
  using (
    (select public.fund_is_platform_admin())
    or (source <> 'online' and campaign_id in (select public.fund_my_campaign_ids(true)))
  )
  with check (
    (select public.fund_is_platform_admin())
    or (source <> 'online' and campaign_id in (select public.fund_my_campaign_ids(true)))
  );

create policy "members read donation matches" on public.fund_donation_matches for select to authenticated
  using (
    (select public.fund_is_platform_admin())
    or donation_id in (select d.id from public.fund_donations d
                       where d.campaign_id in (select public.fund_my_campaign_ids(false)))
  );

-- Platform-only operational tables
create policy "admins read webhooks" on public.fund_webhook_events for select to authenticated
  using ((select public.fund_is_platform_admin()));
create policy "admins manage flagged ips" on public.fund_flagged_ips for all to authenticated
  using ((select public.fund_is_platform_admin()))
  with check ((select public.fund_is_platform_admin()));
create policy "admins and managers read audit log" on public.fund_audit_log for select to authenticated
  using (
    (select public.fund_is_platform_admin())
    or (campaign_id is not null and campaign_id in (select public.fund_my_campaign_ids(true)))
  );
-- fund_rate_limits: RLS enabled with no policies -> service role only.

-- -----------------------------------------------------------------------------
-- 10. Grants (anon never touches tables directly; only the RPCs below)
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'fund_platform_admins', 'fund_organizations', 'fund_org_members', 'fund_campaigns', 'fund_matchers',
    'fund_teams', 'fund_ambassadors', 'fund_links', 'fund_donations', 'fund_donation_matches',
    'fund_outreach_logs', 'fund_campaign_daily_metrics', 'fund_webhook_events', 'fund_flagged_ips',
    'fund_audit_log', 'fund_rate_limits'
  ] loop
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end;
$$;

revoke insert, update, delete on table public.fund_donation_matches       from authenticated;
revoke insert, update, delete on table public.fund_campaign_daily_metrics from authenticated;
revoke insert, update, delete on table public.fund_webhook_events         from authenticated;
revoke insert, update, delete on table public.fund_audit_log              from authenticated;
revoke all                    on table public.fund_rate_limits            from authenticated;

-- Functions: PostgreSQL grants EXECUTE to PUBLIC by default — lock everything
-- down, then open only what each role needs.
revoke execute on function public.fund_set_updated_at()                                  from public, anon, authenticated;
revoke execute on function public.fund_guard_campaign()                                  from public, anon, authenticated;
revoke execute on function public.fund_guard_counters()                                  from public, anon, authenticated;
revoke execute on function public.fund_guard_donation()                                  from public, anon, authenticated;
revoke execute on function public.fund_broadcast(uuid, text, jsonb)                      from public, anon, authenticated;
revoke execute on function public.fund_settle_donation(uuid)                             from public, anon, authenticated;
revoke execute on function public.fund_unsettle_donation(uuid, uuid, bigint, uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fund_on_donation_change()                              from public, anon, authenticated;
revoke execute on function public.fund_on_config_change()                                from public, anon, authenticated;
revoke execute on function public.fund_audit()                                           from public, anon, authenticated;
revoke execute on function public.fund_link_invites_on_signup()                          from public, anon, authenticated;
revoke execute on function public.fund_check_rate_limit(text, integer, integer)          from public, anon, authenticated;
revoke execute on function public.fund_track_checkout_start(uuid)                        from public, anon, authenticated;
revoke execute on function public.fund_current_matcher(uuid, timestamptz)                from public, anon, authenticated;
revoke execute on function public.fund_public_donation_json(public.fund_donations)       from public, anon, authenticated;
revoke execute on function public.fund_public_matcher_json(public.fund_matchers)         from public, anon, authenticated;
revoke execute on function public.fund_my_campaign_ids(boolean)                          from public, anon;
revoke execute on function public.fund_my_org_ids(boolean)                               from public, anon;
revoke execute on function public.fund_my_owned_org_ids()                                from public, anon;
revoke execute on function public.fund_is_platform_admin()                               from public, anon;
revoke execute on function public.fund_can_view_campaign(uuid)                           from public, anon;
revoke execute on function public.fund_can_manage_campaign(uuid)                         from public, anon;
revoke execute on function public.fund_platform_metrics()                                from public, anon;
revoke execute on function public.fund_campaign_dashboard(uuid)                          from public, anon;
revoke execute on function public.fund_claim_invites()                                   from public, anon;
revoke execute on function public.fund_recalculate_campaign(uuid)                        from public, anon;
revoke execute on function public.fund_get_public_campaign(text)                         from public;
revoke execute on function public.fund_list_public_campaigns()                           from public;
revoke execute on function public.fund_track_page_view(uuid)                             from public;
revoke execute on function public.fund_resolve_link(text)                                from public;
revoke execute on function public.fund_campaign_totals(uuid)                             from public, anon;

grant execute on function public.fund_get_public_campaign(text)                to anon, authenticated, service_role;
grant execute on function public.fund_list_public_campaigns()                  to anon, authenticated, service_role;
grant execute on function public.fund_track_page_view(uuid)                    to anon, authenticated, service_role;
grant execute on function public.fund_resolve_link(text)                       to anon, authenticated, service_role;
grant execute on function public.fund_campaign_totals(uuid)                    to authenticated, service_role;
grant execute on function public.fund_is_platform_admin()                      to authenticated, service_role;
grant execute on function public.fund_my_campaign_ids(boolean)                 to authenticated, service_role;
grant execute on function public.fund_my_org_ids(boolean)                      to authenticated, service_role;
grant execute on function public.fund_my_owned_org_ids()                       to authenticated, service_role;
grant execute on function public.fund_can_view_campaign(uuid)                  to authenticated, service_role;
grant execute on function public.fund_can_manage_campaign(uuid)                to authenticated, service_role;
grant execute on function public.fund_platform_metrics()                       to authenticated, service_role;
grant execute on function public.fund_campaign_dashboard(uuid)                 to authenticated, service_role;
grant execute on function public.fund_claim_invites()                          to authenticated, service_role;
grant execute on function public.fund_recalculate_campaign(uuid)               to authenticated, service_role;
grant execute on function public.fund_check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.fund_track_checkout_start(uuid)               to service_role;
grant execute on function public.fund_settle_donation(uuid)                    to service_role;

-- -----------------------------------------------------------------------------
-- 11. Realtime: postgres_changes for the admin monitor (RLS-filtered per user).
--     Public pages use the broadcast topic campaign_donations_<id> instead.
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    begin
      alter publication supabase_realtime add table public.fund_donations, public.fund_webhook_events;
    exception when duplicate_object then
      null;
    end;
  end if;
end;
$$;
