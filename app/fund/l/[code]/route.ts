import { NextResponse } from 'next/server';
import { createFundAnonClient } from '@/lib/fund/supabase/server';
import { isSupabaseConfigured } from '@/lib/fund/env';

/** Short links (/fund/l/<code>) created in the portal's link generator: count the click, then redirect. */
export async function GET(request: Request, ctx: RouteContext<'/fund/l/[code]'>) {
  const { code } = await ctx.params;
  const base = new URL(request.url);
  if (!isSupabaseConfigured || !/^[A-Za-z0-9_-]{4,40}$/.test(code)) return NextResponse.redirect(new URL('/fund', base));

  const { data } = await createFundAnonClient().rpc('fund_resolve_link', { p_code: code });
  const link = data as {
    link_id: string; slug: string | null; team: string | null; ref: string | null; amount_cents: number | null;
    utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
  } | null;
  if (!link?.slug) return NextResponse.redirect(new URL('/fund', base));

  const target = new URL(`/fund/${link.slug}`, base);
  target.searchParams.set('lnk', link.link_id);
  if (link.team) target.searchParams.set('team', link.team);
  if (link.ref) target.searchParams.set('ref', link.ref);
  if (link.amount_cents) target.searchParams.set('amount', String(link.amount_cents / 100));
  if (link.utm_source) target.searchParams.set('utm_source', link.utm_source);
  if (link.utm_medium) target.searchParams.set('utm_medium', link.utm_medium);
  if (link.utm_campaign) target.searchParams.set('utm_campaign', link.utm_campaign);
  return NextResponse.redirect(target, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
