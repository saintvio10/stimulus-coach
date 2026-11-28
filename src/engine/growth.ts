import { MUSCLES } from '../lib/muscles';
import type { AppData, MuscleId } from '../lib/types';
import { addDays, DAY, dateKey, e1rm, fmtNum } from '../lib/utils';
import { eventsFromSessions } from './fatigue';
import { exposures, workingWeight } from './progression';
import { readinessScore } from './readiness';
import { personalTarget } from './planner';
import { weightTrend } from './stats';

/**
 * „Baue ich gerade Muskeln auf – und wo?“
 * Muskelwachstum lässt sich ohne Ultraschall/MRT nicht messen. Die App kombiniert drei Hinweise (Schätzung, keine Messung):
 * 1. Volumen: Ø fraktionale Sätze/Woche der letzten 3 Wochen gegenüber Erhaltungsdosis (~⅓ des Wachstumsvolumens,
 *    vgl. Bickel 2011, Spiering 2021) und Wachstumsbereich (≥ ~60 % deines persönlichen Wochenziels)
 * 2. Kraft: Trend der vergleichbaren Einheiten (gleiche Übung, gleicher Wdh.-Bereich, keine schwachen Tage) der letzten 6 Wochen –
 *    bei Trainierten der beste verfügbare Hinweis auf Fortschritt (Kraftzuwachs und Hypertrophie hängen zusammen, aber nicht 1:1)
 * 3. Körpergewicht: deutliches Defizit (< −0,3 %/Woche) bremst den Aufbau
 */
export type GrowthStatus = 'build' | 'likely' | 'maintain' | 'stall' | 'decline' | 'low' | 'none';

export interface MuscleGrowth {
  muscle: MuscleId;
  status: GrowthStatus;
  /** Ø fraktionale Sätze pro Woche (letzte 3 Wochen) */
  weekly: number;
  target: number;
  maintain: number;
  grow: number;
  /** Krafttrend in % pro 4 Wochen (null = noch zu wenig vergleichbare Einheiten) */
  trend: number | null;
  /** Übungen, aus denen der Trend stammt */
  trendFrom: string[];
  text: string;
}

export const GROWTH_LABEL: Record<GrowthStatus, string> = {
  build: 'Aufbau',
  likely: 'Wahrscheinlich Aufbau',
  maintain: 'Erhalt',
  stall: 'Stagnation',
  decline: 'Rückgang',
  low: 'Zu wenig Reiz',
  none: 'Keine Daten',
};

export const GROWTH_COLOR: Record<GrowthStatus, string> = {
  build: 'rgb(var(--rec-green))',
  likely: 'rgb(var(--rec-green) / 0.55)',
  maintain: 'rgb(var(--rec-yellow))',
  stall: 'rgb(var(--rec-yellow))',
  decline: 'rgb(var(--rec-orange))',
  low: 'rgb(var(--rec-red))',
  none: 'rgb(var(--rec-gray))',
};

/** Krafttrend eines Muskels (% pro 4 Wochen) aus vergleichbaren Einheiten seiner Übungen */
export function strengthTrend(data: AppData, m: MuscleId, now = Date.now(), days = 42): { pct: number; points: number; from: string[] } | null {
  const from = addDays(dateKey(now), -days);
  const done = data.sessions.filter((s) => s.status === 'done' && s.date >= from && s.startedAt <= now);
  const exById = new Map(data.exercises.map((e) => [e.id, e]));
  const ids = new Set(done.flatMap((s) => s.exercises.filter((e) => !e.skipped && exById.get(e.exerciseId)?.primary === m).map((e) => e.exerciseId)));
  let tsum = 0,
    wsum = 0;
  const used: string[] = [];
  for (const id of ids) {
    const xs = exposures(id, done).reverse();
    let seg: { x: number; y: number }[] = [];
    let prevW: number | null = null;
    let prevRange = '';
    for (const e of xs) {
      const weak = e.warmup === 'hard' || e.declineReason === 'dayform' || (readinessScore(data.checkIns[e.date]) ?? 100) < 45;
      if (weak) continue;
      const w = workingWeight(e.sets);
      const range = `${e.repMin}-${e.repMax}`;
      // nach bewusster Gewichtskorrektur oder anderem Wdh.-Bereich neu sammeln (kein „Rückgang“)
      if (prevW != null && ((w > 0 && w < prevW * 0.95) || range !== prevRange)) seg = [];
      prevW = w;
      prevRange = range;
      const ys = e.sets
        .filter((x) => (x.weight ?? 0) === w)
        .map((x) => e1rm(w, x.repsL != null && x.repsR != null ? Math.min(x.repsL, x.repsR) : x.reps ?? 0, x.rir))
        .filter((y) => y > 0);
      if (ys.length) seg.push({ x: e.t / DAY, y: ys.reduce((a, b) => a + b, 0) / ys.length });
    }
    if (seg.length < 3 || seg[seg.length - 1].x - seg[0].x < 10) continue;
    const mx = seg.reduce((a, p) => a + p.x, 0) / seg.length;
    const my = seg.reduce((a, p) => a + p.y, 0) / seg.length;
    const den = seg.reduce((a, p) => a + (p.x - mx) ** 2, 0);
    if (!den || !my) continue;
    const slope = seg.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / den;
    tsum += ((slope * 28) / my) * 100 * seg.length;
    wsum += seg.length;
    used.push(exById.get(id)?.name ?? id);
  }
  return wsum ? { pct: tsum / wsum, points: wsum, from: used } : null;
}

