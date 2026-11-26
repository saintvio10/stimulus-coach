export type MuscleId =
  | 'chest'
  | 'lats'
  | 'upperBack'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

export type PriorityGroup = 'biceps' | 'triceps' | 'sideDelts' | 'chest' | 'back' | 'rearDelts' | 'legs' | 'absCalves';

export type Equipment = 'dumbbell' | 'cable' | 'machine' | 'barbell' | 'plate' | 'bodyweight';

export type AnimPattern =
  | 'curl'
  | 'preacher'
  | 'bayesian'
  | 'overheadExt'
  | 'pushdown'
  | 'dip'
  | 'chestPress'
  | 'inclinePress'
  | 'fly'
  | 'pulldown'
  | 'row'
  | 'cableRow'
  | 'lateralRaise'
  | 'reverseFly'
  | 'shoulderPress'
  | 'legPress'
  | 'legCurl'
  | 'legExtension'
  | 'rdl'
  | 'calfRaise'
  | 'cableCrunch'
  | 'abMachine';

export interface Exercise {
  id: string;
  name: string;
  /** Muskelbeitrag pro Satz: 1 = direkt, 0.5 = indirekt (fraktionale Zählung) */
  muscles: Partial<Record<MuscleId, number>>;
  primary: MuscleId;
  equipment: Equipment;
  pattern: AnimPattern;
  compound: boolean;
  repMin: number;
  repMax: number;
  restSec: number;
  /** Ziel-RIR (Wiederholungen im Tank) */
  targetRir: number;
  /** 0 = kaum Dehnungsbelastung, 2 = hohe Belastung in gedehnter Position */
  stretch: 0 | 1 | 2;
  /** Systemische Ermüdung 1–3 */
  fatigue: 1 | 2 | 3;
  cues: string[];
  /** Kurz: was diese Übung besonders macht */
  benefit?: string;
  /** Eigene Gewichtsstufen (überschreibt Geräte-Standard) */
  weights?: number[];
  /** Eigene Steigerung in kg (überschreibt Geräte-Standard) */
  increment?: number;
  locked: boolean;
  favorite: boolean;
  custom?: boolean;
  note?: string;
}

export interface SetLog {
  id: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  failure: boolean;
  done: boolean;
  note: string;
}

export type AdviceType = 'new' | 'increase' | 'extend' | 'hold' | 'decrease' | 'deload';

export interface ProgressionAdvice {
  type: AdviceType;
  weight: number | null;
  repTarget: number;
  text: string;
  causes: string[];
  setDelta: number;
  rirDelta: number;
  lastWeight: number | null;
  lastReps: number[];
  lastDate: string | null;
  stalled: boolean;
}

export interface SessionExercise {
  uid: string;
  exerciseId: string;
  sets: SetLog[];
  repMin: number;
  repMax: number;
  targetRir: number;
  restSec: number;
  recWeight: number | null;
  skipped: boolean;
  note: string;
  superset?: string;
  reason?: string;
  adviceText?: string;
  setsReason?: string;
  why?: string;
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  startedAt: number;
  endedAt?: number;
  status: 'active' | 'done';
  title: string;
  split: string;
  plannedMinutes: number;
  exercises: SessionExercise[];
  readiness?: number | null;
  notes?: string;
  prs?: string[];
  demo?: boolean;
  /** geschätzte Dauer laut Plan beim Start (min) */
  estMinutes?: number;
  /** geplante Arbeitssätze beim Start */
  plannedSets?: number;
}

export type Availability = 'yes' | 'no' | 'maybe';

export interface PlanOptions {
  uncertain: boolean;
  weekCap: { count: number; until: string } | null;
  todayMinutes: { date: string; minutes: number } | null;
  /** Datum, an dem zuletzt nach der Verfügbarkeit gefragt wurde */
  askedOn?: string;
}

export interface CheckIn {
  sleepHours: number;
  sleepQuality: number; // 1–5
  energy: number; // 1–5
  stress: number; // 1–5
  soreness: Partial<Record<MuscleId, number>>; // 0–3
}

export interface BodyEntry {
  id: string;
  date: string;
  weight?: number;
  arm?: number;
  chest?: number;
  waist?: number;
  demo?: boolean;
}

export interface FoodEntry {
  id: string;
  name: string;
  kcal: number;
  protein: number;
}

export interface NutritionDay {
  entries: FoodEntry[];
  creatine: boolean;
  sleep?: number;
}

export interface Profile {
  name: string;
  age: number;
  weight: number;
  height: number;
  experience: 'beginner' | 'intermediate' | 'advanced';
  gym: string;
  goal: string;
  priorities: PriorityGroup[];
}

export interface Settings {
  preferredDays: number[]; // 0 = So … 6 = Sa
  sessionsPerWeek: number; // 1–3 (erwartet)
  /** Obergrenze Einheiten pro 7 Tage (Rest wird zu Ruhetagen) */
  maxSessionsPerWeek: number;
  /** max. Trainingstage am Stück */
  maxConsecutive: number;
  defaultMinutes: number;
  orderMode: 'priority' | 'compound';
  autoSuperset: boolean;
  dumbbellWeights: number[];
  cableStep: number;
  machineStep: number;
  plateStep: number;
  barbellStep: number;
  sound: boolean;
  vibrate: boolean;
  notifications: boolean;
  nutritionEnabled: boolean;
  onboarded: boolean;
  /** persönlicher Tempo-Faktor (tatsächliche / geschätzte Zeit), aus abgeschlossenen Einheiten gelernt */
  timeFactor: number;
  timeSamples: number;
  targets: { kcalMin: number; kcalMax: number; protein: number; creatine: number; sleepMin: number; sleepMax: number };
  supabase: { url: string; anonKey: string; autoSync: boolean };
}

export interface RestTimer {
  endsAt: number;
  total: number;
  label: string;
  /** Restsekunden, wenn pausiert */
  pausedLeft?: number;
}

export interface AppData {
  version: number;
  profile: Profile;
  settings: Settings;
  exercises: Exercise[];
  sessions: Session[];
  availability: Record<string, Availability>;
  planOptions: PlanOptions;
  checkIns: Record<string, CheckIn>;
  body: BodyEntry[];
  nutrition: Record<string, NutritionDay>;
  timer: RestTimer | null;
  /** persönliche, gelernte Volumenanpassung je Muskel */
  volumeAdjust: Partial<Record<MuscleId, VolumeAdjust>>;
  updatedAt: number;
}

export interface VolumeAdjust {
  factor: number;
  updatedOn: string;
  reason: string;
  trend: number | null;
}
