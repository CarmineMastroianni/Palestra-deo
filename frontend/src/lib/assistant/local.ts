// Assistente locale: risponde con calcoli deterministici sui dati registrati.
// Funziona offline e non invia nulla all'esterno. Non inventa: se i dati mancano lo dice.
import { db } from '../../db/db';
import { ACTIVITY_LABELS, MEASURE_FIELDS, type Exercise } from '../../db/types';
import { addDays, dayKeyOf, fmtDate, todayISO } from '../dates';
import { phaseForDate } from '../progression';
import { workloadRatio } from '../readiness';
import { adherence, exerciseStats, measurementDelta, type Snapshot } from '../stats';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function findExercise(q: string, exercises: Exercise[]): Exercise | undefined {
  const nq = norm(q);
  let best: Exercise | undefined; let bestScore = 0;
  for (const e of exercises) {
    const words = norm(e.name).split(/\s+/).filter((w) => w.length > 2);
    const score = words.filter((w) => nq.includes(w)).length / words.length;
    if (score > bestScore) { best = e; bestScore = score; }
  }
  return bestScore >= 0.5 ? best : undefined;
}

export const SUGGESTED_QUESTIONS = [
  'Quale allenamento devo fare oggi?',
  'Quale peso ho usato l\'ultima volta alla panca piana?',
  'Sto aumentando la forza?',
  'Quanto è diminuito il mio girovita?',
  'Come sto procedendo?',
  'Ho accumulato troppa fatica?',
  'Quanti allenamenti ho completato?'
];

