import type { AppData, Exercise, MuscleId, Session, SetLog } from '../lib/types';
import { MUSCLE, MUSCLES } from '../lib/muscles';
import { addDays, dateKey, e1rm, fmtNum, startOfWeek, WEEKDAYS_LONG, weekdayOf } from '../lib/utils';
import { sessionSets, sessionVolume, weekStreak } from './stats';
import { activityMinutes } from './activities';

/** geschätzte reine Arbeitszeit pro Satz (s) – der Rest des Satzabstands ist Pause */
const WORK_SEC = 40;
/** Abstände über 15 min gelten als Unterbrechung, nicht als Pause */
const MAX_GAP = 15 * 60;

const repsOf = (x: SetLog) => (x.repsL != null && x.repsR != null ? x.repsL + x.repsR : x.reps ?? 0);
const bestE1 = (sets: SetLog[]) => sets.reduce((b, x) => (x.done && x.weight && x.reps ? Math.max(b, e1rm(x.weight, x.reps, x.rir)) : b), 0);

export interface SessionStats {
  durationMin: number;
  sets: number;
  plannedSets: number | null;
  reps: number;
  volume: number;
  exercises: number;
  /** Ø Abstand zwischen zwei Sätzen (s) – inkl. Satz */
  avgGapSec: number | null;
  /** geschätzte Pausenzeit gesamt (min) */
  restMin: number | null;
  /** geschätzte Arbeitszeit unter Spannung (min) */
  workMin: number;
  longestGapSec: number | null;
  avgRir: number | null;
  failureSets: number;
  muscles: { muscle: MuscleId; sets: number }[];
  prev: { date: string; volumePct: number | null; sets: number; durationMin: number | null } | null;
  bestGain: { name: string; pct: number } | null;
  improved: number;
}

export function sessionStats(session: Session, history: Session[], exercises: Exercise[], now = Date.now()): SessionStats {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const done = session.exercises.flatMap((e) => e.sets.filter((x) => x.done));
  const times = done.map((x) => x.doneAt).filter((t): t is number => t != null).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const g = (times[i] - times[i - 1]) / 1000;
    if (g > 5 && g < MAX_GAP) gaps.push(g);
  }
  const rirs = done.map((x) => x.rir).filter((r): r is number => r != null);
  const musc = new Map<MuscleId, number>();
  for (const se of session.exercises) {
    const ex = exMap.get(se.exerciseId);
    const n = se.sets.filter((x) => x.done).length;
    if (!ex || !n) continue;
    for (const [m, c] of Object.entries(ex.muscles) as [MuscleId, number][]) {
      if (MUSCLE[m].indirectOnly && c < 1) continue;
      musc.set(m, (musc.get(m) ?? 0) + c * n);
    }
  }
  const before = history.filter((s) => s.status === 'done' && s.id !== session.id && s.startedAt < session.startedAt).sort((a, b) => b.startedAt - a.startedAt);
  const prevSame = before.find((s) => s.split === session.split);
  const vol = sessionVolume(session);
  // bester Fortschritt je Übung (e1RM ggü. dem letzten Mal)
  let bestGain: SessionStats['bestGain'] = null;
  let improved = 0;
  for (const se of session.exercises) {
    const cur = bestE1(se.sets);
    if (!cur) continue;
    const last = before.find((s) => s.exercises.some((e) => e.exerciseId === se.exerciseId && e.sets.some((x) => x.done)));
    const prevBest = last ? Math.max(...last.exercises.filter((e) => e.exerciseId === se.exerciseId).map((e) => bestE1(e.sets))) : 0;
    if (!prevBest) continue;
    const pct = (cur / prevBest - 1) * 100;
    if (pct > 0.5) improved++;
    if (pct > 0.5 && (!bestGain || pct > bestGain.pct)) bestGain = { name: exMap.get(se.exerciseId)?.name ?? se.exerciseId, pct };
  }
  const sets = done.length;
  return {
    durationMin: Math.max(1, Math.round(((session.endedAt ?? now) - session.startedAt) / 60000)),
    sets,
    plannedSets: session.plannedSets ?? null,
    reps: done.reduce((a, x) => a + repsOf(x), 0),
    volume: vol,
    exercises: session.exercises.filter((e) => e.sets.some((x) => x.done)).length,
    avgGapSec: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
    restMin: gaps.length ? gaps.reduce((a, g) => a + Math.max(0, g - WORK_SEC), 0) / 60 : null,
    workMin: (sets * WORK_SEC) / 60,
    longestGapSec: gaps.length ? Math.max(...gaps) : null,
    avgRir: rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null,
    failureSets: done.filter((x) => x.failure || x.rir === 0).length,
    muscles: [...musc.entries()].map(([muscle, s]) => ({ muscle, sets: s })).filter((x) => x.sets >= 1).sort((a, b) => b.sets - a.sets),
    prev: prevSame
      ? {
          date: prevSame.date,
          volumePct: sessionVolume(prevSame) > 0 ? (vol / sessionVolume(prevSame) - 1) * 100 : null,
          sets: sessionSets(prevSame),
          durationMin: prevSame.endedAt ? Math.round((prevSame.endedAt - prevSame.startedAt) / 60000) : null,
        }
      : null,
    bestGain,
    improved,
  };
}

