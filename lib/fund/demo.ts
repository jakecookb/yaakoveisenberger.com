import { previewMatch } from './matching';
import type { DonationBroadcast, PublicCampaign, PublicDonation, PublicMatcher } from './types';

// Demo mode: a fully populated campaign + simulated live donations, used when
// Supabase isn't configured yet (or NEXT_PUBLIC_FUND_ENABLE_DEMO=true) so the
// public page and big screen can be previewed instantly at /fund/demo.

const DONORS = [
  'Dana & Michael Levy', 'The Rosen Family', 'Yosef B.', 'Shira Katz', 'Benjamin Adler', 'Naomi & Ari',
  'The Klein Family', 'Tova Stern', 'Daniel Mizrahi', 'Hannah Gold', 'Moshe & Chana', 'Ruth Berger',
  'Noah Feld', 'Esther Lowy', 'Jacob Schwartz', 'Ilana Shapiro', 'Sam & Becky', 'Avraham T.', 'Leora P.',
];
const MESSAGES = [
  'So proud to support this!', 'In honor of our parents', 'Go team!', 'Keep building!', 'For the kids',
  'In memory of Grandpa Joe', "Let's hit the bonus goal!", 'Matched gifts are the best gifts', null, null, null,
];
const AMOUNTS = [1800, 3600, 5000, 10000, 18000, 18000, 26000, 36000, 50000, 100000, 180000, 250000];

const pick = <T,>(arr: T[], i: number) => arr[Math.abs(i) % arr.length]!;

export function buildDemoCampaign(now = Date.now()): PublicCampaign {
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
  const H = 3_600_000;
  const matchers: PublicMatcher[] = [
    { id: 'm1', name: 'Power Hour Partners', logo_url: null, message: 'Quadruple impact while it lasts!', ratio: 3,
      pledge_cents: 4_000_000, matched_cents: 2_870_000, remaining_cents: 1_130_000, priority: 10,
      starts_at: iso(-2 * H), ends_at: iso(3 * H), status: 'active', is_live: true },
    { id: 'm2', name: 'The Goldberg Family Foundation', logo_url: null, message: 'Proud to double every gift.', ratio: 1,
      pledge_cents: 15_000_000, matched_cents: 6_240_000, remaining_cents: 8_760_000, priority: 20,
      starts_at: null, ends_at: null, status: 'active', is_live: true },
    { id: 'm3', name: 'Anonymous Matcher', logo_url: null, message: null, ratio: 1,
      pledge_cents: 5_000_000, matched_cents: 0, remaining_cents: 5_000_000, priority: 30,
      starts_at: null, ends_at: null, status: 'active', is_live: true },
  ];
  const teams = [
    { id: 't1', slug: 'jerusalem', name: 'Team Jerusalem', captain_name: 'Miriam L.', goal_cents: 5_000_000, raised_cents: 4_120_000, donation_count: 88 },
    { id: 't2', slug: 'brooklyn', name: 'Team Brooklyn', captain_name: 'David S.', goal_cents: 5_000_000, raised_cents: 3_655_000, donation_count: 71 },
    { id: 't3', slug: 'lakewood', name: 'Team Lakewood', captain_name: 'Sarah K.', goal_cents: 4_000_000, raised_cents: 2_980_000, donation_count: 64 },
    { id: 't4', slug: 'youth', name: 'Youth Division', captain_name: 'Eli R.', goal_cents: 2_000_000, raised_cents: 1_410_000, donation_count: 52 },
    { id: 't5', slug: 'alumni', name: 'Alumni Circle', captain_name: 'Rebecca N.', goal_cents: 3_000_000, raised_cents: 990_000, donation_count: 23 },
  ].map((t) => ({ ...t, description: null, avatar_url: null }));
  const ambassadors = [
    { id: 'a1', code: 'rachel', name: 'Rachel Cohen', team_id: 't1', goal_cents: 1_000_000, raised_cents: 1_184_000, donation_count: 31 },
    { id: 'a2', code: 'avi', name: 'Avi Friedman', team_id: 't2', goal_cents: 1_000_000, raised_cents: 742_000, donation_count: 19 },
    { id: 'a3', code: 'leah', name: 'Leah Weiss', team_id: 't3', goal_cents: 500_000, raised_cents: 516_000, donation_count: 14 },
    { id: 'a4', code: 'josh', name: 'Josh Klein', team_id: null, goal_cents: 500_000, raised_cents: 233_000, donation_count: 9 },
  ].map((a) => ({ ...a, avatar_url: null, message: null }));

  const recent: PublicDonation[] = Array.from({ length: 24 }, (_, i) => {
    const amount = pick(AMOUNTS, i * 7 + 3);
    const anon = i % 6 === 2;
    const team = i % 4 === 3 ? null : teams[i % teams.length]!;
    return {
      id: `seed-${i}`,
      name: anon ? 'Anonymous' : pick(DONORS, i * 5),
      is_anonymous: anon,
      amount_cents: amount,
      matched_cents: amount * (i < 10 ? 3 : 1),
      message: pick(MESSAGES, i * 3),
      team_id: team?.id ?? null,
      team_name: team?.name ?? null,
      ambassador_id: null,
      ambassador_name: null,
      offline: i % 9 === 4,
      created_at: iso(-(i * 6 + 1) * 60_000),
    };
  });

  const raised = 13_480_000;
  const matched = 9_110_000;
  return {
    demo: true,
    campaign: {
      id: 'demo-campaign',
      slug: 'demo',
      title: 'Build the Future Campaign',
      tagline: 'Every dollar is matched — up to 4x during Power Hour.',
      description:
        'For 36 hours only, every gift to our new community center is matched by generous partners.\n\n' +
        'Your donation funds classrooms, a youth wing and scholarships for families who need them most.\n\n' +
        'Join a team, share your link, and help us cross the finish line together.',
      hero_image_url: null,
      logo_url: null,
      video_url: null,
      theme_color: '#4f46e5',
      currency: 'usd',
      goal_cents: 30_000_000,
      bonus_goal_cents: 40_000_000,
      starts_at: iso(-20 * H),
      ends_at: iso(16 * H + 23 * 60_000),
      status: 'active',
      preset_amounts: [3600, 10000, 18000, 36000, 50000, 100000],
      min_donation_cents: 500,
      max_donation_cents: 2_500_000,
      allow_anonymous: true,
      allow_fee_cover: true,
      display_settings: { headline: 'Build the Future', rotate_seconds: 12, show_qr: true },
    },
    organization: { name: 'Sample Community Fund', logo_url: null, website_url: 'https://example.org', ein: '00-0000000' },
    accepting_online: false,
    totals: {
      campaign_id: 'demo-campaign',
      raised_cents: raised,
      matched_cents: matched,
      total_cents: raised + matched,
      donation_count: 412,
      goal_cents: 30_000_000,
      bonus_goal_cents: 40_000_000,
      status: 'active',
      last_donation_at: recent[0]!.created_at,
      match_pledged_cents: 24_000_000,
      match_remaining_cents: 14_890_000,
      current_ratio: 3,
      server_time: iso(0),
    },
    matchers,
    teams,
    ambassadors,
    recent,
    top: [...recent].sort((a, b) => b.amount_cents - a.amount_cents).slice(0, 12),
    server_time: iso(0),
  };
}

