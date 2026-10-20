'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { checkSlugAvailability, saveCampaign } from '@/lib/fund/actions/admin';
import { updateCampaignSettings } from '@/lib/fund/actions/portal';
import { SITE_URL } from '@/lib/fund/env';
import { centsToDollarsInput, dollarsToCents, slugify, toLocalInput } from '@/lib/fund/format';
import type { CampaignRow, CampaignStatus } from '@/lib/fund/types';
import { Button, Card, CardHeader, Field, Input, Select, Switch, Textarea } from '../ui/primitives';
import { useToast } from '../ui/toast';

type Mode = 'admin' | 'manager';

const STATUSES: CampaignStatus[] = ['draft', 'pending_review', 'active', 'paused', 'completed', 'archived'];

function defaults(): Partial<CampaignRow> {
  const start = new Date(Date.now() + 86_400_000);
  start.setMinutes(0, 0, 0);
  return {
    status: 'draft',
    theme_color: '#4f46e5',
    currency: 'usd',
    goal_cents: 10_000_000,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 36 * 3_600_000).toISOString(),
    preset_amounts: [3600, 10000, 18000, 36000, 50000, 100000],
    min_donation_cents: 500,
    max_donation_cents: 2_500_000,
    allow_anonymous: true,
    allow_fee_cover: true,
    display_settings: { rotate_seconds: 12, show_qr: true },
  };
}

