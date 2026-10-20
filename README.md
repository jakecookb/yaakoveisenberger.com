# yaakoveisenberger.com/fund — Fundraising & Matching Platform

A multi-tenant, real-time matching-campaign platform that lives under `/fund` in a Next.js App Router site.

| Route | Who | What |
|---|---|---|
| `/fund/[campaignSlug]` | Donors | Live thermometer, countdown, rolling total, multi-tier matching, donor feed, team/ambassador leaderboards, 3-step Stripe checkout |
| `/fund/admin` | Platform owner | Revenue / live campaigns / match funds locked / platform fees, campaign management + slugs, Stripe Connect onboarding, fraud & transaction monitor, CSV export |
| `/fund/portal/[campaignSlug]` | Nonprofit managers | Live stats + conversion, matcher pledges & ratios, teams & ambassadors, link/QR generator, outreach log, offline cash/check/wire entry |
| `/fund/display/[campaignSlug]` | Event big screen | Full-viewport 1080p/4K scoreboard: rolling counter, milestone colors, donation popups, rotating leaderboards, QR code |

Also included: `/fund` (live campaign list), `/fund/login`, `/fund/l/<code>` (tracked short links), and the API under `/api/fund/*`.

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · Framer Motion · Supabase (Postgres + RLS + Auth + Realtime) · Stripe Connect + Payment Element.

---

## Quick start (about 15 minutes)

You need accounts that only you can create — everything else is automated.

