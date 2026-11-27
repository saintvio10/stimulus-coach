import type { Exercise, SessionExercise, Settings, SetLog } from '../lib/types';
import { e1rm, fmtNum, nextWeight, prevWeight } from '../lib/utils';

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
  // Bei großen Gewichtssprüngen (z. B. Kabel 7,5 → 10 kg = +33 %) nur wechseln, wenn das neue Gewicht laut Schätzung
  // näher am Zielbereich liegt – sonst pendelt die Empfehlung zwischen zwei Stufen.
  const est = w > 0 ? e1rm(w, reps, rir ?? se.targetRir) : 0;
  const dist = (r: number) => (r < se.repMin ? se.repMin - r : r > se.repMax ? r - se.repMax : 0);
  const predicted = (to: number) => Math.max(0, 30 * (est / to - 1) - (se.targetRir ?? 1) - 1); // −1 Wdh. Ermüdung der Folgesätze
  const better = (to: number) => !est || to <= 0 || dist(predicted(to)) < dist(reps) - 0.5;
  // Schon einmal in dieser Einheit angepasst? Dann nicht wieder zurück (kein Pendeln zwischen zwei Stufen)
  const firstW = doneSets[0].weight ?? 0;
  const prevDir = w > firstW ? 1 : w < firstW ? -1 : 0;
  const allowed = (dir: 1 | -1) => prevDir === 0 || prevDir === dir;
  const bw = ex.equipment === 'bodyweight';

  // ── zu schwer
  if (!(bw && w <= 0)) {
    if (reps < se.repMin - 2) {
      let to = step(2, -1);
      if (!better(to)) to = step(1, -1);
      if (to < w && better(to) && allowed(-1))
        return { ...base, dir: 'down', to, title: `Zu schwer: ${fmtNum(to)} kg statt ${fmtNum(w)} kg`, reason: `Nur ${reps} Wdh. – deutlich unter deinem Ziel (${se.repMin}–${se.repMax}). Mit weniger Gewicht schaffst du wieder saubere Wdh. im Zielbereich und mehr Gesamtvolumen.` };
    }
    // In späteren Sätzen ist 1 Wdh. unter dem Ziel normale Ermüdung – erst ab 2 darunter eingreifen
    if (reps < se.repMin - (isFirst ? 0 : 1)) {
      const to = step(1, -1);
      if (to < w && allowed(-1) && (rir === 0 && reps >= se.repMin ? true : better(to)))
        return { ...base, dir: 'down', to, title: `Etwas zu schwer: ${fmtNum(to)} kg?`, reason: `${reps} Wdh. liegen unter deinem Ziel von ${se.repMin}–${se.repMax}. Eine Stufe leichter hält die restlichen Sätze im Zielbereich.` };
    }
    if (isFirst && rir === 0 && reps <= se.repMin + 1 && doneSets.length < se.sets.length) {
      const to = step(1, -1);
      if (to < w && allowed(-1) && (rir === 0 && reps >= se.repMin ? true : better(to)))
        return { ...base, dir: 'down', to, title: `Schon im 1. Satz am Limit – ${fmtNum(to)} kg?`, reason: `Muskelversagen schon im ersten Satz bei nur ${reps} Wdh.: Die Wdh. fallen in den nächsten Sätzen meist stark ab. Eine Stufe leichter bringt mehr Gesamt-Wdh.` };
    }
  }

  // ── zu leicht
  const tooManyReps = reps > se.repMax + 2 && (rir == null || rir >= 1);
  const farFromFailure = reps >= se.repMax && rir != null && rir >= 3;
  if (tooManyReps || farFromFailure) {
    const to = step(1, 1);
    if (to > w && allowed(1) && (better(to) || (farFromFailure && predicted(to) >= se.repMin)))
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
