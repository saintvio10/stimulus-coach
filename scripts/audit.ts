import { defaultData } from '../src/lib/store';
import { buildPlan } from '../src/engine/planner';
import { computeVolumeAdjust } from '../src/engine/adapt';
import { eventsFromSessions } from '../src/engine/fatigue';
import { exerciseSeries } from '../src/engine/stats';
import { MUSCLE, MUSCLES } from '../src/lib/muscles';
import type { AppData, Session } from '../src/lib/types';
import { addDays, parseKey, snapWeight, uid, weekdayOf, HOUR, DAY } from '../src/lib/utils';

const START = '2027-01-04'; // Montag
const WEEKS = 8;
const BASE: Record<string, number> = { 'preacher-curl': 25, 'hammer-curl': 16, 'bayesian-curl': 10, 'db-curl': 14, 'overhead-ext': 22.5, pushdown: 30, 'dip-machine': 60, 'incline-press': 60, 'chest-press': 70, butterfly: 55, 'lat-pulldown': 65, 'chest-supported-row': 60, 'cable-row': 60, 'cable-lateral': 7.5, 'db-lateral': 10, 'reverse-cable-fly': 10, 'shoulder-press': 45, 'leg-press': 160, 'seated-leg-curl': 50, 'leg-extension': 55, rdl: 80, 'calf-raise': 80, 'cable-crunch': 40, 'ab-machine': 50 };

function sim(name: string, days: number[], spw: number, cap = 4) {
  let d: AppData = defaultData();
  d.body = [];
  d.settings.sessionsPerWeek = spw;
  d.settings.maxSessionsPerWeek = cap;
  const splits: Record<string, number> = {};
  const dupes: string[] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const exMap = new Map(d.exercises.map((e) => [e.id, e]));
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
    splits[p.label] = (splits[p.label] ?? 0) + 1;
    const prim = p.exercises.map((x) => exMap.get(x.exerciseId)!.primary);
    const seen = new Set<string>();
    prim.forEach((m, idx) => {
      if (seen.has(m)) dupes.push(`${day} ${MUSCLE[m].short}: ${p.exercises.filter((x) => exMap.get(x.exerciseId)!.primary === m).map((x) => x.exerciseId + '×' + x.sets).join(' + ')}`);
      seen.add(m);
    });
    const s: Session = {
      id: uid(), date: day, startedAt: at, endedAt: at + p.estMinutes * 60000, status: 'done', title: p.label, split: p.templateId, plannedMinutes: p.minutes,
      exercises: p.exercises.map((pe) => {
        const ex = exMap.get(pe.exerciseId)!;
        const w = pe.recWeight ?? snapWeight(BASE[ex.id] ?? 20, ex, d.settings);
        const first = Math.min(pe.repMax + 3, Math.max(pe.repMin, pe.advice.repTarget + Math.round(rand() * 1.6)));
        return { uid: uid(), exerciseId: ex.id, repMin: pe.repMin, repMax: pe.repMax, targetRir: pe.targetRir, restSec: pe.restSec, recWeight: pe.recWeight, skipped: false, note: '',
          sets: Array.from({ length: pe.sets }, (_, k) => ({ id: uid(), weight: w, reps: Math.max(pe.repMin, first - Math.floor(k * (0.2 + rand() * 0.4))), rir: pe.targetRir, failure: false, done: true, note: '' })) };
      }),
    };
    d = { ...d, sessions: [...d.sessions, s] };
  }
  // Auswertung letzte 4 Wochen
  const end = parseKey(addDays(START, WEEKS * 7)).getTime();
  const ev = eventsFromSessions(d.sessions, d.exercises).filter((e) => e.t > end - 28 * DAY);
  const n = d.sessions.length;
  console.log(`\n══ ${name} (spw ${spw}, cap ${cap}) – ${n} Einheiten in ${WEEKS} Wochen ══`);
  console.log('Splits:', Object.entries(splits).map(([k, v]) => `${k} ${v}`).join(', '));
  const row = MUSCLES.filter((m) => !m.indirectOnly).map((m) => {
    const sets = ev.filter((e) => e.muscle === m.id).reduce((a, e) => a + e.sets, 0) / 4;
    const freq = new Set(ev.filter((e) => e.muscle === m.id && e.direct).map((e) => e.t)).size / 4;
    return `${m.short}:${sets.toFixed(1)}/${freq.toFixed(1)}×`;
  });
  console.log('Sätze/Woche (fraktional) & direkte Frequenz/Woche:\n  ' + row.join('  '));
  const used = new Map<string, number>();
  d.sessions.forEach((s) => s.exercises.forEach((e) => used.set(e.exerciseId, (used.get(e.exerciseId) ?? 0) + 1)));
  console.log('Übungen genutzt:', [...used.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
  const unused = d.exercises.filter((e) => !e.locked && !used.has(e.id)).map((e) => e.id);
  if (unused.length) console.log('Nie genutzt:', unused.join(', '));
  const prog = ['preacher-curl', 'overhead-ext', 'cable-lateral', 'incline-press', 'lat-pulldown', 'leg-press'].map((id) => {
    const s = exerciseSeries(id, d.sessions);
    return s.length >= 2 ? `${id} ${s[0].topWeight}→${s[s.length - 1].topWeight}kg (${s.length}×)` : `${id} –`;
  });
  console.log('Progression:', prog.join(' | '));
  if (dupes.length) console.log(`Gleicher Zielmuskel 2× in einer Einheit (${dupes.length}):\n  ` + dupes.slice(0, 6).join('\n  '));
  console.log('Volumen-Anpassung:', Object.entries(d.volumeAdjust).filter(([, a]) => a!.factor !== 1).map(([m, a]) => `${m}:${a!.factor}`).join(' ') || 'keine');
}
sim('1×/Woche (Sa)', [6], 1);
sim('2×/Woche (Mi, Sa)', [3, 6], 2);
sim('3×/Woche (Mi, Fr, So)', [3, 5, 0], 3);
sim('3× am Stück (Fr–So)', [5, 6, 0], 3);
sim('4×/Woche (Mi, Do, Sa, So)', [3, 4, 6, 0], 3);
sim('5×/Woche (Mi–So)', [3, 4, 5, 6, 0], 3, 5);
