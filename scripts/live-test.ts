import { defaultData } from '../src/lib/store';
import { liveAdjust } from '../src/engine/liveAdjust';
import type { SessionExercise } from '../src/lib/types';
const d = defaultData();
const ex = d.exercises.find((e) => e.id === 'preacher-curl')!;
const mk = (done: [number, number, number | null][], total = 4): SessionExercise => ({
  uid: 'u', exerciseId: ex.id, repMin: 8, repMax: 12, targetRir: 1, restSec: 120, recWeight: 27.5, skipped: false, note: '',
  sets: Array.from({ length: total }, (_, i) => (i < done.length ? { id: 's' + i, weight: done[i][0], reps: done[i][1], rir: done[i][2], failure: false, done: true, note: '' } : { id: 's' + i, weight: done[done.length - 1]?.[0] ?? 27.5, reps: 10, rir: 1, failure: false, done: false, note: '' })),
});
const cases: [string, [number, number, number | null][]][] = [
  ['27,5 kg × 10, RIR 1 (passt)', [[27.5, 10, 1]]],
  ['27,5 kg × 7 (knapp drunter)', [[27.5, 7, 0]]],
  ['27,5 kg × 4 (deutlich zu schwer)', [[27.5, 4, 0]]],
  ['27,5 kg × 8, RIR 0 im 1. Satz', [[27.5, 8, 0]]],
  ['27,5 kg × 16 (zu viele Wdh.)', [[27.5, 16, 1]]],
  ['27,5 kg × 12, RIR 3 (zu weit weg)', [[27.5, 12, 3]]],
  ['Satz 3 von 4: 10, 9, 7', [[27.5, 10, 1], [27.5, 9, 1], [27.5, 7, 0]]],
  ['Satz 3 von 4: 10, 8, 6', [[27.5, 10, 1], [27.5, 8, 1], [27.5, 6, 0]]],
];
for (const [l, c] of cases) {
  const a = liveAdjust(mk(c), ex, d.settings);
  console.log(l.padEnd(36), '→', a ? `${a.dir} ${a.from}→${a.to} | ${a.title}` : 'kein Hinweis');
}