export async function answerLocally(question: string, snap: Snapshot): Promise<string> {
  const q = norm(question);
  const { settings, exercises, sessions, sets, activities, measurements } = snap;
  const today = todayISO();
  const completed = sessions.filter((s) => s.status === 'completed');

  // Allenamento di oggi / domani
  if (/(oggi|domani).*(allenament|fare|programma)|(allenament|cosa).*(oggi|domani)/.test(q)) {
    const target = q.includes('domani') ? addDays(today, 1) : today;
    const plan = settings.schedule[dayKeyOf(target)];
    const phases = await db.phases.toArray();
    const ph = phaseForDate(phases, target);
    let txt = `${q.includes('domani') ? 'Domani' : 'Oggi'} (${fmtDate(target, { weekday: 'long', day: 'numeric', month: 'long' })}) è previsto: **${plan.label}**.`;
    if (plan.type === 'gym' && plan.templateId) {
      const tpl = await db.templates.get(plan.templateId);
      if (tpl) {
        const names = new Map(exercises.map((e) => [e.id, e.name]));
        txt += `\n\n${tpl.name}: ${tpl.items.map((i) => `${names.get(i.exerciseId)} ${i.sets}×${i.secMax ? `${i.secMin}-${i.secMax}s` : i.repsMin === i.repsMax ? i.repsMax : `${i.repsMin}-${i.repsMax}`}`).join(', ')}. Cardio: ${tpl.cardio}.`;
      }
      const done = completed.find((s) => s.date === target);
      if (done) txt += '\n\nRisulta già completato.';
    }
    if (ph) txt += `\n\nFase: ${ph.name} (RIR obiettivo ${ph.targetRir}${ph.volumeFactor < 1 ? `, volume ${Math.round(ph.volumeFactor * 100)}%` : ''}).`;
    return txt;
  }

  // Peso usato ultima volta
  if (/(peso|carico|kg).*(ultima|scorsa|usato)|(ultima volta)/.test(q)) {
    const ex = findExercise(question, exercises);
    if (!ex) {
      const lines = exercises.map((e) => ({ e, s: sets.filter((x) => x.exerciseId === e.id) })).filter((x) => x.s.length && x.e.usesLoad)
        .map(({ e, s }) => { const st = exerciseStats(e, s); return `• ${e.name}: ${st.lastWeight} kg (${fmtDate(st.lastDate!)}), ripetizioni ${st.lastReps?.join('/')}`; });
      return lines.length ? `Ultimi carichi registrati:\n${lines.join('\n')}` : 'Non ho ancora carichi registrati. Completa una seduta con la modalità allenamento live.';
    }
    const s = sets.filter((x) => x.exerciseId === ex.id);
    if (!s.length) return `Non ci sono ancora serie registrate per ${ex.name}.`;
    const st = exerciseStats(ex, s);
    return `${ex.name}: l'ultima volta (${fmtDate(st.lastDate!, { weekday: 'long', day: 'numeric', month: 'long' })}) hai usato **${st.lastWeight} kg**, ripetizioni per serie: ${st.lastReps?.join(' / ')}. Miglior carico registrato: ${st.bestWeight} kg.`;
  }

  // Forza
  if (/(forza|piu forte|progress.*carich|carichi.*aument|aumentando)/.test(q)) {
    const rows = exercises.filter((e) => e.usesLoad).map((e) => exerciseStats(e, sets.filter((x) => x.exerciseId === e.id))).filter((st) => st.sessions >= 2);
    if (!rows.length) return 'Servono almeno due sedute registrate per lo stesso esercizio per valutare la forza. Al momento i dati non sono sufficienti.';
    const lines = rows.map((st) => {
      const d = (st.last1RM ?? 0) - (st.first1RM ?? 0);
      const pct = st.first1RM ? Math.round((d / st.first1RM) * 1000) / 10 : 0;
      return `• ${st.exercise.name}: 1RM stimato ${st.first1RM} → ${st.last1RM} kg (${pct >= 0 ? '+' : ''}${pct}%) in ${st.sessions} sedute`;
    });
    const up = rows.filter((st) => (st.last1RM ?? 0) > (st.first1RM ?? 0)).length;
    return `Forza in aumento su ${up} esercizi su ${rows.length} (stima 1RM con formula di Epley, indicativa):\n${lines.join('\n')}`;
  }

  // Misure
  const field = MEASURE_FIELDS.find((f) => q.includes(norm(f.label)) || (f.key === 'weight' && /\bpeso\b|dimagri|chili/.test(q)));
  if (field && /(diminuit|cambiat|variat|sceso|perso|aumentat|quanto|come)/.test(q)) {
    const d = measurementDelta(measurements, field.key);
    if (d.first === undefined) return `Non ci sono ancora misurazioni di ${field.label.toLowerCase()}. Aggiungile dalla sezione Il mio corpo.`;
    if (d.firstDate === d.lastDate) return `Hai una sola misurazione di ${field.label.toLowerCase()} (${d.last} ${field.unit}, ${fmtDate(d.lastDate!)}). Serve almeno una seconda misurazione per un confronto.`;
    return `${field.label}: da ${d.first} ${field.unit} (${fmtDate(d.firstDate!)}) a ${d.last} ${field.unit} (${fmtDate(d.lastDate!)}): variazione di **${d.delta! > 0 ? '+' : ''}${d.delta} ${field.unit}**.`;
  }

  // Fatica
  if (/(fatica|stanc|sovraccaric|riposare|recuper)/.test(q)) {
    const wl = workloadRatio(sessions, activities, today);
    const last = completed.filter((s) => s.readiness).sort((a, b) => b.startedAt - a.startedAt)[0];
    let txt = wl.note + (wl.ratio !== null ? ` (rapporto carico 7 giorni / media 4 settimane: ${wl.ratio}).` : '');
    if (last?.readiness) txt += `\n\nUltimo check (${fmtDate(last.date)}): recupero ${last.readiness.score}/100, stanchezza ${last.readiness.fatigue}/10, gambe ${last.readiness.legs}/10${last.readiness.pain ? `, dolore segnalato (${last.readiness.painNotes || 'senza note'})` : ''}.`;
    txt += '\n\nIl check pre-allenamento ti proporrà eventuali riduzioni di volume. In caso di dolore persistente rivolgiti a un professionista sanitario.';
    return txt;
  }

  // Numero allenamenti
  if (/(quant).*(allenament|sedut)|(allenamenti|sedute).*(complet|fatt)/.test(q)) {
    const byTpl = new Map<string, number>();
    for (const s of completed) byTpl.set(s.templateName, (byTpl.get(s.templateName) ?? 0) + 1);
    const acts = activities.filter((a) => a.done);
    const byType = new Map<string, number>();
    for (const a of acts) byType.set(ACTIVITY_LABELS[a.type], (byType.get(ACTIVITY_LABELS[a.type]) ?? 0) + 1);
    return `Allenamenti in palestra completati: **${completed.length}**${byTpl.size ? ` (${[...byTpl].map(([k, v]) => `${k}: ${v}`).join(', ')})` : ''}.` +
      (acts.length ? `\nAltre attività registrate: ${[...byType].map(([k, v]) => `${k}: ${v}`).join(', ')}.` : '');
  }

  // Andamento generale
  if (/(come sto|procedendo|andamento|progressi|riepilogo|situazione)/.test(q)) {
    const p = settings.profile;
    const adh = adherence(settings, sessions, activities, p.programStart, today);
    const w = measurementDelta(measurements, 'weight');
    const waist = measurementDelta(measurements, 'waist');
    const parts = [`Allenamenti in palestra completati: ${completed.length}.`];
    if (adh.pct !== null) parts.push(`Aderenza al programma dall'inizio (${fmtDate(p.programStart)}): ${adh.pct}% (${adh.done}/${adh.planned}).`);
    if (w.last !== undefined) parts.push(`Peso: iniziale dichiarato ${p.startWeightKg} kg, ultimo registrato ${w.last} kg (${fmtDate(w.lastDate!)}), differenza ${Math.round((w.last - p.startWeightKg) * 10) / 10} kg.`);
    else parts.push('Nessun peso registrato finora.');
    if (waist.delta !== undefined && waist.firstDate !== waist.lastDate) parts.push(`Girovita: ${waist.delta > 0 ? '+' : ''}${waist.delta} cm.`);
    const strength = exercises.filter((e) => e.usesLoad).map((e) => exerciseStats(e, sets.filter((x) => x.exerciseId === e.id))).filter((s) => s.sessions >= 2);
    if (strength.length) parts.push(`Esercizi con carico in aumento: ${strength.filter((s) => (s.last1RM ?? 0) > (s.first1RM ?? 0)).length}/${strength.length}.`);
    return parts.join('\n');
  }

  return 'Con l\'assistente locale posso rispondere a domande su: allenamento di oggi/domani, ultimo carico usato, andamento della forza, variazione di peso e circonferenze, fatica accumulata, numero di allenamenti e andamento generale.\n\nPer domande libere puoi attivare l\'assistente AI (Claude) da Profilo → Assistente AI, scegliendo quali dati condividere.';
}
