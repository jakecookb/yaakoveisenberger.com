import type { HonorList, StateLaw } from './types';

export interface HeldPermit { state: string; kind: 'resident' | 'nonresident' }

export type CoverageKind = 'permit' | 'permitless' | 'home' | 'none';
export interface Coverage {
  kind: CoverageKind;
  /** The permits that work here (if any). */
  by: HeldPermit[];
  why: string;
}

const lists = (l: HonorList, code: string) => l === 'all' || (Array.isArray(l) && l.includes(code));

/**
 * Where can someone carry concealed with these permits? For each destination state:
 *  1. at home, only your own state's resident permit (or permitless carry) counts — other states' permits generally
 *     aren't valid for that state's residents;
 *  2. elsewhere, a permit counts if the destination honors that issuer's resident / non-resident permits (and you meet
 *     its age rule), or if it's that state's own non-resident permit;
 *  3. otherwise, permitless carry if the state has it and you're old enough.
 */
export function coverage(dest: StateLaw, permits: HeldPermit[], home: string, age: number): Coverage {
  const permitlessOk = dest.permitless.concealed && age >= (dest.permitless.minAge ?? 21);
  const permitlessWhy = `Permitless carry for eligible adults${dest.permitless.minAge ? ` ${dest.permitless.minAge}+` : ''}`;
  if (dest.code === home) {
    const own = permits.filter((p) => p.state === home && p.kind === 'resident');
    if (own.length) return { kind: 'permit', by: own, why: 'Your home-state permit' };
    if (permitlessOk) return { kind: 'home', by: [], why: `${permitlessWhy} — your home state` };
    return { kind: 'none', by: [], why: 'Residents need this state’s own permit — permits from other states don’t count for residents' };
  }
  const ageOk = age >= (dest.honors.minAge ?? 0);
  const by = permits.filter((p) => {
    if (p.state === dest.code) return p.kind === 'nonresident';
    if (!ageOk) return false;
    return lists(p.kind === 'resident' ? dest.honors.residentPermits : dest.honors.nonResidentPermits, p.state);
  });
  if (by.length) return { kind: 'permit', by, why: dest.honors.notes ? 'Honored — check the conditions below' : 'Honored' };
  if (permitlessOk) return { kind: 'permitless', by: [], why: permitlessWhy };
  if (!ageOk && permits.length) return { kind: 'none', by: [], why: `Honors out-of-state permits only for holders ${dest.honors.minAge}+` };
  return { kind: 'none', by: [], why: permits.length ? 'None of your permits are honored here' : 'Not covered without a permit this state honors' };
}
