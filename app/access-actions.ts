'use server';

import { categories } from '@/data/navigation';
import { clientIp } from '@/lib/admin/session';
import { createOrUpdateRequest } from '@/lib/access/visitor';

const recent = new Map<string, { n: number; first: number }>();

/** A visitor types their name to ask for access to one locked box. */
export async function requestAccess(name: string, categoryId: string, website: string): Promise<{ ok: boolean; error?: string }> {
  if (website) return { ok: true }; // honeypot: bots fill hidden fields
  if (!categories.some((c) => c.id === categoryId && c.lockable)) return { ok: false, error: 'That page can’t be requested.' };
  const ip = await clientIp();
  const r = recent.get(ip);
  if (!r || Date.now() - r.first > 10 * 60_000) recent.set(ip, { n: 1, first: Date.now() });
  else if (++r.n > 6) return { ok: false, error: 'Too many requests. Please try again in a few minutes.' };
  try {
    return await createOrUpdateRequest(name, categoryId);
  } catch {
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}
