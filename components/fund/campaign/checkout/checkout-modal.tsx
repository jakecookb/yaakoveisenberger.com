'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { ArrowLeft, CheckCircle2, Heart, Sparkles } from 'lucide-react';
import { STRIPE_PUBLISHABLE_KEY, SITE_URL } from '@/lib/fund/env';
import { formatMoney, multiplierLabel, ratioLabel, dollarsToCents } from '@/lib/fund/format';
import { currentMatcher, feeCoverCents, previewMatch } from '@/lib/fund/matching';
import type { DonationBroadcast, PublicCampaign } from '@/lib/fund/types';
import { Modal } from '../../ui/modal';
import { Button, Field, Input, Select, Switch, Textarea } from '../../ui/primitives';
import { cn } from '../../ui/cn';
import { ShareButtons } from '../share-buttons';
import { PaymentForm, type CheckoutPayload } from './payment-form';

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => (stripePromise ??= STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : Promise.resolve(null));

export interface CheckoutPreset {
  amountCents?: number;
  teamId?: string | null;
  ambassadorId?: string | null;
  linkId?: string | null;
}

export interface FeeConfig {
  percent: number;
  fixedCents: number;
}

type Step = 1 | 2 | 3 | 'done';
const STEPS = ['Amount', 'Details', 'Payment'] as const;