/** Einheiten in der aktuellen Kalenderwoche */
export function sessionsThisWeek(sessions: Session[], today = dateKey()) {
  const w = startOfWeek(today);
  return sessions.filter((s) => s.status === 'done' && s.date >= w && s.date <= addDays(w, 6)).length;
}

export function longestWeekStreak(sessions: Session[]): number {
  const weeks = [...new Set(sessions.filter((s) => s.status === 'done').map((s) => startOfWeek(s.date)))].sort();
  let best = 0,
    cur = 0,
    prev: string | null = null;
  for (const w of weeks) {
    cur = prev && addDays(prev, 7) === w ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = w;
  }
  return best;
}

export interface OverallStats {
  sessions: number;
  hours: number;
  volume: number;
  sets: number;
  reps: number;
  avgMin: number | null;
  avgGapSec: number | null;
  avgRestPerSession: number | null;
  prs: number;
  streak: number;
  longestStreak: number;
  perWeek: number;
  favExercise: { name: string; sets: number } | null;
  favDay: string | null;
  avgStart: string | null;
  heaviest: { name: string; weight: number; reps: number } | null;
  topGains: { name: string; from: number; to: number; pct: number }[];
  muscles: { muscle: MuscleId; perWeek: number }[];
  activities: { count: number; minutes: number; km: number; steps: number };
}

