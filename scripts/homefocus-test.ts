// Training ohne Gym: Muskelgruppen einzeln wählbar, passend zu Historie, Wochenziel und den nächsten Einheiten
import { defaultData } from '../src/lib/store';
import { buildPlan, planHome, planHomeWithNext } from '../src/engine/planner';
import { focusGroups, focusLabel, focusMuscles } from '../src/engine/homeFocus';
import { focusStatus } from '../src/engine/homeFocus';
import type { AppData, HomeGroup, Session, SetLog } from '../src/lib/types';
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const at = (day: string, h = 17) => Date.parse(`${day}T${String(h).padStart(2, '0')}:00:00+01:00`);
const day = '2026-12-10';
const prim = (d: AppData, p: { exercises: { exerciseId: string }[] } | null) => (p?.exercises ?? []).map((e) => d.exercises.find((x) => x.id === e.exerciseId)!.primary);
const sess = (date: string, items: [string, number][]): Session => ({
  id: 's' + date + items.map((i) => i[0]).join(''), date, startedAt: at(date), endedAt: at(date) + 3.6e6, status: 'done', title: 'T', split: 'upper', plannedMinutes: 60,
  exercises: items.map(([id, n], k) => ({ uid: `u${k}${date}`, exerciseId: id, repMin: 8, repMax: 12, targetRir: 1, restSec: 120, recWeight: 20, skipped: false, note: '', sets: Array.from({ length: n }, (_, j) => ({ id: `x${k}${j}${date}`, weight: 20, reps: 10, rir: 1, failure: false, done: true, note: '' }) as SetLog) })),
});

// Hilfsfunktionen
ok(focusLabel(['chest', 'back', 'triceps']) === 'Brust, Rücken & Trizeps', 'Name aus Einzelauswahl');
ok(focusLabel(['legs', 'abs']) === 'Beine & Bauch' && focusLabel('upper') === 'Oberkörper' && focusLabel(undefined) === 'Ganzkörper', 'Schnellauswahl-Namen (auch alte Werte)');
ok(focusMuscles(['biceps'])!.includes('biceps') && focusMuscles(undefined) === undefined && focusGroups([]).length === 7, 'leer/alles = Ganzkörper');

// 1) Einzelauswahl: nur Bizeps + Trizeps
{
  const d = defaultData();
  const p = planHome(d, 45, 'weights', at(day), ['biceps', 'triceps']);
  const pm = prim(d, p);
  console.log('  Bizeps+Trizeps:', p?.label, '|', p?.exercises.map((e) => `${e.exerciseId}×${e.sets}`).join(', '));
  ok(!!p && pm.length > 0 && pm.every((m) => m === 'biceps' || m === 'triceps'), 'nur Bizeps- und Trizepsübungen');
  ok(p?.label === 'Unterwegs · Bizeps & Trizeps', 'Name zeigt die Auswahl');
}
// 2) Schon zu viel Trizeps diese Woche → Warnung, kein/kaum Trizeps
{
  const d = defaultData();
  d.sessions = [sess('2026-12-04', [['overhead-ext', 4], ['pushdown', 4], ['dip-machine', 4]]), sess('2026-12-07', [['overhead-ext', 4], ['pushdown', 4], ['dip-machine', 4]])];
  const r = planHomeWithNext(d, 45, 'weights', at(day), ['triceps', 'chest']);
  const st = r.session ? focusStatus(r.session, ['triceps', 'chest'], d.exercises) : [];
  const tri = st.find((x: { group: string }) => x.group === 'triceps');
  console.log('  Trizeps-Status:', tri?.text, '| Plan:', r.session?.exercises.map((e) => `${e.exerciseId}×${e.sets}`).join(', '));
  ok(!!tri && tri.tone === 'warn' && /Schon viel trainiert|Wochenziel schon erreicht/.test(tri.text), 'zu viel Trizeps → Warnung mit Wochenstand');
  const triSets = (r.session?.exercises ?? []).filter((e) => d.exercises.find((x) => x.id === e.exerciseId)!.primary === 'triceps').reduce((a, e) => a + e.sets, 0);
  ok(triSets <= 1, `keine/kaum Trizepsübung eingeplant (${triSets} Sätze)`);
  const only = planHome(d, 45, 'weights', at(day), ['triceps']);
  ok(!only || prim(d, only).filter((m) => m === 'triceps').length === 0 || only.exercises.reduce((a, e) => a + e.sets, 0) <= 2, 'nur Trizeps gewählt, aber schon zu viel → (fast) leerer Plan');
}
// 3) Nur noch 1 Satz bis zum Wochenziel → genau 1 Satz
{
  const d = defaultData();
  const tgt = buildPlan(d, at(day)).sessions[0]; void tgt;
  // Bizeps knapp unter Ziel: mehrere Einheiten mit Curls in den letzten 7 Tagen, aber erholt
  d.sessions = [sess('2026-12-04', [['preacher-curl', 4], ['hammer-curl', 3]]), sess('2026-12-06', [['preacher-curl', 3]])];
  const p = planHome(d, 45, 'weights', at(day), ['biceps']);
  const st = p ? focusStatus(p, ['biceps'], d.exercises) : [];
  console.log('  Bizeps knapp unter Ziel:', p?.exercises.map((e) => `${e.exerciseId}×${e.sets}`).join(', ') ?? '–', '|', st[0]?.text);
  const n = (p?.exercises ?? []).reduce((a, e) => a + e.sets, 0);
  const dec = p?.decisions.find((x) => x.muscle === 'biceps');
  ok(!!dec && dec.vol7 + n <= dec.target + 1.01, `Bizeps: nur so viele Sätze wie bis zum Wochenziel fehlen (${dec?.vol7} + ${n} ≤ ${dec?.target} + 1)`);
}
// 4) Danach: nächste Einheit rechnet das Heimtraining mit ein
{
  const d = defaultData();
  d.availability = { '2026-12-11': 'yes', '2026-12-12': 'no', '2026-12-13': 'no' };
  const chest = planHomeWithNext(d, 45, 'weights', at(day), ['chest', 'triceps']);
  const legs = planHomeWithNext(d, 45, 'weights', at(day), ['legs']);
  const setsOf = (p: typeof chest.next, m: string) => p?.decisions.find((x) => x.muscle === m)?.sets ?? 0;
  console.log('  nächste Einheit nach Brust/Trizeps:', chest.next?.date, 'Brust', setsOf(chest.next, 'chest'), 'Quads', setsOf(chest.next, 'quads'), '| nach Beinen: Brust', setsOf(legs.next, 'chest'), 'Quads', setsOf(legs.next, 'quads'));
  ok(!!chest.next && !!legs.next, 'nächste Einheit wird mitgeliefert');
  ok(setsOf(chest.next, 'chest') <= setsOf(legs.next, 'chest') && setsOf(legs.next, 'quads') <= setsOf(chest.next, 'quads'), 'nächste Einheit passt sich an: weniger von dem, was heute schon dran war');
}
// 5) Gespeicherte Auswahl für einen markierten Tag ohne Gym
{
  const d = defaultData();
  d.availability = { '2026-12-03': 'yes' };
  d.awayDays = ['2026-12-03'];
  d.planOptions.homeFocus = { '2026-12-03': ['back', 'biceps'] as HomeGroup[] };
  const p = buildPlan(d, at('2026-12-03', 10)).sessions.find((x) => x.date === '2026-12-03');
  ok(!!p && p.label === 'Unterwegs · Rücken & Bizeps' && prim(d, p).every((m) => ['lats', 'upperBack', 'biceps'].includes(m)), 'gespeicherte Auswahl gilt im Tagesplan');
}
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
