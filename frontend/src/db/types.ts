// Tipi del modello dati. Tutto è salvato localmente in IndexedDB.

export type DayKey = 'lun' | 'mar' | 'mer' | 'gio' | 'ven' | 'sab' | 'dom';
export const DAY_KEYS: DayKey[] = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
export const DAY_LABELS: Record<DayKey, string> = {
  lun: 'Lunedì', mar: 'Martedì', mer: 'Mercoledì', gio: 'Giovedì', ven: 'Venerdì', sab: 'Sabato', dom: 'Domenica'
};

export type ActivityType = 'gym' | 'futsal' | 'match' | 'rest' | 'active_recovery' | 'other';
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  gym: 'Palestra', futsal: 'Allenamento calcio a 5', match: 'Partita', rest: 'Riposo',
  active_recovery: 'Recupero attivo', other: 'Altro'
};

export interface DayPlan {
  type: ActivityType;
  label: string;
  templateId?: string;
  durationMin?: number;
  notes?: string;
}

export type ExerciseCategory = 'main' | 'complementary' | 'core' | 'cardio' | 'mobility';
export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  main: 'Principale', complementary: 'Complementare', core: 'Core', cardio: 'Cardio', mobility: 'Mobilità'
};

/** reps = serie a ripetizioni con carico; time = isometrico a tempo; cardio = durata con parametri */
export type ExerciseMode = 'reps' | 'time' | 'cardio';

export type MuscleId =
  | 'pettorali' | 'deltoidi_anteriori' | 'deltoidi_laterali' | 'deltoidi_posteriori'
  | 'dorsali' | 'trapezi' | 'romboidi' | 'bicipiti' | 'tricipiti' | 'avambracci'
  | 'addominali' | 'obliqui' | 'lombari' | 'glutei' | 'quadricipiti' | 'femorali'
  | 'adduttori' | 'polpacci' | 'core_profondo';

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  pettorali: 'Pettorali', deltoidi_anteriori: 'Deltoidi anteriori', deltoidi_laterali: 'Deltoidi laterali',
  deltoidi_posteriori: 'Deltoidi posteriori', dorsali: 'Gran dorsale', trapezi: 'Trapezi', romboidi: 'Romboidi',
  bicipiti: 'Bicipiti', tricipiti: 'Tricipiti', avambracci: 'Avambracci', addominali: 'Retto addominale',
  obliqui: 'Obliqui', lombari: 'Lombari', glutei: 'Glutei', quadricipiti: 'Quadricipiti', femorali: 'Femorali',
  adduttori: 'Adduttori', polpacci: 'Polpacci', core_profondo: 'Core profondo (trasverso)'
};
export const LEG_MUSCLES: MuscleId[] = ['glutei', 'quadricipiti', 'femorali', 'adduttori', 'polpacci'];

export type MovementPattern =
  | 'squat' | 'hinge' | 'bench' | 'incline' | 'pulldown' | 'row' | 'lateral_raise' | 'face_pull'
  | 'leg_curl' | 'bridge' | 'plank' | 'side_plank' | 'dead_bug' | 'pallof' | 'cycle' | 'walk' | 'none';
export const MOVEMENT_LABELS: Record<MovementPattern, string> = {
  squat: 'Squat', hinge: 'Piegamento d\'anca (stacco)', bench: 'Spinta orizzontale (panca)', incline: 'Spinta inclinata',
  pulldown: 'Trazione verticale (lat machine)', row: 'Trazione orizzontale (rematore)', lateral_raise: 'Alzate laterali',
  face_pull: 'Face pull', leg_curl: 'Flessione ginocchio (leg curl)', bridge: 'Ponte glutei', plank: 'Plank',
  side_plank: 'Plank laterale', dead_bug: 'Dead bug', pallof: 'Pallof press', cycle: 'Pedalata', walk: 'Camminata', none: 'Nessuna animazione'
};

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  mode: ExerciseMode;
  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];
  notes: string;           // note tecniche
  perSide: boolean;        // serie per lato
  usesLoad: boolean;       // se prevede un carico in kg
  loadIncrementKg: number; // incremento minimo realistico (es. 2.5 bilanciere, 2 manubri, 5 pacco)
  imageId?: string;        // id in tabella media
  videoUrl?: string;       // link a video illustrativo scelto dall'utente
  animationId?: string;    // id in media di un GLB animato
  movement?: MovementPattern; // schema di movimento per la dimostrazione 3D semplificata
  archived?: boolean;
}

