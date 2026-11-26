import { defaultData } from '../src/lib/store';
import { buildPlan, planHome } from '../src/engine/planner';
import { adviseExercise } from '../src/engine/progression';
import { MUSCLE } from '../src/lib/muscles';
import type { AppData, Session } from '../src/lib/types';
import { addDays, parseKey, HOUR } from '../src/lib/utils';

const d: AppData = defaultData();
const day = '2027-01-06';
for (let k = 0; k < 7; k++) d.availability[addDays(day, k)] = 'yes';
const at = parseKey(day).getTime() + 17 * HOUR;
const exMap = new Map(d.exercises.map((e) => [e.id, e]));
const show = (label: string, p: ReturnType<typeof planHome>) => {
  if (!p) return console.log(label, '– kein Plan');
  console.log(`\n${label}: ${p.label} · ~${p.estMinutes} min`);
  for (const e of p.exercises) console.log(`  ${exMap.get(e.exerciseId)!.name.padEnd(44)} ${e.sets}× ${e.repMin}–${e.repMax}  [${exMap.get(e.exerciseId)!.equipment}]`);
  console.log('  Muskeln:', p.decisions.filter((x) => x.sets >= 1).map((x) => `${MUSCLE[x.muscle].short} ${x.sets.toFixed(1)}`).join(', '));
};
for (const m of [30, 45, 60]) show(`Nur Körpergewicht ${m} min`, planHome(d, m, 'bw', at));
show('Mit Gewichten 60 min', planHome(d, 60, 'weights', at));
show('Mit Gewichten 75 min', planHome(d, 75, 'weights', at));

// Studio-Plan darf keine Home-Übungen enthalten
const plan = buildPlan(d, at);
const leak = plan.sessions.flatMap((s) => s.exercises).filter((e) => exMap.get(e.exerciseId)!.location === 'home');
console.log('\nHome-Übungen im Studio-Plan:', leak.length);

// Progression Körpergewicht
const ex = exMap.get('pushup')!;
const mk = (reps: number[]): Session => ({ id: 'x' + reps.join(), date: day, startedAt: at, endedAt: at + HOUR, status: 'done', title: 't', split: 'full', plannedMinutes: 45, exercises: [{ uid: 'u', exerciseId: 'pushup', repMin: 10, repMax: 30, targetRir: 1, restSec: 120, recWeight: null, skipped: false, note: '', sets: reps.map((r, i) => ({ id: 's' + i, weight: null, reps: r, rir: 1, failure: false, done: true, note: '' })) }] });
for (const r of [[18, 16, 14], [30, 30, 30]]) {
  const a = adviseExercise(ex, [mk(r)], { settings: d.settings, checkIns: {} });
  console.log(`Liegestütze ${r.join('/')} →`, a.type, a.weight, a.repTarget, '|', a.text);
}

// Variante: in den nächsten Tagen kein Gym verfügbar (z. B. Urlaub)
const d2: AppData = { ...defaultData(), availability: {} };
for (let k = 1; k < 7; k++) d2.availability[addDays(day, k)] = 'no';
show('Urlaub, mit Gewichten 60 min', planHome(d2, 60, 'weights', at));
show('Urlaub, nur Körpergewicht 45 min', planHome(d2, 45, 'bw', at));
