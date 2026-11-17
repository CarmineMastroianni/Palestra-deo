// Valutazione del recupero pre-allenamento. Regole prudenti e trasparenti:
// non aggiunge mai lavoro, può solo suggerire riduzioni.
import type { ActivityLog, DayPlan, Readiness, WorkoutSession } from '../db/types';

export interface ReadinessInput {
  sleepQuality: number; // 1-5
  sleepHours?: number;
  fatigue: number;      // 1-10
  legs: number;         // 1-10
  pain: boolean;
  painNotes: string;
}

export function evaluateReadiness(
  input: ReadinessInput,
  ctx: { reduceThreshold: number; nextDay?: DayPlan; protectLegs?: boolean }
): Readiness {
  const sleepScore = ((input.sleepQuality - 1) / 4) * 100;
  const hoursScore = input.sleepHours ? Math.max(0, Math.min(100, ((input.sleepHours - 4) / 4) * 100)) : sleepScore;
  const fatigueScore = ((10 - input.fatigue) / 9) * 100;
  const legsScore = ((10 - input.legs) / 9) * 100;
  let score = sleepScore * 0.2 + hoursScore * 0.1 + fatigueScore * 0.4 + legsScore * 0.3;
  if (input.pain) score -= 15;
  score = Math.round(Math.max(0, Math.min(100, score)));

  const advice: string[] = [];
  let applied: Readiness['applied'] = 'full';

  if (input.pain) {
    advice.push('Hai segnalato dolore o fastidio: evita gli esercizi che lo provocano e, se persiste, consulta un medico o un fisioterapista. L\'app non fornisce diagnosi.');
  }
  if (score < ctx.reduceThreshold - 20 || input.fatigue >= 9) {
    applied = 'light';
    advice.push('Recupero molto basso: proposta seduta leggera (una serie in meno per esercizio, gambe ridotte, RIR ≥ 3) oppure riposo.');
  } else if (score < ctx.reduceThreshold || input.fatigue >= 7) {
    applied = 'reduced';
    advice.push('Recupero insufficiente: proposta riduzione del volume (una serie in meno sugli esercizi principali) e niente cedimento.');
  }
  if (input.legs >= 7) {
    if (applied === 'full') applied = 'reduced';
    advice.push('Gambe affaticate: una serie in meno sugli esercizi per gli arti inferiori.');
  }
  const nextIsFutsal = ctx.nextDay && (ctx.nextDay.type === 'futsal' || ctx.nextDay.type === 'match');
  if (ctx.protectLegs || nextIsFutsal) {
    advice.push(`Domani: ${ctx.nextDay?.label ?? 'calcio a 5'}. Mantieni gli esercizi per le gambe con almeno 3 ripetizioni di riserva.`);
  }
  if (advice.length === 0) advice.push('Recupero adeguato: puoi svolgere la seduta come programmato.');

  return { ...input, score, advice, applied };
}

/**
 * Carico di lavoro recente (indicativo): sessioni palestra + attività calcio con RPE.
 * Restituisce il rapporto tra ultimi 7 giorni e media delle 4 settimane (acute:chronic).
 */
export function workloadRatio(
  sessions: WorkoutSession[],
  activities: ActivityLog[],
  today: string
): { acute: number; chronic: number; ratio: number | null; note: string } {
  const t = new Date(today + 'T12:00:00').getTime();
  const day = 86400000;
  const load = (ts: number, units: number) => ({ ts, units });
  const items = [
    ...sessions.filter((s) => s.status === 'completed').map((s) => {
      const min = s.endedAt ? (s.endedAt - s.startedAt) / 60000 : 60;
      return load(new Date(s.date + 'T12:00:00').getTime(), Math.min(150, min) * 6);
    }),
    ...activities.filter((a) => a.done).map((a) => load(new Date(a.date + 'T12:00:00').getTime(), (a.durationMin ?? 90) * (a.rpe ?? 6)))
  ];
  const acute = items.filter((i) => t - i.ts >= 0 && t - i.ts < 7 * day).reduce((s, i) => s + i.units, 0);
  const chronicTotal = items.filter((i) => t - i.ts >= 0 && t - i.ts < 28 * day).reduce((s, i) => s + i.units, 0);
  const chronic = chronicTotal / 4;
  const enoughHistory = items.some((i) => t - i.ts >= 21 * day);
  const ratio = chronic > 0 && enoughHistory ? Math.round((acute / chronic) * 100) / 100 : null;
  let note = 'Dati insufficienti (servono almeno 3-4 settimane di registrazioni) per valutare l\'accumulo di fatica.';
  if (ratio !== null) {
    if (ratio > 1.5) note = 'Carico dell\'ultima settimana molto superiore alla tua media: rischio di fatica accumulata, valuta una riduzione.';
    else if (ratio > 1.3) note = 'Carico in aumento rispetto alla media: monitora sonno e sensazioni.';
    else if (ratio < 0.7) note = 'Carico inferiore alla tua media recente.';
    else note = 'Carico in linea con la tua media delle ultime 4 settimane.';
  }
  return { acute: Math.round(acute), chronic: Math.round(chronic), ratio, note };
}
