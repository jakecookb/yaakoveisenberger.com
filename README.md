# yaakoveisenberger.com

The website for Yaakov Eisenberger — a Next.js App Router site with:

- **Home page** (`/`) — hub of cards linking to every venture; `/video` has featured work and TheZone Camp videos, `/contact` has contact details (moved over from Google Sites)
- **Fundraising & matching platform** (`/fund`) — live matching campaigns, nonprofit portal, platform admin and a live-event big screen

| Route | Who | What |
|---|---|---|
| `/` | Everyone | Home page |
| `/fund/[campaignSlug]` | Donors | Live thermometer, countdown, rolling total, multi-tier matching, donor feed, team/ambassador leaderboards, 3-step Stripe checkout |
| `/fund/admin` | Platform owner | Revenue / live campaigns / match funds locked / platform fees, campaign management + slugs, Stripe Connect onboarding, fraud & transaction monitor, CSV export |
| `/fund/portal/[campaignSlug]` | Nonprofit managers | Live stats + conversion, matcher pledges & ratios, teams & ambassadors, link/QR generator, outreach log, offline cash/check/wire entry |
| `/fund/display/[campaignSlug]` | Event big screen | Full-viewport 1080p/4K scoreboard: rolling counter, milestone colors, donation popups, rotating leaderboards, QR code |

Also included: `/fund` (live campaign list), `/fund/login`, `/fund/l/<code>` (tracked short links), and the API under `/api/fund/*`.

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · Framer Motion · Supabase (Postgres + RLS + Auth + Realtime) · Stripe Connect + Payment Element.

---

## Editing the site

- **Home page hub cards** live in [`data/navigation.ts`](data/navigation.ts) — add one entry to `categories` to add a card (set `gallery: true` / `lockable: true` and add a page that renders `<CategoryPage id="…" />` for a new photo page).
- **Video page / contact content** (featured work, videos, email, phone) lives in [`lib/site/content.ts`](lib/site/content.ts). Add a video by adding one line with its YouTube id; add a featured project with a title, image (in `public/images/home/`) and link.
- **New pages** go in `app/(site)/` — e.g. `app/(site)/about/page.tsx` becomes `/about` and automatically gets the site header and footer. Add it to the menu in [`components/site/header.tsx`](components/site/header.tsx).
- The `/fund` platform has its own layout and doesn't use the site header/footer.

---

## Go live

1. **Vercel** – vercel.com → **Add New… → Project** → import `jakecookb/yaakoveisenberger.com` (framework is detected as Next.js). Add the environment variables from `.env.example` (at minimum `NEXT_PUBLIC_SITE_URL=https://yaakoveisenberger.com`), then **Deploy**. You get a preview URL — check everything there first.
2. **Domain** – in the Vercel project → **Settings → Domains**, add `yaakoveisenberger.com` and `www.yaakoveisenberger.com`. Vercel shows the DNS records it needs.
3. **Cloudflare DNS** (where the domain is managed) – replace the existing `yaakoveisenberger.com` and `www` records with the ones Vercel shows. Set them to **DNS only** (grey cloud), or keep them proxied with SSL/TLS mode **Full (strict)**. The `www` record currently points at Google Sites — changing it is the switch-over; changing it back restores Google Sites.
4. `cookbook.yaakoveisenberger.com` is a separate project and is unaffected.

The home page works without any keys. The fundraising platform needs Supabase and Stripe — see below.

---

## Fundraising platform setup (about 15 minutes)

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

## Notes for developers