export interface TemplateItem {
  exerciseId: string;
  sets: number;
  repsMin: number;   // per mode=reps
  repsMax: number;
  secMin?: number;   // per mode=time/cardio (secondi)
  secMax?: number;
  restSec?: number;  // se assente usa il default per categoria
  notes?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  warmup: string[];
  items: TemplateItem[];
  cardio: string;
  cardioMin?: number;
  notes?: string;
  /** se true protegge gli arti inferiori (es. mercoledì prima del calcio del giovedì) */
  protectLegs?: boolean;
}

export interface Phase {
  id: string;
  name: string;
  start: string; // yyyy-mm-dd
  end: string;
  targetRir: number;
  volumeFactor: number; // 1 = volume pieno, 0.6 = scarico
  notes: string;
  deload?: boolean;
}

export interface Profile {
  name: string;
  age: number;
  heightCm: number;
  startWeightKg: number;
  sex: 'M' | 'F';
  sport: string;
  roles: string;
  gymExperience: string;
  injuries: string;
  mainGoal: string;
  secondaryGoals: string;
  programStart: string;
  programEnd: string;
}

export interface TimerSettings {
  restMainSec: number;
  restComplementarySec: number;
  restCoreSec: number;
  restCardioSec: number;
  countdownBeforeIsoSec: number;
  sound: boolean;
  vibration: boolean;
  notifications: boolean;
  voice: boolean;
  keepScreenOn: boolean;
}

export interface ProgressionSettings {
  minIncreasePct: number;
  maxIncreasePct: number;
  rirThreshold: number;
  deloadEveryWeeks: number; // 0 = disattivato
  readinessReduceThreshold: number; // punteggio sotto cui ridurre volume
}

export type AiMode = 'local' | 'server' | 'direct';
export interface AiSettings {
  mode: AiMode;
  model: string;
  apiKey: string; // solo per modalità direct, salvata localmente
  consentTrainingData: boolean;
  consentBodyData: boolean;
  consentDietText: boolean;
}

export interface CloudSettings {
  enabled: boolean;
  serverUrl: string;
  token: string;
  passphrase: string; // solo su questo dispositivo, mai esportata
  autoSync: boolean;
  includePhotos: boolean;
  lastSyncAt?: string;
  lastSyncResult?: string;
  deviceId: string;
}

export interface SecuritySettings {
  pinHash?: string;
  pinSalt?: string;
  autoLockMin: number;
  biometricCredentialId?: string;
}

export interface UiSettings {
  accent: string;
  fontScale: number;
  weightUnit: 'kg';
  hiddenMeasurements: string[];
}

export interface AppSettings {
  id: 'app';
  version: number;
  profile: Profile;
  schedule: Record<DayKey, DayPlan>;
  timers: TimerSettings;
  progression: ProgressionSettings;
  ai: AiSettings;
  cloud: CloudSettings;
  security: SecuritySettings;
  ui: UiSettings;
  onboardingDone: boolean;
  updatedAt: string;
}

export interface Readiness {
  sleepQuality: number; // 1-5
  sleepHours?: number;
  fatigue: number; // 1-10 (10 = molto stanco)
  legs: number;    // 1-10 (10 = gambe molto pesanti)
  pain: boolean;
  painNotes: string;
  score: number;   // 0-100 calcolato
  advice: string[];
  applied: 'full' | 'reduced' | 'light' | 'skip';
}

export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface WorkoutSession {
  id: string;
  date: string;          // yyyy-mm-dd (data a cui si riferisce la seduta, modificabile)
  templateId: string;
  templateName: string;
  startedAt: number;     // epoch ms
  endedAt?: number;
  status: SessionStatus;
  readiness?: Readiness;
  plan: TemplateItem[];  // piano effettivo della seduta (dopo eventuali riduzioni)
  phaseName?: string;
  notes: string;
  recoveredFrom?: string; // data della seduta saltata che si sta recuperando
  cardioDone?: { minutes: number; notes: string };
}

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number;   // 1-based
  reps: number;
  weightKg: number;
  rir?: number;
  durationSec?: number;
  side?: 'dx' | 'sx';
  techniqueOk: boolean;
  timestamp: number;
  date: string;
  notes?: string;
}

/** registrazione di attività non palestra: calcio, partita, recupero attivo */
export interface ActivityLog {
  id: string;
  date: string;
  type: ActivityType;
  done: boolean;
  durationMin?: number;
  rpe?: number; // 1-10
  notes: string;
}

