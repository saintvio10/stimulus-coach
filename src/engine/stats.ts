import type { AppData, Exercise, Session } from '../lib/types';
import { DAY, addDays, dateKey, e1rm, parseKey, startOfWeek, fmtNum } from '../lib/utils';

export interface PR {
  exerciseId: string;
  kind: 'e1rm' | 'weight' | 'reps';
  value: number;
  weight: number;
  reps: number;
  date: string;
}

export function doneSessions(data: AppData): Session[] {
  return data.sessions.filter((s) => s.status === 'done').sort((a, b) => a.startedAt - b.startedAt);
}

/** Bestwerte pro Übung (geschätztes 1RM, Höchstgewicht) */
export function personalRecords(sessions: Session[]): Map<string, { e1rm: PR; weight: PR }> {
  const out = new Map<string, { e1rm: PR; weight: PR }>();
  for (const s of sessions) {
    if (s.status !== 'done') continue;
    for (const se of s.exercises) {
      for (const set of se.sets) {
        if (!set.done || !set.weight || !set.reps) continue;
        const est = e1rm(set.weight, set.reps, set.rir);
        const cur = out.get(se.exerciseId);
        const mk = (kind: PR['kind'], value: number): PR => ({ exerciseId: se.exerciseId, kind, value, weight: set.weight!, reps: set.reps!, date: s.date });
        if (!cur) out.set(se.exerciseId, { e1rm: mk('e1rm', est), weight: mk('weight', set.weight) });
        else {
          if (est > cur.e1rm.value) cur.e1rm = mk('e1rm', est);
          if (set.weight > cur.weight.value || (set.weight === cur.weight.value && set.reps > cur.weight.reps)) cur.weight = mk('weight', set.weight);
        }
      }
    }
  }
  return out;
}

/** Neue Rekorde einer Einheit im Vergleich zur Historie davor */
export function detectPRs(session: Session, history: Session[], exercises: Exercise[]): string[] {
  const before = personalRecords(history.filter((s) => s.id !== session.id && s.status === 'done'));
  const name = new Map(exercises.map((e) => [e.id, e.name]));
  const out: string[] = [];
  for (const se of session.exercises) {
    const done = se.sets.filter((x) => x.done && x.weight && x.reps);
    if (!done.length) continue;
    const prev = before.get(se.exerciseId);
    const bestSet = done.reduce((b, x) => (e1rm(x.weight!, x.reps!, x.rir) > e1rm(b.weight!, b.reps!, b.rir) ? x : b));
    const est = e1rm(bestSet.weight!, bestSet.reps!, bestSet.rir);
    const maxW = Math.max(...done.map((x) => x.weight!));
    if (!prev) continue; // erstes Mal = kein Rekord
    if (maxW > prev.weight.value) out.push(`${name.get(se.exerciseId)}: neues Höchstgewicht ${fmtNum(maxW)} kg`);
    else if (est > prev.e1rm.value * 1.005) out.push(`${name.get(se.exerciseId)}: neues e1RM ${fmtNum(est)} kg (${fmtNum(bestSet.weight!)} × ${bestSet.reps})`);
  }
  return out;
}

export interface ExercisePoint {
  date: string;
  t: number;
  e1rm: number;
  topWeight: number;
  bestReps: number;
  totalReps: number;
  volume: number;
}

