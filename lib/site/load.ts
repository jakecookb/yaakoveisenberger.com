import 'server-only';
import { cache } from 'react';
import { readJson } from '@/lib/admin/store';
import { defaultSettings, sanitizeSettings, settingsSchema, type SiteSettings } from './settings';

export const SETTINGS_PATH = 'site/settings.json';

/** Current site settings (defaults when nothing is saved yet or storage isn't configured). */
export const loadSettings = cache(async (): Promise<SiteSettings> => {
  const raw = await readJson<unknown>(SETTINGS_PATH);
  if (!raw) return defaultSettings();
  const parsed = settingsSchema.safeParse(raw);
  return parsed.success ? sanitizeSettings(parsed.data) : defaultSettings();
});

let memo: { at: number; value: SiteSettings } | undefined;

/**
 * For routes hit many times in a row (every photo on a page asks for the settings to check its lock). Reuses the last read
 * for a few seconds instead of fetching storage again each time. Pages themselves use the uncached `loadSettings`.
 */
export async function loadSettingsFast(ttlMs = 5000): Promise<SiteSettings> {
  if (memo && Date.now() - memo.at < ttlMs) return memo.value;
  const value = await loadSettings();
  memo = { at: Date.now(), value };
  return value;
}

/** Called after the owner saves, so this server instance sees the change immediately. */
export const forgetSettingsMemo = () => { memo = undefined; };
