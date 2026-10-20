'use client';

import { useState, useTransition } from 'react';
import { Building2, CreditCard, ExternalLink, Plus, RefreshCw, Trash2, UserPlus, AlertTriangle } from 'lucide-react';
import { addOrgMember, removeOrgMember, saveOrganization } from '@/lib/fund/actions/admin';
import { slugify } from '@/lib/fund/format';
import type { OrganizationRow } from '@/lib/fund/types';
import { Badge, Button, Card, EmptyState, Field, Input, Select } from '../ui/primitives';
import { Modal } from '../ui/modal';
import { useToast } from '../ui/toast';

export interface OrgWithMembers extends OrganizationRow {
  members: { id: string; email: string; role: string; user_id: string | null }[];
  campaign_count: number;
}

/** Starts/continues Stripe Express onboarding or opens the Express dashboard. */
export function StripeConnectButtons({ org, next }: { org: Pick<OrganizationRow, 'id' | 'stripe_account_id' | 'stripe_charges_enabled'>; next: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();
  async function call(path: string, body: Record<string, unknown>, label: string) {
    setBusy(label);
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = (await res.json()) as { url?: string; error?: string; status?: unknown };
      if (!res.ok) toast(json.error ?? 'Stripe request failed', 'error');
      else if (json.url) window.location.href = json.url;
      else {
        toast('Stripe status refreshed', 'success');
        window.location.reload();
      }
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {!org.stripe_charges_enabled && (
        <Button size="sm" loading={busy === 'onboard'} onClick={() => call('/api/fund/stripe/connect', { orgId: org.id, next }, 'onboard')}>
          <CreditCard className="size-4" /> {org.stripe_account_id ? 'Continue Stripe onboarding' : 'Connect Stripe'}
        </Button>
      )}
      {org.stripe_account_id && (
        <>
          <Button size="sm" variant="secondary" loading={busy === 'dash'} onClick={() => call('/api/fund/stripe/dashboard', { orgId: org.id, action: 'dashboard' }, 'dash')}>
            <ExternalLink className="size-4" /> Payout dashboard
          </Button>
          <Button size="sm" variant="ghost" loading={busy === 'sync'} onClick={() => call('/api/fund/stripe/dashboard', { orgId: org.id, action: 'sync' }, 'sync')}>
            <RefreshCw className="size-4" /> Sync
          </Button>
        </>
      )}
    </div>
  );
}

export function StripeStatusBadge({ org }: { org: Pick<OrganizationRow, 'stripe_account_id' | 'stripe_charges_enabled' | 'stripe_payouts_enabled' | 'stripe_details_submitted'> }) {
  if (!org.stripe_account_id) return <Badge tone="neutral" dot>Not connected</Badge>;
  if (org.stripe_charges_enabled && org.stripe_payouts_enabled) return <Badge tone="success" dot>Payments & payouts on</Badge>;
  if (org.stripe_charges_enabled) return <Badge tone="warning" dot>Payments on · payouts pending</Badge>;
  return <Badge tone="warning" dot>{org.stripe_details_submitted ? 'Under review by Stripe' : 'Onboarding incomplete'}</Badge>;
}

function OrgForm({ org, onDone }: { org?: OrganizationRow; onDone: () => void }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  const [name, setName] = useState(org?.name ?? '');
  const [slug, setSlug] = useState(org?.slug ?? '');
  const [email, setEmail] = useState(org?.contact_email ?? '');
  const [ein, setEin] = useState(org?.ein ?? '');
  const [website, setWebsite] = useState(org?.website_url ?? '');
  const [logo, setLogo] = useState(org?.logo_url ?? '');
  const [fee, setFee] = useState(String((org?.platform_fee_bps ?? 500) / 100));
  const [status, setStatus] = useState<'active' | 'suspended'>(org?.status ?? 'active');
  return (
    <form
      className="grid gap-4 p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const ok = result(
            await saveOrganization({
              id: org?.id, name, slug: slug || slugify(name), contact_email: email, ein, website_url: website, logo_url: logo,
              platform_fee_bps: Math.round(Number(fee) * 100), status,
            }),
          );
          if (ok) onDone();
        });
      }}
    >
      <Field label="Nonprofit name" className="sm:col-span-2">{(id) => <Input id={id} required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="Short name (slug)">{(id) => <Input id={id} value={slug || slugify(name)} onChange={(e) => setSlug(slugify(e.target.value))} />}</Field>
      <Field label="EIN">{(id) => <Input id={id} value={ein} onChange={(e) => setEin(e.target.value)} placeholder="12-3456789" />}</Field>
      <Field label="Contact email" hint="Pre-fills Stripe onboarding.">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label="Website">{(id) => <Input id={id} type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />}</Field>
      <Field label="Logo URL">{(id) => <Input id={id} type="url" value={logo} onChange={(e) => setLogo(e.target.value)} />}</Field>
      <Field label="Platform fee (%)" hint="Default for this org's campaigns.">{(id) => <Input id={id} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />}</Field>
      <Field label="Status">
        {(id) => (
          <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'suspended')}>
            <option value="active">Active</option>
            <option value="suspended">Suspended (blocks online giving)</option>
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={pending}>{org ? 'Save' : 'Create organization'}</Button>
      </div>
    </form>
  );
}

