import type { AppData, Session } from './types';
import { DAY, HOUR, addDays, dateKey, parseKey, uid, weekdayOf, snapWeight } from './utils';
import { buildPlan } from '../engine/planner';
import { calibrateTime, computeVolumeAdjust } from '../engine/adapt';

const BASE: Record<string, number> = {
  'preacher-curl': 25,
  'hammer-curl': 16,
  'bayesian-curl': 10,
  'db-curl': 14,
  'overhead-ext': 22.5,
  pushdown: 30,
  'dip-machine': 60,
  'incline-press': 60,
  'chest-press': 70,
  butterfly: 55,
  'lat-pulldown': 65,
  'chest-supported-row': 60,
  'cable-row': 60,
  'cable-lateral': 7.5,
  'db-lateral': 10,
  'reverse-cable-fly': 10,
  'shoulder-press': 45,
  'leg-press': 160,
  'seated-leg-curl': 50,
  'leg-extension': 55,
  rdl: 80,
  'calf-raise': 80,
  'cable-crunch': 40,
  'ab-machine': 50,
};

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Erzeugt ~6 Wochen Beispieldaten, indem der echte Planer Tag für Tag durchlaufen wird. */
export function generateDemo(data: AppData, weeks = 6): AppData {
  const rand = rng(42);
  const d: AppData = structuredClone(data);
  d.sessions = d.sessions.filter((s) => !s.demo);
  d.body = d.body.filter((b) => !b.demo);
  const today = dateKey();
  const start = addDays(today, -weeks * 7);
  const exMap = new Map(d.exercises.map((e) => [e.id, e]));
  let weight = 73.1;
  // Trainingstage im Voraus festlegen (1–3 pro Woche, Mi–So, teils aufeinanderfolgend)
  const schedule = new Set<string>();
  for (let w = 0; w < weeks; w++) {
    const days = Array.from({ length: 7 }, (_, k) => addDays(start, w * 7 + k)).filter((x) => d.settings.preferredDays.includes(weekdayOf(x)));
    const n = 1 + Math.floor(rand() * 3);
    const pattern = rand();
    if (n === 3 && pattern < 0.5) [0, 1, 2].forEach((k) => days[k] && schedule.add(days[k]));
    else if (n >= 2 && pattern < 0.6) [1, 2].forEach((k) => days[k] && schedule.add(days[k]));
    else if (n >= 2) [0, 3].concat(n === 3 ? [4] : []).forEach((k) => days[k] && schedule.add(days[k]));
    else days[Math.floor(rand() * days.length)] && schedule.add(days[Math.floor(rand() * days.length)]);
  }
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(start, i);
    weight += 0.025 + (rand() - 0.5) * 0.25;
    if (i % 3 === 0)
      d.body.push({
        id: uid(),
        date: day,
        weight: +weight.toFixed(1),
        arm: i % 9 === 0 ? +(37.2 + i * 0.012).toFixed(1) : undefined,
        chest: i % 9 === 0 ? +(101 + i * 0.02).toFixed(1) : undefined,
        waist: i % 9 === 0 ? +(80 + i * 0.006).toFixed(1) : undefined,
        demo: true,
      });
    if (!schedule.has(day)) continue;
    const at = parseKey(day).getTime() + 17 * HOUR;
    const avail: Record<string, 'yes'> = {};
    for (let k = 0; k < 7; k++) if (schedule.has(addDays(day, k))) avail[addDays(day, k)] = 'yes';
    const plan = buildPlan({ ...d, availability: avail, planOptions: { uncertain: false, weekCap: null, todayMinutes: null } }, at);
    const p = plan.sessions[0];
    if (!p || p.date !== day || p.rest) continue;
    const minutes = Math.round(p.estMinutes * (1.05 + rand() * 0.15));
    const session: Session = {
      id: uid(),
      date: day,
      startedAt: at,
      endedAt: at + minutes * 60_000,
      status: 'done',
      title: p.label,
      split: p.templateId,
      plannedMinutes: p.minutes,
      estMinutes: p.estMinutes,
      plannedSets: p.exercises.reduce((a, x) => a + x.sets, 0),
      demo: true,
      exercises: p.exercises.map((pe) => {
        const ex = exMap.get(pe.exerciseId)!;
        const w = pe.recWeight ?? snapWeight(BASE[ex.id] ?? 20, ex, d.settings);
        const first = Math.min(pe.repMax + 1, Math.max(pe.repMin, pe.advice.repTarget + Math.round(rand() * 1.6)));
        return {
          uid: uid(),
          exerciseId: pe.exerciseId,
          repMin: pe.repMin,
          repMax: pe.repMax,
          targetRir: pe.targetRir,
          restSec: pe.restSec,
          recWeight: pe.recWeight,
          skipped: false,
          note: '',
          sets: Array.from({ length: pe.sets }, (_, k) => {
            const reps = Math.max(pe.repMin, first - Math.floor(k * (0.2 + rand() * 0.4)));
            return { id: uid(), weight: w, reps, rir: pe.targetRir + (rand() > 0.85 ? 1 : 0), failure: false, done: true, note: '' };
          }),
        };
      }),
    };
    d.sessions.push(session);
    // Ernährung & Check-in (Beispiele)
    d.nutrition[day] = {
      creatine: rand() > 0.15,
      sleep: +(6.5 + rand() * 2).toFixed(1),
      entries: [
        { id: uid(), name: 'Haferflocken mit Whey', kcal: 650, protein: 45 },
        { id: uid(), name: 'Reis, Hähnchen, Gemüse', kcal: 900, protein: 60 },
        { id: uid(), name: 'Skyr mit Beeren', kcal: 300, protein: 30 },
        { id: uid(), name: 'Abendessen', kcal: 800 + Math.round(rand() * 400), protein: 35 },
      ],
    };
  }
  d.sessions.sort((a, b) => a.startedAt - b.startedAt);
  // Tempo aus den Beispieleinheiten lernen
  let tf = 1,
    n = 0;
  for (const s of d.sessions) {
    const c = calibrateTime(s, tf, n, s.endedAt);
    tf = c.factor;
    n = c.samples;
  }
  d.settings.timeFactor = tf;
  d.settings.timeSamples = n;
  d.volumeAdjust = computeVolumeAdjust(d).map;
  d.body.sort((a, b) => (a.date < b.date ? -1 : 1));
  void DAY;
  return d;
}

export function clearDemo(data: AppData): AppData {
  const d: AppData = structuredClone(data);
  d.sessions = d.sessions.filter((s) => !s.demo);
  d.body = d.body.filter((b) => !b.demo);
  return d;
}

export function hasDemo(data: AppData) {
  return data.sessions.some((s) => s.demo);
}
