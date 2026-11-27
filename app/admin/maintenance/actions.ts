'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/session';
import { isBlobConfigured, readJson, writeJson } from '@/lib/admin/store';
import { cleanMaintenance, DEFAULT_MAINTENANCE, MAINTENANCE_PATH, type Maintenance } from '@/lib/maintenance/page';
import { loadSettings } from '@/lib/site/load';
import { mediaUrl } from '@/lib/site/settings';

export async function loadMaintenance(): Promise<Maintenance> {
  return cleanMaintenance((await readJson<unknown>(MAINTENANCE_PATH)) ?? DEFAULT_MAINTENANCE);
}

/** Saves the closed-for-now page (and whether it's on). Takes effect across the site within about 10 seconds. */
export async function saveMaintenance(input: unknown): Promise<{ ok: boolean; error?: string; saved?: Maintenance }> {
  await requireAdmin();
  if (!isBlobConfigured) return { ok: false, error: 'Storage is not connected.' };
  const settings = await loadSettings();
  const m = cleanMaintenance(input);
  m.heroLogoUrl = settings.hero.logoPath ? mediaUrl(settings.hero.logoPath) : '';
  m.updatedAt = new Date().toISOString();
  await writeJson(MAINTENANCE_PATH, m);
  revalidatePath('/admin/maintenance');
  return { ok: true, saved: m };
}
