// Programma iniziale fornito dall'utente. Non sono dati dimostrativi:
// è la scheda reale richiesta, interamente modificabile dalle Impostazioni.
import { db, uid } from './db';
import type { AppSettings, AvatarConfig, Exercise, Phase, WorkoutTemplate } from './types';

export const SETTINGS_VERSION = 1;

export function defaultSettings(): AppSettings {
  return {
    id: 'app',
    version: SETTINGS_VERSION,
    profile: {
      name: '',
      age: 36,
      heightCm: 178,
      startWeightKg: 87,
      sex: 'M',
      sport: 'Calcio a 5 agonistico – campionato C1',
      roles: 'Più ruoli',
      gymExperience: 'Intermedia',
      injuries: 'Nessuno',
      mainGoal: 'Perdita di grasso corporeo mantenendo la massa muscolare',
      secondaryGoals: 'Forza, ipertrofia, definizione, stabilità, performance atletica',
      programStart: '2026-11-16',
      programEnd: '2027-03-31'
    },
    schedule: {
      lun: { type: 'gym', label: 'Palestra – Scheda A', templateId: 'tpl-a' },
      mar: { type: 'futsal', label: 'Allenamento calcio a 5', durationMin: 120 },
      mer: { type: 'gym', label: 'Palestra – Scheda B', templateId: 'tpl-b' },
      gio: { type: 'futsal', label: 'Allenamento calcio a 5', durationMin: 120 },
      ven: { type: 'rest', label: 'Riposo' },
      sab: { type: 'match', label: 'Partita' },
      dom: { type: 'active_recovery', label: 'Recupero attivo', durationMin: 30, notes: 'Camminata, mobilità, stretching leggero' }
    },
    timers: {
      restMainSec: 120,
      restComplementarySec: 75,
      restCoreSec: 50,
      restCardioSec: 60,
      countdownBeforeIsoSec: 3,
      sound: true,
      vibration: true,
      notifications: false,
      voice: false,
      keepScreenOn: true
    },
    progression: {
      minIncreasePct: 2,
      maxIncreasePct: 5,
      rirThreshold: 2,
      deloadEveryWeeks: 0,
      readinessReduceThreshold: 55
    },
    ai: {
      mode: 'local',
      model: 'claude-opus-5-5',
      apiKey: '',
      consentTrainingData: false,
      consentBodyData: false,
      consentDietText: false
    },
    cloud: {
      enabled: false,
      supabaseUrl: '',
      supabaseAnonKey: '',
      email: '',
      passphrase: '',
      autoSync: true,
      includePhotos: true,
      deviceId: uid('dev-')
    },
    security: { autoLockMin: 5 },
    ui: { accent: '#39ff88', fontScale: 1, weightUnit: 'kg', hiddenMeasurements: [] },
    onboardingDone: false,
    updatedAt: new Date().toISOString()
  };
}

const ex = (e: Partial<Exercise> & Pick<Exercise, 'id' | 'name' | 'category'>): Exercise => ({
  mode: 'reps',
  primaryMuscles: [],
  secondaryMuscles: [],
  notes: '',
  perSide: false,
  usesLoad: true,
  loadIncrementKg: 2.5,
  ...e
});

