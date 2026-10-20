'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Link2, Trash2 } from 'lucide-react';
import { createLink, deleteLink } from '@/lib/fund/actions/portal';
import { SITE_URL } from '@/lib/fund/env';
import { dollarsToCents, formatMoney, formatPercent } from '@/lib/fund/format';
import type { AmbassadorRow, LinkRow, TeamRow } from '@/lib/fund/types';
import { Button, Card, CardHeader, EmptyState, Field, Input, Select } from '../ui/primitives';
import { Table, Td, Th } from '../dashboard/table';
import { useToast } from '../ui/toast';
import { CopyButton } from './team-manager';

function QrDownload({ url, name }: { url: string; name: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  return (
    <div className="flex items-center gap-3">
      <div ref={wrap} className="rounded-xl border border-slate-200 bg-white p-2">
        <QRCodeCanvas value={url} size={512} level="M" marginSize={2} style={{ width: 88, height: 88 }} />
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          const canvas = wrap.current?.querySelector('canvas');
          if (!canvas) return;
          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = `${name}-qr.png`;
          a.click();
        }}
      >
        <Download className="size-4" /> QR code (PNG)
      </Button>
    </div>
  );
}

export function LinkGenerator({ campaignId, slug, links, teams, ambassadors, canManage }: { campaignId: string; slug: string; links: LinkRow[]; teams: TeamRow[]; ambassadors: AmbassadorRow[]; canManage: boolean }) {
  const [pending, start] = useTransition();
  const { result } = useToast();
  const [label, setLabel] = useState('');
  const [teamId, setTeamId] = useState('');
  const [ambassadorId, setAmbassadorId] = useState('');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [medium, setMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [code, setCode] = useState('');

  const longUrl = useMemo(() => {
    const u = new URL(`${SITE_URL}/fund/${slug}`);
    const t = teams.find((x) => x.id === teamId);
    const a = ambassadors.find((x) => x.id === ambassadorId);
    if (t) u.searchParams.set('team', t.slug);
    if (a) u.searchParams.set('ref', a.code);
    if (amount) u.searchParams.set('amount', String(dollarsToCents(amount) / 100));
    if (source) u.searchParams.set('utm_source', source);
    if (medium) u.searchParams.set('utm_medium', medium);
    if (utmCampaign) u.searchParams.set('utm_campaign', utmCampaign);
    return u.toString();
  }, [slug, teams, ambassadors, teamId, ambassadorId, amount, source, medium, utmCampaign]);

  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const ambName = new Map(ambassadors.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <CardHeader title="Custom link generator" description="Pre-select a team, ambassador or amount and tag the source. Short links track clicks and conversions." />
          <form
            className="grid gap-4 p-5 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createLink({
                  campaignId, label: label || 'Untitled link', team_id: teamId || null, ambassador_id: ambassadorId || null,
                  preset_amount_cents: amount ? dollarsToCents(amount) : null, utm_source: source, utm_medium: medium, utm_campaign: utmCampaign, code: code || null,
                });
                if (result(res)) {
                  setLabel('');
                  setCode('');
                }
              });
            }}
          >
            <Field label="Label" className="lg:col-span-2">{(id) => <Input id={id} required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Board email blast" />}</Field>
            <Field label="Team">
              {(id) => (
                <Select id={id} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">Any</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Ambassador">
              {(id) => (
                <Select id={id} value={ambassadorId} onChange={(e) => setAmbassadorId(e.target.value)}>
                  <option value="">None</option>
                  {ambassadors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Preset amount ($)">{(id) => <Input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="180" />}</Field>
            <Field label="utm_source">{(id) => <Input id={id} value={source} onChange={(e) => setSource(e.target.value)} placeholder="newsletter" />}</Field>
            <Field label="utm_medium">{(id) => <Input id={id} value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="email" />}</Field>
            <Field label="Custom short code (optional)">{(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))} placeholder="auto" />}</Field>
            <Field label="utm_campaign" className="lg:col-span-2">{(id) => <Input id={id} value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} />}</Field>
            <div className="flex items-end lg:col-span-2">
              <Button type="submit" loading={pending} className="w-full"><Link2 className="size-4" /> Create tracked short link</Button>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 lg:col-span-4">
              <p className="text-xs font-medium text-slate-500">Full link (works without saving)</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate text-xs text-slate-700">{longUrl}</code>
                <CopyButton text={longUrl} />
              </div>
              <div className="mt-3"><QrDownload url={longUrl} name={slug} /></div>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader title={`Tracked links (${links.length})`} />
        {links.length === 0 ? (
          <EmptyState icon={<Link2 className="size-8" />} title="No tracked links yet" description="Create one above to see clicks, gifts and conversion per channel." />
        ) : (
          <Table>
            <thead><tr><Th>Link</Th><Th>Targets</Th><Th>Clicks</Th><Th>Gifts</Th><Th>Conversion</Th><Th>Raised</Th><Th /></tr></thead>
            <tbody>
              {links.map((l) => {
                const shortUrl = `${SITE_URL}/fund/l/${l.code}`;
                return (
                  <tr key={l.id}>
                    <Td>
                      <p className="font-medium text-slate-900">{l.label}</p>
                      <div className="flex items-center gap-1"><code className="text-xs text-slate-500">/fund/l/{l.code}</code><CopyButton text={shortUrl} /></div>
                    </Td>
                    <Td className="text-xs text-slate-600">
                      {[l.team_id && `Team: ${teamName.get(l.team_id)}`, l.ambassador_id && `Amb: ${ambName.get(l.ambassador_id)}`, l.preset_amount_cents && formatMoney(l.preset_amount_cents), l.utm_source && `src: ${l.utm_source}`].filter(Boolean).join(' · ') || '—'}
                    </Td>
                    <Td>{l.click_count}</Td>
                    <Td>{l.donation_count}</Td>
                    <Td>{l.click_count ? formatPercent(l.donation_count / l.click_count) : '—'}</Td>
                    <Td className="font-medium text-slate-900">{formatMoney(l.raised_cents)}</Td>
                    <Td>
                      {canManage && (
                        <button className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete link" onClick={() => window.confirm('Delete this link? Existing clicks stop redirecting.') && start(async () => void result(await deleteLink(campaignId, l.id)))}>
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
