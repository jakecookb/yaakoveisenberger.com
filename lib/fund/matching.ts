import type { PublicMatcher } from './types';

export interface MatchPreview {
  matchCents: number;
  impactCents: number;
  tiers: { matcherId: string; name: string; ratio: number; portionCents: number; matchCents: number }[];
}

/**
 * Client-side mirror of public.fund_settle_donation's waterfall, used to show
 * "your $180 becomes $720" before checkout. The database remains the source of
 * truth — this is only a preview.
 */
export function previewMatch(amountCents: number, matchers: PublicMatcher[], at = new Date()): MatchPreview {
  const now = at.getTime();
  const pools = matchers
    .filter(
      (m) =>
        m.status === 'active' &&
        m.remaining_cents > 0 &&
        (!m.starts_at || new Date(m.starts_at).getTime() <= now) &&
        (!m.ends_at || new Date(m.ends_at).getTime() > now),
    )
    .sort((a, b) => a.priority - b.priority);

  let left = amountCents;
  let matchCents = 0;
  const tiers: MatchPreview['tiers'] = [];
  for (const m of pools) {
    if (left <= 0) break;
    const ratio = Number(m.ratio);
    const portion = Math.min(left, Math.ceil(m.remaining_cents / ratio));
    const match = Math.min(m.remaining_cents, Math.floor(portion * ratio));
    if (match <= 0) continue;
    tiers.push({ matcherId: m.id, name: m.name, ratio, portionCents: portion, matchCents: match });
    matchCents += match;
    left -= portion;
  }
  return { matchCents, impactCents: amountCents + matchCents, tiers };
}

/** Matcher currently being drawn (first live pool in priority order). */
export function currentMatcher(matchers: PublicMatcher[], at = new Date()) {
  const now = at.getTime();
  return (
    matchers
      .filter(
        (m) =>
          m.status === 'active' &&
          m.remaining_cents > 0 &&
          (!m.starts_at || new Date(m.starts_at).getTime() <= now) &&
          (!m.ends_at || new Date(m.ends_at).getTime() > now),
      )
      .sort((a, b) => a.priority - b.priority)[0] ?? null
  );
}

/** Stripe fee gross-up so the org nets the full gift: (amount + fixed) / (1 - pct) - amount. */
export function feeCoverCents(amountCents: number, percent = 2.9, fixedCents = 30) {
  return Math.max(0, Math.round((amountCents + fixedCents) / (1 - percent / 100) - amountCents));
}
