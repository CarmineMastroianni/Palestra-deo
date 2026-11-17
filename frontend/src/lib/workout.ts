import { db, uid } from '../db/db';
import type { ActivityType, Readiness, SetLog, TemplateItem, WorkoutSession } from '../db/types';
import { addDays, dayKeyOf, todayISO } from './dates';
import { buildSessionPlan, phaseForDate } from './progression';
import { getSettings } from './settings';
import { markPendingSync } from './sync';

export async function activeSession(): Promise<WorkoutSession | undefined> {
  const live = await db.live.get('live');
  if (!live) return undefined;
  const s = await db.sessions.get(live.sessionId);
  return s?.status === 'in_progress' ? s : undefined;
}

export async function startSession(opts: { templateId: string; date: string; readiness?: Readiness; recoveredFrom?: string; applyReduction: boolean }): Promise<string> {
  const tpl = await db.templates.get(opts.templateId);
  if (!tpl) throw new Error('Scheda non trovata');
  const settings = await getSettings();
  const phases = await db.phases.toArray();
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  const phase = phaseForDate(phases, opts.date);
  const nextDay = settings.schedule[dayKeyOf(addDays(opts.date, 1))];
  const reduce = opts.applyReduction && opts.readiness && opts.readiness.applied !== 'full';
  const { plan } = buildSessionPlan(tpl.items, exercises, {
    volumeFactor: phase?.volumeFactor ?? 1,
    reduceAll: !!reduce && (opts.readiness!.applied === 'light' || opts.readiness!.fatigue >= 7),
    reduceLegs: !!reduce && (opts.readiness!.legs >= 7 || opts.readiness!.applied === 'light' || ((nextDay?.type === 'futsal' || nextDay?.type === 'match') && opts.readiness!.legs >= 6))
  });
  const id = uid('s-');
  const session: WorkoutSession = {
    id, date: opts.date, templateId: tpl.id, templateName: tpl.name, startedAt: Date.now(), status: 'in_progress',
    readiness: opts.readiness, plan, phaseName: phase?.name, notes: '', recoveredFrom: opts.recoveredFrom
  };
  await db.transaction('rw', db.sessions, db.live, async () => {
    // chiude eventuali sedute rimaste aperte
    const open = await db.sessions.where('status').equals('in_progress').toArray();
    for (const o of open) await db.sessions.update(o.id, { status: 'abandoned', endedAt: Date.now() });
    await db.sessions.put(session);
    await db.live.put({ id: 'live', sessionId: id, itemIndex: 0, setIndex: 1, reps: 0, weightKg: 0, phase: 'work', updatedAt: Date.now() });
  });
  return id;
}

export async function finishSession(id: string, notes: string, cardio?: { minutes: number; notes: string }): Promise<void> {
  await db.sessions.update(id, { status: 'completed', endedAt: Date.now(), notes, cardioDone: cardio });
  await db.live.delete('live');
  markPendingSync();
}

export async function abandonSession(id: string): Promise<void> {
  const sets = await db.sets.where('sessionId').equals(id).count();
  if (sets === 0) await db.sessions.delete(id);
  else await db.sessions.update(id, { status: 'abandoned', endedAt: Date.now() });
  await db.live.delete('live');
}

export async function logSet(s: Omit<SetLog, 'id'>): Promise<SetLog> {
  const row = { ...s, id: uid('set-') };
  await db.sets.put(row);
  return row;
}

export async function setActivityDone(date: string, type: ActivityType, data: { done: boolean; durationMin?: number; rpe?: number; notes?: string }): Promise<void> {
  const existing = (await db.activities.where('date').equals(date).toArray()).find((a) => a.type === type);
  await db.activities.put({ id: existing?.id ?? uid('a-'), date, type, done: data.done, durationMin: data.durationMin, rpe: data.rpe, notes: data.notes ?? '' });
  markPendingSync();
}

export type DayStatus = 'done' | 'missed' | 'planned' | 'rest' | 'today';

/** Sedute palestra programmate nelle ultime 2 settimane e non svolte né recuperate. */
export async function missedGymDays(today = todayISO()): Promise<{ date: string; templateId: string; label: string }[]> {
  const settings = await getSettings();
  const sessions = await db.sessions.where('date').between(addDays(today, -14), today, true, true).toArray();
  const done = new Set(sessions.filter((s) => s.status === 'completed').flatMap((s) => [s.date, s.recoveredFrom ?? '']));
  const out: { date: string; templateId: string; label: string }[] = [];
  for (let d = addDays(today, -14); d < today; d = addDays(d, 1)) {
    if (d < settings.profile.programStart) continue;
    const p = settings.schedule[dayKeyOf(d)];
    if (p.type === 'gym' && p.templateId && !done.has(d)) out.push({ date: d, templateId: p.templateId, label: p.label });
  }
  return out.reverse();
}

export function planSummary(items: TemplateItem[]): string {
  return `${items.length} esercizi · ${items.reduce((a, i) => a + i.sets, 0)} serie`;
}
