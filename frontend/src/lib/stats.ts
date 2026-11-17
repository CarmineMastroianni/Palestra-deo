// Calcoli sui dati registrati: nessun valore stimato senza dati reali.
import { db } from '../db/db';
import type { ActivityLog, AppSettings, Exercise, Measurement, SetLog, WorkoutSession } from '../db/types';
import { DAY_KEYS } from '../db/types';
import { addDays, dayKeyOf, todayISO } from './dates';
import { estimate1RM, groupBySession } from './progression';

export interface ExerciseStats {
  exercise: Exercise;
  sessions: number;
  lastDate?: string;
  lastWeight?: number;
  lastReps?: number[];
  bestWeight?: number;
  bestWeightDate?: string;
  best1RM?: number;
  first1RM?: number;
  last1RM?: number;
  totalReps: number;
  series: { date: string; topWeight: number; e1rm: number; volume: number; reps: number }[];
}

export function exerciseStats(ex: Exercise, sets: SetLog[]): ExerciseStats {
  const groups = groupBySession(sets);
  const series = groups.map((g) => {
    const top = Math.max(...g.map((s) => s.weightKg));
    return {
      date: g[0].date,
      topWeight: top,
      e1rm: Math.max(...g.map((s) => estimate1RM(s.weightKg, s.reps))),
      volume: Math.round(g.reduce((a, s) => a + s.weightKg * s.reps, 0)),
      reps: g.reduce((a, s) => a + s.reps, 0)
    };
  });
  const last = groups[groups.length - 1];
  let bestWeight: number | undefined; let bestWeightDate: string | undefined;
  for (const s of sets) if (bestWeight === undefined || s.weightKg > bestWeight) { bestWeight = s.weightKg; bestWeightDate = s.date; }
  return {
    exercise: ex,
    sessions: groups.length,
    lastDate: last?.[0].date,
    lastWeight: last ? Math.max(...last.map((s) => s.weightKg)) : undefined,
    lastReps: last?.map((s) => s.reps),
    bestWeight,
    bestWeightDate,
    best1RM: series.length ? Math.max(...series.map((s) => s.e1rm)) : undefined,
    first1RM: series[0]?.e1rm,
    last1RM: series[series.length - 1]?.e1rm,
    totalReps: sets.reduce((a, s) => a + s.reps, 0),
    series
  };
}

/** Aderenza: attività programmate vs svolte nell'intervallo [from, to]. */
export function adherence(
  settings: AppSettings,
  sessions: WorkoutSession[],
  activities: ActivityLog[],
  from: string,
  to: string
): { planned: number; done: number; pct: number | null; gymPlanned: number; gymDone: number } {
  let planned = 0; let done = 0; let gymPlanned = 0; let gymDone = 0;
  const completedDates = new Set(sessions.filter((s) => s.status === 'completed').map((s) => s.date));
  const recoveredDates = new Set(sessions.filter((s) => s.status === 'completed' && s.recoveredFrom).map((s) => s.recoveredFrom!));
  const actDone = new Set(activities.filter((a) => a.done).map((a) => `${a.date}|${a.type}`));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const plan = settings.schedule[dayKeyOf(d)];
    if (!plan || plan.type === 'rest') continue;
    planned++;
    if (plan.type === 'gym') {
      gymPlanned++;
      if (completedDates.has(d) || recoveredDates.has(d)) { done++; gymDone++; }
    } else if (actDone.has(`${d}|${plan.type}`)) done++;
  }
  return { planned, done, pct: planned ? Math.round((done / planned) * 100) : null, gymPlanned, gymDone };
}

export function measurementDelta(list: Measurement[], key: keyof Measurement, fromDate?: string): { first?: number; last?: number; delta?: number; firstDate?: string; lastDate?: string } {
  const sorted = list.filter((m) => typeof m[key] === 'number' && (!fromDate || m.date >= fromDate)).sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return {};
  const first = sorted[0][key] as number;
  const last = sorted[sorted.length - 1][key] as number;
  return { first, last, delta: Math.round((last - first) * 10) / 10, firstDate: sorted[0].date, lastDate: sorted[sorted.length - 1].date };
}

/** Valore più recente alla data o prima di essa. */
export function valueAt(list: Measurement[], key: keyof Measurement, date: string): number | undefined {
  const s = list.filter((m) => typeof m[key] === 'number' && m.date <= date).sort((a, b) => b.date.localeCompare(a.date));
  return s[0]?.[key] as number | undefined;
}

export interface Snapshot {
  settings: AppSettings;
  exercises: Exercise[];
  sessions: WorkoutSession[];
  sets: SetLog[];
  activities: ActivityLog[];
  measurements: Measurement[];
}

export async function loadSnapshot(settings: AppSettings): Promise<Snapshot> {
  const [exercises, sessions, sets, activities, measurements] = await Promise.all([
    db.exercises.toArray(), db.sessions.toArray(), db.sets.toArray(), db.activities.toArray(), db.measurements.toArray()
  ]);
  return { settings, exercises, sessions, sets, activities, measurements };
}

export function weekRange(today = todayISO()): { from: string; to: string } {
  const idx = DAY_KEYS.indexOf(dayKeyOf(today));
  return { from: addDays(today, -idx), to: addDays(today, 6 - idx) };
}
