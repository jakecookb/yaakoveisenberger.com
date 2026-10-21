'use client';

import { useEffect, useMemo, useState } from 'react';
import { BadgePercent, Briefcase, CalendarClock, Check, Copy, ExternalLink, Info, MapPin, Plane, Trophy, Users } from 'lucide-react';
import { CLASS_LABEL, COMPANIES, DEFAULT_FEES, FEATURE_LABEL, total, VEHICLES, type Company, type Feature, type Fees, type VClass } from '@/lib/rentals/data';

const ACCENT = '#60a5fa';
const STORE = 've_rentals_v1';
const card = 'rounded-3xl bg-neutral-900/70 p-4 ring-1 ring-white/10 sm:p-5';
const field = 'h-10 w-full rounded-xl bg-neutral-950 px-3 text-sm text-white ring-1 ring-white/15 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-[#60a5fa]';
const lbl = 'text-xs font-medium text-neutral-400';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

interface Trip { pickup: string; dropoff: string; sameDrop: boolean; airport: boolean; from: string; to: string }
interface Member { aaa: string; codes: Record<Company, string>; loyalty: Record<Company, string>; extraPct: Record<Company, number> }
type Rates = Record<string, Partial<Record<Company, number>>>; // vehicle id -> company -> daily rate

const today = () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(10, 0, 0, 0); return d; };
const isoLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function RentalCenter() {
  const [trip, setTrip] = useState<Trip>(() => { const a = today(); const b = new Date(a); b.setDate(b.getDate() + 3); return { pickup: '', dropoff: '', sameDrop: true, airport: true, from: isoLocal(a), to: isoLocal(b) }; });
  const [member, setMember] = useState<Member>({ aaa: '', codes: { hertz: '', national: '', avis: '' }, loyalty: { hertz: '', national: '', avis: '' }, extraPct: { hertz: 0, national: 0, avis: 0 } });
  const [fees, setFees] = useState<Fees>(DEFAULT_FEES);
  const [rates, setRates] = useState<Rates>({});
  const [classes, setClasses] = useState<VClass[]>([]);
  const [minPax, setMinPax] = useState(1);
  const [minBags, setMinBags] = useState(0);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [copied, setCopied] = useState<Company | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Everything is kept in this browser only (your AAA number never leaves the device).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? 'null');
      if (s?.member) setMember((m) => ({ ...m, ...s.member, codes: { ...m.codes, ...s.member.codes }, loyalty: { ...m.loyalty, ...s.member.loyalty }, extraPct: { ...m.extraPct, ...s.member.extraPct } }));
      if (s?.fees) setFees({ ...DEFAULT_FEES, ...s.fees });
      if (s?.rates) setRates(s.rates);
      if (s?.trip?.pickup) setTrip((t) => ({ ...t, pickup: s.trip.pickup, dropoff: s.trip.dropoff ?? '', sameDrop: s.trip.sameDrop ?? true, airport: s.trip.airport ?? true }));
    } catch {}
    setLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { if (loaded) try { localStorage.setItem(STORE, JSON.stringify({ member, fees, rates, trip })); } catch {} }, [member, fees, rates, trip, loaded]);

  const ms = new Date(trip.to).getTime() - new Date(trip.from).getTime();
  const days = Number.isFinite(ms) && ms > 0 ? Math.max(1, Math.ceil(ms / 86_400_000 - 1 / 24)) : 1; // 59-minute grace, like most counters
  const oneWay = !trip.sameDrop && Boolean(trip.dropoff.trim()) && trip.dropoff.trim().toLowerCase() !== trip.pickup.trim().toLowerCase();
  const vehicles = useMemo(() => VEHICLES.filter((v) => (!classes.length || classes.includes(v.cls)) && v.passengers >= minPax && v.bags.large + v.bags.small >= minBags && features.every((f) => v.features.includes(f))), [classes, minPax, minBags, features]);

  const tripText = (c: Company) => {
    const co = COMPANIES.find((x) => x.id === c)!;
    const fmt = (s: string) => new Date(s).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    return [
      `Pick-up: ${trip.pickup || '—'} · ${fmt(trip.from)}`,
      `Return: ${oneWay ? trip.dropoff : trip.pickup || '—'} · ${fmt(trip.to)}`,
      member.codes[c] && `${co.codeLabel}: ${member.codes[c]}`,
      c === 'hertz' && member.aaa && `AAA member #: ${member.aaa}`,
      member.loyalty[c] && `Loyalty #: ${member.loyalty[c]}`,
    ].filter(Boolean).join('\n');
  };
  const openCompany = async (c: Company) => {
    try { await navigator.clipboard.writeText(tripText(c)); setCopied(c); setTimeout(() => setCopied(null), 2500); } catch {}
    window.open(COMPANIES.find((x) => x.id === c)!.url, '_blank', 'noopener,noreferrer');
  };
  const setRate = (vid: string, c: Company, v: string) => setRates((r) => ({ ...r, [vid]: { ...r[vid], [c]: v === '' ? undefined : Math.max(0, Number(v)) } }));
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

  return (
    <div className="space-y-6">
      {/* trip */}
      <section className={card} aria-labelledby="trip-h">
        <h2 id="trip-h" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#60a5fa]"><CalendarClock className="size-4" /> Your trip</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="lg:col-span-2"><span className={lbl}>Pick-up location</span><input value={trip.pickup} onChange={(e) => setTrip({ ...trip, pickup: e.target.value, airport: /\b(airport|[A-Z]{3})\b/.test(e.target.value) || trip.airport })} placeholder="e.g. Newark Airport (EWR)" className={`${field} mt-1`} /></label>
          <label className="lg:col-span-2"><span className={lbl}>Drop-off location</span><input value={trip.sameDrop ? trip.pickup : trip.dropoff} disabled={trip.sameDrop} onChange={(e) => setTrip({ ...trip, dropoff: e.target.value })} placeholder="Same as pick-up" className={`${field} mt-1 disabled:opacity-50`} /></label>
          <label><span className={lbl}>Pick-up date & time</span><input type="datetime-local" value={trip.from} onChange={(e) => setTrip({ ...trip, from: e.target.value })} className={`${field} mt-1 [color-scheme:dark]`} /></label>
          <label><span className={lbl}>Return date & time</span><input type="datetime-local" value={trip.to} onChange={(e) => setTrip({ ...trip, to: e.target.value })} className={`${field} mt-1 [color-scheme:dark]`} /></label>
          <div className="flex flex-wrap items-end gap-2 lg:col-span-2">
            <button type="button" onClick={() => setTrip({ ...trip, sameDrop: !trip.sameDrop })} aria-pressed={!trip.sameDrop} className={`h-10 rounded-xl px-3 text-sm ring-1 ${!trip.sameDrop ? 'bg-[#60a5fa]/15 text-[#93c5fd] ring-[#60a5fa]/40' : 'text-neutral-400 ring-white/10'}`}>Different drop-off</button>
            <button type="button" onClick={() => setTrip({ ...trip, airport: !trip.airport })} aria-pressed={trip.airport} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm ring-1 ${trip.airport ? 'bg-[#60a5fa]/15 text-[#93c5fd] ring-[#60a5fa]/40' : 'text-neutral-400 ring-white/10'}`}><Plane className="size-4" /> Airport pick-up</button>
            <span className="ml-auto text-sm text-neutral-300"><b className="text-white">{days}</b> rental day{days === 1 ? '' : 's'}</span>
          </div>
        </div>
      </section>

      {/* membership */}
      <section className={card} aria-labelledby="member-h">
        <h2 id="member-h" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#60a5fa]"><BadgePercent className="size-4" /> AAA & discount codes</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <label><span className={lbl}>AAA membership number</span><input value={member.aaa} onChange={(e) => setMember({ ...member, aaa: e.target.value.replace(/[^\d\s-]/g, '').slice(0, 24) })} inputMode="numeric" autoComplete="off" placeholder="Saved on this device only" className={`${field} mt-1 font-mono`} /></label>
          {COMPANIES.map((c) => (
            <div key={c.id} className="space-y-2 rounded-2xl bg-neutral-950/50 p-3 ring-1 ring-white/5">
              <p className="flex items-center gap-2 text-sm font-semibold text-white"><span className="size-2.5 rounded-full" style={{ background: c.color }} />{c.name}</p>
              <input value={member.codes[c.id]} onChange={(e) => setMember({ ...member, codes: { ...member.codes, [c.id]: e.target.value.slice(0, 20) } })} placeholder={c.codeLabel} aria-label={`${c.name} ${c.codeLabel}`} className={`${field} h-9 font-mono`} />
              <input value={member.loyalty[c.id]} onChange={(e) => setMember({ ...member, loyalty: { ...member.loyalty, [c.id]: e.target.value.slice(0, 20) } })} placeholder="Loyalty number" aria-label={`${c.name} loyalty number`} className={`${field} h-9 font-mono`} />
              <label className="flex items-center justify-between gap-2 text-xs text-neutral-400">Extra % off (if not already in the quote)<input type="number" min={0} max={60} value={member.extraPct[c.id]} onChange={(e) => setMember({ ...member, extraPct: { ...member.extraPct, [c.id]: Math.max(0, Math.min(60, Number(e.target.value) || 0)) } })} className={`${field} h-8 w-16 text-right`} /></label>
              <p className="text-[11px] leading-relaxed text-neutral-500">{c.codeHint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* live prices */}
      <section className={card} aria-labelledby="live-h">
        <h2 id="live-h" className="text-sm font-semibold uppercase tracking-[0.2em] text-[#60a5fa]">1 · Get today’s prices</h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">Hertz, National and Avis don’t publish their prices for other sites to read, so live rates come from their own search. Each button copies your trip and codes, then opens that company — paste, search, and type the daily rates you see into the table below.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {COMPANIES.map((c) => (
            <button key={c.id} type="button" onClick={() => void openCompany(c.id)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white ring-1 ring-white/15 hover:ring-white/40">
              <span className="size-2.5 rounded-full" style={{ background: c.color }} /> {copied === c.id ? <><Check className="size-4 text-emerald-300" /> Copied — opening {c.name}</> : <>Search {c.name} <ExternalLink className="size-3.5 text-neutral-400" /></>}
            </button>
          ))}
          <button type="button" onClick={() => void navigator.clipboard?.writeText(tripText('hertz'))} className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm text-neutral-400 ring-1 ring-white/10 hover:text-white"><Copy className="size-4" /> Copy trip</button>
        </div>
      </section>

      {/* filters */}
      <section className={card} aria-label="Vehicle filters">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(CLASS_LABEL) as VClass[]).map((c) => <button key={c} type="button" onClick={() => setClasses(toggle(classes, c))} aria-pressed={classes.includes(c)} className={`rounded-full px-3 py-1.5 text-sm ring-1 ${classes.includes(c) ? 'bg-[#60a5fa] text-neutral-950 ring-[#60a5fa]' : 'text-neutral-300 ring-white/10 hover:text-white'}`}>{CLASS_LABEL[c]}</button>)}
          <span className="mx-1 h-6 w-px bg-white/10" />
          <label className="flex items-center gap-1.5 text-sm text-neutral-400"><Users className="size-4" /> min<input type="number" min={1} max={15} value={minPax} onChange={(e) => setMinPax(Math.max(1, Number(e.target.value) || 1))} className={`${field} h-8 w-14`} /></label>
          <label className="flex items-center gap-1.5 text-sm text-neutral-400"><Briefcase className="size-4" /> bags<input type="number" min={0} max={10} value={minBags} onChange={(e) => setMinBags(Math.max(0, Number(e.target.value) || 0))} className={`${field} h-8 w-14`} /></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(FEATURE_LABEL) as Feature[]).map((f) => <button key={f} type="button" onClick={() => setFeatures(toggle(features, f))} aria-pressed={features.includes(f)} className={`rounded-full px-2.5 py-1 text-xs ring-1 ${features.includes(f) ? 'bg-white/10 text-white ring-white/30' : 'text-neutral-500 ring-white/10 hover:text-white'}`}>{FEATURE_LABEL[f]}</button>)}
        </div>
      </section>

      {/* compare */}
      <section aria-labelledby="cmp-h">
        <h2 id="cmp-h" className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#60a5fa]">2 · Compare all-in totals</h2>
        {!vehicles.length && <p className={`${card} text-sm text-neutral-400`}>No vehicle matches those filters.</p>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => {
            const totals = COMPANIES.map((c) => { const d = rates[v.id]?.[c.id]; return d ? { c, ...total({ daily: d, discountPct: member.extraPct[c.id] }, days, trip.airport, oneWay, fees) } : null; });
            const best = totals.filter(Boolean).sort((a, b) => a!.total - b!.total)[0];
            return (
              <article key={v.id} className={`${card} flex flex-col`}>
                <div className="flex items-start justify-between gap-2">
                  <div><p className="text-[11px] font-semibold uppercase tracking-wider text-[#60a5fa]">{CLASS_LABEL[v.cls]}</p><h3 className="text-lg font-semibold text-white">{v.name}</h3><p className="text-xs text-neutral-500">{v.examples} or similar</p></div>
                  <div className="text-right text-xs text-neutral-300"><p className="flex items-center justify-end gap-1"><Users className="size-3.5" /> {v.passengers}</p><p className="flex items-center justify-end gap-1"><Briefcase className="size-3.5" /> {v.bags.large}L · {v.bags.small}S</p></div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">{v.features.map((f) => <span key={f} className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-300 ring-1 ring-white/10">{FEATURE_LABEL[f]}</span>)}</div>
                <div className="mt-4 space-y-2">
                  {COMPANIES.map((c, i) => {
                    const t = totals[i];
                    return (
                      <div key={c.id} className={`flex items-center gap-2 rounded-xl p-2 ring-1 ${best && t && best.c.id === c.id ? 'bg-emerald-500/10 ring-emerald-400/40' : 'bg-neutral-950/50 ring-white/5'}`}>
                        <span className="w-20 text-sm font-medium text-white"><span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: c.color }} />{c.name}</span>
                        <label className="flex items-center gap-1 text-xs text-neutral-500">$<input type="number" min={0} step="0.01" value={rates[v.id]?.[c.id] ?? ''} onChange={(e) => setRate(v.id, c.id, e.target.value)} placeholder="/day" aria-label={`${c.name} daily rate for ${v.name}`} className={`${field} h-8 w-20 px-2 text-right`} /></label>
                        <span className="ml-auto text-right">{t ? <><b className="text-white">{money(t.total)}</b><span className="block text-[10px] text-neutral-500">{money(t.total / days)}/day all-in</span></> : <span className="text-xs text-neutral-600">enter rate</span>}</span>
                        {best && t && best.c.id === c.id && <Trophy className="size-4 text-emerald-300" aria-label="Cheapest" />}
                      </div>
                    );
                  })}
                </div>
                {best && <details className="mt-3 text-xs text-neutral-400"><summary className="cursor-pointer">Breakdown ({best.c.name})</summary>
                  <ul className="mt-1 space-y-0.5">
                    <li className="flex justify-between"><span>Base ({days} days{member.extraPct[best.c.id] ? `, −${member.extraPct[best.c.id]}%` : ''})</span><span>{money(best.base)}</span></li>
                    {trip.airport && <li className="flex justify-between"><span>Airport concession ({fees.airportPct}%)</span><span>{money(best.airportFee)}</span></li>}
                    {trip.airport && <li className="flex justify-between"><span>Facility charge</span><span>{money(best.facility)}</span></li>}
                    <li className="flex justify-between"><span>Vehicle licence fee</span><span>{money(best.vlf)}</span></li>
                    <li className="flex justify-between"><span>Surcharges{oneWay ? ' + one-way' : ''}</span><span>{money(best.other)}</span></li>
                    <li className="flex justify-between"><span>Tax ({fees.taxPct}%)</span><span>{money(best.tax)}</span></li>
                  </ul>
                </details>}
              </article>
            );
          })}
        </div>
      </section>

      {/* fees */}
      <section className={card} aria-labelledby="fees-h">
        <h2 id="fees-h" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#60a5fa]"><Info className="size-4" /> Taxes & fees used in the totals</h2>
        <p className="mt-2 max-w-3xl text-xs text-neutral-500">Typical U.S. levels — every airport and city sets its own, so copy the exact figures from your quote’s “taxes & fees” line for a precise total.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {([['taxPct', 'Sales tax %'], ['airportPct', 'Airport fee %'], ['facilityPerDay', 'Facility $/day'], ['vlfPerDay', 'Licence fee $/day'], ['otherFlat', 'Surcharges $'], ['oneWayFee', 'One-way fee $']] as [keyof Fees, string][]).map(([k, l]) => (
            <label key={k}><span className={lbl}>{l}</span><input type="number" min={0} step="0.1" value={fees[k]} onChange={(e) => setFees({ ...fees, [k]: Math.max(0, Number(e.target.value) || 0) })} className={`${field} mt-1`} /></label>
          ))}
        </div>
        <button type="button" onClick={() => setFees(DEFAULT_FEES)} className="mt-3 text-xs text-neutral-400 hover:text-white">Reset to typical values</button>
        <p className="mt-4 flex items-start gap-2 text-xs text-neutral-500"><MapPin className="mt-0.5 size-3.5 shrink-0" style={{ color: ACCENT }} />Your trip, codes and the rates you type are saved in this browser only — nothing is sent anywhere.</p>
      </section>
    </div>
  );
}
