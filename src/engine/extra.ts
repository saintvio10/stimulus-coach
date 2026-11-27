import type { AppData, Exercise, MuscleId, Session } from '../lib/types';
import { MUSCLE } from '../lib/muscles';
import { dateKey, diffDays, fmtNum, relDayLabel } from '../lib/utils';
import { allEvents } from './activities';
import { computeAllStates, recoveryInfo } from './fatigue';
import { buildPlan, buildSession, personalTarget } from './planner';

export interface ExtraItem {
  ex: Exercise;
  sets: number;
  minutes: number;
  why: string;
}

export interface ExtraPlan {
  items: ExtraItem[];
  minutes: number;
  /** warum andere Muskeln heute nicht mehr vorgeschlagen werden */
  skipped: string[];
}

/**
 * „Noch Zeit?“ nach dem Training: sinnvolle Zusatzübungen für die angegebene Zeit.
 * Gleiche Bewertung wie der Plan (Priorität × offener Wochenbedarf × Erholung), mit den heute erledigten Sätzen.
 * Ausgeschlossen: Übungen, die heute schon dran waren; Muskeln mit ≥ 2 direkten Sätzen heute; Muskeln, die in einer
 * sicheren Einheit in den nächsten 2 Tagen geplant sind (die soll nicht unter Ermüdung leiden).
 */
export function extraSuggestions(data: AppData, session: Session, minutes: number, now = Date.now()): ExtraPlan {
  const today = dateKey(now);
  const plan = buildPlan(data, now);
  const exMap = new Map(data.exercises.map((e) => [e.id, e]));
  const events = allEvents(data, now);
  const states = computeAllStates(events, now, data.checkIns);

  // heute direkt trainiert
  const directToday: Partial<Record<MuscleId, number>> = {};
  for (const se of session.exercises) {
    const ex = exMap.get(se.exerciseId);
    const n = se.sets.filter((x) => x.done).length;
    if (ex && n) for (const [m, c] of Object.entries(ex.muscles) as [MuscleId, number][]) if (c >= 0.75) directToday[m] = (directToday[m] ?? 0) + n;
  }
  // bald geplant (sichere Termine ≤ 2 Tage)
  const soon = new Map<MuscleId, string>();
  for (const ps of plan.sessions) {
    if (ps.tentative || diffDays(ps.date, today) > 2) continue;
    for (const d of ps.decisions) if (d.sets >= 2 && !soon.has(d.muscle)) soon.set(d.muscle, ps.date);
  }

  const s = buildSession({
    date: today,
    at: now,
    minutes: minutes + 7, // kein zusätzliches Aufwärmen nötig
    templateId: 'full',
    events,
    data,
    sessionsPerWeek: plan.spw,
    tentative: false,
    nextDates: plan.sessions.filter((p) => !p.tentative).map((p) => p.date),
    today,
  });

  const inSession = new Set(session.exercises.map((e) => e.exerciseId));
  const items: ExtraItem[] = [];
  const skipped = new Set<string>();
  let used = 0;
  for (const pe of s.exercises) {
    const ex = exMap.get(pe.exerciseId);
    if (!ex) continue;
    const m = ex.primary;
    if (inSession.has(ex.id)) continue;
    if ((directToday[m] ?? 0) >= 2) {
      skipped.add(`${MUSCLE[m].short}: heute schon trainiert`);
      continue;
    }
    if (soon.has(m)) {
      skipped.add(`${MUSCLE[m].short}: ${relDayLabel(soon.get(m)!, today).split(',')[0]} geplant – soll erholt sein`);
      continue;
    }
    const sets = Math.min(pe.sets, 3);
    const t = (pe.minutes * sets) / pe.sets;
    if (used + t > minutes + 1) continue;
    used += t;
    const st = states[m];
    const tgt = personalTarget(data, m, plan.spw);
    const rank = MUSCLE[m].group ? data.profile.priorities.indexOf(MUSCLE[m].group!) + 1 : null;
    items.push({
      ex,
      sets,
      minutes: Math.round(t),
      why: `${MUSCLE[m].label}${rank ? ` (Priorität ${rank})` : ''}: ${fmtNum(st.vol7)}/${fmtNum(tgt)} Sätze in 7 Tagen · ${recoveryInfo(st, now).short}`,
    });
  }
  return { items, minutes: Math.round(used), skipped: [...skipped].slice(0, 4) };
}
