// Doppia progressione: si lavora nel range di ripetizioni; quando TUTTE le serie raggiungono
// il massimo del range con RIR >= soglia e tecnica corretta, si propone un aumento del carico
// del 2-5% (arrotondato all'incremento disponibile). Il carico NON viene mai cambiato senza conferma.
import type { Exercise, Phase, ProgressionSettings, SetLog, TemplateItem, TimerSettings } from '../db/types';

export interface LoadSuggestion {
  weightKg: number | null;
  lastWeightKg: number | null;
  kind: 'increase' | 'keep' | 'decrease' | 'first' | 'none';
  reason: string;
}

export function roundToIncrement(value: number, inc: number): number {
  if (!inc || inc <= 0) return Math.round(value * 10) / 10;
  return Math.round(value / inc) * inc;
}

/** Raggruppa i set per sessione in ordine cronologico (più recente per ultimo). */
export function groupBySession(sets: SetLog[]): SetLog[][] {
  const map = new Map<string, SetLog[]>();
  for (const s of [...sets].sort((a, b) => a.timestamp - b.timestamp)) {
    const arr = map.get(s.sessionId) ?? [];
    arr.push(s);
    map.set(s.sessionId, arr);
  }
  return [...map.values()];
}

export function suggestLoad(
  exercise: Exercise,
  item: TemplateItem,
  history: SetLog[],
  settings: ProgressionSettings
): LoadSuggestion {
  if (!exercise.usesLoad || exercise.mode !== 'reps') {
    return { weightKg: null, lastWeightKg: null, kind: 'none', reason: 'Esercizio senza carico esterno.' };
  }
  const sessions = groupBySession(history);
  const last = sessions[sessions.length - 1];
  if (!last || last.length === 0) {
    return { weightKg: null, lastWeightKg: null, kind: 'first', reason: 'Prima volta: scegli un carico che ti lasci almeno 2-3 ripetizioni di riserva.' };
  }
  // carico di lavoro = il più usato nell'ultima seduta
  const lastWeight = mode(last.map((s) => s.weightKg));
  const working = last.filter((s) => s.weightKg === lastWeight);
  const allTop = working.length >= item.sets && working.every((s) => s.reps >= item.repsMax);
  const rirOk = working.every((s) => s.rir === undefined || s.rir >= settings.rirThreshold);
  const rirKnown = working.some((s) => s.rir !== undefined);
  const techOk = working.every((s) => s.techniqueOk);
  const belowMin = working.filter((s) => s.reps < item.repsMin).length;

  if (allTop && rirOk && techOk) {
    const inc = exercise.loadIncrementKg || 2.5;
    const minW = lastWeight * (1 + settings.minIncreasePct / 100);
    const maxW = lastWeight * (1 + settings.maxIncreasePct / 100);
    let next = roundToIncrement(minW, inc);
    if (next <= lastWeight) next = lastWeight + inc;
    const note = next > maxW ? ` (l'incremento minimo disponibile, ${inc} kg, supera il ${settings.maxIncreasePct}%: valuta se restare e aggiungere ripetizioni)` : '';
    return {
      weightKg: Math.round(next * 100) / 100,
      lastWeightKg: lastWeight,
      kind: 'increase',
      reason: `Ultima volta tutte le serie a ${item.repsMax} ripetizioni${rirKnown ? ` con RIR ≥ ${settings.rirThreshold}` : ''} e tecnica corretta: proposta +${settings.minIncreasePct}-${settings.maxIncreasePct}%${note}.`
    };
  }
  if (belowMin >= 2 || (sessions.length >= 2 && stalledTwice(sessions, item))) {
    const inc = exercise.loadIncrementKg || 2.5;
    const dec = roundToIncrement(lastWeight * 0.95, inc);
    return {
      weightKg: dec < lastWeight ? dec : lastWeight,
      lastWeightKg: lastWeight,
      kind: 'decrease',
      reason: 'Più serie sotto il minimo di ripetizioni: valuta di ridurre leggermente il carico (~5%) per restare nel range.'
    };
  }
  let reason = `Resta a ${lastWeight} kg e cerca di aggiungere ripetizioni fino a ${item.repsMax} in tutte le serie.`;
  if (allTop && !rirOk) reason = `Ripetizioni complete ma RIR sotto ${settings.rirThreshold}: consolida il carico prima di aumentare.`;
  if (allTop && rirOk && !techOk) reason = 'Ripetizioni complete ma tecnica segnalata come non corretta: consolida il carico.';
  return { weightKg: lastWeight, lastWeightKg: lastWeight, kind: 'keep', reason };
}

function stalledTwice(sessions: SetLog[][], item: TemplateItem): boolean {
  const lastTwo = sessions.slice(-2);
  return lastTwo.every((ss) => ss.filter((s) => s.reps < item.repsMin).length >= 1) &&
    lastTwo[0][0]?.weightKg === lastTwo[1][0]?.weightKg;
}

function mode(nums: number[]): number {
  const c = new Map<number, number>();
  for (const n of nums) c.set(n, (c.get(n) ?? 0) + 1);
  let best = nums[0];
  let bc = 0;
  for (const [n, k] of c) if (k > bc || (k === bc && n > best)) { best = n; bc = k; }
  return best;
}

export function defaultRestSec(ex: Exercise, timers: TimerSettings): number {
  switch (ex.category) {
    case 'main': return timers.restMainSec;
    case 'core': return timers.restCoreSec;
    case 'cardio': return timers.restCardioSec;
    case 'mobility': return timers.restCoreSec;
    default: return timers.restComplementarySec;
  }
}

export function phaseForDate(phases: Phase[], iso: string): Phase | undefined {
  return phases.find((p) => p.start <= iso && iso <= p.end);
}

/** Stima 1RM (Epley) – solo indicativa, per i grafici di forza. */
export function estimate1RM(weight: number, reps: number): number {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** Applica volume della fase e protezioni al piano della seduta. Non cambia mai i carichi. */
export function buildSessionPlan(
  items: TemplateItem[],
  exercises: Map<string, Exercise>,
  opts: { volumeFactor: number; reduceLegs: boolean; reduceAll: boolean }
): { plan: TemplateItem[]; changes: string[] } {
  const changes: string[] = [];
  const plan = items.map((it) => {
    const ex = exercises.get(it.exerciseId);
    let sets = it.sets;
    if (opts.volumeFactor < 1) sets = Math.max(1, Math.round(sets * opts.volumeFactor));
    if (opts.reduceAll && sets > 1) sets -= 1;
    const isLegs = ex ? [...ex.primaryMuscles].some((m) => ['quadricipiti', 'femorali', 'glutei', 'polpacci', 'adduttori'].includes(m)) : false;
    if (opts.reduceLegs && isLegs && sets > 1 && ex?.category !== 'core') sets -= 1;
    if (sets !== it.sets && ex) changes.push(`${ex.name}: ${it.sets} → ${sets} serie`);
    return { ...it, sets };
  });
  return { plan, changes };
}
