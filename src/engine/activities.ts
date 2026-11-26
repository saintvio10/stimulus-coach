import type { Activity, AppData, MuscleId } from '../lib/types';
import { HOUR, parseKey } from '../lib/utils';
import { eventsFromSessions, type StimulusEvent } from './fatigue';

export type ActivityType = 'ski' | 'walk' | 'hike' | 'run' | 'bike' | 'swim' | 'climb' | 'ball' | 'other';

/** Geschätzte Ermüdung pro Stunde bei mittlerer Intensität (in „Satz-Äquivalenten“, nur für die Regeneration) */
export const ACTIVITY_TYPES: Record<ActivityType, { label: string; emoji: string; perHour: Partial<Record<MuscleId, number>>; usesSteps?: boolean; usesKm?: boolean }> = {
  ski: { label: 'Skifahren', emoji: '⛷️', perHour: { quads: 2.2, glutes: 1.1, hamstrings: 0.7, calves: 0.7, abs: 0.5 } },
  walk: { label: 'Spazieren', emoji: '🚶', perHour: { calves: 0.5, quads: 0.3, glutes: 0.25, hamstrings: 0.2 }, usesSteps: true, usesKm: true },
  hike: { label: 'Wandern', emoji: '🥾', perHour: { quads: 0.9, calves: 0.8, glutes: 0.6, hamstrings: 0.4 }, usesSteps: true, usesKm: true },
  run: { label: 'Laufen', emoji: '🏃', perHour: { quads: 1.4, calves: 1.6, hamstrings: 0.8, glutes: 0.6 }, usesKm: true },
  bike: { label: 'Radfahren', emoji: '🚴', perHour: { quads: 1.2, glutes: 0.5, calves: 0.4 }, usesKm: true },
  swim: { label: 'Schwimmen', emoji: '🏊', perHour: { lats: 1, upperBack: 0.7, sideDelts: 0.5, rearDelts: 0.5, triceps: 0.4, chest: 0.4 }, usesKm: true },
  climb: { label: 'Klettern/Bouldern', emoji: '🧗', perHour: { lats: 1.4, biceps: 1.4, forearms: 1.6, upperBack: 1, rearDelts: 0.5 } },
  ball: { label: 'Ballsport', emoji: '⚽', perHour: { quads: 1.3, hamstrings: 1, calves: 1, glutes: 0.6 } },
  other: { label: 'Sonstiges', emoji: '✨', perHour: { quads: 0.6, calves: 0.4, glutes: 0.3 } },
};

export const INTENSITY: Record<Activity['intensity'], { label: string; mult: number }> = {
  light: { label: 'locker', mult: 0.6 },
  medium: { label: 'mittel', mult: 1 },
  hard: { label: 'intensiv', mult: 1.5 },
};

/** Dauer in Minuten (aus Minuten, Schritten oder km geschätzt) */
export function activityMinutes(a: Activity): number {
  if (a.minutes && a.minutes > 0) return a.minutes;
  if (a.steps) return a.steps / 100; // ~100 Schritte pro Minute
  if (a.km) return a.km * (a.type === 'bike' ? 3 : a.type === 'run' ? 6 : a.type === 'swim' ? 25 : 12);
  return 60;
}

export function activityMuscles(a: Activity): Partial<Record<MuscleId, number>> {
  const t = ACTIVITY_TYPES[a.type as ActivityType] ?? ACTIVITY_TYPES.other;
  const h = activityMinutes(a) / 60;
  const m = INTENSITY[a.intensity]?.mult ?? 1;
  const out: Partial<Record<MuscleId, number>> = {};
  for (const [k, v] of Object.entries(t.perHour)) out[k as MuscleId] = +(v! * h * m).toFixed(2);
  return out;
}

/** Gesamtbelastung – ab ~4 zählt eine Aktivität für die Ruhetag-Regel wie ein Trainingstag */
export function activityLoad(a: Activity): number {
  return Object.values(activityMuscles(a)).reduce((x, y) => x + (y ?? 0), 0);
}

/** Aktivitäten erzeugen nur Ermüdung (keine Hypertrophie-Sätze) */
export function activityEvents(activities: Activity[]): StimulusEvent[] {
  const out: StimulusEvent[] = [];
  for (const a of activities ?? []) {
    const t = parseKey(a.date).getTime() + 15 * HOUR;
    for (const [m, f] of Object.entries(activityMuscles(a)) as [MuscleId, number][]) {
      if (!f) continue;
      out.push({ t, muscle: m, sets: 0, fatigue: f, direct: false, load: 0 });
    }
  }
  return out;
}

/** Alle Reize: Trainings (Volumen + Ermüdung) und Aktivitäten (nur Ermüdung) */
export function allEvents(data: Pick<AppData, 'sessions' | 'exercises' | 'activities'>): StimulusEvent[] {
  return eventsFromSessions(
    data.sessions.filter((s) => s.status === 'done' || s.status === 'active'),
    data.exercises,
  ).concat(activityEvents(data.activities ?? []));
}

export function activityLabel(a: Activity): string {
  const t = ACTIVITY_TYPES[a.type as ActivityType] ?? ACTIVITY_TYPES.other;
  const parts = [`${t.emoji} ${t.label}`];
  if (a.minutes) parts.push(a.minutes >= 60 ? `${Math.floor(a.minutes / 60)} h ${a.minutes % 60 ? (a.minutes % 60) + ' min' : ''}`.trim() : `${a.minutes} min`);
  if (a.steps) parts.push(`${a.steps.toLocaleString('de-DE')} Schritte`);
  if (a.km) parts.push(`${a.km.toLocaleString('de-DE')} km`);
  return parts.join(' · ');
}
