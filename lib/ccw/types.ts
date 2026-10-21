// One state's carry laws, summarised from the handgunlaw.us state guide (see `source` / `sourceUpdated`).
// null / "unknown" means the guide doesn't say — never a guess.

export type PlaceStatus = 'prohibited' | 'allowed' | 'restricted' | 'unknown';
export interface Place { status: PlaceStatus; notes: string }
export type HonorList = 'all' | 'none' | string[];

export interface StateLaw {
  code: string;
  name: string;
  slug: string;
  source: string;
  sourceUpdated: string;
  issuance: 'shall-issue' | 'may-issue' | 'no-permit-system';
  permitless: { concealed: boolean; minAge: number | null; notes: string };
  honors: { residentPermits: HonorList; nonResidentPermits: HonorList; minAge: number | null; notes: string };
  residentPermit: { minAge: number | null; term: string | null; issuedBy: string | null; training: string | null; notes: string };
  nonResidentPermit: { issued: boolean | null; notes: string; url: string | null };
  dutyToInform: { rule: 'immediately' | 'upon-request' | 'no' | 'varies'; notes: string };
  vehicle: { permitHolder: string; noPermit: string; notes: string };
  magazineLimit: { limit: number | null; notes: string };
  ammo: string | null;
  castleDoctrine: boolean | null;
  standYourGround: boolean | null;
  selfDefenseNotes: string;
  preemption: { level: 'full' | 'partial' | 'none' | 'unknown'; notes: string };
  places: Record<'schools' | 'restAreas' | 'stateParks' | 'pollingPlaces' | 'airports' | 'bars' | 'churches' | 'stateBuildings', Place>;
  prohibitedPlaces: string[];
  noGunSigns: { forceOfLaw: boolean | null; notes: string };
  openCarry: { status: 'permitless' | 'permit-required' | 'prohibited' | 'restricted'; notes: string };
  redFlag: boolean | null;
  notes: string[];
}
