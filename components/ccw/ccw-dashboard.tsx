'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Car, ExternalLink, Info, Landmark, MapPin, Plus, Scale, Search, ShieldAlert, X } from 'lucide-react';
import data from '@/data/ccw/states.json';
import { coverage, type CoverageKind, type HeldPermit } from '@/lib/ccw/coverage';
import type { PlaceStatus, StateLaw } from '@/lib/ccw/types';

const STATES = data as unknown as StateLaw[];
const byCode = new Map(STATES.map((s) => [s.code, s]));
const ACCENT = '#f59e0b';
const MAX_PERMITS = 4;

// Tile-grid map (column, row).
const GRID: Record<string, [number, number]> = {
  AK: [0, 0], ME: [10, 0], WI: [5, 1], VT: [9, 1], NH: [10, 1],
  WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], MI: [6, 2], NY: [8, 2], MA: [9, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3], RI: [10, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
  HI: [0, 7], TX: [3, 7], FL: [8, 7],
};

const KIND: Record<CoverageKind, { label: string; bg: string; ring: string; text: string }> = {
  permit: { label: 'Covered by your permit', bg: 'bg-emerald-500/80', ring: 'ring-emerald-300/40', text: 'text-emerald-300' },
  permitless: { label: 'Permitless carry', bg: 'bg-sky-500/70', ring: 'ring-sky-300/40', text: 'text-sky-300' },
  home: { label: 'Home state — permitless', bg: 'bg-sky-500/70', ring: 'ring-sky-300/40', text: 'text-sky-300' },
  none: { label: 'Not covered', bg: 'bg-red-500/60', ring: 'ring-red-300/40', text: 'text-red-300' },
};

const PLACE_LABEL: Record<keyof StateLaw['places'], string> = {
  schools: 'Schools', restAreas: 'Rest stops', stateParks: 'State parks', pollingPlaces: 'Polling places',
  airports: 'Airports (non-secure areas)', bars: 'Bars', churches: 'Places of worship', stateBuildings: 'State buildings',
};
const STATUS_STYLE: Record<PlaceStatus, string> = {
  prohibited: 'bg-red-500/15 text-red-300 ring-red-400/30',
  allowed: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  restricted: 'bg-amber-500/15 text-amber-200 ring-amber-400/30',
  unknown: 'bg-white/5 text-neutral-400 ring-white/10',
};
const DTI: Record<StateLaw['dutyToInform']['rule'], string> = { immediately: 'Immediately', 'upon-request': 'Only if asked', no: 'No duty', varies: 'Depends' };
const yesNo = (v: boolean | null) => (v === null ? 'Not stated' : v ? 'Yes' : 'No');
const honorLabel = (l: StateLaw['honors']['residentPermits']) => (l === 'all' ? 'All states' : l === 'none' ? 'None' : `${l.length} states`);

const STORE = 've_ccw_permits_v1';
interface Saved { home: string; age: number; permits: HeldPermit[] }

const sel = 'h-10 rounded-xl bg-neutral-950 px-3 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-[#f59e0b]';
const card = 'rounded-3xl bg-neutral-900/70 p-4 ring-1 ring-white/10 sm:p-5';

