import type { Exercise, Session } from '../lib/types';
import { clamp } from '../lib/utils';

/**
 * Gelernte Zeiten je Übung aus deinen echten Trainings (Zeitstempel der erledigten Sätze):
 * • perSetMin: Abstand zwischen zwei Sätzen derselben Übung = Arbeitszeit + tatsächliche Pause
 * • firstMin: Abstand vom letzten Satz der vorigen Übung bis zum 1. Satz = Wechsel, Einstellen, Pause, 1. Satz
 * Ausreißer (Unterbrechungen, nachgetragene Sätze) werden verworfen; es zählt der Median der letzten Werte.
 */
export interface ExTiming {
  perSetMin: number;
  firstMin: number | null;
  nSet: number;
  nFirst: number;
  /** Ø Wiederholungen beim letzten Mal (für die Arbeitszeit, solange noch wenig gelernt ist) */
  lastReps: number | null;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const cache = new WeakMap<Session[], Map<string, ExTiming>>();

export function learnedTimings(sessions: Session[]): Map<string, ExTiming> {
  const hit = cache.get(sessions);
  if (hit) return hit;
  const per = new Map<string, number[]>();
  const first = new Map<string, number[]>();
  const reps = new Map<string, number>();
  const done = sessions.filter((s) => s.status === 'done').sort((a, b) => a.startedAt - b.startedAt);
  for (const s of done) {
    // Übungen in der Reihenfolge, in der sie tatsächlich gemacht wurden
    const exs = s.exercises
      .filter((se) => !se.skipped)
      .map((se) => ({ se, ts: se.sets.filter((x) => x.done && x.doneAt).map((x) => x.doneAt!).sort((a, b) => a - b) }))
      .filter((x) => x.ts.length)
      .sort((a, b) => a.ts[0] - b.ts[0]);
    let prevLast: number | null = null;
    for (const { se, ts } of exs) {
      const arr = per.get(se.exerciseId) ?? [];
      for (let k = 1; k < ts.length; k++) {
        const d = (ts[k] - ts[k - 1]) / 60_000;
        if (d >= 0.4 && d <= 8) arr.push(d);
      }
      per.set(se.exerciseId, arr.slice(-16));
      if (prevLast != null) {
        const g = (ts[0] - prevLast) / 60_000;
        if (g >= 0.5 && g <= 12) first.set(se.exerciseId, [...(first.get(se.exerciseId) ?? []), g].slice(-8));
      }
      prevLast = ts[ts.length - 1];
      const r = se.sets.filter((x) => x.done && x.reps).map((x) => (x.repsL != null && x.repsR != null ? Math.min(x.repsL, x.repsR) : x.reps!));
      if (r.length) reps.set(se.exerciseId, r.reduce((a, b) => a + b, 0) / r.length);
    }
  }
  const out = new Map<string, ExTiming>();
  for (const id of new Set([...per.keys(), ...reps.keys()])) {
    const p = per.get(id) ?? [];
    const f = first.get(id) ?? [];
    out.set(id, { perSetMin: p.length ? median(p) : 0, firstMin: f.length ? median(f) : null, nSet: p.length, nFirst: f.length, lastReps: reps.get(id) ?? null });
  }
  cache.set(sessions, out);
  return out;
}

/** Modell: ~3 s pro Wdh. (mind. 40 s, Mehrgelenk 50 s), einseitig × 2, plus Pause */
export function modelSetMin(ex: Exercise, repMin: number, repMax: number, restSec: number, reps?: number | null): number {
  const unilateral = ex.pattern === 'bayesian' || !!ex.unilateral;
  // Ohne Verlauf: Bereichsmitte – mit Flaschen bzw. nur Körpergewicht zu Hause landet man meist am oberen Ende
  const light = ex.location === 'home' && (ex.homeLoad === 'bottles' || ex.equipment === 'bodyweight');
  const r = reps ?? (light ? repMax : (repMin + repMax) / 2);
  const work = Math.max(ex.compound ? 50 : 40, r * 3) * (unilateral ? 2 : 1);
  return (work + restSec) / 60;
}

export function modelSetup(ex: Exercise): number {
  if (ex.location === 'home') return 0.5; // kein Geräte-Einstellen, kein Warten
  return ex.compound ? (ex.fatigue >= 3 ? 4 : 3) : 1;
}

export interface TimeEstimator {
  /** Minuten pro Satz (Arbeit + Pause) */
  perSet: (ex: Exercise, o?: { repMin?: number; repMax?: number; restSec?: number; short?: boolean }) => number;
  /** Minuten für Wechsel/Einstellen vor dem 1. Satz */
  setup: (ex: Exercise) => number;
  /** Wie viel davon aus deinen Daten stammt (0 = reine Schätzung, 1 = vollständig gelernt) */
  learnedShare: (ex: Exercise) => number;
}

/**
 * Zeitschätzung: Modell × persönlicher Tempo-Faktor, schrittweise ersetzt durch deine gemessenen Zeiten
 * (voll ab ~8 gemessenen Satzabständen bzw. 5 Übungswechseln). Wiederholungen: Ø vom letzten Mal statt Bereichsmitte.
 */
export function timeEstimator(data: { sessions: Session[]; settings: { timeFactor?: number } }): TimeEstimator {
  const tf = data.settings.timeFactor || 1;
  const L = learnedTimings(data.sessions);
  const wSet = (lt?: ExTiming) => (lt && lt.nSet >= 3 ? Math.min(1, lt.nSet / 8) : 0);
  const perSet: TimeEstimator['perSet'] = (ex, o = {}) => {
    const lt = L.get(ex.id);
    const model = modelSetMin(ex, o.repMin ?? ex.repMin, o.repMax ?? ex.repMax, o.restSec ?? ex.restSec, lt?.lastReps) * tf;
    const w = wSet(lt);
    let m = w ? w * lt!.perSetMin + (1 - w) * model : model;
    // Zeitmodus: Arm-/Schulterisolation als Supersatz → Pausen teilen sich
    if (o.short && !ex.compound && ['biceps', 'triceps', 'sideDelts', 'rearDelts'].includes(ex.primary)) m *= 0.65;
    return m;
  };
  const setup: TimeEstimator['setup'] = (ex) => {
    const lt = L.get(ex.id);
    const model = modelSetup(ex) * tf;
    if (!lt || lt.firstMin == null || lt.nFirst < 2 || !wSet(lt)) return model;
    const learned = clamp(lt.firstMin - lt.perSetMin, 0.3, 6);
    const w = Math.min(1, lt.nFirst / 5);
    return w * learned + (1 - w) * model;
  };
  const learnedShare: TimeEstimator['learnedShare'] = (ex) => wSet(L.get(ex.id));
  return { perSet, setup, learnedShare };
}

/** Laufendes Training: seit wann, wie lange noch (gleiche Schätzung wie die Planung), voraussichtliches Ende, Fortschritt */
export function sessionTiming(
  session: Session,
  data: { sessions: Session[]; settings: { timeFactor?: number }; exercises: Exercise[] },
  now = Date.now(),
): { elapsedMin: number; remainingMin: number; endAt: number; endTxt: string; progress: number; label: string } {
  const TE = timeEstimator(data);
  const list = session.exercises.filter((e) => !e.skipped && e.sets.length);
  const total = list.reduce((a, e) => a + e.sets.length, 0);
  const doneN = list.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const remainingMin = Math.round(
    list.reduce((a, e) => {
      const ex = data.exercises.find((y) => y.id === e.exerciseId);
      const open = e.sets.filter((z) => !z.done).length;
      if (!open || !ex) return a;
      return a + open * TE.perSet(ex, { repMin: e.repMin, repMax: e.repMax, restSec: e.restSec }) + (e.sets.some((z) => z.done) ? 0 : TE.setup(ex));
    }, 0),
  );
  const elapsedMin = Math.max(0, Math.round((now - session.startedAt) / 60_000));
  const endAt = now + remainingMin * 60_000;
  const d = new Date(endAt);
  const endTxt = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const f = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
  return { elapsedMin, remainingMin, endAt, endTxt, progress: total ? doneN / total : 0, label: `${f(elapsedMin)} · noch ~${f(remainingMin)} · bis ${endTxt}` };
}
