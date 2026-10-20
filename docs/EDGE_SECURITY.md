# Edge security: Vercel Firewall & Cloudflare

The app already enforces its own limits (Postgres-backed per-IP rate limits on checkout,
IP blocklist, card-testing auto-block, signed + idempotent webhooks, optional Turnstile).
The edge rules below stop abuse *before* it reaches your functions. Use whichever edge
you deploy behind — or both (Cloudflare in front of Vercel).

> ⚠️ The one rule you must not get wrong: **never challenge or block `/api/fund/webhooks/stripe`.**
> Stripe can't solve a challenge; payments would stay "pending" until Stripe gives up retrying.
> The endpoint is protected by its signature check instead.

---

## Vercel Firewall (Project → Firewall)

**Custom rules** (add in this order):

| # | Name | If | Then |
|---|---|---|---|
| 1 | Stripe webhooks bypass | Request path **equals** `/api/fund/webhooks/stripe` | **Bypass** (skips Attack Challenge Mode / bot rules) |
| 2 | Checkout rate limit | Request path **equals** `/api/fund/checkout` | **Rate limit** · fixed window · 60 s · 10 requests · key: IP · action: Deny (429) |
| 3 | Snapshot rate limit | Request path **starts with** `/api/fund/campaigns/` | **Rate limit** · 60 s · 120 requests · key: IP · action: Deny |
| 4 | Short-link rate limit | Request path **starts with** `/fund/l/` | **Rate limit** · 60 s · 60 requests · key: IP · action: Deny |

**Managed rulesets:** enable **Bot Protection** (Challenge) — rule 1 keeps Stripe out of it.
**Attack Challenge Mode:** safe to switch on during an attack — rule 1 still lets Stripe through.

---

## Cloudflare (Security → WAF)

### Custom rules

1. **Skip security for Stripe webhooks**
   ```
   (http.request.uri.path eq "/api/fund/webhooks/stripe")
   ```
   Action: **Skip** → all remaining custom rules, rate limiting rules, managed rules, Super Bot Fight Mode.
   *(Plain "Bot Fight Mode" on the Free plan can't be skipped — use Super Bot Fight Mode (Pro+) or leave Bot Fight Mode off.)*

   Optional hardening — only Stripe may call it ([IP list](https://stripe.com/files/ips/ips_webhooks.txt)):
   ```
   (http.request.uri.path eq "/api/fund/webhooks/stripe" and not ip.src in $stripe_webhook_ips)
   ```
   Action: **Block** (create the `stripe_webhook_ips` IP list under Manage Account → Configurations → Lists).

2. **Only POST to checkout**
   ```
   (http.request.uri.path eq "/api/fund/checkout" and http.request.method ne "POST")
   ```
   Action: **Block**.

3. **Challenge automated traffic on checkout** (Pro+ with bot score / Enterprise Bot Management)
   ```
   (http.request.uri.path eq "/api/fund/checkout" and cf.bot_management.score lt 30 and not cf.bot_management.verified_bot)
   ```
   Action: **Managed Challenge**. On lower plans use Turnstile instead (below).

4. **(Optional) Lock dashboards to your countries**
   ```
   ((starts_with(http.request.uri.path, "/fund/admin") or starts_with(http.request.uri.path, "/fund/portal")) and not ip.src.country in {"US" "IL" "CA" "GB"})
   ```
   Action: **Managed Challenge**.

### Rate limiting rules

| Expression | Counting | Limit | Action |
|---|---|---|---|
| `http.request.uri.path eq "/api/fund/checkout"` | per IP | 10 / 1 min (Free plan: 5 / 10 s) | Block 10 min |
| `starts_with(http.request.uri.path, "/api/fund/campaigns/")` | per IP | 120 / 1 min | Block 1 min |
| `starts_with(http.request.uri.path, "/fund/l/")` | per IP | 60 / 1 min | Block 1 min |

### Caching (Caching → Cache Rules)

The public snapshot endpoint sends `Cache-Control: public, s-maxage=3, stale-while-revalidate=30`,
so thousands of screens resyncing at once cost one origin request. Cloudflare doesn't cache JSON by default:

```
(starts_with(http.request.uri.path, "/api/fund/campaigns/"))
```
→ **Eligible for cache**, Edge TTL: **Use cache-control header if present**.

Everything else under `/fund/admin`, `/fund/portal`, `/api/fund/*` is `private`/`no-store` and is never cached.

### SSL / network

- SSL/TLS mode **Full (strict)**; **Always Use HTTPS** on.
- WebSockets are not proxied by your zone (browsers connect straight to `*.supabase.co`), so no WebSocket setting is needed.

---

## Cloudflare Turnstile (optional, any plan)

1. Cloudflare → Turnstile → Add site → hostname `yaakoveisenberger.com`, widget mode **Managed**.
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`, redeploy.
3. The checkout's payment step renders an invisible-unless-needed challenge and the server verifies the token before creating a PaymentIntent.

---

## Stripe-side protections

- **Radar** rules (Stripe → Radar → Rules) — e.g. *Block if :risk_level: = 'highest'*, *Review if :amount_in_usd: > 5000*.
- Radar early-fraud warnings, disputes and elevated-risk charges are flagged automatically in **/fund/admin → Fraud & transactions**.