- **Session refresh** – `proxy.ts` (Next 16's middleware) refreshes Supabase Auth cookies for `/fund/admin` and `/fund/portal`. If you add your own proxy logic, keep calling `updateFundSession(request)` for `/fund/*` paths.
- **Security headers** – `next.config.ts` sets a strict CSP (Stripe, Supabase, Turnstile allowed) scoped to `/fund`.
- **Caching model** – written for Next's default model. If you enable `cacheComponents`, wrap the bodies of the `/fund` pages in `<Suspense>`.
- **Moving `/fund` into another Next.js app** – copy `app/fund`, `app/api/fund`, `components/fund`, `lib/fund`, `supabase/`, `scripts/`, the `proxy.ts` call and the `headers()` block; the module has no dependency on the rest of this site.

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
npm run dev          # http://localhost:3000 (home) · /fund/demo (simulated campaign)
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
app/(site)/                                              main site pages (home) + shared header/footer layout
lib/site/content.ts                                      home page content (videos, featured work, contact)
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


---

## Admin editor (`/admin`)

A private editor for the owner: change box titles, descriptions, icons, icon sizes, colors, order and visibility; edit the home tagline, hero logo and page text; upload photos per category; and **lock** any photo page so visitors must type their name and wait for approval (`/admin/access`).

- **Log in** with the small *Log in* tab at the top right of the site. Sessions are a signed, HttpOnly cookie (7 days). The password is stored only as a scrypt hash.
- **Storage:** Vercel Blob, all **private**. Settings, photos, access requests and the saved password hash are never public URLs; photos are served through `/media/…`, which checks the admin session or an approved visitor first.
- **Env vars** (Vercel → Settings → Environment Variables): `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (create with `npm run admin:hash`), `ADMIN_SESSION_SECRET` (32+ random chars) and `BLOB_READ_WRITE_TOKEN` (added automatically when a Blob store is connected to the project). Changing the password inside the editor overrides `ADMIN_PASSWORD_HASH`.
- **Two-step verification (WhatsApp):** set `ADMIN_2FA_PHONE` (e.g. `+17325697959`) plus the `TWILIO_*` variables and every sign-in also needs a 6-digit code sent to that WhatsApp number. The same number powers **Forgot password** on the login page. Codes last 10 minutes, allow 5 guesses, and are single-use. `ADMIN_EMAIL` may list several emails, comma-separated.
- **Locking:** any box can be locked (locking **Funding** hides every fundraising page — donor pages and the big-screen display — from people you haven't approved; the payment API and Stripe webhooks keep working), including boxes that open a separate site like the Cookbook. Clicking a locked box on the home page opens a pop-up asking for the visitor's name; they stay out until you approve them at `/admin/access`. The gate in `proxy.ts` also stops direct visits to a locked page or its files. Note: it protects the address on this domain — a separately hosted app (e.g. the Cookbook's own `*.vercel.app` address) stays reachable there unless that project is protected too.
- **Your own boxes:** *Add a box* creates either a **page** (`/p/<id>`: text and photos) or a **link** to another website. A locked link never exposes its real address: it goes through `/go/<id>`, which only redirects approved visitors.
- **Sizes:** each box has a width (normal / wide / full row), a height (compact → extra tall) and an icon size, with a phone / tablet / desktop preview.
- **Approval feedback:** a visitor sees *Pending* → *Approved* (then they're let in) or *Declined*. After a decline they must wait **25 minutes** (`RETRY_MINUTES` in `lib/access/visitor.ts`, enforced by the server) before asking again. Each locked card on the home page shows the visitor's own status.

---

## Audio Separator (`/separator`)

Free, private vocal / instrumental splitter. Visitors upload an MP3 or WAV and download two tracks (WAV, or 320 kbps MP3). **No server, API key or sign-up is involved**: the separation runs in the visitor's browser.

- **Options** (defined in `lib/separator/models.ts`, shown with plain-English details): *Best overall* (Kim Vocal 2 — cleanest vocals), *Best backing track* (UVR Inst HQ 3 — cleanest instrumental), and *Instant preview* (no AI, centre-channel removal; rough, needs a stereo song).
- **How it works:** [MDX-Net](https://github.com/Anjok07/ultimatevocalremovergui) ONNX models run through ONNX Runtime Web (WebAssembly; optional WebGPU) in a Web Worker. The STFT/iSTFT and chunking (`lib/separator/`) follow Ultimate Vocal Remover's method and were checked against a Python reference (matches to ~1e-7) and against a ground-truth mix (speech over music: vocals 18–19 dB SI-SDR).
- **Models** (63 MB each) download once from Hugging Face (several byte-identical mirrors are tried in order), are checked against a pinned SHA-256 and cached in the browser (Cache API). To change a model, update `models.ts` — its settings (`dimF`, `dimTPow`, `nFft`, `compensate`) come from UVR's model table, keyed by the hash of the last 10 MB of the file.
- **Speed:** about 3× the song's length on a 4-core laptop, longer on phones. The page is cross-origin isolated (`/separator` sends COOP/COEP headers, see `next.config.ts`) so WebAssembly can use several threads. The runtime files are copied to `public/ort` by `scripts/copy-ort.mjs` after `npm install` (git-ignored).
- It's a normal hub box (`data/navigation.ts`), so it can be hidden, resized, re-titled or **locked** from the admin editor like any other.

---

## Cookies and caching

**Cookies** (all first-party, `HttpOnly`, `SameSite=Lax`, `Secure` in production; no analytics, ads or tracking):

| Cookie | What for | Lifetime |
|---|---|---|
| `__Host-ve_admin` | The owner's signed-in session (signed token; changing the password signs everyone out). | 7 days |
| `ve_visitor` | Remembers a visitor the owner **approved** for locked tiles, so they don't have to ask again. Holds a random id and secret; the approval itself is stored on the server and never expires (the owner can revoke it). | About 13 months (400 days, the most a browser keeps), **renewed every time the visitor returns** |
| `ve_challenge` | Ties a WhatsApp sign-in / password-reset code to the browser that asked for it. | 10 minutes |

Because these are strictly necessary for features the visitor asked for, no consent banner is needed.

**Caching**

- Pages are rebuilt at most once a minute (and immediately when the owner saves); `/_next/static/*` and `/ort/<version>/*` (the audio separator's runtime, in a folder named after its version) are cached for a year.
- Photos (`/media/*`) have unique file names and support `ETag` / `304`: **public** photos are kept 1 day in the browser and 5 minutes in the shared CDN; **locked** photos only in the approved visitor's own browser for 10 minutes, never in a shared cache.
- Access checks are cached on the server for a few seconds; saving in the editor refreshes them at once on the same server.
- The audio separator keeps its AI model on the visitor's device (Cache API) after the first download.

## Latest Car Reveals (`/cars`)

A free, automatic feed: every 30 minutes (ISR) the page reads the public RSS feeds listed in `lib/cars/sources.ts`, keeps genuine reveals and concepts (`lib/cars/pick.ts`), pulls headline-ready specs out of the text (`lib/cars/specs.ts`) and shows about seven fresh ones for the week plus an "Earlier" list. Stories link to the original sites. The last good list is saved in the private Blob store, so the page still shows something if every site is down. To add a source, add one line to `SOURCES`.

## Tech & Gadgets (`/tech`) and Speed Test (`/speed`)

`/tech` works like the car feed: RSS from phone-news sites (`lib/tech/sources.ts`), scored in `lib/tech/pick.ts` (Samsung Galaxy S26/S27 Ultra and Apple get their own sections, then wearables and other phones), refreshed every 30 minutes with a Blob snapshot as a fallback. `/speed` measures ping, download and upload in the browser against `/api/speed/{ping,down,up}`; uploads are sent in 2 MB pieces to stay under the host's request-size limit.

## QR Code Generator (`/qr`)

Runs entirely in the browser (the `qrcode` package computes the code; `lib/qr/render.ts` draws the branded card: logo badge in the centre, site name underneath, error-correction level H so the logo never stops it scanning). Verified by decoding downloaded PNGs from 23 to 1,900 characters.

## Access requests, sign-in emails and sign-up export

Each lockable box is **Open**, **Locked** (shown normally with a lock) or **Greyed out** (a faint grey hint with no description; the description never reaches the page). Set it with the round button on each box in Admin → Boxes, or the Open / Locked / Greyed out switch inside a box.

Clicking a locked or greyed-out box asks for **name, email and phone**. The visitor sees a "check your inbox" confirmation, and gets a branded email with a sign-in link (valid 24 hours) that signs in any device. If the email already belongs to someone, the new browser is *not* signed in — only the link from the inbox does that. "Sign in" lets a returning visitor get a new link by email alone (the answer is the same whether or not the address is known). When you approve someone they get a "you're approved" email with a link straight in.

Admin → Access requests shows everyone's name, email (✓ once they've opened a link), phone, request date and status, with **Download CSV** for the full list (formula-looking cells are escaped so spreadsheets don't run them).

Email needs `RESEND_API_KEY` in Vercel (see `.env.example`). Without it, requests still work and the confirmation says the email couldn't be sent.
