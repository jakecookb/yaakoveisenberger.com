'use client';

import { useState, useTransition } from 'react';
import { Ban, Flag, FlagOff, Pencil, ShieldOff } from 'lucide-react';
import { blockIp, overrideDonation, unblockIp } from '@/lib/fund/actions/admin';
import { centsToDollarsInput, dollarsToCents, formatMoney } from '@/lib/fund/format';
import type { DonationRow, DonationStatus } from '@/lib/fund/types';
import { Button, Field, Input, Select, Switch, Textarea } from '../ui/primitives';
import { Modal } from '../ui/modal';
import { useToast } from '../ui/toast';

const STATUSES: DonationStatus[] = ['pending', 'succeeded', 'failed', 'canceled', 'refunded', 'disputed'];

/** Manual override of a donation. Every change re-settles totals in the DB and is written to the audit log. */
export function DonationOverrideButton({ donation }: { donation: DonationRow }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { result } = useToast();
  const [status, setStatus] = useState<DonationStatus>(donation.status);
  const [amount, setAmount] = useState(centsToDollarsInput(donation.amount_cents));
  const [flagged, setFlagged] = useState(donation.is_flagged);
  const [reason, setReason] = useState(donation.flag_reason ?? '');
  const [notes, setNotes] = useState(donation.notes ?? '');
  const [anonymous, setAnonymous] = useState(donation.is_anonymous);

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Override donation">
        <Pencil className="size-4" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Manual donation override" size="md">
        <form
          className="grid gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const patch: Parameters<typeof overrideDonation>[0] = { id: donation.id };
            if (status !== donation.status) patch.status = status;
            const cents = dollarsToCents(amount);
            if (cents !== donation.amount_cents) patch.amount_cents = cents;
            if (flagged !== donation.is_flagged) patch.is_flagged = flagged;
            if ((reason || null) !== donation.flag_reason) patch.flag_reason = reason || null;
            if ((notes || null) !== donation.notes) patch.notes = notes || null;
            if (anonymous !== donation.is_anonymous) patch.is_anonymous = anonymous;
            start(async () => {
              if (result(await overrideDonation(patch))) setOpen(false);
            });
          }}
        >
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <p className="font-medium text-slate-900">{donation.donor_name ?? 'Unknown donor'} · {formatMoney(donation.amount_cents, donation.currency)}</p>
            <p>{donation.donor_email ?? 'no email'} · {donation.source}{donation.stripe_payment_intent_id ? ` · ${donation.stripe_payment_intent_id}` : ''}</p>
          </div>
          <p className="text-xs text-amber-700">
            Overrides change platform records only — issue refunds in Stripe first (the webhook then updates this row automatically).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              {(id) => (
                <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as DonationStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Amount ($)" hint="Changing it re-runs matching.">{(id) => <Input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
          </div>
          <Switch checked={anonymous} onChange={setAnonymous} label="Show as anonymous" />
          <Switch checked={flagged} onChange={setFlagged} label="Flag for review" />
          {flagged && <Field label="Flag reason">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>}
          <Field label="Internal notes">{(id) => <Textarea id={id} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Apply override</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function FlagToggle({ donation }: { donation: Pick<DonationRow, 'id' | 'is_flagged'> }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => void result(await overrideDonation({ id: donation.id, is_flagged: !donation.is_flagged, ...(donation.is_flagged ? {} : { flag_reason: 'Flagged by admin' }) })))}
      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
      aria-label={donation.is_flagged ? 'Clear flag' : 'Flag'}
      title={donation.is_flagged ? 'Clear flag' : 'Flag for review'}
    >
      {donation.is_flagged ? <FlagOff className="size-4" /> : <Flag className="size-4" />}
    </button>
  );
}

export function BlockIpButton({ ip }: { ip: string }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  return (
    <button
      disabled={pending}
      onClick={() => window.confirm(`Block ${ip} from donating for 24 hours?`) && start(async () => void result(await blockIp(ip, 'Blocked from transaction monitor', 24)))}
      className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      aria-label={`Block ${ip}`}
      title="Block IP 24h"
    >
      <Ban className="size-4" />
    </button>
  );
}

export function UnblockIpButton({ ip }: { ip: string }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => void result(await unblockIp(ip)))}>
      <ShieldOff className="size-4" /> Unblock
    </Button>
  );
}

export function BlockIpForm() {
  const [pending, start] = useTransition();
  const { result } = useToast();
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState('24');
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          if (result(await blockIp(ip, reason, hours === 'forever' ? null : Number(hours)))) {
            setIp('');
            setReason('');
          }
        });
      }}
    >
      <Field label="IP address" className="w-44">{(id) => <Input id={id} required value={ip} onChange={(e) => setIp(e.target.value)} placeholder="203.0.113.7" className="h-9" />}</Field>
      <Field label="Reason" className="min-w-40 flex-1">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} className="h-9" />}</Field>
      <Field label="Duration" className="w-36">
        {(id) => (
          <Select id={id} value={hours} onChange={(e) => setHours(e.target.value)} className="h-9">
            <option value="1">1 hour</option>
            <option value="24">24 hours</option>
            <option value="168">7 days</option>
            <option value="forever">Permanent</option>
          </Select>
        )}
      </Field>
      <Button type="submit" size="sm" className="h-9" loading={pending}><Ban className="size-4" /> Block</Button>
    </form>
  );
}
