import type { AppData, Exercise, Joint, Session, SessionExercise } from '../lib/types';
import { MUSCLE } from '../lib/muscles';
import { REGION_LABEL } from '../data/exercises';
import { painConflict } from './joints';
import { dateKey } from '../lib/utils';

export interface Alternative {
  ex: Exercise;
  score: number;
  /** kurze Begründung, warum gleichwertig */
  why: string;
  /** schon einmal gemacht → Gewichtsempfehlung aus deinem Verlauf */
  known: boolean;
}

/**
 * „Gerät besetzt“: gleichwertige Alternativen für heute (ohne die Übung zu pausieren).
 * Rangfolge (Modellregel): gleicher Zielmuskel > gleicher Bereich (z. B. Dehnposition) > gleiche Bewegung (ein-/mehrgelenkig)
 * > Überlappung der trainierten Muskeln > schon bekannte Übung (Gewicht bekannt). Ausgeschlossen: gesperrte/pausierte
 * Übungen, Übungen, die heute schon im Plan sind, und Übungen, die laut Check-in ein schmerzendes Gelenk belasten.
 */
export function busyAlternatives(data: AppData, session: Session, se: SessionExercise, pain?: Joint[], limit = 3): Alternative[] {
  const cur = data.exercises.find((e) => e.id === se.exerciseId);
  if (!cur) return [];
  const today = session.date ?? dateKey();
  const inSession = new Set(session.exercises.filter((x) => !x.skipped).map((x) => x.exerciseId));
  const home = session.location === 'home' || cur.location === 'home';
  const history = new Set(data.sessions.filter((s) => s.status === 'done').flatMap((s) => s.exercises.filter((x) => x.sets.some((y) => y.done)).map((x) => x.exerciseId)));
  const out: Alternative[] = [];
  for (const e of data.exercises) {
    if (e.id === cur.id || e.locked || (e.pausedUntil && e.pausedUntil >= today) || inSession.has(e.id)) continue;
    if (home ? e.location !== 'home' : e.location === 'home') continue;
    if (painConflict(e, pain).length) continue;
    const onTarget = e.muscles[cur.primary] ?? 0;
    if (onTarget < 0.5) continue;
    const samePrimary = e.primary === cur.primary;
    const sameRegion = !!cur.region && cur.region === e.region;
    const sameKind = e.compound === cur.compound;
    let overlap = 0;
    for (const [m, c] of Object.entries(cur.muscles)) overlap += Math.min(c ?? 0, (e.muscles as Record<string, number>)[m] ?? 0);
    const known = history.has(e.id);
    const score = (samePrimary ? 3 : 0) + (sameRegion ? 2 : 0) + (sameKind ? 1 : 0) + overlap + (e.stretch === cur.stretch ? 0.3 : 0) + (known ? 0.5 : 0) + (e.favorite ? 0.2 : 0);
    const parts: string[] = [];
    if (samePrimary && sameRegion) parts.push(`gleicher Muskel und Bereich${REGION_LABEL[`${e.primary}:${e.region}`] ? ` (${REGION_LABEL[`${e.primary}:${e.region}`]})` : ''}`);
    else if (samePrimary) parts.push(`gleicher Zielmuskel (${MUSCLE[cur.primary].short})${e.region && REGION_LABEL[`${e.primary}:${e.region}`] ? `, Schwerpunkt ${REGION_LABEL[`${e.primary}:${e.region}`]}` : ''}`);
    else parts.push(`trifft ${MUSCLE[cur.primary].short} ${onTarget >= 0.75 ? 'stark' : 'mit'} (Ziel: ${MUSCLE[e.primary].short})`);
    if (!sameKind) parts.push(e.compound ? 'Mehrgelenksübung' : 'Isolationsübung');
    if (!known) parts.push('neu – Gewicht vorsichtig wählen');
    out.push({ ex: e, score, why: parts.join(' · '), known });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
