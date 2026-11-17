import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { defaultSettings } from '../db/seed';
import type { AppSettings } from '../db/types';

/** Unisce in profondità i default con quanto salvato (utile quando si aggiungono nuove impostazioni). */
function withDefaults(s: AppSettings | undefined): AppSettings {
  const d = defaultSettings();
  if (!s) return d;
  return {
    ...d,
    ...s,
    profile: { ...d.profile, ...s.profile },
    schedule: { ...d.schedule, ...s.schedule },
    timers: { ...d.timers, ...s.timers },
    progression: { ...d.progression, ...s.progression },
    ai: { ...d.ai, ...s.ai },
    cloud: { ...d.cloud, ...s.cloud },
    security: { ...d.security, ...s.security },
    ui: { ...d.ui, ...s.ui }
  };
}

export async function getSettings(): Promise<AppSettings> {
  return withDefaults(await db.settings.get('app'));
}

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(async () => withDefaults(await db.settings.get('app')), []);
}

type Section = Exclude<keyof AppSettings, 'id' | 'version' | 'updatedAt' | 'onboardingDone'>;

export async function updateSettings<K extends Section>(section: K, patch: Partial<AppSettings[K]>): Promise<void> {
  const cur = await getSettings();
  const next = { ...cur, [section]: { ...(cur[section] as object), ...(patch as object) }, updatedAt: new Date().toISOString() };
  await db.settings.put(next as AppSettings);
}

export async function setSettingsField<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  const cur = await getSettings();
  await db.settings.put({ ...cur, [key]: value, updatedAt: new Date().toISOString() });
}
