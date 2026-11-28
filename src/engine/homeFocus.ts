import type { Exercise, HomeGroup, HomeFocusValue, MuscleId } from '../lib/types';
import type { PlannedSession } from './planner';
import { MUSCLE } from '../lib/muscles';
import { fmtNum } from '../lib/utils';

/** Muskelgruppen, die man beim Training ohne Gym einzeln anwählen kann */
export const HOME_GROUPS: Record<HomeGroup, { label: string; muscles: MuscleId[] }> = {
  chest: { label: 'Brust', muscles: ['chest'] },
  back: { label: 'Rücken', muscles: ['lats', 'upperBack'] },
  biceps: { label: 'Bizeps', muscles: ['biceps', 'forearms'] },
  triceps: { label: 'Trizeps', muscles: ['triceps'] },
  shoulders: { label: 'Schultern', muscles: ['sideDelts', 'rearDelts', 'frontDelts'] },
  abs: { label: 'Bauch', muscles: ['abs'] },
  legs: { label: 'Beine', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
};
export const HOME_GROUP_IDS = Object.keys(HOME_GROUPS) as HomeGroup[];

/** Schnellauswahl */
export const HOME_PRESETS: { label: string; groups: HomeGroup[] }[] = [
  { label: 'Alles', groups: HOME_GROUP_IDS },
  { label: 'Oberkörper', groups: ['chest', 'back', 'biceps', 'triceps', 'shoulders'] },
  { label: 'Arme & Schultern', groups: ['biceps', 'triceps', 'shoulders'] },
  { label: 'Beine & Bauch', groups: ['legs', 'abs'] },
];

const LEGACY: Record<string, HomeGroup[]> = {
  all: HOME_GROUP_IDS,
  upper: ['chest', 'back', 'biceps', 'triceps', 'shoulders'],
  arms: ['biceps', 'triceps', 'shoulders'],
  lower: ['legs', 'abs'],
};

/** Gespeicherten Wert lesen (auch alte Einzelwerte wie „upper“); leer/alle = Ganzkörper */
export function focusGroups(v: HomeFocusValue | undefined): HomeGroup[] {
  if (!v) return HOME_GROUP_IDS;
  const g = typeof v === 'string' ? LEGACY[v] ?? HOME_GROUP_IDS : v.filter((x) => x in HOME_GROUPS);
  return g.length ? HOME_GROUP_IDS.filter((x) => g.includes(x)) : HOME_GROUP_IDS;
}

export const isAllGroups = (g: HomeGroup[]) => HOME_GROUP_IDS.every((x) => g.includes(x));

/** Zielmuskeln der Auswahl (undefined = alles) */
export function focusMuscles(v: HomeFocusValue | undefined): MuscleId[] | undefined {
  const g = focusGroups(v);
  return isAllGroups(g) ? undefined : g.flatMap((x) => HOME_GROUPS[x].muscles);
}

/** Kurzer Name: Schnellauswahl-Name oder „Brust, Rücken & Trizeps“ */
export function focusLabel(v: HomeFocusValue | undefined): string {
  const g = focusGroups(v);
  if (isAllGroups(g)) return 'Ganzkörper';
  const preset = HOME_PRESETS.find((p) => p.groups.length === g.length && p.groups.every((x) => g.includes(x)));
  if (preset) return preset.label;
  const names = g.map((x) => HOME_GROUPS[x].label);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export type FocusTone = 'ok' | 'warn' | 'muted';
/**
 * Pro gewählter Gruppe: wie viel heute sinnvoll ist – passend zu dem, was du in den letzten 7 Tagen schon trainiert hast.
 * Direkte Sätze = Übungen für diese Gruppe; indirekte (z. B. Trizeps bei Liegestützen) werden extra genannt.
 */
export function focusStatus(plan: PlannedSession, groups: HomeGroup[], exercises: Exercise[]): { group: HomeGroup; tone: FocusTone; text: string }[] {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  return groups.map((g) => {
    const ms = HOME_GROUPS[g].muscles.filter((m) => !MUSCLE[m].indirectOnly);
    const ds = plan.decisions.filter((d) => ms.includes(d.muscle));
    const all = ds.reduce((a, d) => a + d.sets, 0);
    const direct = plan.exercises.reduce((a, pe) => {
      const ex = exMap.get(pe.exerciseId);
      return a + (ex && ms.some((m) => (ex.muscles[m] ?? 0) >= 0.75) ? pe.sets : 0);
    }, 0);
    const indirect = Math.max(0, all - direct);
    const vol7 = ds.reduce((a, d) => a + d.vol7, 0);
    const target = ds.reduce((a, d) => a + d.target, 0);
    const tired = ds.find((d) => d.sets < 1 && d.reason.startsWith('Noch ermüdet'));
    const n = (x: number) => fmtNum(Math.round(x * 2) / 2);
    const week = `${n(vol7)}/${n(target)} Sätze in 7 Tagen`;
    const ind = indirect >= 0.5 ? ` (nur ~${n(indirect)} indirekt über andere Übungen)` : '';
    const today = direct >= 1 ? `Heute nur ${direct} ${direct === 1 ? 'Satz' : 'Sätze'}` : `Heute keine eigene Übung${ind}`;
    if (target > 0 && vol7 >= target * 1.3) return { group: g, tone: 'warn', text: `Schon viel trainiert (${week}) – mehr bringt kaum zusätzlichen Reiz. ${today}.` };
    if (tired && direct < 1) return { group: g, tone: 'warn', text: `${tired.reason.replace(/ – voraussichtlich.*$/, '').replace(/\.$/, '')} – heute keine eigene Übung.` };
    if (target > 0 && vol7 >= target) return { group: g, tone: 'warn', text: `Wochenziel schon erreicht (${week}) – ${direct >= 1 ? `heute nur ${direct} ${direct === 1 ? 'Satz' : 'Sätze'}` : `heute nicht nötig${ind}`}.` };
    if (direct >= 1) {
      const fill = vol7 + all >= target * 0.95;
      return { group: g, tone: 'ok', text: `${direct} ${direct === 1 ? 'Satz' : 'Sätze'} geplant (${week}${fill ? ' → damit ist das Wochenziel erreicht' : ''})${direct === 1 ? ' – mehr ist heute nicht nötig' : ''}.` };
    }
    return { group: g, tone: 'muted', text: ds[0]?.reason ?? 'Heute keine passende Übung.' };
  });
}