export function muscleGrowth(data: AppData, now = Date.now()): { muscles: MuscleGrowth[]; weight: ReturnType<typeof weightTrend>; deficit: boolean; weeks: number } {
  const events = eventsFromSessions(
    data.sessions.filter((s) => s.status === 'done' && s.startedAt <= now),
    data.exercises,
  );
  const span = 21 * DAY;
  const done3 = data.sessions.filter((s) => s.status === 'done' && s.startedAt > now - span && s.startedAt <= now);
  const firstDone = data.sessions.filter((s) => s.status === 'done').map((s) => s.startedAt).sort((a, b) => a - b)[0];
  // Bei kurzer Historie nicht über 3 Wochen mitteln (sonst zählen leere Wochen vor Trackingbeginn mit)
  const weeks = firstDone ? Math.min(3, Math.max(1, (now - firstDone) / (7 * DAY))) : 3;
  const spw = Math.min(3, Math.max(1, Math.round(new Set(done3.map((s) => s.date)).size / weeks)));
  const wt = weightTrend(data, 21, dateKey(now));
  const deficit = !!wt && wt.pctPerWeek <= -0.3;
  const out: MuscleGrowth[] = [];
  for (const meta of MUSCLES) {
    if (meta.indirectOnly) continue;
    const m = meta.id;
    const sets = events.filter((e) => e.muscle === m && e.t > now - span && e.t <= now).reduce((a, e) => a + e.sets, 0);
    const weekly = sets / weeks;
    const target = personalTarget(data, m, spw);
    const maintain = Math.max(2, target / 3);
    const grow = Math.max(4, target * 0.6);
    const tr = strengthTrend(data, m, now);
    const trend = tr ? +tr.pct.toFixed(1) : null;
    const vol = weeks < 1.5 ? `bisher ${fmtNum(sets)} Sätze` : `Ø ${fmtNum(weekly)} Sätze/Woche`;
    const since = weeks >= 3 ? 'Seit 3 Wochen' : `Seit Beginn der Aufzeichnung (${Math.max(1, Math.round((now - firstDone!) / DAY))} Tage)`;
    const trTxt = trend != null ? `Kraft ${trend >= 0 ? '+' : ''}${fmtNum(trend)} % in 4 Wochen` : 'Kraftverlauf noch zu kurz';
    let status: GrowthStatus;
    let text: string;
    if (!firstDone || (weekly < 0.25 && trend == null)) {
      status = firstDone ? 'low' : 'none';
      text = firstDone ? `${since} nicht trainiert – ohne Reiz baut der Muskel auf Dauer ab (Erhalt braucht ~${fmtNum(Math.round(maintain))} Sätze/Woche).` : 'Noch keine Trainings gespeichert.';
    } else if (trend != null && trend <= -3) {
      status = 'decline';
      text = `${trTxt} trotz ${vol} – eher Ermüdung oder zu wenig Erholung (Schlaf, Kalorien) als zu wenig Training.`;
    } else if (weekly < maintain) {
      status = 'low';
      text = `${vol} – unter der Erhaltungsdosis (~${fmtNum(Math.round(maintain))} pro Woche). Langfristig geht hier eher Muskel verloren.`;
    } else if (weekly >= grow) {
      if (trend != null && trend >= 1) {
        status = deficit ? 'likely' : 'build';
        text = `${vol} im Wachstumsbereich und ${trTxt} – ${deficit ? 'im Kaloriendefizit aber gebremst' : 'deutliches Zeichen für Aufbau'}.`;
      } else if (trend != null && trend < 1) {
        status = 'stall';
        text = `${vol} reicht für Aufbau, aber ${trTxt} – eher Erhalt. Mögliche Ursachen: Erholung, Kalorien, Übungsauswahl.`;
      } else {
        status = 'likely';
        text = `${vol} im Wachstumsbereich (ab ~${fmtNum(Math.round(grow))}) – ${trTxt}, Bestätigung über die Kraft folgt nach 3 vergleichbaren Einheiten.`;
      }
    } else if (trend != null && trend >= 2) {
      status = 'likely';
      text = `${vol} eher im Erhaltungsbereich, aber ${trTxt} – du reagierst gut auf wenig Volumen.`;
    } else {
      status = 'maintain';
      text = `${vol} – reicht zum Halten (ab ~${fmtNum(Math.round(maintain))}), für Aufbau eher ~${fmtNum(Math.round(grow))}+.${trend != null ? ` ${trTxt}.` : ''}`;
    }
    out.push({ muscle: m, status, weekly: +weekly.toFixed(1), target, maintain, grow, trend, trendFrom: tr?.from ?? [], text });
  }
  return { muscles: out, weight: wt, deficit, weeks };
}
