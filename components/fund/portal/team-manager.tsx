'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, Pencil, Plus, Trash2, UserRound, Users } from 'lucide-react';
import { deleteAmbassador, deleteTeam, saveAmbassador, saveTeam } from '@/lib/fund/actions/portal';
import { SITE_URL } from '@/lib/fund/env';
import { centsToDollarsInput, dollarsToCents, formatMoney, slugify } from '@/lib/fund/format';
import type { AmbassadorRow, TeamRow } from '@/lib/fund/types';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Switch, Textarea } from '../ui/primitives';
import { Meter } from '../ui/stat';
import { Modal } from '../ui/modal';
import { useToast } from '../ui/toast';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => window.prompt('Copy', text));
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
    >
      {done ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />} {done ? 'Copied' : label}
    </button>
  );
}

function TeamForm({ campaignId, team, onDone }: { campaignId: string; team?: TeamRow; onDone: () => void }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  const [name, setName] = useState(team?.name ?? '');
  const [slug, setSlug] = useState(team?.slug ?? '');
  const [captain, setCaptain] = useState(team?.captain_name ?? '');
  const [goal, setGoal] = useState(centsToDollarsInput(team?.goal_cents ?? null));
  const [description, setDescription] = useState(team?.description ?? '');
  const [avatar, setAvatar] = useState(team?.avatar_url ?? '');
  const [active, setActive] = useState(team?.is_active ?? true);
  const [order, setOrder] = useState(String(team?.sort_order ?? 0));
  return (
    <form
      className="grid gap-4 p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const ok = result(await saveTeam({ id: team?.id, campaignId, name, slug: slug || slugify(name), captain_name: captain, goal_cents: goal ? dollarsToCents(goal) : null, description, avatar_url: avatar, is_active: active, sort_order: Number(order) || 0 }));
          if (ok) onDone();
        });
      }}
    >
      <Field label="Team name">{(id) => <Input id={id} required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="Link name" hint="Used in ?team=…">{(id) => <Input id={id} value={slug || slugify(name)} onChange={(e) => setSlug(slugify(e.target.value))} />}</Field>
      <Field label="Captain">{(id) => <Input id={id} value={captain} onChange={(e) => setCaptain(e.target.value)} />}</Field>
      <Field label="Team goal ($, optional)">{(id) => <Input id={id} inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} />}</Field>
      <Field label="Avatar URL">{(id) => <Input id={id} type="url" value={avatar} onChange={(e) => setAvatar(e.target.value)} />}</Field>
      <Field label="Sort order">{(id) => <Input id={id} type="number" value={order} onChange={(e) => setOrder(e.target.value)} />}</Field>
      <Field label="Description" className="sm:col-span-2">{(id) => <Textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
      <Switch checked={active} onChange={setActive} label="Show on public leaderboard" />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={pending}>{team ? 'Save team' : 'Create team'}</Button>
      </div>
    </form>
  );
}

function AmbassadorForm({ campaignId, ambassador, teams, onDone }: { campaignId: string; ambassador?: AmbassadorRow; teams: TeamRow[]; onDone: () => void }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  const [name, setName] = useState(ambassador?.name ?? '');
  const [code, setCode] = useState(ambassador?.code ?? '');
  const [email, setEmail] = useState(ambassador?.email ?? '');
  const [phone, setPhone] = useState(ambassador?.phone ?? '');
  const [teamId, setTeamId] = useState(ambassador?.team_id ?? '');
  const [goal, setGoal] = useState(centsToDollarsInput(ambassador?.goal_cents ?? null));
  const [message, setMessage] = useState(ambassador?.message ?? '');
  const [active, setActive] = useState(ambassador?.is_active ?? true);
  const autoCode = slugify(name).slice(0, 40).replace(/-+$/, '');
  return (
    <form
      className="grid gap-4 p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const ok = result(await saveAmbassador({ id: ambassador?.id, campaignId, name, code: code || autoCode, email, phone, team_id: teamId || null, goal_cents: goal ? dollarsToCents(goal) : null, message, is_active: active, avatar_url: ambassador?.avatar_url ?? null }));
          if (ok) onDone();
        });
      }}
    >
      <Field label="Ambassador name">{(id) => <Input id={id} required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="Referral code" hint="Their link: ?ref=code">{(id) => <Input id={id} value={code || autoCode} onChange={(e) => setCode(slugify(e.target.value))} />}</Field>
      <Field label="Email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label="Phone">{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
      <Field label="Team">
        {(id) => (
          <Select id={id} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">No team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Personal goal ($)">{(id) => <Input id={id} inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} />}</Field>
      <Field label="Message" className="sm:col-span-2">{(id) => <Input id={id} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />}</Field>
      <Switch checked={active} onChange={setActive} label="Show on public leaderboard" />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={pending}>{ambassador ? 'Save ambassador' : 'Add ambassador'}</Button>
      </div>
    </form>
  );
}