1. **Supabase** – create a project at [supabase.com](https://supabase.com). Copy the URL, publishable key and secret key (Project Settings → API Keys) and the *Session pooler* connection string (Connect button).
2. **Stripe** – in [dashboard.stripe.com](https://dashboard.stripe.com) enable **Connect** (platform, Express accounts). Copy the publishable and secret keys (start in test mode).
3. **Environment** – `cp .env.example .env.local` and fill in the values. Put your own email in `FUND_PLATFORM_ADMIN_EMAILS`.
4. **Run setup** – `npm install && npm run fund:setup -- --seed`
   - applies the database migration (tables, RLS, indexes, functions, triggers)
   - loads a sample campaign at `/fund/sample-campaign` (`--seed`, optional)
   - verifies the Supabase keys work
   - registers both Stripe webhook endpoints and writes their signing secrets into `.env.local`
   - adds `/fund/auth/callback` to Supabase Auth redirect URLs (if `SUPABASE_ACCESS_TOKEN` is set)
5. **Deploy** – add the same variables in Vercel (Settings → Environment Variables) and deploy. Sign in at `/fund/login` with your admin email (magic link) — you're promoted to super admin automatically.
6. In **/fund/admin → Nonprofits & Stripe**: create a nonprofit, click **Connect Stripe** (or invite its managers and let them do it from their portal), then create and approve a campaign.

No Supabase yet? `npm run dev` and open **`/fund/demo`** and **`/fund/display/demo`** — a fully simulated live campaign.

> No SQL access? Paste `supabase/migrations/20261020000000_fund_platform.sql` into Supabase → SQL Editor → Run (then `supabase/seed.sql` for sample data). Or `npx supabase link && npx supabase db push`.

---

## Adding it to your existing site

Copy these into your repo (paths are relative to the project root; adjust for `src/` if you use it):

```
app/fund/                    # all four routes + login, auth callback, short links
app/api/fund/                # checkout, Stripe webhook, Connect, exports, public snapshot
components/fund/             # UI
lib/fund/                    # Supabase/Stripe clients, auth, actions, matching, validation
supabase/migrations/  supabase/seed.sql
scripts/fund-setup.mjs  scripts/test-db.mjs
```

Then:

1. **Dependencies**
   ```bash
   npm i @supabase/ssr @supabase/supabase-js stripe @stripe/stripe-js @stripe/react-stripe-js framer-motion zod qrcode.react lucide-react server-only
   npm i -D pg @electric-sql/pglite
   ```
2. **Session refresh** – Supabase Auth needs the request proxy for `/fund/admin` and `/fund/portal`.
   - No `proxy.ts`/`middleware.ts` yet → copy `proxy.ts` (Next 16) as is (rename to `middleware.ts` and export `middleware` on Next ≤ 15).
   - Already have one → call it for fund paths:
     ```ts
     import { updateFundSession } from '@/lib/fund/supabase/proxy';
     if (request.nextUrl.pathname.startsWith('/fund/')) return updateFundSession(request);
     ```
3. **Security headers** – merge the `headers()` block from `next.config.ts` (CSP that allows Stripe, Supabase and Turnstile, scoped to `/fund`).
4. **Tailwind** – v4 detects the classes automatically. On Tailwind v3 add `'./components/fund/**/*.{ts,tsx}', './app/fund/**/*.{ts,tsx}'` to `content`.
5. **Your navbar/footer** – `/fund/display/*` renders as a fixed full-viewport layer above your root layout, so no layout changes are needed for the big screen. The other pages render inside your existing chrome.
6. **Path alias** – code imports from `@/lib/...` and `@/components/...` (`"paths": { "@/*": ["./*"] }`).
7. **Caching model** – written for Next's default model. If your site enables `cacheComponents`, wrap the bodies of the `/fund` pages in `<Suspense>`.

---

## How it works

```
Donor ──► /fund/[slug] (SSR snapshot via fund_get_public_campaign RPC)
   │          │  subscribes ► Supabase Realtime topic  campaign_donations_<campaignId>
   │          ▼
   │   Payment Element (Stripe iframe) ──► POST /api/fund/checkout
   │        rate limit · IP blocklist · Turnstile · zod · pending donation row
   │        PaymentIntent: destination charge → nonprofit's Connect account,
   │        application_fee_amount → platform
   ▼
Stripe ──► POST /api/fund/webhooks/stripe  (signature verified, event id = ledger PK)
              └─► UPDATE fund_donations SET status='succeeded'
                     └─► trigger fund_settle_donation():
                           match waterfall (FOR UPDATE on pools) → totals → teams →
                           ambassadors → links → realtime.send('donation', sanitized payload)
                                       └─► every open page, portal and big screen updates
Offline gift (portal) ──► INSERT … status='succeeded' ──► same trigger ──► same broadcast
```

**Multi-tier matching.** Each matcher has a ratio (`1` = $1→$2, `3` = $1→$4), a pledge pool, a tier order and an optional time window ("power hour"). Gifts draw from the first live pool; whatever a pool can't cover spills to the next tier. Pool rows are locked during settlement, so simultaneous gifts can never overdraw a pool. Refunds, disputes, voids and admin edits reverse the exact ledger entries (`fund_donation_matches`) and restore the pools. The checkout shows a preview computed with the same algorithm (`lib/fund/matching.ts`).

**Totals shown publicly** = donor dollars + match dollars. Team and ambassador totals include matched dollars credited to them.

**Real time.** Settled gifts are broadcast from inside Postgres (`realtime.send`) on `campaign_donations_<campaignId>` with a PII-free payload. Clients apply deltas instantly, then resync a CDN-cached snapshot (`/api/fund/campaigns/[slug]`, `s-maxage=3`) on reconnects, config changes, tab focus and a slow heartbeat, so long-running screens self-heal. If Realtime is unavailable, pages fall back to polling.

**Payments & fees.** Destination charges to each nonprofit's Express account. `application_fee_amount` = platform fee (org default `platform_fee_bps`, overridable per campaign) + estimated Stripe processing (paid by the donor if they tick "cover fees", otherwise by the nonprofit — set `FUND_ORG_PAYS_PROCESSING_FEES=false` to absorb it). Card data never touches your servers (Payment Element iframe → PCI SAQ-A).

---

## Security

- **RLS on every table.** Anonymous visitors cannot read any table; public data comes only from `SECURITY DEFINER` RPCs that return sanitized JSON (no emails/phones, anonymous names masked). Managers see only their organization's campaigns; platform admins see everything.
- **Guard triggers** stop clients from writing counters, fees, approval fields or online-donation state, even through the API with a valid session. Managers can only record/void offline gifts and can't approve their own campaigns.
- **Audit log.** Every human change to campaigns, matchers, donations, members, orgs and IP blocks is recorded with a field-level diff (Admin → Fraud & transactions → Overrides & audit).
- **Webhooks.** Signature-verified (platform + Connect secrets), idempotent by Stripe event id, guarded state transitions (replays and out-of-order events are safe). Failures return 500 so Stripe retries.
- **Fraud controls.** Per-IP rate limits (Postgres-backed, no Redis needed), IP blocklist, auto-block after 5 failed payments/hour (card testing), large-gift review flags, Stripe Radar risk + early-fraud-warning flags, disputes auto-unsettle.
- **Headers.** Strict CSP scoped to `/fund`, HSTS, `nosniff`, frame denial (except the big screen, which signage software may embed).
- Edge configuration for Cloudflare / Vercel Firewall: **[docs/EDGE_SECURITY.md](docs/EDGE_SECURITY.md)**.

---

## Running a live event

Open `/fund/display/<slug>` on the venue computer (Chrome kiosk: `chrome --kiosk --app=https://yaakoveisenberger.com/fund/display/<slug>`).

- **F** toggles fullscreen · **T** shows a test popup · **Shift+T** a big-gift popup (rehearsal)
- `?big=500` sets the dollar amount that triggers full-screen popups (default $1,000)
- The cursor hides itself; the screen is kept awake (Wake Lock API); the layout scales with the viewport (1080p → 4K)
- Headline, rotation speed, QR message and QR visibility: Admin/Portal → Settings → Big screen
- Cash and checks entered in the portal appear on the screen within about a second

---

## What happens if something isn't configured

| Missing | Behavior |
|---|---|
| Supabase | `/fund/demo` and `/fund/display/demo` run with simulated donations; dashboards show a setup screen |
| Supabase secret key | Public pages work; checkout, webhooks and rate limiting are disabled |
| Stripe keys | Checkout step 3 explains online giving isn't open yet; offline entry still works |
| Nonprofit not connected to Stripe | That campaign accepts offline gifts only (or set `FUND_STRIPE_DIRECT_CHARGES_FALLBACK=true`) |
| Realtime disabled | Pages poll snapshots instead (10 s when disconnected) |
| Turnstile keys | Bot check skipped (edge WAF + rate limits still apply) |

---

## Development & tests

```bash
npm run dev          # http://localhost:3000/fund/demo
npm run test:db      # 22 database tests in an embedded Postgres (matching, refunds, RLS, broadcasts, rate limits)
npm run typecheck    # next typegen && tsc
npm run lint
npm run build
stripe listen --forward-to localhost:3000/api/fund/webhooks/stripe   # local webhooks
```

Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (decline), `4000 0027 6000 3184` (3-D Secure).

---

## File map

```
supabase/migrations/20261020000000_fund_platform.sql   schema, RLS, matching waterfall, broadcasts, RPCs
supabase/seed.sql                                        sample campaign
app/fund/[campaignSlug]/                                 public campaign page
app/fund/display/[campaignSlug]/                         big screen
app/fund/admin/                                          super admin (overview, campaigns, organizations, monitor)
app/fund/portal/[campaignSlug]/                          nonprofit portal (dashboard, donations, matchers, teams, links, outreach, settings)
app/api/fund/checkout/                                   PaymentIntent creation
app/api/fund/webhooks/stripe/                            Stripe webhook
app/api/fund/stripe/{connect,return,refresh,dashboard}/  Connect onboarding
app/api/fund/admin/export/  app/api/fund/portal/[slug]/export/   CSV
app/api/fund/campaigns/[slug]/                           cached public snapshot
lib/fund/actions/{admin,portal}.ts                       server actions (run as the signed-in user → RLS enforced)
lib/fund/matching.ts                                     client mirror of the waterfall (preview only)
components/fund/hooks/use-campaign-live.ts               Realtime + resync hook
```
