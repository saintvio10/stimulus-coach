// Zeitschätzung aus echten Satzzeiten: lernt Satzabstand & Wechselzeit je Übung, ignoriert Ausreißer
import { defaultData } from '../src/lib/store';
import { timeEstimator, learnedTimings } from '../src/engine/timing';
import type { Session, SetLog } from '../src/lib/types';
import { uid } from '../src/lib/utils';
const d = defaultData();
const ex = (id: string) => d.exercises.find((e) => e.id === id)!;
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
/** Einheit mit Übungen [id, Sätze, Minuten zwischen Sätzen, Wdh.], Wechsel `gap` Minuten */
const mk = (day: number, items: [string, number, number, number][], gap = 4): Session => {
  const t0 = Date.parse('2026-11-01T17:00:00+01:00') + day * 86_400_000;
  let t = t0;
  const exs = items.map(([id, n, every, reps], i) => {
    if (i) t += gap * 60_000;
    const sets = Array.from({ length: n }, (_, k) => {
      if (k) t += every * 60_000;
      return { id: uid(), weight: 20, reps, rir: 1, failure: false, done: true, doneAt: t, note: '' } as SetLog;
    });
    return { uid: uid(), exerciseId: id, repMin: 8, repMax: 12, targetRir: 1, restSec: 120, recWeight: 20, skipped: false, note: '', sets };
  });
  return { id: uid(), date: `2026-11-${String(day + 1).padStart(2, '0')}`, startedAt: t0, endedAt: t + 60_000, status: 'done', title: 't', split: 'full', plannedMinutes: 60, exercises: exs };
};
const pc = ex('preacher-curl');
const te0 = timeEstimator(d);
const model = te0.perSet(pc);
console.log(`Modell Preacher Curls: ${model.toFixed(2)} min/Satz, Wechsel ${te0.setup(pc).toFixed(2)} min`);
// 1) Nach 5 Einheiten mit je 3,5 min Satzabstand und 5 min Wechsel → gelernt
d.sessions = [0, 3, 6, 9, 12].map((k) => mk(k, [['lat-pulldown', 3, 4, 10], ['preacher-curl', 4, 3.5, 10]], 5));
const te = timeEstimator(d);
const L = learnedTimings(d.sessions).get('preacher-curl')!;
console.log(`gelernt: ${L.perSetMin.toFixed(2)} min/Satz aus ${L.nSet} Abständen, Wechsel ${L.firstMin?.toFixed(2)} aus ${L.nFirst}`);
ok(Math.abs(te.perSet(pc) - 3.5) < 0.05, `Satzzeit = gemessene 3,5 min (statt Modell ${model.toFixed(2)})`);
ok(Math.abs(te.setup(pc) - 1.5) < 0.05, `Wechselzeit = 5 min Abstand − 3,5 min Satz = 1,5 min`);
ok(te.learnedShare(pc) === 1, 'vollständig gelernt ab 8 Satzabständen');
// 2) wenig Daten → Mischung aus Modell und Messung
d.sessions = [mk(0, [['preacher-curl', 4, 3.5, 10]])];
const te2 = timeEstimator(d);
ok(te2.perSet(pc) > Math.min(model, 3.5) && te2.perSet(pc) < Math.max(model, 3.5), `3 Abstände → Mischwert ${te2.perSet(pc).toFixed(2)} zwischen Modell und Messung`);
// 3) Ausreißer (20 min Unterbrechung) wird ignoriert
d.sessions = [0, 3, 6].map((k) => mk(k, [['preacher-curl', 4, 3, 10]]));
d.sessions[1].exercises[0].sets[2].doneAt! += 20 * 60_000;
d.sessions[1].exercises[0].sets[3].doneAt! += 20 * 60_000;
ok(Math.abs(timeEstimator(d).perSet(pc) - 3) < 0.05, 'Unterbrechung von 20 min verfälscht die Satzzeit nicht');
// 4) Heimübung mit 35 Wdh. letztes Mal → Arbeitszeit nach echten Wdh. statt Bereichsmitte
const home = d.exercises.find((e) => e.location === 'home' && !e.unilateral && e.pattern !== 'bayesian')!;
d.sessions = [];
const before = timeEstimator(d).perSet(home);
const s1 = mk(0, [[home.id, 1, 0, 35]]);
d.sessions = [s1];
const after = timeEstimator(d).perSet(home);
console.log(`${home.name}: vorher ${before.toFixed(2)} min/Satz, nach 35 Wdh. ${after.toFixed(2)} min/Satz`);
ok(after > before + 0.5, 'Heimübung: lange Sätze (35 Wdh.) werden in der Schätzung berücksichtigt');
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