export function TeamManager({ campaignId, slug, teams, ambassadors, canManage }: { campaignId: string; slug: string; teams: TeamRow[]; ambassadors: AmbassadorRow[]; canManage: boolean }) {
  const [team, setTeam] = useState<TeamRow | 'new' | null>(null);
  const [amb, setAmb] = useState<AmbassadorRow | 'new' | null>(null);
  const [pending, start] = useTransition();
  const { result } = useToast();
  const base = `${SITE_URL}/fund/${slug}`;
  const teamName = new Map(teams.map((t) => [t.id, t.name]));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title={`Teams (${teams.length})`} description="Team totals include matched dollars." action={canManage && <Button size="sm" onClick={() => setTeam('new')}><Plus className="size-4" /> New team</Button>} />
        {teams.length === 0 ? (
          <EmptyState icon={<Users className="size-8" />} title="No teams yet" description="Teams compete on the public leaderboard and the big screen." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {teams.map((t) => (
              <li key={t.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{t.name} {!t.is_active && <Badge>hidden</Badge>}</p>
                    <p className="text-xs text-slate-500">{t.captain_name ? `Captain ${t.captain_name} · ` : ''}{t.donation_count} gifts · {formatMoney(t.raised_cents)}{t.goal_cents ? ` of ${formatMoney(t.goal_cents)}` : ''}</p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setTeam(t)} aria-label="Edit team"><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="ghost" loading={pending} aria-label="Delete team" onClick={() => window.confirm(`Delete ${t.name}? Its gifts stay on the campaign.`) && start(async () => void result(await deleteTeam(campaignId, t.id)))}>
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
                {t.goal_cents ? <Meter value={t.raised_cents} max={t.goal_cents} className="mt-2" height="h-1.5" label={`${t.name} progress`} /> : null}
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-500">
                  <span className="min-w-0 flex-1 truncate font-mono">{base}?team={t.slug}</span>
                  <CopyButton text={`${base}?team=${t.slug}`} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={`Ambassadors (${ambassadors.length})`} description="Each gets a personal referral link that credits them." action={canManage && <Button size="sm" onClick={() => setAmb('new')}><Plus className="size-4" /> Add ambassador</Button>} />
        {ambassadors.length === 0 ? (
          <EmptyState icon={<UserRound className="size-8" />} title="No ambassadors yet" description="Ambassadors share their own link and climb the leaderboard." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {ambassadors.map((a) => (
              <li key={a.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{a.name} {!a.is_active && <Badge>hidden</Badge>}</p>
                    <p className="text-xs text-slate-500">{a.team_id ? `${teamName.get(a.team_id)} · ` : ''}{a.donation_count} gifts · {formatMoney(a.raised_cents)}{a.goal_cents ? ` of ${formatMoney(a.goal_cents)}` : ''}{a.email ? ` · ${a.email}` : ''}</p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setAmb(a)} aria-label="Edit ambassador"><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="ghost" loading={pending} aria-label="Delete ambassador" onClick={() => window.confirm(`Remove ${a.name}?`) && start(async () => void result(await deleteAmbassador(campaignId, a.id)))}>
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
                {a.goal_cents ? <Meter value={a.raised_cents} max={a.goal_cents} className="mt-2" height="h-1.5" label={`${a.name} progress`} /> : null}
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-500">
                  <span className="min-w-0 flex-1 truncate font-mono">{base}?ref={a.code}</span>
                  <CopyButton text={`${base}?ref=${a.code}`} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={team !== null} onClose={() => setTeam(null)} title={team === 'new' ? 'New team' : 'Edit team'} size="lg">
        {team !== null && <TeamForm campaignId={campaignId} team={team === 'new' ? undefined : team} onDone={() => setTeam(null)} />}
      </Modal>
      <Modal open={amb !== null} onClose={() => setAmb(null)} title={amb === 'new' ? 'Add ambassador' : 'Edit ambassador'} size="lg">
        {amb !== null && <AmbassadorForm campaignId={campaignId} ambassador={amb === 'new' ? undefined : amb} teams={teams} onDone={() => setAmb(null)} />}
      </Modal>
    </div>
  );
}
