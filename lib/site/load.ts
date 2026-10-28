import 'server-only';
import { cache } from 'react';
import { readJson, readJsonStrict } from '@/lib/admin/store';
import { defaultSettings, sanitizeSettings, settingsSchema, type SiteSettings } from './settings';

export const SETTINGS_PATH = 'site/settings.json';
/** The version before the last save: one click to bring it back from the editor. */
export const PREVIOUS_PATH = 'site/settings.prev.json';

let memo: { at: number; value: SiteSettings } | undefined;

async function readSettings(): Promise<SiteSettings> {
  const raw = await readJson<unknown>(SETTINGS_PATH);
  if (!raw) return defaultSettings();
  const parsed = settingsSchema.safeParse(raw);
  return parsed.success ? sanitizeSettings(parsed.data) : defaultSettings();
}

/**
 * Current site settings (defaults when nothing is saved yet or storage isn't configured). The parsed result is reused
 * for a few seconds per server instance, so a page view doesn't re-read and re-validate the whole file; a save shows up
 * within seconds (and at once on the instance that saved it). `cache` also shares one read within a single render.
 */
export const loadSettings = cache(async (): Promise<SiteSettings> => loadSettingsFast());

/** The same, with a custom reuse window. */
export async function loadSettingsFast(ttlMs = 10_000): Promise<SiteSettings> {
  if (memo && Date.now() - memo.at < ttlMs) return memo.value;
  const value = await readSettings();
  memo = { at: Date.now(), value };
  return value;
}

/** Called after the owner saves, so this server instance sees the change immediately. */
export const forgetSettingsMemo = () => { memo = undefined; };

export type SettingsState = 'saved' | 'none' | 'invalid' | 'unreadable';

/**
 * Like loadSettings, but also says WHERE the settings came from, so the editor can warn when the site is running on
 * factory defaults (nothing saved, a saved file that no longer validates, or storage that couldn't be read). On
 * defaults every private box is locked, which is exactly what looks like "everything is locked".
 */
export async function loadSettingsInfo(): Promise<{ settings: SiteSettings; state: SettingsState; hasPrevious: boolean }> {
  const hasPrevious = Boolean(await readJson<unknown>(PREVIOUS_PATH));
  try {
    const raw = await readJsonStrict<unknown>(SETTINGS_PATH);
    if (!raw) return { settings: defaultSettings(), state: 'none', hasPrevious };
    const parsed = settingsSchema.safeParse(raw);
    return parsed.success ? { settings: sanitizeSettings(parsed.data), state: 'saved', hasPrevious } : { settings: defaultSettings(), state: 'invalid', hasPrevious };
  } catch {
    return { settings: defaultSettings(), state: 'unreadable', hasPrevious };
  }
}
