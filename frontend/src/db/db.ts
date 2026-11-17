import Dexie, { type EntityTable } from 'dexie';
import type {
  ActivityLog, AppSettings, AvatarConfig, ChatMessage, DietDoc, DietPlan, Exercise, LiveState,
  MealLog, Measurement, MediaBlob, Phase, Photo, SetLog, WorkoutSession, WorkoutTemplate
} from './types';

export class FitnessDB extends Dexie {
  settings!: EntityTable<AppSettings, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  templates!: EntityTable<WorkoutTemplate, 'id'>;
  phases!: EntityTable<Phase, 'id'>;
  sessions!: EntityTable<WorkoutSession, 'id'>;
  sets!: EntityTable<SetLog, 'id'>;
  activities!: EntityTable<ActivityLog, 'id'>;
  measurements!: EntityTable<Measurement, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  media!: EntityTable<MediaBlob, 'id'>;
  dietDocs!: EntityTable<DietDoc, 'id'>;
  dietPlans!: EntityTable<DietPlan, 'id'>;
  mealLogs!: EntityTable<MealLog, 'id'>;
  avatar!: EntityTable<AvatarConfig, 'id'>;
  chat!: EntityTable<ChatMessage, 'id'>;
  live!: EntityTable<LiveState, 'id'>;

  constructor(name = 'my-fitness-futsal') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      exercises: 'id, name, category',
      templates: 'id, name',
      phases: 'id, start, end',
      sessions: 'id, date, templateId, status, startedAt',
      sets: 'id, sessionId, exerciseId, date, timestamp, [exerciseId+date]',
      activities: 'id, date, type',
      measurements: 'id, date',
      photos: 'id, date, view, purpose',
      media: 'id, createdAt',
      dietDocs: 'id, uploadedAt, active',
      dietPlans: 'id, docId',
      mealLogs: 'id, date, meal',
      avatar: 'id',
      chat: 'id, at',
      live: 'id'
    });
  }
}

export const db = new FitnessDB();

/** Tabelle incluse in export/backup (ordine di ripristino) */
export const DATA_TABLES = [
  'settings', 'exercises', 'templates', 'phases', 'sessions', 'sets', 'activities', 'measurements',
  'photos', 'media', 'dietDocs', 'dietPlans', 'mealLogs', 'avatar', 'chat', 'live'
] as const;
export type DataTable = (typeof DATA_TABLES)[number];

export function uid(prefix = ''): string {
  const r = crypto.getRandomValues(new Uint8Array(8));
  return prefix + Date.now().toString(36) + Array.from(r, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Richiede al browser di non cancellare i dati in caso di poco spazio (se supportato). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch { /* non supportato */ }
  return null;
}
