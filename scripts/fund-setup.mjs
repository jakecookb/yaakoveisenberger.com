#!/usr/bin/env node
// One-command setup for yaakoveisenberger.com/fund.
//
//   npm run fund:setup              # migrate DB, register Stripe webhooks, verify everything
//   npm run fund:setup -- --seed    # also load the sample campaign (/fund/sample-campaign)
//
// Reads .env.local (then the process environment). Every step is idempotent and
// skips itself with an explanation when the credentials it needs are missing.
//
// Optional extras it understands:
//   SUPABASE_DB_URL        Postgres connection string (Supabase → Connect → "Session pooler")
//                          used to apply supabase/migrations/*.sql
//   SUPABASE_ACCESS_TOKEN  personal access token (supabase.com/dashboard/account/tokens)
//                          used to add the /fund/auth/callback redirect URL to Supabase Auth

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const envFile = join(root, '.env.local');

const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m` };
const ok = (m) => console.log(`  ${c.g('✓')} ${m}`);
const warn = (m) => console.log(`  ${c.y('!')} ${m}`);
const bad = (m) => console.log(`  ${c.r('✗')} ${m}`);
const step = (m) => console.log(`\n${c.b(m)}`);

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const fileEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
const env = { ...fileEnv, ...process.env };
const get = (...names) => names.map((n) => env[n]).find(Boolean) ?? '';

function writeEnv(updates) {
  let text = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, `${k}=${v}`) : `${text.replace(/\n?$/, '\n')}${k}=${v}\n`;
    env[k] = v;
  }
  writeFileSync(envFile, text);
}

const SUPABASE_URL = get('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
const PUBLIC_KEY = get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SECRET_KEY = get('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
const SITE_URL = (get('NEXT_PUBLIC_SITE_URL') || 'https://yaakoveisenberger.com').replace(/\/$/, '');
const STRIPE_KEY = get('STRIPE_SECRET_KEY');
const results = [];

console.log(c.b('\n/fund platform setup'));
console.log(c.d(`  site ${SITE_URL} · env file ${existsSync(envFile) ? '.env.local' : '(none — using process env)'}`));

// ---------------------------------------------------------------- 1. environment
step('1. Environment');
const required = [
  ['NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL, 'Supabase → Project Settings → API'],
  ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY)', PUBLIC_KEY, 'Supabase → Project Settings → API Keys'],
  ['SUPABASE_SECRET_KEY (or _SERVICE_ROLE_KEY)', SECRET_KEY, 'Supabase → Project Settings → API Keys (server only!)'],
  ['STRIPE_SECRET_KEY', STRIPE_KEY, 'dashboard.stripe.com/apikeys'],
  ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', get('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'), 'dashboard.stripe.com/apikeys'],
  ['FUND_PLATFORM_ADMIN_EMAILS', get('FUND_PLATFORM_ADMIN_EMAILS'), 'your email — becomes super admin on first sign-in'],
];
for (const [name, value, where] of required) (value ? ok(name) : warn(`${name} missing — ${where}`));
if (STRIPE_KEY.startsWith('sk_live')) warn('Using LIVE Stripe keys — real money will move.');

// ---------------------------------------------------------------- 2. database
step('2. Database migration');
const dbUrl = get('SUPABASE_DB_URL', 'DATABASE_URL', 'POSTGRES_URL');
if (!dbUrl) {
  warn('SUPABASE_DB_URL not set — apply the schema one of these ways:');
  console.log(c.d('      a) set SUPABASE_DB_URL (Supabase → Connect → Session pooler URI) and re-run this script'));
  console.log(c.d('      b) paste supabase/migrations/20261020000000_fund_platform.sql into Supabase → SQL Editor → Run'));
  console.log(c.d('      c) npx supabase link --project-ref <ref> && npx supabase db push'));
  results.push(['database', 'manual']);
} else {
  let pg;
  try {
    pg = (await import('pg')).default;
  } catch {
    bad('The "pg" package is missing — run `npm install` first.');
  }
  if (pg) {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);
    const client = new pg.Client({
      connectionString: dbUrl,
      // Supabase's certificate chain isn't in Node's default store; the connection is still TLS-encrypted.
      ssl: local ? false : { rejectUnauthorized: Boolean(get('FUND_DB_SSL_STRICT')) },
    });
    try {
      await client.connect();
      ok('connected');
      const { rows } = await client.query(`select to_regclass('public.fund_campaigns') is not null as installed`);
      const migrations = readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
      if (rows[0].installed) {
        ok('schema already installed — skipping (migrations are not re-run)');
      } else {
        for (const file of migrations) {
          const sql = readFileSync(join(root, 'supabase/migrations', file), 'utf8');
          await client.query('begin');
          try {
            await client.query(sql);
            await client.query('commit');
            ok(`applied ${file}`);
          } catch (e) {
            await client.query('rollback');
            throw new Error(`${file}: ${e.message}`);
          }
        }
        // Let the Supabase CLI know these are applied, if it tracks this project.
        const { rows: tracked } = await client.query(`select to_regclass('supabase_migrations.schema_migrations') is not null as t`);
        if (tracked[0].t) {
          for (const file of migrations) {
            const version = file.split('_')[0];
            await client.query(`insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict do nothing`, [version, file.replace(/^\d+_|\.sql$/g, '')]).catch(() => {});
          }
        }
      }
      if (args.has('--seed')) {
        await client.query(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'));
        ok('sample campaign loaded → /fund/sample-campaign');
      }
      const { rows: rt } = await client.query(`select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'realtime' and p.proname = 'send') as ok`);
      rt[0].ok ? ok('realtime.send() available — live broadcasts enabled') : warn('realtime.send() not found — pages fall back to polling (enable Realtime in Supabase)');
      results.push(['database', 'ok']);
    } catch (e) {
      bad(`migration failed: ${e.message}`);
      results.push(['database', 'failed']);
    } finally {
      await client.end().catch(() => {});
    }
  }
}

// ---------------------------------------------------------------- 3. verify API
step('3. Supabase API check');
if (SUPABASE_URL && PUBLIC_KEY) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fund_list_public_campaigns`, {
      method: 'POST',
      headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${PUBLIC_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (res.ok) ok(`public RPC reachable (${(await res.json()).length} live campaigns)`);
    else bad(`public RPC returned ${res.status}: ${(await res.text()).slice(0, 160)} — is the migration applied?`);
    if (SECRET_KEY) {
      const res2 = await fetch(`${SUPABASE_URL}/rest/v1/fund_rate_limits?limit=1`, { headers: { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}` } });
      res2.ok ? ok('secret key works (server-side access)') : bad(`secret key rejected (${res2.status})`);
    }
  } catch (e) {
    bad(`could not reach ${SUPABASE_URL}: ${e.message}`);
  }
} else {
  warn('skipped — Supabase URL/key missing');
}

// ---------------------------------------------------------------- 4. Supabase Auth redirect URL
step('4. Supabase Auth redirect URL');
const callback = `${SITE_URL}/fund/auth/callback`;
const ref = SUPABASE_URL.match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/)?.[1];
const pat = get('SUPABASE_ACCESS_TOKEN');
if (ref && pat) {
  try {
    const headers = { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' };
    const cfg = await (await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, { headers })).json();
    const list = (cfg.uri_allow_list ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const wanted = `${callback}**`;
    if (list.includes(wanted)) ok('redirect URL already allowed');
    else {
      const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ uri_allow_list: [...list, wanted].join(','), ...(cfg.site_url?.includes('localhost') ? { site_url: SITE_URL } : {}) }),
      });
      res.ok ? ok(`added ${wanted} to Auth → URL configuration`) : bad(`Management API returned ${res.status}`);
    }
  } catch (e) {
    bad(`could not update auth config: ${e.message}`);
  }
} else {
  warn(`add ${callback}** under Supabase → Authentication → URL Configuration → Redirect URLs`);
  console.log(c.d('      (or set SUPABASE_ACCESS_TOKEN and re-run to do it automatically)'));
}

// ---------------------------------------------------------------- 5. Stripe
step('5. Stripe Connect + webhooks');
if (!STRIPE_KEY || args.has('--skip-stripe')) {
  warn('skipped — STRIPE_SECRET_KEY not set');
} else {
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(STRIPE_KEY);
  try {
    await stripe.accounts.list({ limit: 1 });
    ok('Stripe Connect is enabled');
  } catch (e) {
    bad(`Stripe Connect not ready: ${e.message}`);
    console.log(c.d('      enable it at https://dashboard.stripe.com/connect (choose "Platform or marketplace", Express accounts)'));
  }
  const url = `${SITE_URL}/api/fund/webhooks/stripe`;
  if (!/^https:\/\//.test(url) || /localhost|127\.0\.0\.1/.test(url)) {
    warn(`webhooks need a public https URL — for local testing run: stripe listen --forward-to localhost:3000/api/fund/webhooks/stripe`);
  } else {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const specs = [
      {
        key: 'STRIPE_WEBHOOK_SECRET',
        connect: false,
        events: ['payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.canceled', 'charge.succeeded', 'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed', 'radar.early_fraud_warning.created'],
      },
      { key: 'STRIPE_CONNECT_WEBHOOK_SECRET', connect: true, events: ['account.updated'] },
    ];
    for (const spec of specs) {
      const existing = endpoints.data.find((e) => e.url === url && Boolean(e.application) === spec.connect && e.status === 'enabled');
      const label = spec.connect ? 'Connect webhook' : 'Platform webhook';
      if (existing && env[spec.key] && !args.has('--recreate-webhooks')) {
        ok(`${label} exists (${existing.id})`);
        continue;
      }
      if (existing) {
        // Signing secrets are only revealed at creation, so replace the endpoint to obtain one.
        await stripe.webhookEndpoints.del(existing.id);
        warn(`${label}: replaced ${existing.id} to obtain a fresh signing secret`);
      }
      const created = await stripe.webhookEndpoints.create({
        url,
        enabled_events: spec.events,
        connect: spec.connect,
        description: `yaakoveisenberger.com/fund (${spec.connect ? 'connected accounts' : 'platform'})`,
      });
      writeEnv({ [spec.key]: created.secret });
      ok(`${label} created (${created.id}) — ${spec.key} saved to .env.local`);
    }
  }
}

// ---------------------------------------------------------------- summary
step('Next steps');
console.log(`  1. Copy these variables into Vercel → Project → Settings → Environment Variables:`);
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_CONNECT_WEBHOOK_SECRET', 'NEXT_PUBLIC_SITE_URL', 'FUND_PLATFORM_ADMIN_EMAILS', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY']) {
    if (env[k]) console.log(c.d(`       ${k}=${k.startsWith('NEXT_PUBLIC') || k === 'FUND_PLATFORM_ADMIN_EMAILS' ? env[k] : env[k].slice(0, 7) + '…'}`));
  }
  console.log(`     (or: npx vercel env pull / vercel env add — values are in .env.local)`);
  console.log(`  2. Deploy, then sign in at ${SITE_URL}/fund/login with ${get('FUND_PLATFORM_ADMIN_EMAILS') || 'your admin email'}`);
  console.log(`  3. In /fund/admin → Nonprofits & Stripe: create the nonprofit, click "Connect Stripe", invite its managers`);
  console.log(`  4. Create a campaign, approve it, and share ${SITE_URL}/fund/<slug>\n`);
