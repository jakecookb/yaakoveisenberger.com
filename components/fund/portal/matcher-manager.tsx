'use client';

import { useState, useTransition } from 'react';
import { Handshake, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { deleteMatcher, saveMatcher, setMatcherStatus } from '@/lib/fund/actions/portal';
import { centsToDollarsInput, dollarsToCents, formatDateTime, formatMoney, ratioLabel, toLocalInput } from '@/lib/fund/format';
import type { MatcherRow } from '@/lib/fund/types';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, StatusBadge, Switch, Textarea } from '../ui/primitives';
import { Meter } from '../ui/stat';
import { Modal } from '../ui/modal';
import { useToast } from '../ui/toast';

const RATIOS = [
  { value: '1', label: '$1 = $2 (1:1 — doubles every gift)' },
  { value: '2', label: '$1 = $3 (2:1 — triples)' },
  { value: '3', label: '$1 = $4 (3:1 — quadruples)' },
  { value: '4', label: '$1 = $5 (4:1)' },
  { value: '0.5', label: '$1 = $1.50 (50% match)' },
  { value: 'custom', label: 'Custom ratio…' },
];

function MatcherForm({ campaignId, matcher, nextPriority, onDone }: { campaignId: string; matcher?: MatcherRow; nextPriority: number; onDone: () => void }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  const initialRatio = matcher ? String(Number(matcher.ratio)) : '1';
  const preset = RATIOS.some((r) => r.value === initialRatio);
  const [name, setName] = useState(matcher?.name ?? '');
  const [displayName, setDisplayName] = useState(matcher?.display_name ?? '');
  const [anonymous, setAnonymous] = useState(matcher?.is_anonymous ?? false);
  const [ratioChoice, setRatioChoice] = useState(preset ? initialRatio : 'custom');
  const [customRatio, setCustomRatio] = useState(preset ? '' : initialRatio);
  const [pledge, setPledge] = useState(centsToDollarsInput(matcher?.pledge_cents ?? null));
  const [priority, setPriority] = useState(String(matcher?.priority ?? nextPriority));
  const [startsAt, setStartsAt] = useState(toLocalInput(matcher?.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(matcher?.ends_at));
  const [message, setMessage] = useState(matcher?.message ?? '');
  const [logo, setLogo] = useState(matcher?.logo_url ?? '');
  const [pledgeStatus, setPledgeStatus] = useState<MatcherRow['pledge_status']>(matcher?.pledge_status ?? 'pledged');
  const [contactName, setContactName] = useState(matcher?.contact_name ?? '');
  const [contactEmail, setContactEmail] = useState(matcher?.contact_email ?? '');
  const [contactPhone, setContactPhone] = useState(matcher?.contact_phone ?? '');
  const [notes, setNotes] = useState(matcher?.notes ?? '');
  const ratio = Number(ratioChoice === 'custom' ? customRatio : ratioChoice);

  return (
    <form
      className="grid gap-4 p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const ok = result(
            await saveMatcher({
              id: matcher?.id, campaignId, name, display_name: displayName, is_anonymous: anonymous, logo_url: logo, message,
              ratio, pledge_cents: dollarsToCents(pledge), priority: Number(priority) || 100,
              starts_at: startsAt ? new Date(startsAt).toISOString() : null, ends_at: endsAt ? new Date(endsAt).toISOString() : null,
              status: matcher?.status ?? 'active', pledge_status: pledgeStatus,
              contact_name: contactName, contact_email: contactEmail, contact_phone: contactPhone, notes,
            }),
          );
          if (ok) onDone();
        });
      }}
    >
      <Field label="Matcher name (internal)">{(id) => <Input id={id} required value={name} onChange={(e) => setName(e.target.value)} placeholder="The Goldberg Family Foundation" />}</Field>
      <Field label="Public display name" hint="Leave blank to use the name.">{(id) => <Input id={id} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}</Field>
      <Field label="Match ratio" className="sm:col-span-2">
        {(id) => (
          <div className="flex gap-2">
            <Select id={id} value={ratioChoice} onChange={(e) => setRatioChoice(e.target.value)}>
              {RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
            {ratioChoice === 'custom' && <Input aria-label="Custom ratio" className="w-32" inputMode="decimal" placeholder="e.g. 1.5" value={customRatio} onChange={(e) => setCustomRatio(e.target.value)} />}
          </div>
        )}
      </Field>
      <Field label="Pledged match pool ($)" hint={ratio > 0 && pledge ? `Matches the first ${formatMoney(Math.ceil(dollarsToCents(pledge) / ratio))} donated at ${ratioLabel(ratio)}.` : undefined}>
        {(id) => <Input id={id} required inputMode="decimal" value={pledge} onChange={(e) => setPledge(e.target.value)} placeholder="50000" />}
      </Field>
      <Field label="Tier order (priority)" hint="Lower numbers are drawn first. Put a 3x power hour before a 1x base match.">
        {(id) => <Input id={id} type="number" min={0} value={priority} onChange={(e) => setPriority(e.target.value)} />}
      </Field>
      <Field label="Active from (optional)">{(id) => <Input id={id} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}</Field>
      <Field label="Active until (optional)" hint="Great for “power hours”.">{(id) => <Input id={id} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />}</Field>
      <Field label="Public message">{(id) => <Input id={id} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Proud to double every gift!" />}</Field>
      <Field label="Logo URL">{(id) => <Input id={id} type="url" value={logo} onChange={(e) => setLogo(e.target.value)} />}</Field>
      <div className="sm:col-span-2"><Switch checked={anonymous} onChange={setAnonymous} label="Show as “Anonymous Matcher” publicly" /></div>
      <fieldset className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium text-slate-700">Offline pledge tracking (private)</legend>
        <Field label="Pledge status">
          {(id) => (
            <Select id={id} value={pledgeStatus} onChange={(e) => setPledgeStatus(e.target.value as MatcherRow['pledge_status'])}>
              <option value="pledged">Pledged</option>
              <option value="invoiced">Invoiced</option>
              <option value="collected">Collected</option>
            </Select>
          )}
        </Field>
        <Field label="Contact name">{(id) => <Input id={id} value={contactName} onChange={(e) => setContactName(e.target.value)} />}</Field>
        <Field label="Contact email">{(id) => <Input id={id} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />}</Field>
        <Field label="Contact phone">{(id) => <Input id={id} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />}</Field>
        <Field label="Notes" className="sm:col-span-2">{(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </fieldset>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={pending}>{matcher ? 'Save matcher' : 'Add matcher'}</Button>
      </div>
    </form>
  );
}

function MatcherRowItem({ m, campaignId, canManage, onEdit, now }: { m: MatcherRow; campaignId: string; canManage: boolean; onEdit: () => void; now: number }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  const remaining = m.pledge_cents - m.matched_cents;
  const upcoming = m.starts_at && Date.parse(m.starts_at) > now;
  const ended = m.ends_at && Date.parse(m.ends_at) <= now;
  return (
    <li className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_260px_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-900">{m.display_name || m.name}</p>
          <Badge tone="accent">{ratioLabel(Number(m.ratio))}</Badge>
          <StatusBadge status={m.status} />
          {upcoming && <Badge tone="info">starts {formatDateTime(m.starts_at)}</Badge>}
          {ended && <Badge>window ended</Badge>}
          {m.is_anonymous && <Badge>anonymous</Badge>}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Tier {m.priority} · pledge {m.pledge_status}
          {m.contact_name ? ` · ${m.contact_name}` : ''}
          {m.ends_at && !ended ? ` · until ${formatDateTime(m.ends_at)}` : ''}
        </p>
      </div>
      <div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>{formatMoney(m.matched_cents)} matched</span>
          <span>{formatMoney(remaining)} left</span>
        </div>
        <Meter value={m.matched_cents} max={m.pledge_cents} className="mt-1.5" label={`${m.name} pool`} />
        <p className="mt-1 text-right text-xs text-slate-400">of {formatMoney(m.pledge_cents)}</p>
      </div>
      {canManage && (
        <div className="flex gap-1 md:justify-end">
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit"><Pencil className="size-4" /></Button>
          <Button size="sm" variant="ghost" loading={pending} aria-label={m.status === 'active' ? 'Pause' : 'Resume'} onClick={() => start(async () => void result(await setMatcherStatus(campaignId, m.id, m.status === 'active' ? 'paused' : 'active')))}>
            {m.status === 'active' ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => window.confirm(`Remove ${m.name}?`) && start(async () => void result(await deleteMatcher(campaignId, m.id)))}>
            <Trash2 className="size-4 text-red-500" />
          </Button>
        </div>
      )}
    </li>
  );
}

export function MatcherManager({ campaignId, matchers, canManage, now }: { campaignId: string; matchers: MatcherRow[]; canManage: boolean; now: number }) {
  const [editing, setEditing] = useState<MatcherRow | 'new' | null>(null);
  const pledged = matchers.filter((m) => m.status === 'active').reduce((s, m) => s + m.pledge_cents, 0);
  const matched = matchers.reduce((s, m) => s + m.matched_cents, 0);
  const nextPriority = (matchers.reduce((mx, m) => Math.max(mx, m.priority), 0) || 0) + 10;
  return (
    <Card>
      <CardHeader
        title="Matchers"
        description={`${formatMoney(pledged)} pledged · ${formatMoney(matched)} matched so far · pools are drawn in tier order`}
        action={canManage && <Button size="sm" onClick={() => setEditing('new')}><Plus className="size-4" /> Add matcher</Button>}
      />
      {matchers.length === 0 ? (
        <EmptyState icon={<Handshake className="size-8" />} title="No matchers yet" description="Add a sponsor's pledge and ratio — every online and offline gift is matched automatically until the pool runs out." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {matchers.map((m) => <MatcherRowItem key={m.id} m={m} campaignId={campaignId} canManage={canManage} onEdit={() => setEditing(m)} now={now} />)}
        </ul>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add matcher' : 'Edit matcher'} size="lg">
        {editing !== null && <MatcherForm campaignId={campaignId} matcher={editing === 'new' ? undefined : editing} nextPriority={nextPriority} onDone={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}