export function CheckoutModal({
  open,
  onClose,
  data,
  preset,
  feeConfig,
  paymentsEnabled,
  onDemoDonation,
  now,
}: {
  open: boolean;
  onClose: () => void;
  data: PublicCampaign;
  preset: CheckoutPreset;
  feeConfig: FeeConfig;
  paymentsEnabled: boolean;
  onDemoDonation: (b: DonationBroadcast) => void;
  now: number;
}) {
  const { campaign, organization, matchers, teams, ambassadors } = data;
  const currency = campaign.currency;
  const [step, setStep] = useState<Step>(1);
  const [amountCents, setAmountCents] = useState<number>(preset.amountCents ?? campaign.preset_amounts[2] ?? campaign.preset_amounts[0] ?? 18000);
  const [custom, setCustom] = useState(preset.amountCents && !campaign.preset_amounts.includes(preset.amountCents) ? String(preset.amountCents / 100) : '');
  const [coverFees, setCoverFees] = useState(campaign.allow_fee_cover);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState('');
  const [teamId, setTeamId] = useState<string>(preset.teamId ?? '');
  const [ambassadorId, setAmbassadorId] = useState<string>(preset.ambassadorId ?? '');
  const [touched, setTouched] = useState(false);
  const [doneStatus, setDoneStatus] = useState<string>('succeeded');

  // Re-apply presets each time the modal opens (e.g. "Donate" on a specific team).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setStep(1);
      setTouched(false);
      if (preset.amountCents) {
        setAmountCents(preset.amountCents);
        setCustom(campaign.preset_amounts.includes(preset.amountCents) ? '' : String(preset.amountCents / 100));
      }
      setTeamId(preset.teamId ?? '');
      setAmbassadorId(preset.ambassadorId ?? '');
    }, 0);
    return () => clearTimeout(t);
  }, [open, preset.amountCents, preset.teamId, preset.ambassadorId, campaign.preset_amounts]);

  const live = currentMatcher(matchers, new Date(now));
  const match = useMemo(() => previewMatch(amountCents, matchers, new Date(now)), [amountCents, matchers, now]);
  const cover = coverFees && campaign.allow_fee_cover ? feeCoverCents(amountCents, feeConfig.percent, feeConfig.fixedCents) : 0;
  const totalCents = amountCents + cover;
  const amountError =
    amountCents < campaign.min_donation_cents
      ? `Minimum gift is ${formatMoney(campaign.min_donation_cents, currency)}`
      : amountCents > campaign.max_donation_cents
        ? `For gifts over ${formatMoney(campaign.max_donation_cents, currency)} please contact ${organization.name}`
        : null;
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const detailsError = !name.trim() ? 'Please enter your name' : !emailValid ? 'Please enter a valid email for your receipt' : null;

  const payload: CheckoutPayload = {
    campaignId: campaign.id,
    amountCents,
    coverFees: cover > 0,
    donorName: name.trim(),
    donorEmail: email.trim(),
    donorPhone: phone.trim() || undefined,
    isAnonymous: anonymous,
    message: message.trim() || undefined,
    teamId: teamId || null,
    ambassadorId: ambassadorId || null,
    linkId: preset.linkId ?? null,
  };

  const simulate = () => {
    const team = teams.find((t) => t.id === teamId) ?? null;
    onDemoDonation({
      donation: {
        id: `demo-local-${Date.now()}`, name: anonymous ? 'Anonymous' : name.trim() || 'You', is_anonymous: anonymous,
        amount_cents: amountCents, matched_cents: match.matchCents, message: message.trim() || null,
        team_id: team?.id ?? null, team_name: team?.name ?? null, ambassador_id: null, ambassador_name: null, offline: false,
        created_at: new Date().toISOString(),
      },
      totals: {
        ...data.totals,
        raised_cents: data.totals.raised_cents + amountCents,
        matched_cents: data.totals.matched_cents + match.matchCents,
        total_cents: data.totals.total_cents + amountCents + match.matchCents,
        donation_count: data.totals.donation_count + 1,
        match_remaining_cents: Math.max(0, data.totals.match_remaining_cents - match.matchCents),
        server_time: new Date().toISOString(),
      },
      team: team ? { id: team.id, raised_cents: team.raised_cents + amountCents + match.matchCents, donation_count: team.donation_count + 1 } : null,
      ambassador: null,
    });
    setDoneStatus('succeeded');
    setStep('done');
  };

  const elementsOptions = useMemo(
    () => ({
      mode: 'payment' as const,
      amount: totalCents,
      currency,
      appearance: {
        theme: 'stripe' as const,
        variables: { colorPrimary: campaign.theme_color, borderRadius: '12px', fontFamily: 'ui-sans-serif, system-ui, sans-serif' },
      },
    }),
    [totalCents, currency, campaign.theme_color],
  );

  const stepIndex = step === 'done' ? 3 : step;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      themeColor={campaign.theme_color}
      labelledBy="fund-checkout-title"
      title={
        step === 'done' ? (
          'Thank you!'
        ) : (
          <div className="flex items-center gap-3">
            {step !== 1 && (
              <button onClick={() => setStep((s) => (s === 3 ? 2 : 1))} className="-ml-1 rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Back">
                <ArrowLeft className="size-4" />
              </button>
            )}
            <span>Donate to {campaign.title}</span>
          </div>
        )
      }
    >
      {step !== 'done' && (
        <ol className="flex gap-2 px-5 pt-4" aria-label="Checkout steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <div className={cn('h-1 rounded-full transition-colors', i < stepIndex ? 'bg-[var(--fund-accent)]' : 'bg-slate-200')} />
              <p className={cn('mt-1.5 text-xs', i + 1 === stepIndex ? 'font-medium text-slate-900' : 'text-slate-500')}>
                {i + 1}. {label}
              </p>
            </li>
          ))}
        </ol>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={String(step)} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="p-5">
          {step === 1 && (
            <div className="space-y-5">
              {live && (
                <div className="flex items-center gap-3 rounded-2xl bg-[var(--fund-accent-soft)] px-4 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fund-accent)] text-sm font-bold text-white">{multiplierLabel(live.ratio)}</span>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{ratioLabel(live.ratio)}</span> right now, thanks to {live.name}.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {campaign.preset_amounts.map((a) => {
                  const impact = previewMatch(a, matchers, new Date(now)).impactCents;
                  const selected = !custom && amountCents === a;
                  return (
                    <button
                      key={a}
                      onClick={() => {
                        setAmountCents(a);
                        setCustom('');
                      }}
                      className={cn(
                        'rounded-2xl border px-2 py-3 text-center transition',
                        selected ? 'border-[var(--fund-accent)] bg-[var(--fund-accent-soft)] ring-2 ring-[var(--fund-accent)]' : 'border-slate-200 hover:border-slate-400',
                      )}
                      aria-pressed={selected}
                    >
                      <span className="block text-lg font-semibold text-slate-900">{formatMoney(a, currency)}</span>
                      {impact > a && <span className="block text-xs text-[var(--fund-accent-strong)]">becomes {formatMoney(impact, currency)}</span>}
                    </button>
                  );
                })}
              </div>
              <Field label="Or enter an amount" error={touched ? (amountError ?? undefined) : undefined}>
                {(id) => (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <Input
                      id={id}
                      inputMode="decimal"
                      placeholder="Other amount"
                      className="pl-7 text-base"
                      value={custom}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, '');
                        setCustom(v);
                        setAmountCents(dollarsToCents(v));
                      }}
                      onBlur={() => setTouched(true)}
                    />
                  </div>
                )}
              </Field>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-600">Your gift</span>
                  <span className="font-semibold">{formatMoney(amountCents, currency)}</span>
                </div>
                {match.tiers.map((t) => (
                  <div key={t.matcherId} className="mt-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">
                      {t.name} <span className="text-slate-400">({ratioLabel(t.ratio)})</span>
                    </span>
                    <span className="font-medium text-[var(--fund-accent-strong)]">+{formatMoney(t.matchCents, currency)}</span>
                  </div>
                ))}
                <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                    <Sparkles className="size-4 text-amber-500" aria-hidden /> Total impact
                  </span>
                  <span className="text-xl font-bold text-slate-900">{formatMoney(match.impactCents, currency)}</span>
                </div>
              </div>

              {campaign.allow_fee_cover && amountCents > 0 && (
                <Switch
                  checked={coverFees}
                  onChange={setCoverFees}
                  label={`Add ${formatMoney(feeCoverCents(amountCents, feeConfig.percent, feeConfig.fixedCents), currency, { cents: true })} to cover processing fees`}
                  description={`So 100% of your gift goes to ${organization.name}.`}
                />
              )}
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  setTouched(true);
                  if (!amountError) setStep(2);
                }}
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" error={touched && !name.trim() ? 'Required' : undefined}>
                  {(id) => <Input id={id} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />}
                </Field>
                <Field label="Email (for your receipt)" error={touched && !emailValid ? 'Enter a valid email' : undefined}>
                  {(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
                </Field>
              </div>
              <Field label="Phone (optional)">
                {(id) => <Input id={id} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
              </Field>
              {campaign.allow_anonymous && (
                <Switch checked={anonymous} onChange={setAnonymous} label="Give anonymously" description="Your name won't appear on the public donor wall or big screen." />
              )}
              <Field label="Message or dedication (optional)" hint={`${message.length}/500 · shown publicly with your gift`}>
                {(id) => <Textarea id={id} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="In honor of…" />}
              </Field>
              {teams.length > 0 && (
                <Field label="Credit a team (optional)">
                  {(id) => (
                    <Select id={id} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                      <option value="">No team</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
              {ambassadors.length > 0 && (
                <Field label="Referred by an ambassador? (optional)">
                  {(id) => (
                    <Select id={id} value={ambassadorId} onChange={(e) => setAmbassadorId(e.target.value)}>
                      <option value="">No ambassador</option>
                      {ambassadors.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  setTouched(true);
                  if (!detailsError) setStep(3);
                }}
              >
                Continue to payment
              </Button>
              {touched && detailsError && <p className="text-center text-sm text-red-600">{detailsError}</p>}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <dl className="space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between"><dt className="text-slate-600">Donation</dt><dd className="font-medium">{formatMoney(amountCents, currency)}</dd></div>
                {match.matchCents > 0 && (
                  <div className="flex justify-between"><dt className="text-slate-600">Matched by sponsors</dt><dd className="font-medium text-[var(--fund-accent-strong)]">+{formatMoney(match.matchCents, currency)}</dd></div>
                )}
                {cover > 0 && (
                  <div className="flex justify-between"><dt className="text-slate-600">Processing fee cover</dt><dd className="font-medium">{formatMoney(cover, currency, { cents: true })}</dd></div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2"><dt className="font-medium text-slate-900">You pay</dt><dd className="font-semibold">{formatMoney(totalCents, currency, { cents: totalCents % 100 !== 0 })}</dd></div>
              </dl>

              {data.demo ? (
                <div className="space-y-3">
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Demo mode — no payment is taken. Connect Supabase + Stripe to accept real donations.
                  </p>
                  <Button size="lg" className="w-full" onClick={simulate}>
                    <Heart className="size-4" aria-hidden /> Simulate this donation
                  </Button>
                </div>
              ) : !paymentsEnabled || !data.accepting_online ? (
                <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  Online giving opens as soon as {organization.name} finishes connecting their payout account. Please check back shortly.
                </p>
              ) : (
                <Elements stripe={getStripe()} options={elementsOptions}>
                  <PaymentForm
                    payload={payload}
                    totalCents={totalCents}
                    currency={currency}
                    slug={campaign.slug}
                    onSuccess={(status) => {
                      setDoneStatus(status);
                      setStep('done');
                    }}
                  />
                </Elements>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-5 text-center">
              <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="size-9 text-emerald-600" aria-hidden />
              </motion.div>
              <div>
                <p className="text-xl font-semibold text-slate-900">Thank you{name.trim() ? `, ${name.trim().split(' ')[0]}` : ''}!</p>
                <p className="mt-1 text-slate-600">
                  {doneStatus === 'processing'
                    ? 'Your payment is processing — it will appear on the page as soon as it clears.'
                    : match.matchCents > 0
                      ? `Your ${formatMoney(amountCents, currency)} gift became ${formatMoney(match.impactCents, currency)} with matching.`
                      : `Your ${formatMoney(amountCents, currency)} gift is on its way.`}
                </p>
                {email && <p className="mt-1 text-sm text-slate-500">A receipt is on its way to {email}.</p>}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Double your impact — share with friends</p>
                <ShareButtons url={`${SITE_URL}/fund/${campaign.slug}`} title={campaign.title} className="justify-center" />
              </div>
              <Button variant="secondary" className="w-full" onClick={onClose}>Done</Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}