export function defaultExercises(): Exercise[] {
  return [
    ex({ id: 'squat-multipower', movement: 'squat', name: 'Squat al multipower', category: 'main', primaryMuscles: ['quadricipiti', 'glutei'], secondaryMuscles: ['adduttori', 'femorali', 'lombari'], notes: 'Piedi leggermente avanti rispetto al bilanciere, larghezza spalle. Scendi controllato fino a dove mantieni la schiena neutra, spingi con tutto il piede. Ginocchia in linea con le punte.', loadIncrementKg: 2.5 }),
    ex({ id: 'panca-piana', movement: 'bench', name: 'Panca piana bilanciere', category: 'main', primaryMuscles: ['pettorali'], secondaryMuscles: ['deltoidi_anteriori', 'tricipiti'], notes: 'Scapole addotte e depresse, piedi a terra. Bilanciere sulla parte bassa del petto, gomiti a circa 45°. Usa sempre le sicure o un assistente.', loadIncrementKg: 2.5 }),
    ex({ id: 'rematore-cavo', movement: 'row', name: 'Rematore al cavo basso', category: 'complementary', primaryMuscles: ['dorsali', 'romboidi'], secondaryMuscles: ['bicipiti', 'deltoidi_posteriori', 'trapezi'], notes: 'Busto stabile, petto alto. Tira verso l\'ombelico portando indietro le scapole, ritorno controllato senza flettere la schiena.', loadIncrementKg: 5 }),
    ex({ id: 'stacco-rumeno-manubri', movement: 'hinge', name: 'Stacco rumeno con manubri', category: 'complementary', primaryMuscles: ['femorali', 'glutei'], secondaryMuscles: ['lombari', 'avambracci'], notes: 'Ginocchia leggermente flesse e fisse, spingi le anche indietro mantenendo la schiena neutra. Manubri vicini alle gambe. Fermati quando senti tensione sui femorali.', loadIncrementKg: 2 }),
    ex({ id: 'lat-machine', movement: 'pulldown', name: 'Lat machine', category: 'complementary', primaryMuscles: ['dorsali'], secondaryMuscles: ['bicipiti', 'romboidi', 'deltoidi_posteriori'], notes: 'Presa poco più larga delle spalle. Porta la barra al petto alto guidando con i gomiti, senza slanci del busto.', loadIncrementKg: 5 }),
    ex({ id: 'pallof-press', movement: 'pallof', name: 'Pallof press', category: 'core', primaryMuscles: ['obliqui', 'core_profondo'], secondaryMuscles: ['addominali', 'glutei'], notes: 'Di fianco al cavo, spingi le mani in avanti resistendo alla rotazione. Bacino e spalle fermi. Esegui su entrambi i lati.', perSide: true, loadIncrementKg: 2.5 }),
    ex({ id: 'plank', movement: 'plank', name: 'Plank', category: 'core', mode: 'time', usesLoad: false, primaryMuscles: ['addominali', 'core_profondo'], secondaryMuscles: ['glutei', 'deltoidi_anteriori'], notes: 'Gomiti sotto le spalle, corpo in linea, glutei contratti. Non far cedere il bacino.', loadIncrementKg: 0 }),
    ex({ id: 'cyclette', movement: 'cycle', name: 'Cyclette', category: 'cardio', mode: 'cardio', usesLoad: false, primaryMuscles: ['quadricipiti'], secondaryMuscles: ['glutei', 'polpacci'], notes: 'Intensità moderata: devi riuscire a parlare con frasi brevi.', loadIncrementKg: 0 }),
    ex({ id: 'panca-inclinata-manubri', movement: 'incline', name: 'Panca inclinata con manubri', category: 'main', primaryMuscles: ['pettorali', 'deltoidi_anteriori'], secondaryMuscles: ['tricipiti'], notes: 'Panca a 30°. Scapole stabili, scendi controllato fino a sentire l\'allungamento del petto, spingi verso l\'alto senza far sbattere i manubri.', loadIncrementKg: 2 }),
    ex({ id: 'lat-machine-neutra', movement: 'pulldown', name: 'Lat machine presa neutra', category: 'complementary', primaryMuscles: ['dorsali'], secondaryMuscles: ['bicipiti', 'romboidi'], notes: 'Maniglia a presa neutra, tira verso lo sterno con gomiti vicini al corpo.', loadIncrementKg: 5 }),
    ex({ id: 'alzate-laterali', movement: 'lateral_raise', name: 'Alzate laterali', category: 'complementary', primaryMuscles: ['deltoidi_laterali'], secondaryMuscles: ['trapezi'], notes: 'Gomiti leggermente flessi, solleva fino all\'altezza delle spalle senza slanci. Discesa lenta.', loadIncrementKg: 1 }),
    ex({ id: 'face-pull', movement: 'face_pull', name: 'Face pull', category: 'complementary', primaryMuscles: ['deltoidi_posteriori', 'romboidi'], secondaryMuscles: ['trapezi'], notes: 'Corda all\'altezza del viso, tira verso la fronte aprendo i gomiti e ruotando esternamente le spalle.', loadIncrementKg: 2.5 }),
    ex({ id: 'leg-curl', movement: 'leg_curl', name: 'Leg curl', category: 'complementary', primaryMuscles: ['femorali'], secondaryMuscles: ['polpacci'], notes: 'Movimento controllato, senza sollevare il bacino. Prima del calcio del giovedì resta lontano dal cedimento.', loadIncrementKg: 5 }),
    ex({ id: 'glute-bridge', movement: 'bridge', name: 'Glute bridge', category: 'complementary', primaryMuscles: ['glutei'], secondaryMuscles: ['femorali', 'core_profondo'], notes: 'Spingi con i talloni, contrai i glutei in alto senza iperestendere la zona lombare. Pausa di 1 secondo in alto.', loadIncrementKg: 2.5 }),
    ex({ id: 'side-plank', movement: 'side_plank', name: 'Side plank', category: 'core', mode: 'time', usesLoad: false, perSide: true, primaryMuscles: ['obliqui'], secondaryMuscles: ['core_profondo', 'glutei'], notes: 'Gomito sotto la spalla, corpo in linea, bacino alto. Esegui entrambi i lati.', loadIncrementKg: 0 }),
    ex({ id: 'dead-bug', movement: 'dead_bug', name: 'Dead bug', category: 'core', usesLoad: false, perSide: true, primaryMuscles: ['core_profondo', 'addominali'], secondaryMuscles: ['obliqui'], notes: 'Zona lombare a contatto col pavimento, estendi braccio e gamba opposti lentamente espirando.', loadIncrementKg: 0 }),
    ex({ id: 'tapis-roulant', movement: 'walk', name: 'Tapis roulant in pendenza', category: 'cardio', mode: 'cardio', usesLoad: false, primaryMuscles: ['glutei', 'polpacci'], secondaryMuscles: ['quadricipiti', 'femorali'], notes: 'Velocità 4,5–5,2 km/h, pendenza 3–5%. Non tenerti ai corrimano.', loadIncrementKg: 0 })
  ];
}