function MemberRow({ m }: { m: OrgWithMembers['members'][number] }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="min-w-0 truncate">
        {m.email} <span className="text-slate-400">· {m.role}</span>
        {!m.user_id && <Badge tone="warning" className="ml-2">invited</Badge>}
      </span>
      <button
        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        disabled={pending}
        aria-label={`Remove ${m.email}`}
        onClick={() => window.confirm(`Remove ${m.email}?`) && start(async () => void result(await removeOrgMember(m.id)))}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function AddMember({ orgId }: { orgId: string }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'manager' | 'viewer'>('manager');
  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          if (result(await addOrgMember({ orgId, email, role }))) setEmail('');
        });
      }}
    >
      <Input type="email" required placeholder="manager@nonprofit.org" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 min-w-0 flex-1" aria-label="Member email" />
      <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="h-9 w-auto" aria-label="Role">
        <option value="owner">Owner</option>
        <option value="manager">Manager</option>
        <option value="viewer">Viewer</option>
      </Select>
      <Button type="submit" size="sm" className="h-9" loading={pending}><UserPlus className="size-4" /> Invite</Button>
    </form>
  );
}

export function OrganizationManager({ orgs, stripeReady }: { orgs: OrgWithMembers[]; stripeReady: boolean }) {
  const [editing, setEditing] = useState<OrganizationRow | 'new' | null>(null);
  return (
    <div className="space-y-4">
      {!stripeReady && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Add <code>STRIPE_SECRET_KEY</code> and <code>SUPABASE_SECRET_KEY</code> to enable Stripe Connect onboarding.
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}><Plus className="size-4" /> New organization</Button>
      </div>
      {orgs.length === 0 ? (
        <Card><EmptyState icon={<Building2 className="size-8" />} title="No organizations yet" description="Create a nonprofit, invite its managers, and connect Stripe for payouts." /></Card>
      ) : (
        orgs.map((org) => (
          <Card key={org.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {org.logo_url ? <img src={org.logo_url} alt="" className="size-11 rounded-xl border border-slate-200 object-contain" /> : <span className="flex size-11 items-center justify-center rounded-xl bg-slate-100"><Building2 className="size-5 text-slate-500" /></span>}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{org.name} {org.status === 'suspended' && <Badge tone="danger">suspended</Badge>}</p>
                  <p className="text-sm text-slate-500">
                    {org.campaign_count} campaign{org.campaign_count === 1 ? '' : 's'} · fee {org.platform_fee_bps / 100}%{org.ein ? ` · EIN ${org.ein}` : ''}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(org)}>Edit</Button>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">Stripe Connect</p>
                  <StripeStatusBadge org={org} />
                </div>
                {org.stripe_account_id && <p className="mt-1 font-mono text-xs text-slate-500">{org.stripe_account_id}</p>}
                {(org.stripe_requirements?.currently_due?.length ?? 0) > 0 && (
                  <p className="mt-2 text-xs text-amber-700">Stripe needs: {org.stripe_requirements!.currently_due!.slice(0, 4).join(', ').replace(/_/g, ' ')}</p>
                )}
                <div className="mt-3"><StripeConnectButtons org={org} next="/fund/admin/organizations" /></div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-800">Campaign managers</p>
                {org.members.length ? (
                  <ul className="mt-1 divide-y divide-slate-100">{org.members.map((m) => <MemberRow key={m.id} m={m} />)}</ul>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">No one yet.</p>
                )}
                <AddMember orgId={org.id} />
              </div>
            </div>
          </Card>
        ))
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New organization' : 'Edit organization'} size="lg">
        {editing !== null && <OrgForm org={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
