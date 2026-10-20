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
