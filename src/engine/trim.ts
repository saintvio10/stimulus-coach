import type { AppData, MuscleId, Session } from '../lib/types';
import { MUSCLE, priorityWeight } from '../lib/muscles';
import { clamp, dateKey, relDayLabel } from '../lib/utils';
import { computeAllStates } from './fatigue';
import { allEvents } from './activities';
import { buildPlan, personalTarget } from './planner';

export interface TrimItem {
  uid: string;
  exerciseId: string;
  name: string;
  done: number;
  open: number;
  keep: number;
  /** Erklärung, warum gekürzt/verschoben */
  note: string;
}

export interface TrimPlan {
  minutes: number;
  estMin: number;
  items: TrimItem[];
  dropped: number;
}

/**
 * „Zeit übrig“: verbleibende Sätze so auswählen, dass in die angegebene Zeit der größte Nutzen passt.
 * Zeit je Satz = Arbeitszeit (× 2 bei einseitigen Übungen) + Pause; nicht begonnene Übungen kosten zusätzlich Gerätewechsel.
 * Nutzen = Priorität × noch offener Wochenbedarf (inkl. heute Erledigtem) × abnehmender Zusatznutzen; Muskeln, die in den
 * nächsten 2 Tagen ohnehin geplant sind, werden etwas niedriger gewichtet (sie werden dort abgedeckt). Modellregel.
 */
export function planTrim(data: AppData, session: Session, minutes: number, now = Date.now()): TrimPlan {
  const tf = data.settings.timeFactor || 1;
  const exMap = new Map(data.exercises.map((e) => [e.id, e]));
  const states = computeAllStates(allEvents(data, now), now, data.checkIns);
  const plan = buildPlan(data, now);
  const spw = plan.spw;
  const soon = plan.sessions.filter((s) => (Date.parse(s.date) - Date.parse(dateKey(now))) / 86_400_000 <= 2);
  const soonFor = (m: MuscleId) => soon.find((s) => (s.decisions.find((x) => x.muscle === m)?.sets ?? 0) >= 2);

  const doneToday: Partial<Record<MuscleId, number>> = {};
  for (const se of session.exercises) {
    const ex = exMap.get(se.exerciseId);
    const n = se.sets.filter((x) => x.done).length;
    if (ex) for (const [m, c] of Object.entries(ex.muscles) as [MuscleId, number][]) doneToday[m] = (doneToday[m] ?? 0) + c * n;
  }
  const items: (TrimItem & { cost: number; setup: number; started: boolean; primary: MuscleId })[] = [];
  for (const se of session.exercises) {
    const ex = exMap.get(se.exerciseId);
    if (!ex || se.skipped) continue;
    const done = se.sets.filter((x) => x.done).length;
    const open = se.sets.length - done;
    if (!open) continue;
    const uni = ex.unilateral || ex.pattern === 'bayesian';
    const cost = (((ex.compound ? 50 : 40) * (uni ? 2 : 1) + se.restSec) / 60) * tf;
    items.push({ uid: se.uid, exerciseId: ex.id, name: ex.name, done, open, keep: 0, note: '', cost, setup: done ? 0 : ex.compound ? 2 : 1, started: done > 0, primary: ex.primary });
  }
  const added: Partial<Record<MuscleId, number>> = {};
  const currentUid = session.exercises.find((e) => !e.skipped && e.sets.some((x) => !x.done))?.uid;
  const value = (it: (typeof items)[number]) => {
    const ex = exMap.get(it.exerciseId)!;
    let v = 0;
    for (const [m, c] of Object.entries(ex.muscles) as [MuscleId, number][]) {
      if (MUSCLE[m].indirectOnly) continue;
      const target = personalTarget(data, m, spw) || 1;
      const have = states[m].vol7 + (added[m] ?? 0);
      const need = clamp(1 - have / target, 0.15, 1);
      const today = (doneToday[m] ?? 0) + (added[m] ?? 0);
      // Priorität quadratisch: deine Top-Muskeln setzen sich bei knapper Zeit klar durch (Modellregel)
      v += c * priorityWeight(m, data.profile.priorities) ** 2 * need * (1 / (1 + today / 3)) * (soonFor(m) ? 0.8 : 1);
    }
    // laufende bzw. aktuelle Übung bevorzugt abschließen (du stehst schon am Gerät)
    return v * (it.uid === currentUid ? 1.5 : it.started && it.keep === 0 ? 1.15 : 1);
  };
  let used = 0;
  for (let guard = 0; guard < 60; guard++) {
    let best: (typeof items)[number] | null = null;
    let bestR = 0;
    let bestN = 1;
    for (const it of items) {
      if (it.keep >= it.open) continue;
      // Eine noch nicht begonnene Übung nur mit mindestens 2 Sätzen aufnehmen – 1 Satz nach dem Geräte-Einstellen lohnt kaum
      const n = it.keep === 0 && !it.started && it.open >= 2 ? 2 : 1;
      const c = it.cost * n + (it.keep === 0 ? it.setup : 0);
      if (used + c > minutes) continue;
      const r = (value(it) * n) / c;
      if (r > bestR) (bestR = r), (best = it), (bestN = n);
    }
    if (!best) break;
    used += best.cost * bestN + (best.keep === 0 ? best.setup : 0);
    best.keep += bestN;
    for (const [m, c] of Object.entries(exMap.get(best.exerciseId)!.muscles) as [MuscleId, number][]) added[m] = (added[m] ?? 0) + c * bestN;
  }
  let dropped = 0;
  for (const it of items) {
    const cut = it.open - it.keep;
    dropped += cut;
    if (!cut) continue;
    const s = soonFor(it.primary);
    const where = s ? `${MUSCLE[it.primary].short} ist ${relDayLabel(s.date, dateKey(now)).split(',')[0]} wieder geplant` : 'wird in den nächsten Einheiten berücksichtigt';
    it.note =
      it.keep === 0
        ? `entfällt heute – ${where}.`
        : `${it.keep} statt ${it.open} offene Sätze – ${(doneToday[it.primary] ?? 0) >= 1 ? `${MUSCLE[it.primary].short} hat heute schon ${Math.round((doneToday[it.primary] ?? 0) * 10) / 10} Sätze` : 'weitere Sätze bringen pro Minute weniger als die übrigen Übungen'}${s ? `; ${where}` : ''}.`;
  }
  return { minutes, estMin: Math.round(used), items: items.map(({ cost: _c, setup: _s, started: _st, primary: _p, ...r }) => r), dropped };
}
