import { describe, expect, it } from 'vitest';
import { suggestLoad, buildSessionPlan, roundToIncrement } from '../lib/progression';
import { addTime, pauseCountdown, remainingMs, resumeCountdown, startCountdown } from '../lib/timer';
import { parseDietText } from '../lib/dietParser';
import { evaluateReadiness } from '../lib/readiness';
import { encryptString, decryptString } from '../lib/crypto';
import { defaultExercises, defaultSettings, defaultTemplates } from '../db/seed';
import { dayKeyOf, addDays } from '../lib/dates';
import type { SetLog } from '../db/types';

const settings = defaultSettings();
const exs = defaultExercises();
const panca = exs.find((e) => e.id === 'panca-piana')!;
const item = defaultTemplates()[0].items[1]; // panca 3x8-10

const mk = (sessionId: string, reps: number[], w: number, rir?: number, ts = 1): SetLog[] =>
  reps.map((r, i) => ({ id: `${sessionId}${i}`, sessionId, exerciseId: panca.id, setIndex: i + 1, reps: r, weightKg: w, rir, techniqueOk: true, timestamp: ts + i, date: '2026-11-17' }));

describe('doppia progressione', () => {
  it('prima volta: nessun carico suggerito', () => {
    expect(suggestLoad(panca, item, [], settings.progression).kind).toBe('first');
  });
  it('tutte le serie al massimo con RIR>=2 → aumento 2-5%', () => {
    const s = suggestLoad(panca, item, mk('a', [10, 10, 10], 50, 2), settings.progression);
    expect(s.kind).toBe('increase');
    expect(s.weightKg).toBeGreaterThan(50);
    expect(s.weightKg! / 50).toBeLessThanOrEqual(1.05);
  });
  it('RIR troppo basso → mantiene', () => {
    expect(suggestLoad(panca, item, mk('a', [10, 10, 10], 50, 1), settings.progression).kind).toBe('keep');
  });
  it('ripetizioni incomplete → mantiene il carico', () => {
    const s = suggestLoad(panca, item, mk('a', [10, 9, 8], 50, 2), settings.progression);
    expect(s.kind).toBe('keep');
    expect(s.weightKg).toBe(50);
  });
  it('arrotonda all\'incremento', () => { expect(roundToIncrement(51.3, 2.5)).toBe(52.5); });
});

describe('piano della seduta', () => {
  it('riduce le serie per gambe e fase di scarico, senza toccare i carichi', () => {
    const map = new Map(exs.map((e) => [e.id, e]));
    const { plan, changes } = buildSessionPlan(defaultTemplates()[0].items, map, { volumeFactor: 0.6, reduceLegs: false, reduceAll: false });
    expect(plan[0].sets).toBe(2);
    expect(changes.length).toBeGreaterThan(0);
    const legs = buildSessionPlan(defaultTemplates()[0].items, map, { volumeFactor: 1, reduceLegs: true, reduceAll: false });
    expect(legs.plan[0].sets).toBe(2); // squat
    expect(legs.plan[1].sets).toBe(3); // panca invariata
  });
});

describe('timer assoluto', () => {
  it('calcola il tempo residuo anche dopo sospensione', () => {
    const t = startCountdown(120000, 1000);
    expect(remainingMs(t, 61000)).toBe(60000);
    expect(remainingMs(t, 500000)).toBe(0);
  });
  it('pausa, ripresa e aggiunta di tempo', () => {
    let t = startCountdown(60000, 0);
    t = pauseCountdown(t, 20000);
    expect(remainingMs(t, 999999)).toBe(40000);
    t = resumeCountdown(t, 100000);
    expect(remainingMs(t, 110000)).toBe(30000);
    t = addTime(t, 30000, 110000);
    expect(remainingMs(t, 110000)).toBe(60000);
  });
});

describe('programma settimanale', () => {
  it('riconosce il giorno della settimana', () => {
    expect(dayKeyOf('2026-11-16')).toBe('lun');
    expect(dayKeyOf('2026-11-18')).toBe('mer');
    expect(dayKeyOf(addDays('2026-11-16', 6))).toBe('dom');
    expect(settings.schedule.sab.type).toBe('match');
  });
});

describe('lettura dieta', () => {
  it('organizza per pasto senza alterare quantità', () => {
    const txt = `PIANO ALIMENTARE\nColazione ore 7:30\n- Yogurt greco 150 g\n- Fiocchi d'avena 40 g oppure pane integrale 50 g\nSpuntino\nFrutta 150 g\nPranzo\nRiso basmati 80 g\nPetto di pollo 150 g\nMerenda\nMandorle 20 g\nCena\nSalmone 150 g\nVerdure a volontà\nGiorno della partita\nPranzo 3 ore prima: pasta 100 g`;
    const p = parseDietText(txt, 'd1');
    expect(p.meals.map((m) => m.key)).toEqual(['colazione', 'spuntino', 'pranzo', 'merenda', 'cena']);
    expect(p.meals[0].time).toBe('07:30');
    const oats = p.meals[0].foods[1];
    expect(oats.quantity).toBe('40 g');
    expect(oats.alternatives[0]).toContain('pane integrale 50 g');
    expect(p.matchNotes.join(' ')).toContain('pasta 100 g');
  });
});

describe('recupero', () => {
  it('suggerisce riduzione con stanchezza alta', () => {
    const r = evaluateReadiness({ sleepQuality: 2, sleepHours: 5, fatigue: 8, legs: 8, pain: false, painNotes: '' }, { reduceThreshold: 55 });
    expect(r.applied).not.toBe('full');
  });
  it('recupero buono: seduta piena', () => {
    const r = evaluateReadiness({ sleepQuality: 5, sleepHours: 8, fatigue: 2, legs: 2, pain: false, painNotes: '' }, { reduceThreshold: 55 });
    expect(r.applied).toBe('full');
  });
});

describe('cifratura backup', () => {
  it('cifra e decifra; passphrase errata fallisce', async () => {
    const env = await encryptString('{"a":1}', 'passphrase-123');
    expect(env.data).not.toContain('"a"');
    expect(await decryptString(env, 'passphrase-123')).toBe('{"a":1}');
    await expect(decryptString(env, 'sbagliata')).rejects.toThrow();
  });
});
