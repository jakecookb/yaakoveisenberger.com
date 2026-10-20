import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStripe, accountStatus } from '@/lib/fund/stripe';
import { createFundServiceClient } from '@/lib/fund/supabase/server';
import { isServiceRoleConfigured, serverEnv } from '@/lib/fund/env';

type Outcome = { status: 'processed' | 'ignored'; donationId?: string | null };

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : (v?.id ?? null));

/**
 * Stripe webhook: signature-verified with STRIPE_WEBHOOK_SECRET (platform events)
 * and/or STRIPE_CONNECT_WEBHOOK_SECRET (connected-account events). The Stripe
 * event id is the primary key of fund_webhook_events, so re-deliveries are no-ops,
 * and every handler is a guarded state transition (safe to replay).
 */
export async function POST(request: Request) {
  const secrets = serverEnv().stripeWebhookSecrets;
  if (!secrets.length || !isServiceRoleConfigured()) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  const body = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret);
      break;
    } catch {
      // try the next secret
    }
  }
  if (!event) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });

  const db = createFundServiceClient();
  const { error: insertError } = await db.from('fund_webhook_events').insert({
    id: event.id,
    type: event.type,
    account: event.account ?? null,
    livemode: event.livemode,
    payload: event,
  });
  if (insertError) {
    if (insertError.code !== '23505') {
      console.error('[fund] webhook ledger insert failed', insertError.message);
      return NextResponse.json({ error: 'Ledger unavailable' }, { status: 500 });
    }
    const { data: existing } = await db
      .from('fund_webhook_events')
      .select('status, attempts')
      .eq('id', event.id)
      .single<{ status: string; attempts: number }>();
    if (existing && (existing.status === 'processed' || existing.status === 'ignored')) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    await db
      .from('fund_webhook_events')
      .update({ attempts: (existing?.attempts ?? 1) + 1, status: 'received', error: null })
      .eq('id', event.id);
  }

  try {
    const outcome = await handleEvent(event, db);
    await db
      .from('fund_webhook_events')
      .update({
        status: outcome.status,
        processed_at: new Date().toISOString(),
        related_donation_id: outcome.donationId ?? null,
        error: null,
      })
      .eq('id', event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fund] webhook ${event.type} failed`, message);
    await db.from('fund_webhook_events').update({ status: 'failed', error: message.slice(0, 2000) }).eq('id', event.id);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 }); // Stripe retries with backoff
  }
}

async function findDonationId(db: SupabaseClient, paymentIntentId: string | null, metadataId?: string | null) {
  if (metadataId) return metadataId;
  if (!paymentIntentId) return null;
  const { data } = await db
    .from('fund_donations')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

async function must<T extends { error: { message: string } | null }>(p: PromiseLike<T>) {
  const res = await p;
  if (res.error) throw new Error(res.error.message);
  return res;
}

async function handleEvent(event: Stripe.Event, db: SupabaseClient): Promise<Outcome> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      const donationId = await findDonationId(db, pi.id, pi.metadata?.donation_id);
      if (!donationId) return { status: 'ignored' };
      // Guarded transition: only pending/failed/canceled -> succeeded. The DB trigger then
      // applies the match waterfall, updates every total and broadcasts to Realtime.
      await must(
        db
          .from('fund_donations')
          .update({
            status: 'succeeded',
            succeeded_at: new Date().toISOString(),
            stripe_payment_intent_id: pi.id,
            stripe_charge_id: idOf(pi.latest_charge),
            livemode: pi.livemode,
            failure_code: null,
            failure_message: null,
          })
          .eq('id', donationId)
          .in('status', ['pending', 'failed', 'canceled']),
      );
      return { status: 'processed', donationId };
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      const donationId = await findDonationId(db, pi.id, pi.metadata?.donation_id);
      if (!donationId) return { status: 'ignored' };
      const err = pi.last_payment_error;
      await must(
        db
          .from('fund_donations')
          .update({
            status: 'failed',
            failure_code: err?.decline_code ?? err?.code ?? null,
            failure_message: err?.message?.slice(0, 500) ?? null,
          })
          .eq('id', donationId)
          .eq('status', 'pending'),
      );
      await autoBlockCardTesting(db, donationId);
      return { status: 'processed', donationId };
    }

    case 'payment_intent.canceled': {
      const pi = event.data.object;
      const donationId = await findDonationId(db, pi.id, pi.metadata?.donation_id);
      if (!donationId) return { status: 'ignored' };
      await must(db.from('fund_donations').update({ status: 'canceled' }).eq('id', donationId).eq('status', 'pending'));
      return { status: 'processed', donationId };
    }

    case 'charge.succeeded': {
      const charge = event.data.object;
      const donationId = await findDonationId(db, idOf(charge.payment_intent), charge.metadata?.donation_id);
      if (!donationId) return { status: 'ignored' };
      const risk = charge.outcome?.risk_level ?? null;
      const risky = risk === 'elevated' || risk === 'highest';
      const country = charge.payment_method_details?.card?.country ?? null;
      await must(
        db
          .from('fund_donations')
          .update({
            risk_level: risk,
            stripe_charge_id: charge.id,
            ...(country ? { country } : {}),
            ...(risky ? { is_flagged: true, flag_reason: `Stripe Radar risk: ${risk}` } : {}),
          })
          .eq('id', donationId),
      );
      return { status: 'processed', donationId };
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      const donationId = await findDonationId(db, idOf(charge.payment_intent), charge.metadata?.donation_id);
      if (!donationId) return { status: 'ignored' };
      if (charge.refunded) {
        // Full refund: unsettles the gift and returns its match dollars to the pools.
        await must(
          db
            .from('fund_donations')
            .update({ status: 'refunded', refunded_at: new Date().toISOString() })
            .eq('id', donationId)
            .in('status', ['succeeded', 'disputed', 'pending']),
        );
      } else {
        await must(
          db
            .from('fund_donations')
            .update({
              is_flagged: true,
              flag_reason: `Partial refund of $${(charge.amount_refunded / 100).toFixed(2)} — adjust amount if needed`,
            })
            .eq('id', donationId),
        );
      }
      return { status: 'processed', donationId };
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object;
      const donationId = await findDonationId(db, idOf(dispute.payment_intent));
      if (!donationId) return { status: 'ignored' };
      await must(
        db
          .from('fund_donations')
          .update({ status: 'disputed', is_flagged: true, flag_reason: `Dispute opened: ${dispute.reason}` })
          .eq('id', donationId)
          .eq('status', 'succeeded'),
      );
      return { status: 'processed', donationId };
    }

    case 'charge.dispute.closed': {
      const dispute = event.data.object;
      const donationId = await findDonationId(db, idOf(dispute.payment_intent));
      if (!donationId) return { status: 'ignored' };
      const won = dispute.status === 'won' || dispute.status === 'warning_closed';
      await must(
        db
          .from('fund_donations')
          .update(
            won
              ? { status: 'succeeded', flag_reason: `Dispute ${dispute.status}` }
              : { status: 'refunded', refunded_at: new Date().toISOString(), flag_reason: `Dispute ${dispute.status}` },
          )
          .eq('id', donationId)
          .eq('status', 'disputed'),
      );
      return { status: 'processed', donationId };
    }

    case 'radar.early_fraud_warning.created': {
      const warning = event.data.object;
      const donationId = await findDonationId(db, idOf(warning.payment_intent));
      if (!donationId) return { status: 'ignored' };
      await must(
        db
          .from('fund_donations')
          .update({ is_flagged: true, flag_reason: `Early fraud warning: ${warning.fraud_type}` })
          .eq('id', donationId),
      );
      return { status: 'processed', donationId };
    }

    case 'account.updated': {
      const account = event.data.object;
      await must(db.from('fund_organizations').update(accountStatus(account)).eq('stripe_account_id', account.id));
      return { status: 'processed' };
    }

    default:
      return { status: 'ignored' };
  }
}

/** Card-testing defense: 5+ failed attempts from one IP within an hour blocks it for 24h. */
async function autoBlockCardTesting(db: SupabaseClient, donationId: string) {
  const { data: d } = await db.from('fund_donations').select('ip_address').eq('id', donationId).maybeSingle<{ ip_address: string | null }>();
  if (!d?.ip_address) return;
  const { count } = await db
    .from('fund_donations')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', d.ip_address)
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) < 5) return;
  await db.from('fund_flagged_ips').upsert(
    {
      ip: d.ip_address,
      reason: `Auto-blocked: ${count} failed payments in 1 hour (possible card testing)`,
      is_blocked: true,
      hit_count: count ?? 0,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    },
    { onConflict: 'ip' },
  );
}
