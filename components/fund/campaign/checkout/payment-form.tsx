'use client';

import { useRef, useState } from 'react';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Lock } from 'lucide-react';
import { formatMoney } from '@/lib/fund/format';
import { TURNSTILE_SITE_KEY } from '@/lib/fund/env';
import { Button } from '../../ui/primitives';
import { Turnstile } from './turnstile';

export interface CheckoutPayload {
  campaignId: string;
  amountCents: number;
  coverFees: boolean;
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  isAnonymous: boolean;
  message?: string;
  teamId?: string | null;
  ambassadorId?: string | null;
  linkId?: string | null;
}

/**
 * Deferred-intent Payment Element: the card / wallet / bank form renders immediately;
 * on submit we validate, create the PaymentIntent server-side, then confirm. Card data
 * stays inside Stripe's iframe (PCI SAQ-A).
 */
export function PaymentForm({
  payload,
  totalCents,
  currency,
  slug,
  onSuccess,
}: {
  payload: CheckoutPayload;
  totalCents: number;
  currency: string;
  slug: string;
  onSuccess: (status: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  // Reuse the same PaymentIntent when a card is declined and the donor retries.
  const intent = useRef<{ key: string; clientSecret: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || busy) return;
    if (TURNSTILE_SITE_KEY && !token) {
      setError('Please complete the security check.');
      return;
    }
    setBusy(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? 'Please check your payment details.');
      setBusy(false);
      return;
    }

    const key = JSON.stringify(payload);
    let clientSecret = intent.current?.key === key ? intent.current.clientSecret : null;
    if (!clientSecret) {
      const res = await fetch('/api/fund/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, turnstileToken: token ?? undefined }),
      });
      const json = (await res.json().catch(() => ({}))) as { clientSecret?: string; error?: string };
      if (!res.ok || !json.clientSecret) {
        setError(json.error ?? 'Could not start payment. Please try again.');
        setBusy(false);
        setResetKey((k) => k + 1);
        return;
      }
      clientSecret = json.clientSecret;
      intent.current = { key, clientSecret };
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: `${window.location.origin}/fund/${slug}?donation=complete` },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Your payment could not be completed.');
      setBusy(false);
      return;
    }
    if (paymentIntent && ['succeeded', 'processing', 'requires_capture'].includes(paymentIntent.status)) {
      onSuccess(paymentIntent.status);
    } else {
      setError('Payment was not completed. Please try another method.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement options={{ layout: { type: 'tabs' } }} />
      <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setToken} resetKey={resetKey} />
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!stripe}>
        <Lock className="size-4" aria-hidden /> Donate {formatMoney(totalCents, currency, { cents: totalCents % 100 !== 0 })}
      </Button>
      <p className="text-center text-xs text-slate-500">Payments are encrypted and processed securely by Stripe.</p>
    </form>
  );
}