export function defaultTemplates(): WorkoutTemplate[] {
  return [
    {
      id: 'tpl-a',
      name: 'Scheda A',
      warmup: ['Cyclette 5 minuti', 'Mobilità articolare', 'Squat a corpo libero', 'Glute bridge'],
      items: [
        { exerciseId: 'squat-multipower', sets: 3, repsMin: 8, repsMax: 8 },
        { exerciseId: 'panca-piana', sets: 3, repsMin: 8, repsMax: 10 },
        { exerciseId: 'rematore-cavo', sets: 3, repsMin: 10, repsMax: 10 },
        { exerciseId: 'stacco-rumeno-manubri', sets: 2, repsMin: 10, repsMax: 10 },
        { exerciseId: 'lat-machine', sets: 3, repsMin: 10, repsMax: 10 },
        { exerciseId: 'pallof-press', sets: 3, repsMin: 12, repsMax: 12 },
        { exerciseId: 'plank', sets: 3, repsMin: 0, repsMax: 0, secMin: 35, secMax: 45 }
      ],
      cardio: 'Cyclette 10–12 minuti a intensità moderata',
      cardioMin: 12
    },
    {
      id: 'tpl-b',
      name: 'Scheda B',
      warmup: ['Cyclette 5 minuti', 'Mobilità delle spalle e delle anche', 'Attivazione dei glutei'],
      items: [
        { exerciseId: 'panca-inclinata-manubri', sets: 3, repsMin: 10, repsMax: 10 },
        { exerciseId: 'lat-machine-neutra', sets: 3, repsMin: 10, repsMax: 12 },
        { exerciseId: 'alzate-laterali', sets: 3, repsMin: 12, repsMax: 15 },
        { exerciseId: 'face-pull', sets: 2, repsMin: 15, repsMax: 15 },
        { exerciseId: 'leg-curl', sets: 2, repsMin: 12, repsMax: 12 },
        { exerciseId: 'glute-bridge', sets: 2, repsMin: 12, repsMax: 12 },
        { exerciseId: 'side-plank', sets: 2, repsMin: 0, repsMax: 0, secMin: 30, secMax: 40 },
        { exerciseId: 'dead-bug', sets: 2, repsMin: 10, repsMax: 10 }
      ],
      cardio: 'Tapis roulant 15 minuti, velocità 4,5–5,2 km/h, pendenza 3–5%',
      cardioMin: 15,
      protectLegs: true,
      notes: 'Il giorno dopo c\'è l\'allenamento di calcio a 5: gambe lontane dal cedimento (RIR ≥ 3).'
    }
  ];
}