export function exerciseSeries(exerciseId: string, sessions: Session[]): ExercisePoint[] {
  const out: ExercisePoint[] = [];
  for (const s of sessions) {
    if (s.status !== 'done') continue;
    for (const se of s.exercises) {
      if (se.exerciseId !== exerciseId) continue;
      const done = se.sets.filter((x) => x.done && x.weight != null && x.weight > 0 && x.reps);
      if (!done.length) continue;
      const topWeight = Math.max(...done.map((x) => x.weight!));
      out.push({
        date: s.date,
        t: parseKey(s.date).getTime(),
        e1rm: +Math.max(...done.map((x) => e1rm(x.weight!, x.reps!, x.rir))).toFixed(1),
        topWeight,
        bestReps: Math.max(...done.filter((x) => x.weight === topWeight).map((x) => x.reps!)),
        totalReps: done.reduce((a, x) => a + x.reps!, 0),
        volume: done.reduce((a, x) => a + x.weight! * x.reps!, 0),
      });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

export function sessionVolume(s: Session): number {
  return s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).reduce((b, x) => b + (x.weight ?? 0) * (x.reps ?? 0), 0), 0);
}

export function sessionSets(s: Session): number {
  return s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
}

/** Wochenserie: aufeinanderfolgende Kalenderwochen mit ≥ 1 Training (aktuelle Woche zählt, sobald trainiert) */
export function weekStreak(sessions: Session[], today = dateKey()): number {
  const weeks = new Set(sessions.filter((s) => s.status === 'done').map((s) => startOfWeek(s.date)));
  let w = startOfWeek(today);
  if (!weeks.has(w)) w = addDays(w, -7);
  let n = 0;
  while (weeks.has(w)) {
    n++;
    w = addDays(w, -7);
  }
  return n;
}

export function avgDurationMin(sessions: Session[]): number | null {
  const d = sessions.filter((s) => s.status === 'done' && s.endedAt).map((s) => (s.endedAt! - s.startedAt) / 60000);
  if (!d.length) return null;
  return Math.round(d.reduce((a, b) => a + b, 0) / d.length);
}

export type RangeKey = '1W' | '1M' | '3M' | '6M' | '1J';
export const RANGE_DAYS: Record<RangeKey, number> = { '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1J': 365 };

export function inRange(dateStr: string, range: RangeKey, today = dateKey()): boolean {
  const t = parseKey(dateStr).getTime();
  return t >= parseKey(today).getTime() - RANGE_DAYS[range] * DAY;
}

/** Wochenweise Aggregation */
export function weeklyBuckets(sessions: Session[], range: RangeKey, today = dateKey()) {
  const n = Math.max(1, Math.ceil(RANGE_DAYS[range] / 7));
  const out: { week: string; label: string; sessions: number; volume: number; sets: number }[] = [];
  const first = addDays(startOfWeek(today), -(n - 1) * 7);
  for (let i = 0; i < n; i++) {
    const w = addDays(first, i * 7);
    const d = parseKey(w);
    out.push({ week: w, label: `${d.getDate()}.${d.getMonth() + 1}.`, sessions: 0, volume: 0, sets: 0 });
  }
  for (const s of sessions) {
    if (s.status !== 'done') continue;
    const b = out.find((x) => x.week === startOfWeek(s.date));
    if (!b) continue;
    b.sessions++;
    b.volume += sessionVolume(s);
    b.sets += sessionSets(s);
  }
  return out;
}

/** Lineare Regression Gewicht ~ Zeit, kg pro Woche */
export function weightTrend(data: AppData, days = 21, today = dateKey()) {
  const pts = data.body
    .filter((b) => b.weight && parseKey(b.date).getTime() >= parseKey(today).getTime() - days * DAY)
    .map((b) => ({ x: parseKey(b.date).getTime() / DAY, y: b.weight! }));
  if (pts.length < 3) return null;
  const span = pts[pts.length - 1].x - pts[0].x;
  if (span < 10) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const slopeDay = den ? num / den : 0;
  return { perWeek: slopeDay * 7, pctPerWeek: ((slopeDay * 7) / my) * 100, mean: my, n: pts.length, span };
}

export function calorieAdvice(data: AppData) {
  const tr = weightTrend(data);
  if (!tr)
    return {
      status: 'unknown' as const,
      title: 'Noch zu wenige Daten',
      text: 'Trage mindestens 3 Körpergewichtsmessungen über ≥ 10 Tage ein (am besten morgens nüchtern). Danach berechnet die App einen Trend.',
      delta: 0,
      trend: null,
    };
  const pct = tr.pctPerWeek;
  // Fortgeschrittene: langsame Zunahme ~0,1–0,3 % Körpergewicht pro Woche (praktische Empfehlung)
  if (pct < 0.1)
    return {
      status: 'low' as const,
      title: 'Zunahme zu langsam',
      text: `Trend ${fmtNum(tr.perWeek, 2)} kg/Woche (${fmtNum(pct, 2)} %). Für Muskelaufbau mit minimalem Fettzuwachs werden ~0,1–0,3 %/Woche angepeilt. Empfehlung: +150–200 kcal pro Tag.`,
      delta: 175,
      trend: tr,
    };
  if (pct > 0.35)
    return {
      status: 'high' as const,
      title: 'Zunahme recht schnell',
      text: `Trend +${fmtNum(tr.perWeek, 2)} kg/Woche (${fmtNum(pct, 2)} %). Größere Überschüsse erhöhen vor allem den Fettzuwachs. Empfehlung: −150 kcal pro Tag.`,
      delta: -150,
      trend: tr,
    };
  return {
    status: 'ok' as const,
    title: 'Im Zielkorridor',
    text: `Trend +${fmtNum(tr.perWeek, 2)} kg/Woche (${fmtNum(pct, 2)} %) – passt zu einem moderaten Aufbau. Kalorien beibehalten.`,
    delta: 0,
    trend: tr,
  };
}
