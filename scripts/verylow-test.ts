// Hinweis bei ≤ 4 Wdh.: leichter oder Übung beenden (live)
import { liveAdjust } from '../src/engine/liveAdjust';
import { defaultData } from '../src/lib/store';
import type { SessionExercise, SetLog } from '../src/lib/types';
const d = defaultData();
const ex = d.exercises.find((e) => e.id === 'preacher-curl')!;
let fails = 0;
const mk = (done: [number, number][], open: number, repMin = 8, repMax = 12): SessionExercise => ({
  uid: 'u', exerciseId: ex.id, repMin, repMax, targetRir: 1, restSec: 120, recWeight: done[0][0], skipped: false, note: '',
  sets: [
    ...done.map(([w, r], i) => ({ id: 'd' + i, weight: w, reps: r, rir: 0, failure: false, done: true, note: '' }) as SetLog),
    ...Array.from({ length: open }, (_, i) => ({ id: 'o' + i, weight: done[done.length - 1][0], reps: 10, rir: 1, failure: false, done: false, note: '' }) as SetLog),
  ],
});
const cases: [string, SessionExercise, (a: ReturnType<typeof liveAdjust>) => boolean][] = [
  ['25×11/10/8/3 (noch 1 offen)', mk([[25, 11], [25, 10], [25, 3]], 1), (a) => !!a?.endOption && a.to < 25],
  ['25×4 im 1. Satz', mk([[25, 4]], 2), (a) => !!a?.endOption && a.to < 25],
  ['25×5 → kein ≤4-Hinweis', mk([[25, 11], [25, 5]], 1), (a) => !a?.endOption],
  ['25×7 (4. Satz) → kein Beenden-Hinweis', mk([[25, 11], [25, 10], [25, 8], [25, 7]], 1), (a) => !a?.endOption],
  ['nach Erhöhung trotzdem (27,5×3)', mk([[25, 12], [27.5, 3]], 1), (a) => !!a?.endOption && a.to < 27.5],
  ['Kraftbereich 3–5 → kein Hinweis', mk([[60, 3]], 2, 3, 5), (a) => !a?.endOption],
  ['letzter Satz 3 Wdh. → nichts mehr anzupassen', mk([[25, 11], [25, 3]], 0), (a) => a == null],
];
for (const [name, se, chk] of cases) {
  const a = liveAdjust(se, ex, d.settings);
  const okk = chk(a);
  if (!okk) fails++;
  console.log(`${okk ? '✓' : '✗'} ${name.padEnd(40)} → ${a ? `${a.dir} ${a.from}→${a.to}${a.endOption ? ' +Beenden' : ''} | ${a.title}` : '–'}`);
}
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
