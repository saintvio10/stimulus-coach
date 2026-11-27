import type { MuscleId, PriorityGroup } from './types';

export interface MuscleMeta {
  id: MuscleId;
  label: string;
  short: string;
  group: PriorityGroup | null;
  /** Zeitkonstante der geschätzten Ermüdungsabnahme in Stunden (Heuristik) */
  tau: number;
  /** Basis-Wochenvolumen (fraktionale Sätze) bei ~3 Einheiten/Woche, vor Prioritätsfaktor */
  baseTarget: number;
  /** Max. sinnvolle fraktionale Sätze pro Einheit */
  sessionCap: number;
  /** Wird nicht direkt trainiert, nur indirekt mitgezählt */
  indirectOnly?: boolean;
}

export const MUSCLES: MuscleMeta[] = [
  { id: 'biceps', label: 'Bizeps', short: 'Bizeps', group: 'biceps', tau: 34, baseTarget: 12, sessionCap: 9 },
  { id: 'triceps', label: 'Trizeps', short: 'Trizeps', group: 'triceps', tau: 36, baseTarget: 12, sessionCap: 9 },
  { id: 'sideDelts', label: 'Seitliche Schulter', short: 'Seitl. Schulter', group: 'sideDelts', tau: 30, baseTarget: 12, sessionCap: 9 },
  { id: 'chest', label: 'Brust', short: 'Brust', group: 'chest', tau: 40, baseTarget: 12, sessionCap: 8 },
  { id: 'lats', label: 'Latissimus', short: 'Lat', group: 'back', tau: 40, baseTarget: 10, sessionCap: 7 },
  { id: 'upperBack', label: 'Oberer Rücken', short: 'Ob. Rücken', group: 'back', tau: 38, baseTarget: 10, sessionCap: 7 },
  { id: 'rearDelts', label: 'Hintere Schulter', short: 'Hint. Schulter', group: 'rearDelts', tau: 30, baseTarget: 8, sessionCap: 6 },
  { id: 'quads', label: 'Quadrizeps', short: 'Quads', group: 'legs', tau: 50, baseTarget: 10, sessionCap: 7 },
  { id: 'hamstrings', label: 'Beinbeuger', short: 'Beinbeuger', group: 'legs', tau: 50, baseTarget: 8, sessionCap: 6 },
  { id: 'glutes', label: 'Gesäß', short: 'Gesäß', group: 'legs', tau: 46, baseTarget: 4, sessionCap: 5 },
  { id: 'abs', label: 'Bauch', short: 'Bauch', group: 'absCalves', tau: 28, baseTarget: 6, sessionCap: 4 },
  { id: 'calves', label: 'Waden', short: 'Waden', group: 'absCalves', tau: 30, baseTarget: 6, sessionCap: 4 },
  { id: 'frontDelts', label: 'Vordere Schulter', short: 'Vord. Schulter', group: null, tau: 34, baseTarget: 4, sessionCap: 3, indirectOnly: true },
  { id: 'forearms', label: 'Unterarme', short: 'Unterarme', group: null, tau: 28, baseTarget: 2, sessionCap: 2, indirectOnly: true },
];

export const MUSCLE: Record<MuscleId, MuscleMeta> = Object.fromEntries(MUSCLES.map((m) => [m.id, m])) as Record<
  MuscleId,
  MuscleMeta
>;

export const MUSCLE_IDS = MUSCLES.map((m) => m.id);

export const GROUP_LABEL: Record<PriorityGroup, string> = {
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  sideDelts: 'Seitliche Schulter',
  chest: 'Brust',
  back: 'Rücken',
  rearDelts: 'Hintere Schulter',
  legs: 'Beine',
  absCalves: 'Bauch & Waden',
};

export const DEFAULT_PRIORITIES: PriorityGroup[] = [
  'biceps',
  'triceps',
  'sideDelts',
  'chest',
  'back',
  'rearDelts',
  'legs',
  'absCalves',
];

export function groupRank(group: PriorityGroup | null, priorities: PriorityGroup[]): number {
  if (!group) return priorities.length + 1;
  const i = priorities.indexOf(group);
  return i < 0 ? priorities.length : i;
}

/** Prioritätsgewicht 1.0 (Rang 1) bis ~0.5 (Rang 8); nur-indirekte Muskeln 0.3 */
export function priorityWeight(m: MuscleId, priorities: PriorityGroup[]): number {
  const meta = MUSCLE[m];
  if (meta.indirectOnly) return 0.3;
  return Math.max(0.45, 1 - groupRank(meta.group, priorities) * 0.07);
}

/** Frequenzabhängiger Skalierungsfaktor: realistisches Volumen bei 1, 2 oder 3 Einheiten/Woche */
export interface FreqFactors {
  freqFactor1?: number;
  freqFactor2?: number;
}
/** Modellannahme (keine Studienwerte): Standard 0,55 bei 1×, 0,8 bei 2× – im Profil einstellbar */
export function frequencyFactor(sessionsPerWeek: number, f: FreqFactors = {}): number {
  const f1 = f.freqFactor1 ?? 0.55;
  const f2 = f.freqFactor2 ?? 0.8;
  // Zwischenwerte (z. B. 1,5 = 1 fester + 1 vorläufiger Termin) linear dazwischen
  if (sessionsPerWeek <= 1) return f1;
  if (sessionsPerWeek < 2) return f1 + (f2 - f1) * (sessionsPerWeek - 1);
  if (sessionsPerWeek < 3) return f2 + (1 - f2) * (sessionsPerWeek - 2);
  return 1;
}

/** Wöchentliches Zielvolumen (fraktionale Sätze, rollierende 7 Tage) */
export function weeklyTarget(m: MuscleId, priorities: PriorityGroup[], sessionsPerWeek: number, f: FreqFactors = {}): number {
  const meta = MUSCLE[m];
  if (meta.indirectOnly) return meta.baseTarget;
  const rank = groupRank(meta.group, priorities);
  const prioMult = 1.15 - rank * 0.05;
  return Math.round(meta.baseTarget * prioMult * frequencyFactor(sessionsPerWeek, f) * 2) / 2;
}

/** Mindestdosis über 14 Tage, damit kein Muskel dauerhaft vernachlässigt wird */
export function minDose14(m: MuscleId, priorities: PriorityGroup[], sessionsPerWeek: number, f: FreqFactors = {}): number {
  return Math.round(weeklyTarget(m, priorities, sessionsPerWeek, f) * 0.7 * 2) / 2;
}

export const RECOVERY_COLORS = {
  gray: 'rgb(var(--rec-gray))',
  green: 'rgb(var(--rec-green))',
  yellow: 'rgb(var(--rec-yellow))',
  orange: 'rgb(var(--rec-orange))',
  red: 'rgb(var(--rec-red))',
} as const;

export type RecoveryColor = keyof typeof RECOVERY_COLORS;

export const RECOVERY_LABEL: Record<RecoveryColor, string> = {
  gray: 'Länger nicht belastet',
  green: 'Wahrscheinlich erholt',
  yellow: 'Teilweise erholt',
  orange: 'Noch belastet – Belastung reduzieren',
  red: 'Frisch belastet – eher pausieren',
};