/** Produces the next simulated donation and the resulting broadcast payload. */
export function simulateDemoDonation(state: PublicCampaign, seq: number): DonationBroadcast {
  const amount = pick(AMOUNTS, seq * 11 + Math.floor(Math.random() * AMOUNTS.length));
  const team = Math.random() < 0.8 ? state.teams[Math.floor(Math.random() * state.teams.length)] ?? null : null;
  const anonymous = Math.random() < 0.2;
  const { matchCents } = previewMatch(amount, state.matchers);
  const raised = state.totals.raised_cents + amount;
  const matched = state.totals.matched_cents + matchCents;
  const remaining = Math.max(0, state.totals.match_remaining_cents - matchCents);
  return {
    donation: {
      id: `demo-${Date.now()}-${seq}`,
      name: anonymous ? 'Anonymous' : pick(DONORS, seq * 3 + Math.floor(Math.random() * DONORS.length)),
      is_anonymous: anonymous,
      amount_cents: amount,
      matched_cents: matchCents,
      message: pick(MESSAGES, Math.floor(Math.random() * MESSAGES.length)),
      team_id: team?.id ?? null,
      team_name: team?.name ?? null,
      ambassador_id: null,
      ambassador_name: null,
      offline: false,
      created_at: new Date().toISOString(),
    },
    totals: {
      ...state.totals,
      raised_cents: raised,
      matched_cents: matched,
      total_cents: raised + matched,
      donation_count: state.totals.donation_count + 1,
      match_remaining_cents: remaining,
      server_time: new Date().toISOString(),
    },
    team: team ? { id: team.id, raised_cents: team.raised_cents + amount + matchCents, donation_count: team.donation_count + 1 } : null,
    ambassador: null,
  };
}
