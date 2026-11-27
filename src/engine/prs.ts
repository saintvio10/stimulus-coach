import type { Exercise, Session } from '../lib/types';
import { e1rm, fmtNum } from '../lib/utils';
import { personalRecords } from './stats';

export interface SetPR {
  kind: 'weight' | 'reps' | 'e1rm' | 'bw';
  title: string;
  sub: string;
}

interface Cand {
  id: string;
  w: number;
  reps: number;
  rir: number | null;
}

/** Bisherige Bestwerte einer Übung (nur abgeschlossene Einheiten außer der aktuellen) */
function baseline(history: Session[], sessionId: string, exId: string) {
  const prev = personalRecords(history.filter((s) => s.id !== sessionId && s.status === 'done')).get(exId);
  let bwReps = 0;
  let any = false;
  for (const s of history) {
    if (s.id === sessionId || s.status !== 'done') continue;
    for (const se of s.exercises)
      if (se.exerciseId === exId)
        for (const x of se.sets)
          if (x.done && x.reps) {
            any = true;
            if (!x.weight) bwReps = Math.max(bwReps, x.reps);
          }
  }
  return { prev, bwReps, any };
}

/** Prüft einen Satz gegen alle bisherigen Bestwerte (inkl. früherer Sätze dieser Einheit) */
function judge(b: ReturnType<typeof baseline>, run: { maxW: number; repsAtMax: number; maxE: number; bwReps: number }, c: Cand, ex: Exercise): SetPR | null {
  if (!b.any) return null; // erstes Mal = noch kein Rekord
  if (c.w <= 0) {
    if (ex.equipment !== 'bodyweight') return null;
    const best = Math.max(b.bwReps, run.bwReps);
    return c.reps > best && best > 0 ? { kind: 'bw', title: 'Neuer Rekord!', sub: `${c.reps} Wdh. – mehr als je zuvor (bisher ${best})` } : null;
  }
  const histW = b.prev?.weight.value ?? 0;
  const histR = b.prev?.weight.reps ?? 0;
  const bestW = Math.max(histW, run.maxW);
  const repsAtBest = run.maxW > histW ? run.repsAtMax : run.maxW === histW ? Math.max(histR, run.repsAtMax) : histR;
  if (c.w > bestW && bestW > 0) return { kind: 'weight', title: 'Neues Höchstgewicht!', sub: `${fmtNum(c.w)} kg × ${c.reps} – bisher max. ${fmtNum(bestW)} kg` };
  if (c.w === bestW && c.reps > repsAtBest && repsAtBest > 0) return { kind: 'reps', title: 'Rekord!', sub: `${fmtNum(c.w)} kg × ${c.reps} – mehr Wdh. als je zuvor bei diesem Gewicht` };
  const e = e1rm(c.w, c.reps, c.rir);
  const bestE = Math.max(b.prev?.e1rm.value ?? 0, run.maxE);
  if (bestE > 0 && e > bestE * 1.005) return { kind: 'e1rm', title: 'Neuer Kraftrekord!', sub: `${fmtNum(c.w)} kg × ${c.reps} ≈ ${fmtNum(e, 1)} kg Maximalkraft (bisher ${fmtNum(bestE, 1)})` };
  return null;
}

const runOf = () => ({ maxW: 0, repsAtMax: 0, maxE: 0, bwReps: 0 });
const add = (run: ReturnType<typeof runOf>, c: Cand) => {
  if (c.w > run.maxW) {
    run.maxW = c.w;
    run.repsAtMax = c.reps;
  } else if (c.w === run.maxW) run.repsAtMax = Math.max(run.repsAtMax, c.reps);
  if (c.w > 0) run.maxE = Math.max(run.maxE, e1rm(c.w, c.reps, c.rir));
  else run.bwReps = Math.max(run.bwReps, c.reps);
};

const doneSetsOf = (session: Session, exId: string): Cand[] =>
  session.exercises
    .filter((e) => e.exerciseId === exId)
    .flatMap((e) =>
      e.sets
        .filter((x) => x.done && x.reps)
        .map((x) => ({ id: x.id, w: x.weight ?? 0, reps: x.repsL != null && x.repsR != null ? Math.min(x.repsL, x.repsR) : x.reps!, rir: x.failure ? 0 : x.rir, t: x.doneAt ?? 0 })),
    )
    .sort((a, b) => a.t - b.t);

/** Ist dieser gerade abgeschlossene Satz ein Rekord? (vor dem Speichern aufrufen) */
export function setPR(history: Session[], session: Session, ex: Exercise, cand: Cand): SetPR | null {
  const b = baseline(history, session.id, ex.id);
  const run = runOf();
  for (const c of doneSetsOf(session, ex.id)) if (c.id !== cand.id) add(run, c);
  return judge(b, run, cand, ex);
}

/** Welche Sätze dieser Einheit waren Rekorde? (für das 🏆 am Satz) */
export function prSetIds(history: Session[], session: Session, ex: Exercise): Set<string> {
  const b = baseline(history, session.id, ex.id);
  const run = runOf();
  const out = new Set<string>();
  for (const c of doneSetsOf(session, ex.id)) {
    if (judge(b, run, c, ex)) out.add(c.id);
    add(run, c);
  }
  return out;
}
