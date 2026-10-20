import type { PostgrestError } from '@supabase/supabase-js';
import type { ActionResult } from '../types';

export function dbError(error: PostgrestError | null, fallback = 'Something went wrong'): ActionResult<never> {
  if (!error) return { ok: false, error: fallback };
  switch (error.code) {
    case '23505':
      return { ok: false, error: /slug|code/.test(error.message) ? 'That URL / code is already taken.' : 'That record already exists.' };
    case '23503':
      return { ok: false, error: /fund_donation_matches/.test(error.message) ? 'This matcher has applied matches — pause it instead of deleting.' : 'A related record is missing or still in use.' };
    case '23514':
      return { ok: false, error: `Invalid value (${error.message.replace(/^.*constraint "?([a-z_]+)"?.*$/i, '$1')}).` };
    case '42501':
      return { ok: false, error: error.message.includes('row-level security') ? 'You do not have permission to do that.' : error.message };
    default:
      return { ok: false, error: error.message || fallback };
  }
}

export const ok = (message?: string): ActionResult => ({ ok: true, message });
export const fail = (error: string): ActionResult<never> => ({ ok: false, error });

export function randomCode(length = 7) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
