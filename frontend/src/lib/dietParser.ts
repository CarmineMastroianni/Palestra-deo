// Lettura automatica (euristica, senza AI) del testo del piano alimentare.
// Non modifica mai quantità o alimenti: copia il testo così com'è e lo organizza per pasto.
// Il risultato va verificato dall'utente; il documento originale resta sempre consultabile.
import type { DietPlan, MealKey, ParsedFood, ParsedMeal } from '../db/types';
import { MEAL_KEYS } from '../db/types';

const MEAL_PATTERNS: [MealKey, RegExp][] = [
  ['colazione', /^\s*(prima\s+)?colazione\b/i],
  ['spuntino', /^\s*(spuntino|spuntino\s+di\s+met[aà]\s+mattin[ao]|met[aà]\s+mattin[ao])\b/i],
  ['pranzo', /^\s*pranzo\b/i],
  ['merenda', /^\s*(merenda|spuntino\s+pomeridiano|spuntino\s+del\s+pomeriggio)\b/i],
  ['cena', /^\s*cena\b/i]
];

const QTY = /(\d+(?:[.,]\d+)?\s*(?:g|gr|grammi|kg|ml|cl|l|litri|cucchiai(?:no|ni)?|cucchiaio|vasetto|vasetti|fett[ae]|pz|pezzi|porzion[ei]|tazz[ae]|bicchier[ei]|uova|uovo|unità|n\.?)\b\.?)/i;
const ALT_SPLIT = /\s+(?:oppure|o in alternativa|in alternativa|in alternativa a|o)\s+|\s*\/\s*/i;
const TIME = /\b(?:ore\s*)?([01]?\d|2[0-3])[:.]([0-5]\d)\b/;
const TRAINING = /(allenament|palestra|pre[\s-]?workout|post[\s-]?workout|pre[\s-]?allenamento|post[\s-]?allenamento)/i;
const MATCH = /(partita|gara|giorno\s+della\s+partita|match)/i;

export function detectMeal(line: string): MealKey | null {
  for (const [k, re] of MEAL_PATTERNS) if (re.test(line)) return k;
  return null;
}

export function parseFoodLine(line: string): ParsedFood {
  const clean = line.replace(/^[\s•\-–*·●▪]+/, '').trim();
  const parts = clean.split(ALT_SPLIT).map((p) => p.trim()).filter(Boolean);
  const main = parts[0] ?? clean;
  const q = main.match(QTY);
  return {
    text: clean,
    food: q ? main.replace(q[0], '').replace(/\s{2,}/g, ' ').replace(/^[\s:,-]+|[\s:,-]+$/g, '') : main,
    quantity: q ? q[0].trim() : undefined,
    alternatives: parts.slice(1)
  };
}

export function parseDietText(text: string, docId: string): DietPlan {
  const meals = new Map<MealKey, ParsedMeal>();
  const trainingNotes: string[] = [];
  const matchNotes: string[] = [];
  const otherNotes: string[] = [];
  const unassigned: string[] = [];
  let current: MealKey | null = null;
  let section: 'training' | 'match' | null = null;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 1);
  for (const line of lines) {
    const meal = detectMeal(line);
    // dentro una sezione "allenamento/partita" una riga con pasto e contenuto resta nella sezione
    if (meal && section && (QTY.test(line) || line.length > 30)) {
      (section === 'match' ? matchNotes : trainingNotes).push(line);
      continue;
    }
    if (meal) {
      current = meal;
      section = null;
      const m = meals.get(meal) ?? { key: meal, foods: [], notes: [] };
      const t = line.match(TIME);
      if (t) m.time = `${t[1].padStart(2, '0')}:${t[2]}`;
      // eventuale contenuto sulla stessa riga dopo i due punti
      const rest = line.replace(MEAL_PATTERNS.find(([k]) => k === meal)![1], '').replace(TIME, '').replace(/^[\s:–-]+/, '').replace(/^\(?\s*ore\s*\)?/i, '').trim();
      if (rest.length > 2) m.foods.push(parseFoodLine(rest));
      meals.set(meal, m);
      continue;
    }
    const isTraining = TRAINING.test(line);
    const isMatch = MATCH.test(line);
    if ((isTraining || isMatch) && line.length < 60 && !QTY.test(line)) {
      // intestazione di sezione
      section = isMatch ? 'match' : 'training';
      current = null;
      (section === 'match' ? matchNotes : trainingNotes).push(line);
      continue;
    }
    if (section === 'training') { trainingNotes.push(line); continue; }
    if (section === 'match') { matchNotes.push(line); continue; }
    if (current) {
      const m = meals.get(current)!;
      if (QTY.test(line) || /^[\s•\-–*·●▪]/.test(line) || line.length < 80) m.foods.push(parseFoodLine(line));
      else m.notes.push(line);
      if (isTraining) trainingNotes.push(line);
      if (isMatch) matchNotes.push(line);
      continue;
    }
    if (isTraining) trainingNotes.push(line);
    else if (isMatch) matchNotes.push(line);
    else if (/(acqua|integrator|evitare|consigli|note|indicazion)/i.test(line)) otherNotes.push(line);
    else unassigned.push(line);
  }

  return {
    id: docId,
    docId,
    meals: MEAL_KEYS.filter((k) => meals.has(k)).map((k) => meals.get(k)!),
    trainingNotes,
    matchNotes,
    otherNotes,
    unassigned,
    reviewedByUser: false,
    updatedAt: Date.now()
  };
}
