import Link from 'next/link';
import { ArrowRight, Megaphone } from 'lucide-react';
import { requireFundSession } from '@/lib/fund/auth';
import { isSupabaseConfigured } from '@/lib/fund/env';
import { formatMoney } from '@/lib/fund/format';
import type { CampaignRow } from '@/lib/fund/types';
import { SetupRequired } from '@/components/fund/setup-required';
import { Card, EmptyState, StatusBadge } from '@/components/fund/ui/primitives';
import { Meter } from '@/components/fund/ui/stat';

export const metadata = { title: 'Campaign portal', robots: { index: false } };

export default async function PortalHome({ searchParams }: PageProps<'/fund/portal'>) {
  if (!isSupabaseConfigured) return <SetupRequired area="The campaign portal" />;
  const { supabase, user, isPlatformAdmin } = await requireFundSession('/fund/portal');
  await supabase.rpc('fund_claim_invites');
  const sp = await searchParams;
  const { data } = await supabase
    .from('fund_campaigns')
    .select('*, org:fund_organizations(name)')
    .neq('status', 'archived')
    .order('starts_at', { ascending: false });
  const campaigns = (data ?? []) as unknown as (CampaignRow & { org: { name: string } | null })[];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your campaigns</h1>
          <p className="mt-1 text-sm text-slate-500">Signed in as {user.email}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {isPlatformAdmin && <Link href="/fund/admin" className="font-medium text-indigo-700 hover:underline">Platform admin →</Link>}
          <form action="/fund/auth/signout" method="post"><button className="text-slate-500 hover:text-slate-900">Sign out</button></form>
        </div>
      </div>
      {sp.error === 'admin_only' && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">That area is for platform admins only.</p>}
      {campaigns.length === 0 ? (
        <Card className="mt-8">
          <EmptyState icon={<Megaphone className="size-8" />} title="No campaigns yet" description="Ask the platform team to add your email to your nonprofit. You'll see your campaigns here as soon as they do." />
        </Card>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {campaigns.map((c) => {
            const total = c.raised_cents + c.matched_cents;
            return (
              <li key={c.id} style={{ '--fund-accent': c.theme_color } as React.CSSProperties} className="fund-theme">
                <Link href={`/fund/portal/${c.slug}`} className="group block rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">{c.org?.name}</p>
                      <p className="truncate font-semibold text-slate-900">{c.title}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <Meter value={total} max={c.goal_cents} className="mt-4" label="Progress" />
                  <p className="mt-2 flex items-center justify-between text-sm text-slate-600">
                    <span><span className="font-semibold text-slate-900">{formatMoney(total)}</span> of {formatMoney(c.goal_cents)}</span>
                    <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-0.5" />
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
