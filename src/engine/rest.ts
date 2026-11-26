import type { SessionExercise } from '../lib/types';

/**
 * Pause nach einem Satz (autoreguliert):
 * Basis = Übungspause. +30 s nach Satz bis Muskelversagen / RIR 0,
 * +30 s wenn die Wiederholungen schon ≥ 3 unter dem ersten Satz liegen (Leistung bricht ein → mehr Erholung,
 * damit die Folgesätze effektiv bleiben). Grundlage: längere Pausen erhalten die Wiederholungsleistung (Singer 2024).
 */
export function restAfterSet(se: SessionExercise, reps: number | null, rir: number | null, failure: boolean): { sec: number; note: string | null } {
  let sec = se.restSec;
  const notes: string[] = [];
  if (failure || rir === 0) {
    sec += 30;
    notes.push('Versagen');
  }
  const first = se.sets.find((x) => x.done && x.reps != null);
  if (first && reps != null && first.reps! - reps >= 3) {
    sec += 30;
    notes.push('Wdh. gefallen');
  }
  return { sec, note: notes.length ? `+${sec - se.restSec}s (${notes.join(', ')})` : null };
}

/** Pause beim Wechsel zur nächsten Übung: mindestens 2 min und mindestens so lang wie die Pause der nächsten Übung */
export function transitionRest(currentRestSec: number, nextRestSec: number | undefined): number {
  return Math.max(120, currentRestSec, nextRestSec ?? 0);
}