export function CampaignForm({
  mode,
  campaign,
  organizations = [],
}: {
  mode: Mode;
  campaign?: CampaignRow | null;
  organizations?: { id: string; name: string; platform_fee_bps: number }[];
}) {
  const router = useRouter();
  const { result, toast } = useToast();
  const [pending, start] = useTransition();
  const init = { ...defaults(), ...campaign };

  const [orgId, setOrgId] = useState(init.org_id ?? organizations[0]?.id ?? '');
  const [title, setTitle] = useState(init.title ?? '');
  const [slug, setSlug] = useState(init.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(campaign));
  const [slugState, setSlugState] = useState<{ available: boolean; reason?: string } | null>(null);
  const [tagline, setTagline] = useState(init.tagline ?? '');
  const [description, setDescription] = useState(init.description ?? '');
  const [status, setStatus] = useState<CampaignStatus>(init.status ?? 'draft');
  const [goal, setGoal] = useState(centsToDollarsInput(init.goal_cents));
  const [bonus, setBonus] = useState(centsToDollarsInput(init.bonus_goal_cents ?? null));
  const [startsAt, setStartsAt] = useState(toLocalInput(init.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(init.ends_at));
  const [color, setColor] = useState(init.theme_color ?? '#4f46e5');
  const [hero, setHero] = useState(init.hero_image_url ?? '');
  const [logo, setLogo] = useState(init.logo_url ?? '');
  const [video, setVideo] = useState(init.video_url ?? '');
  const [presets, setPresets] = useState((init.preset_amounts ?? []).map((c) => c / 100).join(', '));
  const [minGift, setMinGift] = useState(centsToDollarsInput(init.min_donation_cents));
  const [maxGift, setMaxGift] = useState(centsToDollarsInput(init.max_donation_cents));
  const [allowAnon, setAllowAnon] = useState(init.allow_anonymous ?? true);
  const [allowFee, setAllowFee] = useState(init.allow_fee_cover ?? true);
  const [feePct, setFeePct] = useState(init.platform_fee_bps != null ? String(init.platform_fee_bps / 100) : '');
  const [headline, setHeadline] = useState(init.display_settings?.headline ?? '');
  const [ticker, setTicker] = useState(init.display_settings?.ticker_message ?? '');
  const [rotate, setRotate] = useState(String(init.display_settings?.rotate_seconds ?? 12));
  const [showQr, setShowQr] = useState(init.display_settings?.show_qr !== false);

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const orgFee = organizations.find((o) => o.id === orgId)?.platform_fee_bps;

  useEffect(() => {
    if (mode !== 'admin' || !effectiveSlug || effectiveSlug === campaign?.slug) {
      const t = setTimeout(() => setSlugState(null), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      void checkSlugAvailability(effectiveSlug, campaign?.id).then(setSlugState);
    }, 400);
    return () => clearTimeout(t);
  }, [effectiveSlug, mode, campaign?.id, campaign?.slug]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const presetCents = presets
      .split(/[,\s]+/)
      .map((p) => dollarsToCents(p))
      .filter((c) => c >= 100)
      .slice(0, 8);
    if (!presetCents.length) return toast('Add at least one preset amount', 'error');
    const payload = {
      id: campaign?.id,
      org_id: orgId,
      slug: effectiveSlug,
      title,
      tagline,
      description,
      hero_image_url: hero,
      logo_url: logo,
      video_url: video,
      theme_color: color,
      goal_cents: dollarsToCents(goal),
      bonus_goal_cents: bonus ? dollarsToCents(bonus) : null,
      starts_at: startsAt ? new Date(startsAt).toISOString() : '',
      ends_at: endsAt ? new Date(endsAt).toISOString() : '',
      status,
      preset_amounts: presetCents,
      min_donation_cents: dollarsToCents(minGift),
      max_donation_cents: dollarsToCents(maxGift),
      allow_anonymous: allowAnon,
      allow_fee_cover: allowFee,
      platform_fee_bps: feePct === '' ? null : Math.round(Number(feePct) * 100),
      display_settings: { headline, ticker_message: ticker, rotate_seconds: Number(rotate) || 12, show_qr: showQr },
    };
    start(async () => {
      if (mode === 'admin') {
        const res = await saveCampaign(payload);
        if (result(res) && res.ok && !campaign && res.data) router.push(`/fund/admin/campaigns/${res.data.id}`);
      } else {
        result(await updateCampaignSettings(payload));
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Campaign page" description="What donors see at the top of the page." />
          <div className="grid gap-4 p-5">
            <Field label="Title">{(id) => <Input id={id} required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
            <Field
              label="Custom URL"
              hint={
                mode === 'admin' ? (
                  slugState ? (
                    slugState.available ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="size-3.5" /> Available</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="size-3.5" /> {slugState.reason}</span>
                    )
                  ) : (
                    'Lowercase letters, numbers and dashes.'
                  )
                ) : (
                  'URL changes are handled by the platform team.'
                )
              }
            >
              {(id) => (
                <div className="flex items-center overflow-hidden rounded-xl border border-slate-300 bg-slate-50 focus-within:border-[var(--fund-accent)]">
                  <span className="hidden shrink-0 pl-3 text-sm text-slate-500 sm:inline">{SITE_URL.replace(/^https?:\/\//, '')}/fund/</span>
                  <input
                    id={id}
                    className="h-10 min-w-0 flex-1 bg-white px-2 text-sm outline-none disabled:bg-slate-50"
                    value={effectiveSlug}
                    disabled={mode !== 'admin'}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    }}
                  />
                </div>
              )}
            </Field>
            <Field label="Tagline">{(id) => <Input id={id} maxLength={280} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Every dollar matched — up to 4x!" />}</Field>
            <Field label="Story" hint="Separate paragraphs with a blank line.">{(id) => <Textarea id={id} rows={7} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Hero image URL">{(id) => <Input id={id} type="url" value={hero} onChange={(e) => setHero(e.target.value)} placeholder="https://…" />}</Field>
              <Field label="Logo URL">{(id) => <Input id={id} type="url" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…" />}</Field>
              <Field label="Video (YouTube/Vimeo)">{(id) => <Input id={id} type="url" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://youtu.be/…" />}</Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Goal & schedule" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Goal ($)">{(id) => <Input id={id} required inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} />}</Field>
            <Field label="Bonus goal ($, optional)" hint="Thermometer rescales to this once the goal is hit.">{(id) => <Input id={id} inputMode="decimal" value={bonus} onChange={(e) => setBonus(e.target.value)} />}</Field>
            <Field label="Starts">{(id) => <Input id={id} type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}</Field>
            <Field label="Ends">{(id) => <Input id={id} type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />}</Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Giving options" />
          <div className="grid gap-4 p-5">
            <Field label="Preset amounts ($)" hint="Comma-separated, up to 8.">{(id) => <Input id={id} value={presets} onChange={(e) => setPresets(e.target.value)} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Minimum online gift ($)">{(id) => <Input id={id} inputMode="decimal" value={minGift} onChange={(e) => setMinGift(e.target.value)} />}</Field>
              <Field label="Maximum online gift ($)">{(id) => <Input id={id} inputMode="decimal" value={maxGift} onChange={(e) => setMaxGift(e.target.value)} />}</Field>
            </div>
            <Switch checked={allowAnon} onChange={setAllowAnon} label="Allow anonymous gifts" />
            <Switch checked={allowFee} onChange={setAllowFee} label="Offer donors to cover processing fees" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Big screen" description="Settings for /fund/display at live events." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Headline override">{(id) => <Input id={id} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={title} />}</Field>
            <Field label="Panel rotation (seconds)">{(id) => <Input id={id} type="number" min={5} max={120} value={rotate} onChange={(e) => setRotate(e.target.value)} />}</Field>
            <Field label="Message under QR code" className="sm:col-span-2">{(id) => <Input id={id} maxLength={200} value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="Text GIVE to 12345" />}</Field>
            <Switch checked={showQr} onChange={setShowQr} label="Show donation QR code" />
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="lg:sticky lg:top-32">
          <CardHeader title={campaign ? 'Save changes' : 'Create campaign'} />
          <div className="grid gap-4 p-5">
            {mode === 'admin' && (
              <>
                <Field label="Organization">
                  {(id) => (
                    <Select id={id} required value={orgId} onChange={(e) => setOrgId(e.target.value)} disabled={Boolean(campaign)}>
                      {!organizations.length && <option value="">Create an organization first</option>}
                      {organizations.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Status">
                  {(id) => (
                    <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Platform fee (%)" hint={orgFee != null ? `Blank = organization default (${orgFee / 100}%)` : undefined}>
                  {(id) => <Input id={id} inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value)} placeholder={orgFee != null ? String(orgFee / 100) : '5'} />}
                </Field>
              </>
            )}
            <Field label="Theme color">
              {(id) => (
                <div className="flex gap-2">
                  <input type="color" aria-label="Pick theme color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" />
                  <Input id={id} value={color} onChange={(e) => setColor(e.target.value)} pattern="^#[0-9a-fA-F]{6}$" />
                </div>
              )}
            </Field>
            <Button type="submit" loading={pending} disabled={mode === 'admin' && slugState?.available === false}>
              {campaign ? 'Save campaign' : 'Create campaign'}
            </Button>
            {campaign && (
              <p className="text-xs text-slate-500">
                Live at{' '}
                <a className="font-medium text-[var(--fund-accent-strong)] hover:underline" href={`/fund/${campaign.slug}`} target="_blank" rel="noopener">
                  /fund/{campaign.slug}
                </a>
              </p>
            )}
          </div>
        </Card>
      </div>
    </form>
  );
}
