import 'server-only';
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';

// Format: scrypt:<N>:<saltHex>:<hashHex> (':' not '$', which .env loaders and shells would expand). Only the hash is ever stored (Vercel env / private blob).
const N = 16384;
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password, salt, KEYLEN, { N: n, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(k))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, N);
  return `scrypt:${N}:${salt.toString('hex')}:${key.toString('hex')}`;
}

// Used so a wrong email costs the same time as a wrong password.
const DUMMY = 'scrypt:16384:00000000000000000000000000000000:' + '00'.repeat(KEYLEN);

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, n, saltHex, hashHex] = (stored || DUMMY).split(':');
  if (scheme !== 'scrypt' || !n || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), Number(n));
  return expected.length === actual.length && timingSafeEqual(expected, actual) && Boolean(stored);
}

export const fingerprint = (hash: string) => createHash('sha256').update(hash).digest('hex').slice(0, 12);
