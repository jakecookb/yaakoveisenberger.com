// Runs the Supabase migration against an in-process PostgreSQL (PGlite) with the
// Supabase `auth` / `realtime` schemas stubbed, then exercises matching, refunds,
// RLS and broadcasts.  Usage: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const db = new PGlite();

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  grant create on schema public to service_role;

  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;

  create schema realtime;
  create table realtime.sent (id serial primary key, topic text, event text, payload jsonb, private boolean);
  create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
  returns void language sql as $$
    insert into realtime.sent (topic, event, payload, private) values (topic, event, payload, private)
  $$;
  create publication supabase_realtime;
`;

const ADMIN = '00000000-0000-0000-0000-00000000000a';
const MANAGER = '00000000-0000-0000-0000-00000000000b';
const STRANGER = '00000000-0000-0000-0000-00000000000c';
const INVITEE = '00000000-0000-0000-0000-00000000000d';

async function as(role, sub, email, fn) {
  await db.exec(`set role ${role}`);
  const claims = sub ? JSON.stringify({ sub, email, role }) : JSON.stringify({ role });
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params) => (await db.query(sql, params)).rows;
let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

await db.exec(SUPABASE_STUBS);
for (const file of readdirSync(join(root, 'supabase/migrations')).sort()) {
  await db.exec(readFileSync(join(root, 'supabase/migrations', file), 'utf8'));
  console.log(`applied ${file}`);
}

await db.exec(`
  insert into auth.users (id, email) values
    ('${ADMIN}', 'admin@example.com'), ('${MANAGER}', 'manager@example.org'), ('${STRANGER}', 'x@example.net');
  insert into public.fund_platform_admins (user_id) values ('${ADMIN}');
  insert into public.fund_organizations (id, name, slug, stripe_account_id, stripe_charges_enabled)
    values ('10000000-0000-0000-0000-000000000001', 'Test Org', 'test-org', 'acct_test', true);
  insert into public.fund_org_members (org_id, user_id, email, role)
    values ('10000000-0000-0000-0000-000000000001', '${MANAGER}', 'manager@example.org', 'manager');
  insert into public.fund_campaigns (id, org_id, slug, title, goal_cents, starts_at, ends_at, status)
    values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'big-match',
            'Big Match', 50000000, now() - interval '1 day', now() + interval '1 day', 'active');
  insert into public.fund_teams (id, campaign_id, name, slug)
    values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Blue', 'blue');
  -- Tier 1: power hour 3x ($1 = $4) with $1,500; Tier 2: base 1x ($1 = $2) with $100,000
  insert into public.fund_matchers (id, campaign_id, name, ratio, pledge_cents, priority) values
    ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Power Hour', 3, 150000, 10),
    ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Base Match', 1, 10000000, 20);