export interface Measurement {
  id: string;
  date: string;
  weight?: number;
  waist?: number;
  abdomen?: number;
  hips?: number;
  chest?: number;
  armR?: number;
  armL?: number;
  thighR?: number;
  thighL?: number;
  calf?: number;
  notes?: string;
}

export const MEASURE_FIELDS: { key: keyof Measurement; label: string; unit: string }[] = [
  { key: 'weight', label: 'Peso', unit: 'kg' },
  { key: 'waist', label: 'Girovita', unit: 'cm' },
  { key: 'abdomen', label: 'Addome', unit: 'cm' },
  { key: 'hips', label: 'Fianchi', unit: 'cm' },
  { key: 'chest', label: 'Torace', unit: 'cm' },
  { key: 'armR', label: 'Braccio destro', unit: 'cm' },
  { key: 'armL', label: 'Braccio sinistro', unit: 'cm' },
  { key: 'thighR', label: 'Coscia destra', unit: 'cm' },
  { key: 'thighL', label: 'Coscia sinistra', unit: 'cm' },
  { key: 'calf', label: 'Polpaccio', unit: 'cm' }
];

export type PhotoView = 'front' | 'side' | 'back';
export const VIEW_LABELS: Record<PhotoView, string> = { front: 'Frontale', side: 'Laterale', back: 'Posteriore' };

export interface Photo {
  id: string;
  date: string;
  view: PhotoView;
  purpose: 'progress' | 'avatar';
  mediaId: string;
  notes?: string;
}

/** file binari (foto, immagini esercizi, documenti, modelli 3D) */
export interface MediaBlob {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  blob: Blob;
}

export type MealKey = 'colazione' | 'spuntino' | 'pranzo' | 'merenda' | 'cena';
export const MEAL_KEYS: MealKey[] = ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'];
export const MEAL_LABELS: Record<MealKey, string> = {
  colazione: 'Colazione', spuntino: 'Spuntino', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena'
};

export interface DietDoc {
  id: string;
  title: string;
  mediaId: string;
  mime: string;
  uploadedAt: number;
  validFrom: string;
  active: boolean;
  extractedText: string;
  extractionMethod: 'pdf' | 'docx' | 'ocr' | 'manuale' | 'nessuno';
}

export interface ParsedFood {
  text: string;        // riga originale
  food: string;
  quantity?: string;
  alternatives: string[];
}

export interface ParsedMeal {
  key: MealKey;
  time?: string;
  foods: ParsedFood[];
  notes: string[];
}

export interface DietPlan {
  id: string;          // = docId
  docId: string;
  meals: ParsedMeal[];
  trainingNotes: string[];
  matchNotes: string[];
  otherNotes: string[];
  unassigned: string[];
  reviewedByUser: boolean;
  updatedAt: number;
}

export interface MealLog {
  id: string; // date|meal
  date: string;
  meal: MealKey;
  done: boolean;
  notes?: string;
  at?: number;
}

export interface AvatarConfig {
  id: 'avatar';
  heightCm: number;
  weightKg: number;
  build: number;      // 0 esile - 1 robusta
  shoulders: number;  // fattori 0.8-1.2
  chest: number;
  waist: number;
  hips: number;
  arms: number;
  legs: number;
  skinTone: string;
  useMeasurements: boolean;
  glbMediaId?: string;
  glbName?: string;
  photoConsent: boolean;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  source: 'locale' | 'ai';
}

/** stato persistente della seduta live per riprendere dopo chiusura/sospensione */
export interface LiveTimer {
  endsAt?: number;          // epoch ms assoluto
  pausedRemaining?: number; // ms residui se in pausa
  totalMs: number;
}
export interface LiveState {
  id: 'live';
  sessionId: string;
  itemIndex: number;
  setIndex: number;        // 1-based
  side?: 'dx' | 'sx';
  reps: number;
  weightKg: number;
  weightSetForItem?: number; // indice esercizio per cui il carico è stato inizializzato
  phase: 'work' | 'rest' | 'cardio' | 'done';
  timer?: LiveTimer;       // recupero o cardio
  isoStartedAt?: number;   // isometrico in corso
  isoAccumulated?: number;
  lastSetIds?: string[];   // ultime serie registrate (per RIR/annulla)
  undo?: { itemIndex: number; setIndex: number; side?: 'dx' | 'sx'; reps: number; weightKg: number; isoAccumulated?: number };
  updatedAt: number;
}
