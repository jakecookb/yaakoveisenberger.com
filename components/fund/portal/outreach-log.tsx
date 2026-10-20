'use client';

import { useState, useTransition } from 'react';
import { CalendarClock, PhoneCall, Plus, Trash2 } from 'lucide-react';
import { deleteOutreach, saveOutreach } from '@/lib/fund/actions/portal';
import { dollarsToCents, formatDateTime, formatMoney } from '@/lib/fund/format';
import type { AmbassadorRow, OutreachRow } from '@/lib/fund/types';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Textarea } from '../ui/primitives';
import { Table, Td, Th } from '../dashboard/table';
import { useToast } from '../ui/toast';

const CHANNELS = ['call', 'email', 'sms', 'whatsapp', 'in_person', 'other'] as const;
const OUTCOMES = ['follow_up', 'no_answer', 'left_message', 'pledged', 'donated', 'declined'] as const;
const OUTCOME_TONE: Record<OutreachRow['outcome'], 'success' | 'warning' | 'neutral' | 'danger' | 'info'> = {
  donated: 'success', pledged: 'info', follow_up: 'warning', left_message: 'neutral', no_answer: 'neutral', declined: 'danger',
};

export function OutreachLog({ campaignId, logs, ambassadors, canManage, now }: { campaignId: string; logs: OutreachRow[]; ambassadors: AmbassadorRow[]; canManage: boolean; now: number }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  const [filter, setFilter] = useState<'all' | 'due' | OutreachRow['outcome']>('all');
  const [form, setForm] = useState({ contact_name: '', contact_email: '', contact_phone: '', channel: 'call' as OutreachRow['channel'], outcome: 'follow_up' as OutreachRow['outcome'], pledge: '', notes: '', follow_up_at: '', ambassador_id: '' });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const due = logs.filter((l) => l.follow_up_at && Date.parse(l.follow_up_at) <= now + 86_400_000 && !['donated', 'declined'].includes(l.outcome));
  const shown = filter === 'all' ? logs : filter === 'due' ? due : logs.filter((l) => l.outcome === filter);
  const pledged = logs.filter((l) => l.outcome === 'pledged').reduce((s, l) => s + (l.pledge_cents ?? 0), 0);
  const ambName = new Map(ambassadors.map((a) => [a.id, a.name]));

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      {canManage && (
        <Card className="self-start">
          <CardHeader title="Log outreach" description="Calls, texts and visits to prospective donors." />
          <form
            className="grid gap-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const ok = result(
                  await saveOutreach({
                    campaignId, contact_name: form.contact_name, contact_email: form.contact_email, contact_phone: form.contact_phone, channel: form.channel, outcome: form.outcome,
                    pledge_cents: form.pledge ? dollarsToCents(form.pledge) : null, notes: form.notes, follow_up_at: form.follow_up_at ? new Date(form.follow_up_at).toISOString() : null, ambassador_id: form.ambassador_id || null,
                  }),
                );
                if (ok) setForm((f) => ({ ...f, contact_name: '', contact_email: '', contact_phone: '', pledge: '', notes: '', follow_up_at: '' }));
              });
            }}
          >
            <Field label="Contact name">{(id) => <Input id={id} required value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">{(id) => <Input id={id} type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} />}</Field>
              <Field label="Phone">{(id) => <Input id={id} value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />}</Field>
              <Field label="Channel">
                {(id) => (
                  <Select id={id} value={form.channel} onChange={(e) => set('channel', e.target.value as OutreachRow['channel'])}>
                    {CHANNELS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Outcome">
                {(id) => (
                  <Select id={id} value={form.outcome} onChange={(e) => set('outcome', e.target.value as OutreachRow['outcome'])}>
                    {OUTCOMES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Pledge ($)">{(id) => <Input id={id} inputMode="decimal" value={form.pledge} onChange={(e) => set('pledge', e.target.value)} />}</Field>
              <Field label="Follow up">{(id) => <Input id={id} type="datetime-local" value={form.follow_up_at} onChange={(e) => set('follow_up_at', e.target.value)} />}</Field>
            </div>
            {ambassadors.length > 0 && (
              <Field label="Ambassador (who reached out)">
                {(id) => (
                  <Select id={id} value={form.ambassador_id} onChange={(e) => set('ambassador_id', e.target.value)}>
                    <option value="">—</option>
                    {ambassadors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                )}
              </Field>
            )}
            <Field label="Notes">{(id) => <Textarea id={id} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />}</Field>
            <Button type="submit" loading={pending}><Plus className="size-4" /> Save entry</Button>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader
          title={`Donor outreach (${logs.length})`}
          description={`${due.length} follow-ups due within 24h · ${formatMoney(pledged)} verbally pledged`}
          action={
            <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-9 w-auto" aria-label="Filter">
              <option value="all">All</option>
              <option value="due">Follow-ups due</option>
              {OUTCOMES.map((o) => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
            </Select>
          }
        />
        {shown.length === 0 ? (
          <EmptyState icon={<PhoneCall className="size-8" />} title="Nothing logged" description="Track every call so your team never double-asks a donor." />
        ) : (
          <Table>
            <thead><tr><Th>Contact</Th><Th>Channel</Th><Th>Outcome</Th><Th>Notes</Th><Th>Follow up</Th><Th /></tr></thead>
            <tbody>
              {shown.map((l) => {
                const overdue = l.follow_up_at && Date.parse(l.follow_up_at) < now && !['donated', 'declined'].includes(l.outcome);
                return (
                  <tr key={l.id}>
                    <Td>
                      <p className="font-medium text-slate-900">{l.contact_name}</p>
                      <p className="text-xs text-slate-500">{[l.contact_phone, l.contact_email].filter(Boolean).join(' · ')}</p>
                    </Td>
                    <Td className="text-xs">{l.channel.replace('_', ' ')}{l.ambassador_id ? <p className="text-slate-500">by {ambName.get(l.ambassador_id)}</p> : null}</Td>
                    <Td><Badge tone={OUTCOME_TONE[l.outcome]} dot>{l.outcome.replace('_', ' ')}</Badge>{l.pledge_cents ? <p className="mt-1 text-xs">{formatMoney(l.pledge_cents)}</p> : null}</Td>
                    <Td className="max-w-72 text-xs text-slate-600">{l.notes}</Td>
                    <Td className="whitespace-nowrap text-xs">
                      {l.follow_up_at ? (
                        <span className={overdue ? 'inline-flex items-center gap-1 font-medium text-red-600' : 'text-slate-600'}>
                          <CalendarClock className="size-3.5" /> {formatDateTime(l.follow_up_at)}
                        </span>
                      ) : '—'}
                      <p className="text-slate-400">logged {formatDateTime(l.created_at)}</p>
                    </Td>
                    <Td>
                      {canManage && (
                        <button className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete entry" onClick={() => window.confirm('Delete this entry?') && start(async () => void result(await deleteOutreach(campaignId, l.id)))}>
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
