'use client';

import { useState, useTransition } from 'react';
import { Banknote, Ban } from 'lucide-react';
import { recordOfflineDonation, voidOfflineDonation } from '@/lib/fund/actions/portal';
import { dollarsToCents, toLocalInput } from '@/lib/fund/format';
import type { AmbassadorRow, TeamRow } from '@/lib/fund/types';
import { Button, Card, CardHeader, Field, Input, Select, Switch, Textarea } from '../ui/primitives';
import { useToast } from '../ui/toast';

const SOURCES = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'wire', label: 'Wire / bank transfer' },
  { value: 'daf', label: 'Donor-advised fund' },
  { value: 'other', label: 'Other' },
] as const;

/** Cash / check / wire entry — settles instantly and pushes to the thermometer and big screens. */
export function OfflineDonationForm({ campaignId, teams, ambassadors }: { campaignId: string; teams: TeamRow[]; ambassadors: AmbassadorRow[] }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  const blank = { amount: '', source: 'check' as (typeof SOURCES)[number]['value'], reference: '', name: '', email: '', phone: '', anonymous: false, message: '', team: '', ambassador: '', match: true, received: '', notes: '' };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Card>
      <CardHeader title="Record an offline gift" description="Cash, checks and wires appear on the public page and big screen within a second." />
      <form
        className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const ok = result(
              await recordOfflineDonation({
                campaignId, amount_cents: dollarsToCents(f.amount), source: f.source, reference: f.reference, donor_name: f.name, donor_email: f.email, donor_phone: f.phone,
                is_anonymous: f.anonymous, message: f.message, team_id: f.team || null, ambassador_id: f.ambassador || null, apply_match: f.match,
                received_at: f.received ? new Date(f.received).toISOString() : null, notes: f.notes,
              }),
            );
            if (ok) setF({ ...blank, source: f.source });
          });
        }}
      >
        <Field label="Amount ($)">{(id) => <Input id={id} required inputMode="decimal" value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="1800" className="text-base font-semibold" />}</Field>
        <Field label="Method">
          {(id) => (
            <Select id={id} value={f.source} onChange={(e) => set('source', e.target.value as typeof f.source)}>
              {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label={f.source === 'check' ? 'Check #' : 'Reference'}>{(id) => <Input id={id} value={f.reference} onChange={(e) => set('reference', e.target.value)} />}</Field>
        <Field label="Date received">{(id) => <Input id={id} type="datetime-local" value={f.received} max={toLocalInput(new Date().toISOString())} onChange={(e) => set('received', e.target.value)} />}</Field>
        <Field label="Donor name">{(id) => <Input id={id} value={f.name} onChange={(e) => set('name', e.target.value)} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />}</Field>
        <Field label="Team">
          {(id) => (
            <Select id={id} value={f.team} onChange={(e) => set('team', e.target.value)}>
              <option value="">None</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Ambassador">
          {(id) => (
            <Select id={id} value={f.ambassador} onChange={(e) => set('ambassador', e.target.value)}>
              <option value="">None</option>
              {ambassadors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Public message (optional)" className="sm:col-span-2">{(id) => <Input id={id} maxLength={500} value={f.message} onChange={(e) => set('message', e.target.value)} />}</Field>
        <Field label="Internal notes" className="sm:col-span-2">{(id) => <Textarea id={id} rows={1} value={f.notes} onChange={(e) => set('notes', e.target.value)} className="min-h-10" />}</Field>
        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-3 lg:flex-row lg:gap-8">
          <Switch checked={f.match} onChange={(v) => set('match', v)} label="Apply matching" description="Draws from active match pools." />
          <Switch checked={f.anonymous} onChange={(v) => set('anonymous', v)} label="Anonymous on public displays" />
        </div>
        <div className="flex items-end">
          <Button type="submit" loading={pending} className="w-full"><Banknote className="size-4" /> Record gift</Button>
        </div>
      </form>
    </Card>
  );
}

export function VoidDonationButton({ campaignId, donationId }: { campaignId: string; donationId: string }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  return (
    <button
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      onClick={() => window.confirm('Void this offline gift? Totals and match pools are restored.') && start(async () => void result(await voidOfflineDonation(campaignId, donationId)))}
    >
      <Ban className="size-3.5" /> Void
    </button>
  );
}
