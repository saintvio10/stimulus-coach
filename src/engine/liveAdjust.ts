import type { Exercise, SessionExercise, Settings, SetLog } from '../lib/types';
import { fmtNum, nextWeight, prevWeight } from '../lib/utils';

export interface LiveAdjust {
  dir: 'down' | 'up';
  /** Satz, nach dem die Empfehlung entstand (zum Ausblenden) */
  afterSetId: string;
  /** nächster offener Satz, der angepasst würde */
  nextSetId: string;
  from: number;
  to: number;
  title: string;
  reason: string;
}

const repsOf = (x: SetLog) => (x.repsL != null && x.repsR != null ? Math.min(x.repsL, x.repsR) : x.reps);

/**
 * Erkennt direkt nach einem Satz, ob das Gewicht für die restlichen Sätze zu schwer oder zu leicht ist.
 * Muskelaufbau klappt in einem breiten Bereich (~5–30 Wdh. nah am Versagen) – eingegriffen wird daher nur,
 * wenn du klar aus deinem Zielbereich fällst: darunter bleibt weniger Gesamtvolumen und die Technik leidet,
 * darüber ist der Satz zu weit vom Versagen weg.
 */
export function liveAdjust(se: SessionExercise, ex: Exercise, settings: Settings): LiveAdjust | null {
  const doneSets = se.sets.filter((x) => x.done);
  const last = doneSets[doneSets.length - 1];
  const next = se.sets.find((x) => !x.done);
  if (!last || !next || se.skipped) return null;
  if (se.liveDismissed === last.id) return null;
  const reps = repsOf(last);
  const w = last.weight ?? 0;
  if (reps == null) return null;
  // Nur vorschlagen, solange der nächste Satz noch mit demselben Gewicht geplant ist
  if ((next.weight ?? w) !== w) return null;
  const rir = last.failure ? 0 : last.rir;
  const isFirst = doneSets.length === 1;
  const step = (n: number, dir: 1 | -1) => {
    let v = w;
    for (let i = 0; i < n; i++) v = dir > 0 ? nextWeight(v, ex, settings) : prevWeight(v, ex, settings);
    return v;
  };
  const base = { afterSetId: last.id, nextSetId: next.id, from: w };
  const bw = ex.equipment === 'bodyweight';

  // ── zu schwer
  if (!(bw && w <= 0)) {
    if (reps < se.repMin - 2) {
      const to = step(2, -1);
      if (to < w)
        return { ...base, dir: 'down', to, title: `Zu schwer: ${fmtNum(to)} kg statt ${fmtNum(w)} kg`, reason: `Nur ${reps} Wdh. – deutlich unter deinem Ziel (${se.repMin}–${se.repMax}). Mit weniger Gewicht schaffst du wieder saubere Wdh. im Zielbereich und mehr Gesamtvolumen.` };
    }
    // In späteren Sätzen ist 1 Wdh. unter dem Ziel normale Ermüdung – erst ab 2 darunter eingreifen
    if (reps < se.repMin - (isFirst ? 0 : 1)) {
      const to = step(1, -1);
      if (to < w)
        return { ...base, dir: 'down', to, title: `Etwas zu schwer: ${fmtNum(to)} kg?`, reason: `${reps} Wdh. liegen unter deinem Ziel von ${se.repMin}–${se.repMax}. Eine Stufe leichter hält die restlichen Sätze im Zielbereich.` };
    }
    if (isFirst && rir === 0 && reps <= se.repMin + 1 && doneSets.length < se.sets.length) {
      const to = step(1, -1);
      if (to < w)
        return { ...base, dir: 'down', to, title: `Schon im 1. Satz am Limit – ${fmtNum(to)} kg?`, reason: `Muskelversagen schon im ersten Satz bei nur ${reps} Wdh.: Die Wdh. fallen in den nächsten Sätzen meist stark ab. Eine Stufe leichter bringt mehr Gesamt-Wdh.` };
    }
  }

  // ── zu leicht
  const tooManyReps = reps > se.repMax + 2 && (rir == null || rir >= 1);
  const farFromFailure = reps >= se.repMax && rir != null && rir >= 3;
  if (tooManyReps || farFromFailure) {
    const to = step(1, 1);
    if (to > w)
      return {
        ...base,
        dir: 'up',
        to,
        title: `Zu leicht: ${fmtNum(to)} kg?`,
        reason: tooManyReps
          ? `${reps} Wdh. liegen über deinem Ziel (${se.repMin}–${se.repMax}). Mit einer Stufe mehr bleibst du im Zielbereich nah am Versagen.`
          : `${reps} Wdh. mit noch ${rir} Wdh. Reserve – zu weit vom Versagen weg für einen starken Reiz.`,
      };
  }
  return null;
}