export function defaultPhases(): Phase[] {
  return [
    { id: 'ph-1', name: 'Adattamento', start: '2026-11-16', end: '2026-12-13', targetRir: 3, volumeFactor: 1, notes: 'Tecnica, carichi di riferimento, nessun cedimento.' },
    { id: 'ph-2', name: 'Costruzione della forza', start: '2026-12-14', end: '2027-01-24', targetRir: 2, volumeFactor: 1, notes: 'Doppia progressione sui fondamentali.' },
    { id: 'ph-d1', name: 'Settimana di scarico', start: '2027-01-25', end: '2027-01-31', targetRir: 4, volumeFactor: 0.6, notes: 'Volume ridotto, carichi invariati o leggermente ridotti.', deload: true },
    { id: 'ph-3', name: 'Consolidamento', start: '2027-02-01', end: '2027-03-07', targetRir: 2, volumeFactor: 1, notes: 'Mantenere i carichi raggiunti, priorità alla performance in campo.' },
    { id: 'ph-4', name: 'Transizione', start: '2027-03-08', end: '2027-03-31', targetRir: 3, volumeFactor: 0.8, notes: 'Volume moderato, mantenimento.' }
  ];
}

export function defaultAvatar(): AvatarConfig {
  return {
    id: 'avatar', heightCm: 178, weightKg: 87, build: 0.55, shoulders: 1, chest: 1, waist: 1, hips: 1,
    arms: 1, legs: 1, skinTone: '#c99a7a', useMeasurements: true, photoConsent: false, updatedAt: Date.now()
  };
}

/** Crea i dati iniziali solo al primo avvio. */
export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', [db.settings, db.exercises, db.templates, db.phases, db.avatar], async () => {
    if (!(await db.settings.get('app'))) {
      await db.settings.put(defaultSettings());
      if ((await db.exercises.count()) === 0) await db.exercises.bulkPut(defaultExercises());
      if ((await db.templates.count()) === 0) await db.templates.bulkPut(defaultTemplates());
      if ((await db.phases.count()) === 0) await db.phases.bulkPut(defaultPhases());
    }
    if (!(await db.avatar.get('avatar'))) await db.avatar.put(defaultAvatar());
  });
}

/** Ripristina la scheda originale (esercizi/schede/fasi), senza toccare lo storico. */
export async function restoreDefaultProgram(): Promise<void> {
  await db.transaction('rw', [db.exercises, db.templates, db.phases], async () => {
    await db.exercises.bulkPut(defaultExercises());
    await db.templates.bulkPut(defaultTemplates());
    await db.phases.clear();
    await db.phases.bulkPut(defaultPhases());
  });
}
