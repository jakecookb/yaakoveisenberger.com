import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { ArrowRight, Database, CreditCard, ShieldCheck, MonitorPlay } from 'lucide-react';
import { listPublicCampaigns } from '@/lib/fund/data';
import { isDemoEnabled, isServiceRoleConfigured, isStripeClientConfigured, isStripeServerConfigured, isSupabaseConfigured, serverEnv } from '@/lib/fund/env';
import { formatMoney } from '@/lib/fund/format';

export const metadata = { title: 'Live campaigns' };

function Check({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{ok ? '✓' : '!'}</span>
      <span>
        <span className="font-medium text-slate-900">{label}</span>
        <span className="block text-sm text-slate-500">{hint}</span>
      </span>
    </li>
  );
}

async function CampaignList() {
  await connection(); // always fresh — never baked in at build time
  const campaigns = await listPublicCampaigns();
  if (!campaigns.length) {
    return <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No live campaigns right now.</div>;
  }
  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2">
      {campaigns.map((c) => {
        const pct = Math.min(100, Math.floor((c.total_cents / c.goal_cents) * 100));
        return (
          <li key={c.id}>
            <Link href={`/fund/${c.slug}`} className="block overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-md">
              <div className="h-28 bg-cover bg-center" style={{ backgroundColor: c.theme_color, backgroundImage: c.hero_image_url ? `url(${JSON.stringify(c.hero_image_url)})` : undefined }} />
              <div className="p-5">
                <p className="text-xs font-medium text-slate-500">{c.organization}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{c.title}</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.theme_color }} /></div>
                <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-900">{formatMoney(c.total_cents)}</span> raised of {formatMoney(c.goal_cents)} · {pct}%</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function FundHome() {
  const env = serverEnv();
  // Setup checklist only in local/preview builds before the backend exists; never on the live site
  // (afterwards the same checks live in /fund/admin → Platform health).
  const setupIncomplete = !isSupabaseConfigured && process.env.VERCEL_ENV !== 'production';

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live campaigns</h1>
          <p className="mt-1 text-slate-600">Every gift matched. Every dollar counted live.</p>
        </div>
        <Link href="/fund/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Organizer sign in →</Link>
      </div>

      <Suspense fallback={<div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="h-56 animate-pulse rounded-2xl bg-slate-200" /><div className="h-56 animate-pulse rounded-2xl bg-slate-200" /></div>}>
        <CampaignList />
      </Suspense>

      {isDemoEnabled && (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link href="/fund/demo" className="group flex items-center justify-between rounded-2xl bg-slate-900 p-5 text-white">
            <span><span className="block text-sm text-white/60">Preview</span><span className="font-semibold">Demo campaign page</span></span>
            <ArrowRight className="size-5 transition group-hover:translate-x-1" />
          </Link>
          <Link href="/fund/display/demo" className="group flex items-center justify-between rounded-2xl bg-indigo-600 p-5 text-white">
            <span><span className="block text-sm text-white/70">Preview</span><span className="flex items-center gap-2 font-semibold"><MonitorPlay className="size-4" /> Demo big screen</span></span>
            <ArrowRight className="size-5 transition group-hover:translate-x-1" />
          </Link>
        </div>
      )}

      {setupIncomplete && (
        <section className="mt-10 rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
          <h2 className="font-semibold text-slate-900">Finish setup</h2>
          <p className="mt-1 text-sm text-slate-600">Add these environment variables (see <code>.env.example</code>) or run <code>npm run fund:setup</code>.</p>
          <ul className="mt-4 space-y-3">
            <Check ok={isSupabaseConfigured} label="Supabase URL + publishable key" hint="NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" />
            <Check ok={isServiceRoleConfigured()} label="Supabase secret key" hint="SUPABASE_SECRET_KEY — used only by webhooks, checkout and rate limiting" />
            <Check ok={isStripeServerConfigured() && isStripeClientConfigured} label="Stripe keys" hint="STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" />
            <Check ok={env.stripeWebhookSecrets.length > 0} label="Stripe webhook secret" hint="STRIPE_WEBHOOK_SECRET (+ STRIPE_CONNECT_WEBHOOK_SECRET) — the setup script creates the endpoints for you" />
            <Check ok={env.platformAdminEmails.length > 0} label="Platform admin email" hint="FUND_PLATFORM_ADMIN_EMAILS — that account becomes super admin on first sign-in" />
          </ul>
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><Database className="size-3.5" /> Supabase RLS on every table</span>
            <span className="inline-flex items-center gap-1"><CreditCard className="size-3.5" /> Stripe Connect payouts</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" /> Signed, idempotent webhooks</span>
          </div>
        </section>
      )}
    </main>
  );
}
