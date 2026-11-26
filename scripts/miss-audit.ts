// Prüft, ob die Pläne nach im Training entfernten Übungen sinnvoll bleiben (Volumen, Regeneration, Nachholen)
import { defaultData } from '../src/lib/store';
import { buildPlan } from '../src/engine/planner';
import { computeVolumeAdjust } from '../src/engine/adapt';
import { computeAllStates } from '../src/engine/fatigue';
import { allEvents } from '../src/engine/activities';
import { MUSCLE, MUSCLES } from '../src/lib/muscles';
import type { AppData, Session } from '../src/lib/types';
import { addDays, diffDays, parseKey, snapWeight, uid, weekdayOf, HOUR } from '../src/lib/utils';

const START = '2027-01-04';
const WEEKS = 8;

function sim(days: number[], spw: number, missRate: number, seed0 = 11) {
  let d: AppData = defaultData();
  d.body = [];
  d.settings.sessionsPerWeek = spw;
  let seed = seed0;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const exMap = new Map(d.exercises.map((e) => [e.id, e]));
  const recs: number[] = [];
  let low50 = 0, low70 = 0, consec = 0, capOver = 0, nEx = 0;
  const lastDirect = new Map<string, string>();
  const pending: { id: string; day: string; prim: string }[] = [];
  const makeup: number[] = [];
  const makeupRec: number[] = [];
  const muscleMakeup: number[] = [];
  let missedN = 0, neverMade = 0;
  for (let i = 0; i < WEEKS * 7; i++) {
    const day = addDays(START, i);
    const at = parseKey(day).getTime() + 17 * HOUR;
    if (weekdayOf(day) === 1) d.volumeAdjust = computeVolumeAdjust(d, at).map;
    const avail: Record<string, 'yes'> = {};
    for (let k = 0; k < 7; k++) if (days.includes(weekdayOf(addDays(day, k)))) avail[addDays(day, k)] = 'yes';
    if (!avail[day]) continue;
    const plan = buildPlan({ ...d, availability: avail }, at);
    const p = plan.sessions.find((s) => s.date === day);
    if (!p || p.rest) continue;
    const states = computeAllStates(allEvents(d), at, {});
    const perMuscle: Record<string, number> = {};
    for (const pe of p.exercises) {
      const ex = exMap.get(pe.exerciseId)!;
      const r = states[ex.primary].recovery;
      recs.push(r); nEx++;
      if (r < 50) low50++;
      if (r < 70) low70++;
      if (!MUSCLE[ex.primary].indirectOnly && lastDirect.get(ex.primary) === addDays(day, -1)) consec++;
      for (const [m, c] of Object.entries(ex.muscles)) perMuscle[m] = (perMuscle[m] ?? 0) + (c ?? 0) * pe.sets;
      const pi = pending.findIndex((x) => x.id === ex.id);
      if (pi >= 0) { makeup.push(diffDays(day, pending[pi].day)); makeupRec.push(r); pending.splice(pi, 1); }
    }
    for (const [m, v] of Object.entries(perMuscle)) if (v > MUSCLE[m as keyof typeof MUSCLE].sessionCap + 0.01) { capOver++; if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.V) console.log(`  cap ${day} ${m} ${v.toFixed(2)}/${MUSCLE[m as keyof typeof MUSCLE].sessionCap} :: ${p.exercises.map((x) => x.exerciseId + "×" + x.sets).join(" ")}`); }
    // Abbruch simulieren: mit Wahrscheinlichkeit missRate werden die letzten 1–2 Übungen entfernt
    const nMiss = rand() < missRate ? (rand() < 0.5 ? 1 : 2) : 0;
    const s: Session = {
      id: uid(), date: day, startedAt: at, endedAt: at + p.estMinutes * 60000, status: 'done', title: p.label, split: p.templateId, plannedMinutes: p.minutes,
      exercises: p.exercises.map((pe, idx) => {
        const ex = exMap.get(pe.exerciseId)!;
        const miss = idx >= p.exercises.length - nMiss;
        if (miss) { pending.push({ id: ex.id, day, prim: ex.primary }); missedN++; }
        else if (!MUSCLE[ex.primary].indirectOnly) lastDirect.set(ex.primary, day);
        const w = pe.recWeight ?? snapWeight(20, ex, d.settings);
        return { uid: uid(), exerciseId: ex.id, repMin: pe.repMin, repMax: pe.repMax, targetRir: pe.targetRir, restSec: pe.restSec, recWeight: pe.recWeight, skipped: miss, missed: miss ? pe.sets : undefined, note: '',
          sets: miss ? [] : Array.from({ length: pe.sets }, () => ({ id: uid(), weight: w, reps: pe.advice.repTarget, rir: pe.targetRir, failure: false, done: true, note: '' })) };
      }),
    };
    d = { ...d, sessions: [...d.sessions, s] };
    // Muskel wieder direkt trainiert? (unabhängig von der Übung)
  }
  neverMade = pending.filter((x) => diffDays(addDays(START, WEEKS * 7 - 1), x.day) > 10).length;
  const end = parseKey(addDays(START, WEEKS * 7)).getTime();
  const ev = allEvents(d).filter((e) => e.t > end - 28 * 86400000);
  const vol = Object.fromEntries(MUSCLES.filter((m) => !m.indirectOnly).map((m) => [m.short, ev.filter((e) => e.muscle === m.id).reduce((a, e) => a + e.sets, 0) / 4]));
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  return { nEx, avgRec: avg(recs), low50, low70, consec, capOver, missedN, made: makeup.length, makeupDays: avg(makeup), makeupRec: avg(makeupRec), minMakeupRec: Math.min(...makeupRec), neverMade, vol };
}

for (const [name, days, spw] of [['2×/Woche', [3, 6], 2], ['3×/Woche', [3, 5, 0], 3], ['4×/Woche', [3, 4, 6, 0], 3], ['5×/Woche', [3, 4, 5, 6, 0], 3]] as const) {
  const base = sim([...days], spw, 0);
  const miss = sim([...days], spw, 0.35);
  console.log(`\n══ ${name} ══`);
  for (const [lbl, r] of [['ohne Abbrüche', base], ['35 % Abbrüche', miss]] as const) {
    console.log(`${lbl.padEnd(14)} Übungen ${r.nEx} · Ø Erholung Zielmuskel ${r.avgRec.toFixed(0)} % · <70 %: ${r.low70} · <50 %: ${r.low50} · gleicher Muskel Folgetag: ${r.consec} · Muskel-Obergrenze überschritten: ${r.capOver}`);
    if (r.missedN) console.log(`               entfernt ${r.missedN}, nachgeholt ${r.made} (Ø nach ${r.makeupDays.toFixed(1)} Tagen, Erholung dann Ø ${r.makeupRec.toFixed(0)} %, min ${r.minMakeupRec} %), nie nachgeholt: ${r.neverMade}`);
    console.log('               Sätze/Woche: ' + Object.entries(r.vol).map(([k, v]) => `${k} ${(v as number).toFixed(1)}`).join(' · '));
  }
}