`);
const C = '20000000-0000-0000-0000-000000000001';

console.log('\nmatching waterfall');
await test('$1,000 gift spills from 3x tier into 1x tier', async () => {
  await as('service_role', null, null, () => db.query(`
    insert into public.fund_donations (id, campaign_id, team_id, amount_cents, donor_name, donor_email, status, stripe_payment_intent_id)
    values ('50000000-0000-0000-0000-000000000001', $1, '30000000-0000-0000-0000-000000000001', 100000, 'Dana', 'dana@example.com', 'pending', 'pi_1')`, [C]));
  let d = await one(`select matched_cents, settled_at from public.fund_donations where stripe_payment_intent_id = 'pi_1'`);
  assert.equal(Number(d.matched_cents), 0, 'pending gifts are not matched');

  await as('service_role', null, null, () =>
    db.query(`update public.fund_donations set status = 'succeeded', succeeded_at = now() where stripe_payment_intent_id = 'pi_1'`));
  d = await one(`select matched_cents, settled_at from public.fund_donations where stripe_payment_intent_id = 'pi_1'`);
  assert.equal(Number(d.matched_cents), 200000, '$500 x3 = $1,500 + $500 x1 = $500');
  assert.ok(d.settled_at);

  const m = await rows(`select name, matched_cents from public.fund_matchers order by priority`);
  assert.deepEqual(m.map((r) => Number(r.matched_cents)), [150000, 50000]);
  const c = await one(`select raised_cents, matched_cents, donation_count from public.fund_campaigns where id = $1`, [C]);
  assert.deepEqual([Number(c.raised_cents), Number(c.matched_cents), c.donation_count], [100000, 200000, 1]);
  const t = await one(`select raised_cents, donation_count from public.fund_teams`);
  assert.deepEqual([Number(t.raised_cents), t.donation_count], [300000, 1], 'team gets gift + match credit');
});

await test('repeated succeeded updates are idempotent', async () => {
  await as('service_role', null, null, () =>
    db.query(`update public.fund_donations set status = 'succeeded' where stripe_payment_intent_id = 'pi_1'`));
  const c = await one(`select raised_cents, donation_count from public.fund_campaigns where id = $1`, [C]);
  assert.deepEqual([Number(c.raised_cents), c.donation_count], [100000, 1]);
});

await test('current ratio moves to the next tier once the pool is exhausted', async () => {
  const t = await one(`select public.fund_campaign_totals($1) as t`, [C]);
  assert.equal(Number(t.t.current_ratio), 1);
  assert.equal(Number(t.t.match_remaining_cents), 10000000 - 50000);
});

await test('refund reverses matches and restores pools', async () => {
  await as('service_role', null, null, () =>
    db.query(`update public.fund_donations set status = 'refunded' where stripe_payment_intent_id = 'pi_1'`));
  const m = await rows(`select matched_cents from public.fund_matchers order by priority`);
  assert.deepEqual(m.map((r) => Number(r.matched_cents)), [0, 0]);
  const c = await one(`select raised_cents, matched_cents, donation_count from public.fund_campaigns where id = $1`, [C]);
  assert.deepEqual([Number(c.raised_cents), Number(c.matched_cents), c.donation_count], [0, 0, 0]);
  const reversed = await one(`select count(*)::int n from public.fund_donation_matches where reversed_at is not null`);
  assert.equal(reversed.n, 2);
});

await test('pool caps exactly (no stranded cents, never overdrawn)', async () => {
  await db.exec(`update public.fund_matchers set pledge_cents = 100, status = 'active' where priority = 10;
                 update public.fund_matchers set status = 'paused' where priority = 20;`);
  await as('service_role', null, null, () => db.query(`
    insert into public.fund_donations (campaign_id, amount_cents, status, stripe_payment_intent_id)
    values ($1, 5000, 'succeeded', 'pi_2')`, [C]));
  const d = await one(`select matched_cents from public.fund_donations where stripe_payment_intent_id = 'pi_2'`);
  assert.equal(Number(d.matched_cents), 100);
  const m = await one(`select matched_cents, pledge_cents from public.fund_matchers where priority = 10`);
  assert.equal(Number(m.matched_cents), Number(m.pledge_cents));
  await db.exec(`update public.fund_matchers set status = 'active' where priority = 20;`);
});

await test('time-boxed matchers only apply inside their window', async () => {
  await db.exec(`insert into public.fund_matchers (campaign_id, name, ratio, pledge_cents, priority, starts_at, ends_at)
                 values ('${C}', 'Future Hour', 5, 1000000, 1, now() + interval '1 hour', now() + interval '2 hours')`);
  await as('service_role', null, null, () => db.query(`
    insert into public.fund_donations (campaign_id, amount_cents, status, stripe_payment_intent_id)
    values ($1, 1000, 'succeeded', 'pi_3')`, [C]));
  const d = await one(`select matched_cents from public.fund_donations where stripe_payment_intent_id = 'pi_3'`);
  assert.equal(Number(d.matched_cents), 1000, 'base 1x tier, not the future 5x tier');
});

console.log('\nrealtime broadcasts');
await test('settled gifts broadcast sanitized payload on campaign_donations_<id>', async () => {
  const msg = await one(`select * from realtime.sent where event = 'donation' order by id desc limit 1`);
  assert.equal(msg.topic, `campaign_donations_${C}`);
  assert.equal(msg.private, false);
  assert.equal(msg.payload.donation.amount_cents, 1000);
  assert.ok(msg.payload.totals.total_cents > 0);
  assert.ok(!JSON.stringify(msg.payload).includes('@'), 'no emails in broadcast');
});
await test('refunds and config edits broadcast refresh', async () => {
  const n = await one(`select count(*)::int n from realtime.sent where event = 'refresh'`);
  assert.ok(n.n >= 2);
});

console.log('\nrow level security');
await test('anon cannot read any table directly', async () => {
  await as('anon', null, null, async () => {
    await assert.rejects(db.query(`select * from public.fund_donations`), /permission denied/);
    await assert.rejects(db.query(`select * from public.fund_campaigns`), /permission denied/);
  });
});
await test('anon public RPC hides donor PII and anonymous names', async () => {
  await as('service_role', null, null, () => db.query(`
    insert into public.fund_donations (campaign_id, amount_cents, status, donor_name, donor_email, is_anonymous, stripe_payment_intent_id)
    values ($1, 1800, 'succeeded', 'Secret Person', 'secret@example.com', true, 'pi_4')`, [C]));
  const r = await as('anon', null, null, () => one(`select public.fund_get_public_campaign('big-match') as p`));
  const s = JSON.stringify(r.p);
  assert.ok(!s.includes('secret@example.com') && !s.includes('Secret Person') && !s.includes('dana@example.com'));
  assert.equal(r.p.recent[0].name, 'Anonymous');
  assert.ok(r.p.matchers.length === 3 && r.p.teams.length === 1);
});
await test('anon cannot call internal functions', async () => {
  await as('anon', null, null, async () => {
    await assert.rejects(db.query(`select public.fund_settle_donation(gen_random_uuid())`), /permission denied/);
    await assert.rejects(db.query(`select public.fund_check_rate_limit('x', 1, 60)`), /permission denied/);
    await assert.rejects(db.query(`select public.fund_platform_metrics()`), /permission denied/);
  });
});
await test('drafts are hidden from the public but visible to managers', async () => {
  await db.exec(`insert into public.fund_campaigns (id, org_id, slug, title, goal_cents, starts_at, ends_at, status)
    values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'draft-one', 'Draft One',
            100000, now(), now() + interval '3 days', 'draft')`);
  const pub = await as('anon', null, null, () => one(`select public.fund_get_public_campaign('draft-one') as p`));
  assert.equal(pub.p, null);
  const mgr = await as('authenticated', MANAGER, 'manager@example.org', () => one(`select public.fund_get_public_campaign('draft-one') as p`));
  assert.ok(mgr.p);
});
await test('managers see only their org data; strangers see nothing', async () => {
  const mine = await as('authenticated', MANAGER, 'manager@example.org', () => rows(`select id from public.fund_donations`));
  assert.ok(mine.length >= 3);
  const theirs = await as('authenticated', STRANGER, 'x@example.net', () => rows(`select id from public.fund_donations`));
  assert.equal(theirs.length, 0);
  const camps = await as('authenticated', STRANGER, 'x@example.net', () => rows(`select id from public.fund_campaigns`));
  assert.equal(camps.length, 0);
});
await test('managers record offline gifts that settle and broadcast instantly', async () => {
  const before = await one(`select raised_cents from public.fund_campaigns where id = $1`, [C]);
  await as('authenticated', MANAGER, 'manager@example.org', () => db.query(`
    insert into public.fund_donations (campaign_id, amount_cents, source, reference, donor_name, status, matched_cents, platform_fee_cents)
    values ($1, 50000, 'check', '#1042', 'Rabbi K', 'pending', 999999, 12345)`, [C]));
  const d = await one(`select * from public.fund_donations where reference = '#1042'`);
  assert.equal(d.status, 'succeeded');
  assert.equal(Number(d.platform_fee_cents), 0, 'client cannot set platform fee');
  assert.equal(Number(d.matched_cents), 50000, 'matched by the waterfall, not by the client value');
  assert.equal(d.created_by, MANAGER);
  const after = await one(`select raised_cents from public.fund_campaigns where id = $1`, [C]);
  assert.equal(Number(after.raised_cents) - Number(before.raised_cents), 50000);
  const audit = await one(`select count(*)::int n from public.fund_audit_log where entity_type = 'fund_donations' and actor_id = $1`, [MANAGER]);
  assert.equal(audit.n, 1);
});
await test('managers cannot create online gifts or edit online gifts', async () => {
  await as('authenticated', MANAGER, 'manager@example.org', async () => {
    await assert.rejects(db.query(`insert into public.fund_donations (campaign_id, amount_cents, source, status)
                                   values ($1, 100, 'online', 'succeeded')`, [C]), /row-level security/);
    const r = await db.query(`update public.fund_donations set amount_cents = 1 where stripe_payment_intent_id = 'pi_4'`);
    assert.equal(r.affectedRows ?? 0, 0);
  });
});
await test('managers cannot touch counters, fees or approve their own campaigns', async () => {
  await as('authenticated', MANAGER, 'manager@example.org', async () => {
    await db.query(`update public.fund_campaigns set raised_cents = 999999999, platform_fee_bps = 0 where id = $1`, [C]);
    await db.query(`update public.fund_matchers set matched_cents = 0 where campaign_id = $1`, [C]);
    await assert.rejects(
      db.query(`update public.fund_campaigns set status = 'active' where slug = 'draft-one'`),
      /requires a platform admin/);
  });
  const c = await one(`select raised_cents, platform_fee_bps from public.fund_campaigns where id = $1`, [C]);
  assert.notEqual(Number(c.raised_cents), 999999999);
  assert.equal(c.platform_fee_bps, null);
  const m = await one(`select sum(matched_cents)::bigint s from public.fund_matchers where campaign_id = $1`, [C]);
  assert.ok(Number(m.s) > 0);
});
await test('platform admin approves campaigns and sees metrics', async () => {
  await as('authenticated', ADMIN, 'admin@example.com', async () => {
    await db.query(`update public.fund_campaigns set status = 'active' where slug = 'draft-one'`);
    const m = await one(`select public.fund_platform_metrics() as m`);
    assert.ok(Number(m.m.gross_cents) > 0);
  });
  const c = await one(`select approved_at, approved_by from public.fund_campaigns where slug = 'draft-one'`);
  assert.ok(c.approved_at);
  assert.equal(c.approved_by, ADMIN);
  await as('authenticated', MANAGER, 'manager@example.org', async () => {
    await assert.rejects(db.query(`select public.fund_platform_metrics()`), /Platform admin only/);
    const dash = await one(`select public.fund_campaign_dashboard($1) as d`, [C]);
    assert.ok(Number(dash.d.unique_donors) >= 3);
  });
});
await test('admin override of a settled gift re-settles totals', async () => {
  const before = await one(`select raised_cents from public.fund_campaigns where id = $1`, [C]);
  await as('authenticated', ADMIN, 'admin@example.com', () =>
    db.query(`update public.fund_donations set amount_cents = 3600 where stripe_payment_intent_id = 'pi_4'`));
  const after = await one(`select raised_cents from public.fund_campaigns where id = $1`, [C]);
  assert.equal(Number(after.raised_cents) - Number(before.raised_cents), 1800);
  const recalculated = await as('authenticated', ADMIN, 'admin@example.com', () =>
    one(`select public.fund_recalculate_campaign($1) as t`, [C]));
  assert.equal(Number(recalculated.t.raised_cents), Number(after.raised_cents), 'ledger agrees with counters');
});
await test('pending invites are linked when the user signs up', async () => {
  await db.exec(`insert into public.fund_org_members (org_id, email, role)
                 values ('10000000-0000-0000-0000-000000000001', 'new@example.org', 'viewer');
                 insert into auth.users (id, email) values ('${INVITEE}', 'New@Example.org');`);
  const m = await one(`select user_id from public.fund_org_members where email = 'new@example.org'`);
  assert.equal(m.user_id, INVITEE);
});
await test('short links count clicks and resolve params', async () => {
  await db.exec(`insert into public.fund_links (campaign_id, code, label, team_id, preset_amount_cents)
                 values ('${C}', 'blue180', 'Blue team', '30000000-0000-0000-0000-000000000001', 18000)`);
  const r = await as('anon', null, null, () => one(`select public.fund_resolve_link('blue180') as l`));
  assert.equal(r.l.slug, 'big-match');
  assert.equal(r.l.team, 'blue');
  const l = await one(`select click_count from public.fund_links where code = 'blue180'`);
  assert.equal(l.click_count, 1);
});
await test('rate limiter allows N per window then blocks', async () => {
  const results = await as('service_role', null, null, async () => {
    const out = [];
    for (let i = 0; i < 4; i++) out.push((await one(`select public.fund_check_rate_limit('ip:1', 3, 60) ok`)).ok);
    return out;
  });
  assert.deepEqual(results, [true, true, true, false]);
});

const seed = readFileSync(join(root, 'supabase/seed.sql'), 'utf8');
await db.exec(seed);
await test('seed data loads and settles', async () => {
  const r = await one(`select public.fund_get_public_campaign('sample-campaign') as p`);
  assert.ok(r.p && Number(r.p.totals.total_cents) > 0);
});

console.log(`\n${passed} database tests passed`);