export function overallStats(data: AppData, days: number | null, today = dateKey()): OverallStats {
  const from = days ? addDays(today, -days + 1) : '0000-00-00';
  const all = data.sessions.filter((s) => s.status === 'done').sort((a, b) => a.startedAt - b.startedAt);
  const ss = all.filter((s) => s.date >= from);
  const exMap = new Map(data.exercises.map((e) => [e.id, e]));
  const stats = ss.map((s) => sessionStats(s, all, data.exercises));
  const withGap = stats.filter((x) => x.avgGapSec != null);
  const setsBy = new Map<string, number>();
  const dayCount = new Map<number, number>();
  let heaviest: OverallStats['heaviest'] = null;
  const series = new Map<string, number[]>();
  for (const s of ss) {
    dayCount.set(weekdayOf(s.date), (dayCount.get(weekdayOf(s.date)) ?? 0) + 1);
    for (const se of s.exercises) {
      const d = se.sets.filter((x) => x.done);
      if (!d.length) continue;
      setsBy.set(se.exerciseId, (setsBy.get(se.exerciseId) ?? 0) + d.length);
      const b = bestE1(d);
      if (b) series.set(se.exerciseId, [...(series.get(se.exerciseId) ?? []), b]);
      for (const x of d)
        if (x.weight && x.reps && (!heaviest || x.weight > heaviest.weight)) heaviest = { name: exMap.get(se.exerciseId)?.name ?? se.exerciseId, weight: x.weight, reps: x.reps };
    }
  }
  const fav = [...setsBy.entries()].sort((a, b) => b[1] - a[1])[0];
  const favD = [...dayCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const starts = ss.map((s) => {
    const d = new Date(s.startedAt);
    return d.getHours() * 60 + d.getMinutes();
  });
  const avgStartMin = starts.length ? Math.round(starts.reduce((a, b) => a + b, 0) / starts.length) : null;
  // Zeitraum ab dem ersten Training im Fenster (sonst verfälschen leere Wochen vor Trackingbeginn den Schnitt)
  const sinceFirst = ss.length ? (Date.parse(today) - Date.parse(ss[0].date)) / 86_400_000 + 1 : 7;
  const spanDays = Math.max(7, Math.min(days ?? Infinity, sinceFirst));
  const weeks = Math.max(1, spanDays / 7);
  const musc = new Map<MuscleId, number>();
  for (const st of stats) for (const m of st.muscles) musc.set(m.muscle, (musc.get(m.muscle) ?? 0) + m.sets);
  const acts = (data.activities ?? []).filter((a) => a.date >= from);
  return {
    sessions: ss.length,
    hours: stats.reduce((a, x) => a + x.durationMin, 0) / 60,
    volume: stats.reduce((a, x) => a + x.volume, 0),
    sets: stats.reduce((a, x) => a + x.sets, 0),
    reps: stats.reduce((a, x) => a + x.reps, 0),
    avgMin: stats.length ? Math.round(stats.reduce((a, x) => a + x.durationMin, 0) / stats.length) : null,
    avgGapSec: withGap.length ? withGap.reduce((a, x) => a + x.avgGapSec!, 0) / withGap.length : null,
    avgRestPerSession: withGap.length ? withGap.reduce((a, x) => a + (x.restMin ?? 0), 0) / withGap.length : null,
    prs: ss.reduce((a, s) => a + (s.prs?.length ?? 0), 0),
    streak: weekStreak(all, today),
    longestStreak: longestWeekStreak(all),
    perWeek: ss.length / weeks,
    favExercise: fav ? { name: exMap.get(fav[0])?.name ?? fav[0], sets: fav[1] } : null,
    favDay: favD ? WEEKDAYS_LONG[favD[0]] : null,
    avgStart: avgStartMin != null ? `${String(Math.floor(avgStartMin / 60)).padStart(2, '0')}:${String(avgStartMin % 60).padStart(2, '0')}` : null,
    heaviest,
    topGains: [...series.entries()]
      .filter(([, v]) => v.length >= 3)
      .map(([id, v]) => ({ name: exMap.get(id)?.name ?? id, from: v[0], to: v[v.length - 1], pct: (v[v.length - 1] / v[0] - 1) * 100 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5),
    muscles: [...musc.entries()]
      .filter(([m]) => !MUSCLE[m].indirectOnly)
      .map(([muscle, s]) => ({ muscle, perWeek: s / weeks }))
      .sort((a, b) => b.perWeek - a.perWeek),
    activities: {
      count: acts.length,
      minutes: acts.reduce((a, x) => a + activityMinutes(x), 0),
      km: acts.reduce((a, x) => a + (x.km ?? 0), 0),
      steps: acts.reduce((a, x) => a + (x.steps ?? 0), 0),
    },
  };
}

export const fmtMinSec = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// ───────────────────────── Wochenrückblick ─────────────────────────

export interface WeekReview {
  start: string;
  end: string;
  complete: boolean;
  sessions: number;
  prevSessions: number;
  minutes: number;
  sets: number;
  prevSets: number;
  volume: number;
  prevVolume: number;
  reps: number;
  prs: string[];
  gains: { name: string; pct: number }[];
  muscles: { muscle: MuscleId; sets: number; target: number; prev: number }[];
  avgRir: number | null;
  avgGapSec: number | null;
  activities: number;
  activityMin: number;
  weight: { avg: number; prevAvg: number | null } | null;
  streak: number;
  score: number;
  headline: string;
  focus: string[];
}

const weekSets = (data: AppData, start: string) => {
  const end = addDays(start, 6);
  const ss = data.sessions.filter((s) => s.status === 'done' && s.date >= start && s.date <= end);
  const exMap = new Map(data.exercises.map((e) => [e.id, e]));
  const m = new Map<MuscleId, number>();
  for (const s of ss)
    for (const se of s.exercises) {
      const ex = exMap.get(se.exerciseId);
      const n = se.sets.filter((x) => x.done).length;
      if (!ex || !n) continue;
      for (const [mm, c] of Object.entries(ex.muscles) as [MuscleId, number][]) m.set(mm, (m.get(mm) ?? 0) + c * n);
    }
  return { ss, m };
};

export function weekReview(data: AppData, start: string, targetOf: (m: MuscleId) => number, today = dateKey()): WeekReview {
  const end = addDays(start, 6);
  const prevStart = addDays(start, -7);
  const all = data.sessions.filter((s) => s.status === 'done').sort((a, b) => a.startedAt - b.startedAt);
  const cur = weekSets(data, start);
  const prev = weekSets(data, prevStart);
  const st = cur.ss.map((s) => sessionStats(s, all, data.exercises));
  const prevSt = prev.ss.map((s) => sessionStats(s, all, data.exercises));
  const gainsMap = new Map<string, number>();
  for (const x of st) if (x.bestGain) gainsMap.set(x.bestGain.name, Math.max(gainsMap.get(x.bestGain.name) ?? 0, x.bestGain.pct));
  const rirs = cur.ss.flatMap((s) => s.exercises.flatMap((e) => e.sets.filter((x) => x.done && x.rir != null).map((x) => x.rir!)));
  const gaps = st.filter((x) => x.avgGapSec != null);
  const muscles = MUSCLES.filter((m) => !m.indirectOnly).map((m) => ({ muscle: m.id, sets: cur.m.get(m.id) ?? 0, target: targetOf(m.id), prev: prev.m.get(m.id) ?? 0 }));
  const reached = muscles.filter((m) => m.sets >= m.target * 0.9).length;
  const acts = (data.activities ?? []).filter((a) => a.date >= start && a.date <= end);
  const wAvg = (from: string, to: string) => {
    const w = data.body.filter((b) => b.weight && b.date >= from && b.date <= to).map((b) => b.weight!);
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
  };
  const wa = wAvg(start, end);
  const sets = st.reduce((a, x) => a + x.sets, 0);
  const prs = cur.ss.flatMap((s) => s.prs ?? []);
  // Wochen-Score 0–100: Volumen-Zielerreichung (60 %), Konstanz (25 %), Intensität (15 %)
  const volScore = muscles.reduce((a, m) => a + Math.min(1, m.target ? m.sets / m.target : 1), 0) / Math.max(1, muscles.length);
  const consScore = Math.min(1, cur.ss.length / Math.max(1, data.settings.sessionsPerWeek));
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  const intScore = avgRir == null ? 0.7 : avgRir <= 2 ? 1 : avgRir <= 3 ? 0.7 : 0.4;
  const score = Math.round(100 * (0.6 * volScore + 0.25 * consScore + 0.15 * intScore));
  const under = muscles
    .filter((m) => m.sets < m.target * 0.75)
    .sort((a, b) => a.sets / Math.max(1, a.target) - b.sets / Math.max(1, b.target))
    .slice(0, 3);
  const focus: string[] = [];
  if (under.length) focus.push(`Mehr Volumen für ${under.map((m) => MUSCLE[m.muscle].short).join(', ')} – der Plan priorisiert das automatisch.`);
  if (avgRir != null && avgRir > 2.5) focus.push(`Ø ${fmtNum(avgRir, 1)} RIR: Sätze 1–2 Wdh. näher ans Versagen bringen.`);
  if (cur.ss.length < data.settings.sessionsPerWeek) focus.push(`${cur.ss.length}/${data.settings.sessionsPerWeek} Einheiten – trag deine freien Tage früh ein, dann verteilt der Plan besser.`);
  if (!focus.length) focus.push('Alles im Soll – genauso weitermachen und Gewichte steigern, wo die App es vorschlägt.');
  const headline =
    cur.ss.length === 0
      ? 'Keine Einheit diese Woche'
      : score >= 85
        ? 'Starke Woche 💪'
        : score >= 65
          ? 'Solide Woche'
          : 'Ausbaufähige Woche';
  return {
    start,
    end,
    complete: end < today,
    sessions: cur.ss.length,
    prevSessions: prev.ss.length,
    minutes: st.reduce((a, x) => a + x.durationMin, 0),
    sets,
    prevSets: prevSt.reduce((a, x) => a + x.sets, 0),
    volume: st.reduce((a, x) => a + x.volume, 0),
    prevVolume: prevSt.reduce((a, x) => a + x.volume, 0),
    reps: st.reduce((a, x) => a + x.reps, 0),
    prs,
    gains: [...gainsMap.entries()].map(([name, pct]) => ({ name, pct })).sort((a, b) => b.pct - a.pct).slice(0, 4),
    muscles,
    avgRir,
    avgGapSec: gaps.length ? gaps.reduce((a, x) => a + x.avgGapSec!, 0) / gaps.length : null,
    activities: acts.length,
    activityMin: acts.reduce((a, x) => a + activityMinutes(x), 0),
    weight: wa != null ? { avg: wa, prevAvg: wAvg(prevStart, addDays(start, -1)) } : null,
    streak: weekStreak(all, end < today ? end : today),
    score: cur.ss.length ? score : 0,
    headline,
    focus,
  };
}