export function CcwDashboard() {
  const [home, setHome] = useState('NJ');
  const [age, setAge] = useState(30);
  const [permits, setPermits] = useState<HeldPermit[]>([{ state: 'NJ', kind: 'resident' }]);
  const [picked, setPicked] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'table'>('map');
  const [q, setQ] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Remember the visitor's permits on this device only. (Restored after hydration, since the server can't see them.)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Saved | null;
      if (s && byCode.has(s.home)) { setHome(s.home); setAge(s.age); setPermits(s.permits.filter((p) => byCode.has(p.state)).slice(0, MAX_PERMITS)); }
    } catch {}
    setLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { if (loaded) try { localStorage.setItem(STORE, JSON.stringify({ home, age, permits })); } catch {} }, [home, age, permits, loaded]);

  const cov = useMemo(() => new Map(STATES.map((s) => [s.code, coverage(s, permits, home, age)])), [permits, home, age]);
  const counts = useMemo(() => { const c = { permit: 0, permitless: 0, home: 0, none: 0 }; cov.forEach((v) => c[v.kind]++); return c; }, [cov]);
  const issuers = STATES.filter((s) => s.nonResidentPermit.issued);
  const setPermit = (i: number, p: HeldPermit) => setPermits((ps) => ps.map((x, k) => (k === i ? p : x)));
  const detail = picked ? byCode.get(picked) ?? null : null;

  return (
    <div className="space-y-6">
      {/* your permits */}
      <section className={card} aria-labelledby="permits-h">
        <h2 id="permits-h" className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f59e0b]">Your permits</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-neutral-400">I live in<select value={home} onChange={(e) => setHome(e.target.value)} className={`${sel} mt-1 block w-48`}>{STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
          <label className="text-xs text-neutral-400">My age<input type="number" min={18} max={99} value={age} onChange={(e) => setAge(Math.max(18, Math.min(99, Number(e.target.value) || 18)))} className={`${sel} mt-1 block w-24`} /></label>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {permits.map((p, i) => {
            const issuer = byCode.get(p.state)!;
            return (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-neutral-950/60 p-2.5 ring-1 ring-white/10">
                <BadgeCheck className="size-4 text-[#f59e0b]" />
                <select value={p.state} onChange={(e) => setPermit(i, { state: e.target.value, kind: e.target.value === home ? 'resident' : 'nonresident' })} className={`${sel} h-9 min-w-0 flex-1`} aria-label={`Permit ${i + 1} issuing state`}>
                  {STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
                <div className="flex rounded-xl bg-neutral-900 p-0.5 ring-1 ring-white/10">
                  {(['resident', 'nonresident'] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setPermit(i, { ...p, kind: k })} aria-pressed={p.kind === k} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${p.kind === k ? 'bg-[#f59e0b] text-neutral-950' : 'text-neutral-400 hover:text-white'}`}>{k === 'resident' ? 'Resident' : 'Non-resident'}</button>
                  ))}
                </div>
                <button type="button" aria-label="Remove permit" onClick={() => setPermits((ps) => ps.filter((_, k) => k !== i))} className="rounded-lg p-1.5 text-neutral-500 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
                {p.kind === 'resident' && p.state !== home && <p className="w-full text-[11px] text-amber-200/80">A resident permit is normally only valid while you live in {issuer.name}.</p>}
                {p.kind === 'nonresident' && issuer.nonResidentPermit.issued === false && <p className="w-full text-[11px] text-amber-200/80">{issuer.name} doesn’t issue non-resident permits to the general public.</p>}
              </li>
            );
          })}
          {permits.length < MAX_PERMITS && (
            <li>
              <button type="button" onClick={() => setPermits((ps) => [...ps, { state: issuers.find((s) => s.code !== home && !ps.some((p) => p.state === s.code))?.code ?? 'UT', kind: 'nonresident' }])} className="flex h-full min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-sm text-neutral-400 hover:border-[#f59e0b]/60 hover:text-white">
                <Plus className="size-4" /> Add a permit ({permits.length}/{MAX_PERMITS})
              </button>
            </li>
          )}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">States that sell non-resident permits: {issuers.map((s) => s.code).join(', ')}. Saved on this device only.</p>
      </section>

      {/* summary + view switch */}
      <div className="flex flex-wrap items-center gap-2">
        {(['permit', 'permitless', 'none'] as const).map((k) => (
          <span key={k} className={`inline-flex items-center gap-2 rounded-full bg-neutral-900/70 px-3 py-1.5 text-sm ring-1 ${KIND[k].ring}`}>
            <span className={`size-2.5 rounded-sm ${KIND[k].bg}`} /><b className="text-white">{k === 'permitless' ? counts.permitless + counts.home : counts[k]}</b><span className="text-neutral-400">{KIND[k].label}</span>
          </span>
        ))}
        <div className="ml-auto flex rounded-xl bg-neutral-900 p-0.5 ring-1 ring-white/10">
          {(['map', 'table'] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-white/10 text-white' : 'text-neutral-400'}`}>{v === 'map' ? 'Map' : 'All states table'}</button>)}
        </div>
      </div>

      {view === 'map' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className={card}>
            <div className="grid gap-1 sm:gap-1.5" style={{ gridTemplateColumns: 'repeat(11, minmax(0, 1fr))' }} role="list" aria-label="Coverage by state">
              {STATES.map((s) => {
                const [x, y] = GRID[s.code];
                const c = cov.get(s.code)!;
                return (
                  <button
                    key={s.code} type="button" role="listitem" onClick={() => setPicked(s.code)}
                    style={{ gridColumn: x + 1, gridRow: y + 1 }}
                    className={`aspect-square rounded-md text-[10px] font-bold text-white ring-1 transition hover:scale-110 sm:rounded-lg sm:text-xs ${KIND[c.kind].bg} ${picked === s.code ? 'ring-2 ring-white' : KIND[c.kind].ring} ${s.code === home ? 'outline outline-2 outline-offset-1 outline-[#f59e0b]' : ''}`}
                    aria-label={`${s.name}: ${KIND[c.kind].label}`} title={`${s.name}: ${c.why}`}
                  >{s.code}</button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-neutral-500">Tap a state for its full rules. Your home state has an amber outline.</p>
          </div>
          <StateDetail s={detail} cov={detail ? cov.get(detail.code)! : null} onClose={() => setPicked(null)} />
        </div>
      ) : (
        <StateTable q={q} setQ={setQ} cov={cov} onPick={(c) => { setPicked(c); setView('map'); }} />
      )}
    </div>
  );
}

function Fact({ icon: Icon, title, children }: { icon: typeof Info; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-neutral-950/50 p-3 ring-1 ring-white/5">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400"><Icon className="size-3.5 text-[#f59e0b]" /> {title}</h4>
      <div className="mt-1.5 space-y-1 text-sm leading-relaxed text-neutral-200">{children}</div>
    </div>
  );
}
const Small = ({ children }: { children: React.ReactNode }) => (children ? <p className="text-xs leading-relaxed text-neutral-400">{children}</p> : null);

function StateDetail({ s, cov, onClose }: { s: StateLaw | null; cov: ReturnType<typeof coverage> | null; onClose: () => void }) {
  if (!s || !cov) {
    return <aside className={`${card} flex min-h-64 flex-col items-center justify-center text-center text-sm text-neutral-400`}><MapPin className="mb-2 size-6 text-[#f59e0b]" />Pick a state to see its duty-to-inform, vehicle, magazine, self-defense, preemption and prohibited-place rules.</aside>;
  }
  const honors = s.honors;
  return (
    <aside className={`${card} space-y-3 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto`} aria-label={`${s.name} rules`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-white">{s.name}</h3>
          <p className={`mt-0.5 text-sm font-medium ${KIND[cov.kind].text}`}>{KIND[cov.kind].label}{cov.by.length ? ` — ${cov.by.map((p) => `${p.state} ${p.kind === 'resident' ? 'resident' : 'non-resident'}`).join(', ')}` : ''}</p>
          <p className="text-xs text-neutral-400">{cov.why}</p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-neutral-500 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
      </div>
      <Fact icon={BadgeCheck} title="Permits & reciprocity">
        <p>{s.issuance === 'no-permit-system' ? 'No permit system' : s.issuance === 'may-issue' ? 'May-issue' : 'Shall-issue'}{s.permitless.concealed ? ` · permitless carry${s.permitless.minAge ? ` ${s.permitless.minAge}+` : ''}` : ' · permit required to carry concealed'}</p>
        <p>Honors resident permits from: <b>{honorLabel(honors.residentPermits)}</b> · non-resident permits: <b>{honorLabel(honors.nonResidentPermits)}</b>{honors.minAge ? ` · holder must be ${honors.minAge}+` : ''}</p>
        {Array.isArray(honors.residentPermits) && <Small>Resident: {honors.residentPermits.join(', ')}</Small>}
        {Array.isArray(honors.nonResidentPermits) && honors.nonResidentPermits !== honors.residentPermits && <Small>Non-resident: {honors.nonResidentPermits.join(', ')}</Small>}
        <Small>{honors.notes}</Small>
        <Small>{s.permitless.notes}</Small>
      </Fact>
      <Fact icon={ShieldAlert} title="Duty to inform police"><p><b>{DTI[s.dutyToInform.rule]}</b></p><Small>{s.dutyToInform.notes}</Small></Fact>
      <Fact icon={Car} title="Vehicle carry">
        <p><span className="text-neutral-400">With a permit:</span> {s.vehicle.permitHolder || 'Not stated'}</p>
        <p><span className="text-neutral-400">Without a permit:</span> {s.vehicle.noPermit || 'Not stated'}</p>
        <Small>{s.vehicle.notes}</Small>
      </Fact>
      <Fact icon={Info} title="Magazines & ammo"><p>{s.magazineLimit.limit ? <b className="text-amber-200">Limit: {s.magazineLimit.limit} rounds</b> : 'No magazine limit stated'}</p><Small>{s.magazineLimit.notes}</Small><Small>{s.ammo}</Small></Fact>
      <Fact icon={Scale} title="Self-defense">
        <p>Castle doctrine: <b>{yesNo(s.castleDoctrine)}</b> · Stand your ground: <b>{yesNo(s.standYourGround)}</b></p>
        <Small>{s.selfDefenseNotes}</Small>
      </Fact>
      <Fact icon={Landmark} title="Preemption & local rules"><p className="capitalize">{s.preemption.level === 'unknown' ? 'Not stated' : `${s.preemption.level} preemption`}</p><Small>{s.preemption.notes}</Small></Fact>
      <Fact icon={MapPin} title="Places">
        <ul className="grid gap-1.5">
          {(Object.keys(PLACE_LABEL) as (keyof StateLaw['places'])[]).map((k) => (
            <li key={k} className="text-xs">
              <span className="flex items-center justify-between gap-2"><span className="text-neutral-300">{PLACE_LABEL[k]}</span><span className={`rounded-full px-2 py-0.5 font-medium capitalize ring-1 ${STATUS_STYLE[s.places[k].status]}`}>{s.places[k].status === 'unknown' ? 'Not stated' : s.places[k].status}</span></span>
              {s.places[k].notes && <span className="mt-0.5 block text-neutral-500">{s.places[k].notes}</span>}
            </li>
          ))}
        </ul>
        {s.prohibitedPlaces.length > 0 && <details className="mt-2 text-xs text-neutral-300"><summary className="cursor-pointer text-neutral-400">All {s.prohibitedPlaces.length} off-limits places</summary><ul className="mt-1 list-disc space-y-0.5 pl-4">{s.prohibitedPlaces.map((p, i) => <li key={i}>{p}</li>)}</ul></details>}
        <p className="mt-2 text-xs text-neutral-400">“No guns” signs: <b className="text-neutral-200">{s.noGunSigns.forceOfLaw === null ? 'unclear' : s.noGunSigns.forceOfLaw ? 'have force of law' : 'no force of law'}</b>{s.noGunSigns.notes ? ` — ${s.noGunSigns.notes}` : ''}</p>
      </Fact>
      <Fact icon={Info} title="Open carry & red flag">
        <p>Open carry: <b className="capitalize">{s.openCarry.status.replace('-', ' ')}</b> · Red-flag law: <b>{yesNo(s.redFlag)}</b></p>
        <Small>{s.openCarry.notes}</Small>
      </Fact>
      <Fact icon={BadgeCheck} title="Getting this state’s permit">
        <p>Non-resident permit: <b>{s.nonResidentPermit.issued === null ? 'Unclear' : s.nonResidentPermit.issued ? 'Available' : 'Not for the general public'}</b></p>
        <Small>{s.nonResidentPermit.notes}</Small>
        {s.nonResidentPermit.url && <a href={s.nonResidentPermit.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#f59e0b] hover:underline">Application <ExternalLink className="size-3" /></a>}
        <Small>Residents: {[s.residentPermit.minAge && `age ${s.residentPermit.minAge}+`, s.residentPermit.term, s.residentPermit.issuedBy && `issued by ${s.residentPermit.issuedBy}`, s.residentPermit.training].filter(Boolean).join(' · ')}</Small>
      </Fact>
      {s.notes.length > 0 && <Fact icon={AlertTriangle} title="Also know"><ul className="list-disc space-y-1 pl-4 text-xs text-neutral-300">{s.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></Fact>}
      <a href={s.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#f59e0b] hover:underline">Full {s.name} guide (handgunlaw.us, updated {s.sourceUpdated}) <ExternalLink className="size-3" /></a>
    </aside>
  );
}

function StateTable({ q, setQ, cov, onPick }: { q: string; setQ: (v: string) => void; cov: Map<string, ReturnType<typeof coverage>>; onPick: (code: string) => void }) {
  const rows = STATES.filter((s) => !q || `${s.name} ${s.code}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className={card}>
      <label className="relative mb-3 block max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a state…" className={`${sel} w-full pl-9`} /></label>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-neutral-500">
            <tr>{['State', 'You', 'Permitless', 'Duty to inform', 'Magazine limit', 'Open carry', 'Stand your ground', 'Red flag', 'Preemption', 'Non-res permit'].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((s) => {
              const c = cov.get(s.code)!;
              return (
                <tr key={s.code} onClick={() => onPick(s.code)} className="cursor-pointer hover:bg-white/5">
                  <td className="px-2 py-2 font-medium text-white">{s.name}</td>
                  <td className={`px-2 py-2 ${KIND[c.kind].text}`}>{c.kind === 'permit' ? 'Permit' : c.kind === 'none' ? 'No' : 'Permitless'}</td>
                  <td className="px-2 py-2 text-neutral-300">{s.permitless.concealed ? `Yes${s.permitless.minAge ? ` (${s.permitless.minAge}+)` : ''}` : 'No'}</td>
                  <td className="px-2 py-2 text-neutral-300">{DTI[s.dutyToInform.rule]}</td>
                  <td className="px-2 py-2 text-neutral-300">{s.magazineLimit.limit ?? '—'}</td>
                  <td className="px-2 py-2 capitalize text-neutral-300">{s.openCarry.status.replace('-', ' ')}</td>
                  <td className="px-2 py-2 text-neutral-300">{yesNo(s.standYourGround)}</td>
                  <td className="px-2 py-2 text-neutral-300">{yesNo(s.redFlag)}</td>
                  <td className="px-2 py-2 capitalize text-neutral-300">{s.preemption.level === 'unknown' ? '—' : s.preemption.level}</td>
                  <td className="px-2 py-2 text-neutral-300">{s.nonResidentPermit.issued ? 'Yes' : s.nonResidentPermit.issued === false ? 'No' : '?'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-500">“Not stated” / “—” means the state guide doesn’t say; open the state for the details and the source link.</p>
    </div>
  );
}
