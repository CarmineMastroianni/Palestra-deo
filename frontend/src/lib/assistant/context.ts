// Costruisce un riepilogo testuale dei dati REALI registrati, usato dall'assistente.
// Include solo le categorie per cui l'utente ha dato il consenso.
import { db } from '../../db/db';
import { ACTIVITY_LABELS, MEAL_LABELS, MEASURE_FIELDS } from '../../db/types';
import { addDays, dayKeyOf, todayISO } from '../dates';
import { phaseForDate } from '../progression';
import { workloadRatio } from '../readiness';
import { adherence, exerciseStats, measurementDelta, type Snapshot } from '../stats';

export async function buildDataContext(snap: Snapshot, consent: { training: boolean; body: boolean; diet: boolean }): Promise<string> {
  const { settings, exercises, sessions, sets, activities, measurements } = snap;
  const today = todayISO();
  const phases = await db.phases.toArray();
  const out: string[] = [];
  const p = settings.profile;
  out.push(`Data di oggi: ${today}. Programma dal ${p.programStart} al ${p.programEnd}.`);
  out.push(`Profilo: ${p.age} anni, ${p.heightCm} cm, peso iniziale ${p.startWeightKg} kg, sport: ${p.sport}; ruoli: ${p.roles}; esperienza palestra: ${p.gymExperience}; infortuni: ${p.injuries}. Obiettivo: ${p.mainGoal}. Secondari: ${p.secondaryGoals}.`);
  const ph = phaseForDate(phases, today);
  out.push(`Fase attuale: ${ph ? `${ph.name} (${ph.start} → ${ph.end}, RIR obiettivo ${ph.targetRir}, volume ${Math.round(ph.volumeFactor * 100)}%)` : 'nessuna fase definita per oggi'}.`);
  out.push('Programma settimanale: ' + Object.entries(settings.schedule).map(([k, v]) => `${k}: ${v.label}`).join('; ') + '.');
  out.push(`Oggi (${dayKeyOf(today)}): ${settings.schedule[dayKeyOf(today)]?.label}. Domani: ${settings.schedule[dayKeyOf(addDays(today, 1))]?.label}.`);

  if (consent.training) {
    const completed = sessions.filter((s) => s.status === 'completed').sort((a, b) => a.date.localeCompare(b.date));
    out.push(`Allenamenti in palestra completati: ${completed.length}.`);
    if (completed.length) out.push('Ultime sedute: ' + completed.slice(-6).map((s) => `${s.date} ${s.templateName}${s.readiness ? ` (recupero ${s.readiness.score}/100)` : ''}`).join('; ') + '.');
    const acts = activities.filter((a) => a.done).sort((a, b) => a.date.localeCompare(b.date)).slice(-8);
    if (acts.length) out.push('Attività calcio/recupero registrate: ' + acts.map((a) => `${a.date} ${ACTIVITY_LABELS[a.type]}${a.rpe ? ` RPE ${a.rpe}` : ''}${a.durationMin ? ` ${a.durationMin}min` : ''}`).join('; ') + '.');
    const adh = adherence(settings, sessions, activities, p.programStart, today < p.programEnd ? today : p.programEnd);
    if (adh.pct !== null) out.push(`Aderenza dall'inizio: ${adh.done}/${adh.planned} attività programmate (${adh.pct}%), palestra ${adh.gymDone}/${adh.gymPlanned}.`);
    const wl = workloadRatio(sessions, activities, today);
    out.push(`Carico di lavoro: ${wl.note}${wl.ratio !== null ? ` (rapporto 7gg/28gg = ${wl.ratio})` : ''}.`);
    const lastReadiness = completed.filter((s) => s.readiness).slice(-3);
    if (lastReadiness.length) out.push('Ultimi check di recupero: ' + lastReadiness.map((s) => `${s.date}: sonno ${s.readiness!.sleepQuality}/5, stanchezza ${s.readiness!.fatigue}/10, gambe ${s.readiness!.legs}/10${s.readiness!.pain ? `, dolore: ${s.readiness!.painNotes}` : ''}`).join('; ') + '.');
    for (const ex of exercises.filter((e) => !e.archived)) {
      const exSets = sets.filter((s) => s.exerciseId === ex.id);
      if (!exSets.length) continue;
      const st = exerciseStats(ex, exSets);
      out.push(`Esercizio ${ex.name}: ${st.sessions} sedute, ultima ${st.lastDate} con ${st.lastWeight ?? 0} kg, ripetizioni ${st.lastReps?.join('/')}; miglior carico ${st.bestWeight} kg (${st.bestWeightDate})${st.first1RM && st.last1RM ? `; 1RM stimato da ${st.first1RM} a ${st.last1RM} kg` : ''}.`);
    }
  }
  if (consent.body) {
    const ms = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
    out.push(`Misurazioni registrate: ${ms.length}.`);
    for (const f of MEASURE_FIELDS) {
      const d = measurementDelta(ms, f.key);
      if (d.first !== undefined) out.push(`${f.label}: da ${d.first} ${f.unit} (${d.firstDate}) a ${d.last} ${f.unit} (${d.lastDate}), variazione ${d.delta! > 0 ? '+' : ''}${d.delta} ${f.unit}.`);
    }
  }
  if (consent.diet) {
    const plan = await activeDietPlan();
    if (plan) {
      out.push('Piano alimentare del nutrizionista (lettura automatica, NON modificabile): ' + plan.meals.map((m) => `${MEAL_LABELS[m.key]}${m.time ? ` ${m.time}` : ''}: ${m.foods.map((f) => f.text).join('; ')}`).join(' | '));
      if (plan.trainingNotes.length) out.push('Indicazioni per gli allenamenti: ' + plan.trainingNotes.join(' '));
      if (plan.matchNotes.length) out.push('Indicazioni giorno partita: ' + plan.matchNotes.join(' '));
    }
  }
  return out.join('\n');
}

export async function activeDietPlan() {
  const doc = (await db.dietDocs.toArray()).filter((d) => d.active).sort((a, b) => b.uploadedAt - a.uploadedAt)[0];
  if (!doc) return undefined;
  return db.dietPlans.get(doc.id);
}
