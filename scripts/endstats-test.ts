// Endscreen-Statistik: Kalorien und Vergleich je Übung zum letzten Mal
import { bodyWeightAt, estimateKcal, exerciseComparison } from '../src/engine/sessionStats';
import { defaultData } from '../src/lib/store';
import type { Session, SetLog } from '../src/lib/types';
const d = defaultData();
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const t0 = Date.parse('2026-11-01T17:00:00+01:00');
const se = (id: string, sets: [number, number, number?][], extra: Partial<SetLog> = {}) => ({
  uid: 'u' + Math.random(), exerciseId: id, repMin: 8, repMax: 12, targetRir: 1, restSec: 120, recWeight: null, skipped: false, note: '',
  sets: sets.map(([w, r, rir], k) => ({ id: 's' + k + Math.random(), weight: w, reps: r, rir: rir ?? 1, failure: false, done: true, doneAt: t0 + k * 1e5, note: '', ...extra }) as SetLog),
});
const sess = (id: string, day: number, exs: ReturnType<typeof se>[], status: Session['status'] = 'done'): Session => ({
  id, date: `2026-11-${String(day).padStart(2, '0')}`, startedAt: t0 + (day - 1) * 864e5, endedAt: t0 + (day - 1) * 864e5 + 3.6e6, status, title: 't', split: 'full', plannedMinutes: 60, exercises: exs,
});
const h = [
  sess('a', 3, [se('preacher-curl', [[20, 10], [20, 9]]), se('pushup', [[0, 15], [0, 12]])]),
  sess('b', 10, [se('preacher-curl', [[22.5, 9], [22.5, 8]]), se('pushup', [[0, 16], [0, 14]])]),
  sess('c', 17, [se('preacher-curl', [[22.5, 11], [22.5, 10]])]),
];
const today = sess('now', 24, [se('preacher-curl', [[25, 9], [25, 8]]), se('pushup', [[0, 18], [0, 15]]), se('lat-pulldown', [[60, 10]])], 'active');
const all = [...h, today];
const c = exerciseComparison(today, all, d.exercises);
const curl = c.find((x) => x.id === 'preacher-curl')!;
console.log(curl);
ok(curl.prevBest?.weight === 22.5 && curl.prevBest.reps === 11 && curl.prevBest.date === '2026-11-17', 'letztes Mal = bester Satz der letzten Einheit mit dieser Übung (22,5 × 11)');
ok(curl.best.weight === 25 && curl.best.reps === 9, 'heute bester Satz 25 × 9');
ok(curl.pct != null && curl.pct > 0, `25×9 > 22,5×11 im e1RM → Fortschritt (${curl.pct?.toFixed(1)} %)`);
ok(curl.history.length === 4 && curl.history[3] === curl.value, 'Verlauf: 3 alte Einheiten + heute');
ok(curl.first?.date === '2026-11-03' && curl.first.pct > 10, `seit Beginn +${curl.first?.pct.toFixed(0)} %`);
const pu = c.find((x) => x.id === 'pushup')!;
ok(!pu.weighted && pu.value === 33 && pu.prevValue === 30, 'Körpergewicht: Vergleich über Wiederholungen gesamt (33 vs 30)');
ok(pu.prevBest?.date === '2026-11-10', 'Körpergewicht: letzte Einheit mit der Übung, nicht die letzte Einheit überhaupt');
const lat = c.find((x) => x.id === 'lat-pulldown')!;
ok(lat.pct == null && lat.prevBest == null && lat.first == null, 'neue Übung: kein Vergleich, „Startwert“');
// L/R getrennt: schwächere Seite zählt
const lr = sess('lr', 25, [se('preacher-curl', [[25, 0]], { repsL: 10, repsR: 8, reps: 10 })], 'active');
const c2 = exerciseComparison(lr, [...h, lr], d.exercises)[0];
ok(c2.best.reps === 8, 'L/R getrennt: schwächere Seite zählt (8)');
// nicht abgeschlossene Einheiten zählen nicht
const ab = { ...sess('x', 20, [se('preacher-curl', [[40, 12]])]), status: 'active' as const };
const c3 = exerciseComparison(today, [...all, ab], d.exercises).find((x) => x.id === 'preacher-curl')!;
ok(c3.prevBest?.date === '2026-11-17', 'abgebrochene/aktive Einheiten zählen nicht als „letztes Mal“');
// mehr Gewicht, weniger Wdh. = normale Steigerung
ok(curl.trend === 'up', 'e1RM gestiegen → up');
const hv = sess('hv', 26, [se('preacher-curl', [[25, 6]])], 'active');
const c4 = exerciseComparison(hv, [...h, hv], d.exercises)[0];
console.log('  25×6 nach 22,5×11:', c4.pct?.toFixed(1), '%', c4.trend, c4.weightUp);
ok(c4.trend === 'up' && c4.weightUp === 2.5 && (c4.pct ?? 0) < 0, '+2,5 kg mit weniger Wdh. → als Fortschritt (+2,5 kg), nicht rot');
const hv2 = sess('hv2', 26, [se('preacher-curl', [[25, 4]])], 'active');
const c5 = exerciseComparison(hv2, [...h, hv2], d.exercises)[0];
ok(c5.trend === 'down' && c5.weightUp == null, `+2,5 kg aber Wdh. eingebrochen (${c5.pct?.toFixed(0)} %) → Rückgang`);
const lo = sess('lo', 26, [se('preacher-curl', [[22.5, 9]])], 'active');
ok(exerciseComparison(lo, [...h, lo], d.exercises)[0].trend === 'down', 'gleiches Gewicht, weniger Wdh. → Rückgang');
const eq = sess('eq', 26, [se('preacher-curl', [[22.5, 11]])], 'active');
ok(exerciseComparison(eq, [...h, eq], d.exercises)[0].trend === 'flat', 'gleich → gehalten');
ok(lat.trend === 'new', 'neue Übung → new');
// Kalorien
ok(estimateKcal(60, 80) === 400, '60 min × 80 kg × MET 5 = 400 kcal');
ok(estimateKcal(47, 78) === 305, '47 min × 78 kg → 305 kcal (auf 5 gerundet)');
const body = [{ date: '2026-10-01', weight: 80 }, { date: '2026-11-20', weight: 82 }, { date: '2026-11-30', weight: 83 }];
ok(bodyWeightAt(body, '2026-11-24').kg === 82, 'Körpergewicht: letzter Eintrag vor dem Trainingstag');
ok(bodyWeightAt(body, '2026-09-01').kg === 80, 'vor dem ersten Eintrag: erster Eintrag');
ok(!bodyWeightAt([], '2026-11-24').measured && bodyWeightAt([], '2026-11-24').kg === 75, 'ohne Eintrag: 75 kg angenommen');
console.log(fails ? `\n${fails} FEHLER` : '\nalle ok');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
