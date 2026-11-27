// Übungstausch: erledigte Sätze bleiben bei der alten Übung (Historie, Empfehlung), offene Sätze wandern zur neuen
import { defaultData, useStore } from '../src/lib/store';
import { exposures } from '../src/engine/progression';
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const S = () => useStore.getState();
S().replaceAll(defaultData());
const ex = (id: string) => S().exercises.find((e) => e.id === id)!;
const row = (sid: string, uid: string) => S().sessions.find((s) => s.id === sid)!.exercises.find((e) => e.uid === uid)!;

// Fall aus dem Testbericht: Dip-Maschine 3 Sätze, 1. Satz 140 × 9, dann Tausch auf Überkopf-Trizepsstrecken
const sid = S().startSession(null, 'Test');
S().addExerciseToSession(sid, ex('dip-machine'), undefined, 3);
S().addExerciseToSession(sid, ex('butterfly'), undefined, 3);
const dip = S().sessions.find((s) => s.id === sid)!.exercises[0];
S().patchExercise(sid, dip.uid, { setsReason: '3 Arbeitssätze geplant. Begründung: Trizeps …', why: 'Trizeps (Priorität 2) …' });
S().updateSet(sid, dip.uid, dip.sets[0].id, { weight: 140, reps: 9, rir: 1, done: true });
const nu = S().swapExercise(sid, dip.uid, ex('overhead-ext'));
let ses = S().sessions.find((s) => s.id === sid)!;
ok(nu !== dip.uid, 'neue Zeile für die neue Übung (eigene uid)');
ok(ses.exercises.map((e) => e.exerciseId).join(',') === 'dip-machine,overhead-ext,butterfly', 'Reihenfolge: Dip (erledigt) → Überkopf direkt dahinter → Rest');
ok(row(sid, dip.uid).sets.length === 1 && row(sid, dip.uid).sets[0].weight === 140 && row(sid, dip.uid).sets[0].done, 'Dip behält genau den erledigten Satz 140 × 9');
const oh = row(sid, nu);
ok(oh.sets.length === 2 && oh.sets.every((x) => !x.done), 'Überkopf bekommt die 2 offenen Sätze');
ok(oh.setsReason === undefined && oh.why === undefined, 'alte Satz-Begründung und Übungserklärung sind bei der neuen Übung weg');
ok(/statt Dip-Maschine/.test(oh.reason ?? ''), `Grund nennt den Tausch („${oh.reason}“)`);
ok(oh.repMin === ex('overhead-ext').repMin && oh.restSec === ex('overhead-ext').restSec, 'Wdh.-Bereich und Pause der neuen Übung');
for (const x of oh.sets) S().updateSet(sid, nu, x.id, { weight: 32.5, reps: 12, rir: 1, done: true });
S().finishSession(sid, []);
ses = S().sessions.find((s) => s.id === sid)!;
const hDip = exposures('dip-machine', S().sessions);
const hOh = exposures('overhead-ext', S().sessions);
ok(hDip.length === 1 && hDip[0].sets.length === 1 && hDip[0].sets[0].weight === 140, 'Historie Dip: 140 × 9 dauerhaft bei den Dips');
ok(hOh.length === 1 && hOh[0].sets.every((x) => x.weight === 32.5), 'Historie Überkopf: nur 32,5-kg-Sätze, keine 140 kg');

// Tausch ohne erledigte Sätze: an Ort und Stelle, alte Begründung weg
const sid2 = S().startSession(null, 'Test 2');
S().addExerciseToSession(sid2, ex('incline-press'), undefined, 3);
const ip = S().sessions.find((s) => s.id === sid2)!.exercises[0];
S().patchExercise(sid2, ip.uid, { setsReason: 'alt', why: 'alt', liveDismissed: 'x', warmup: 'hard' });
const nu2 = S().swapExercise(sid2, ip.uid, ex('chest-press'));
const cp = row(sid2, nu2);
ok(nu2 === ip.uid && S().sessions.find((s) => s.id === sid2)!.exercises.length === 1, 'ohne erledigte Sätze: gleiche Zeile, keine zusätzliche');
ok(cp.exerciseId === 'chest-press' && cp.sets.length === 3, 'Übung ersetzt, 3 Sätze bleiben');
ok(cp.setsReason === undefined && cp.why === undefined && cp.liveDismissed === undefined && cp.warmup === undefined, 'Begründung, Live- und Aufwärm-Status der alten Übung zurückgesetzt');
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
