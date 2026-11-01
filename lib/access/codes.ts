import 'server-only';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { listPaths, readJson, removePath, writeJson } from '@/lib/admin/store';

// Access codes the owner makes in admin (/admin/codes). A visitor types one in the email box of the "type your name" screen
// and the box opens at once — no approval, no email. Every use is logged on its own (site/access-code-uses/) so the owner sees
// code sign-ins separately from regular email sign-ups. Codes live only in private storage, never in this public repo.

export const CODES_PATH = 'site/access-codes.json';
const USES_PREFIX = 'site/access-code-uses/';

export interface AccessCode {
  id: string;
  label: string; // who it's for
  /** The code as typed, so the owner can copy it again. Absent for codes kept only as a hash (Claude's own). */
  code?: string;
  hash: string; // sha256 of the normalised code
  /** Boxes it opens: '*' = every locked box. */
  boxes: '*' | string[];
  active: boolean;
  createdAt: string;
}

export interface CodeUse { id: string; codeId: string; label: string; recordId: string; name: string; box: string; at: string; country?: string }

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
/** Case, spaces, dashes and a leading # don't matter: "ab12-cd34" = "AB12CD34". */
export const normaliseCode = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9]/g, '');
export const MIN_CODE = 8;

// Claude's own code, for checking locked pages while working on the site. Only its hash is here; the owner was given the code.
// It's created the first time the code list is read, and can be turned off or deleted like any other.
const SEED: AccessCode[] = [
  { id: 'claude', label: 'Claude (site checks)', hash: 'f92bb5504dee4b0adf5c476eeeacb73a684ee10014ce82ef4f1005d21d13b250', boxes: '*', active: true, createdAt: '2026-11-01T00:00:00.000Z' },
];

export async function listCodes(): Promise<AccessCode[]> {
  return (await readJson<{ codes: AccessCode[] }>(CODES_PATH))?.codes ?? SEED;
}
export const saveCodes = (codes: AccessCode[]) => writeJson(CODES_PATH, { codes });

/** A readable random code, e.g. "K7QM-2XHP-9TRW" (no 0/O or 1/I/L to mix up). */
export function generateCode() {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => a[randomInt(a.length)]).join('')).join('-');
}

export function newCode(label: string, code: string, boxes: '*' | string[]): AccessCode {
  return { id: randomBytes(6).toString('hex'), label, code, hash: sha(normaliseCode(code)), boxes, active: true, createdAt: new Date().toISOString() };
}

/** The active code that matches what was typed and opens this box, or null. */
export async function matchCode(raw: string | undefined, box: string): Promise<AccessCode | null> {
  const n = normaliseCode(raw ?? '');
  if (n.length < MIN_CODE || (raw ?? '').includes('@')) return null;
  const want = Buffer.from(sha(n));
  for (const c of await listCodes()) {
    const b = Buffer.from(c.hash);
    if (c.active && b.length === want.length && timingSafeEqual(b, want) && (c.boxes === '*' || c.boxes.includes(box))) return c;
  }
  return null;
}

/** Logs one use. The file name starts with a countdown number so the newest uses list first. */
export async function logUse(code: AccessCode, rec: { id: string; name: string }, box: string, country?: string) {
  const at = new Date();
  const use: CodeUse = { id: `${String(9_999_999_999_999 - at.getTime()).padStart(13, '0')}-${randomBytes(3).toString('hex')}`, codeId: code.id, label: code.label, recordId: rec.id, name: rec.name, box, at: at.toISOString(), ...(country ? { country } : {}) };
  await writeJson(`${USES_PREFIX}${use.id}.json`, use).catch(() => {});
}

export async function listUses(limit = 300): Promise<CodeUse[]> {
  const paths = await listPaths(USES_PREFIX, limit);
  return (await Promise.all(paths.map((p) => readJson<CodeUse>(p)))).filter((u): u is CodeUse => Boolean(u));
}
