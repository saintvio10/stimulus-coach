// Aufbau oder Erhalt? Schätzung je Muskel aus Volumen, Krafttrend und Körpergewicht
import { defaultData } from '../src/lib/store';
import { muscleGrowth } from '../src/engine/growth';
import type { AppData, Session, SetLog } from '../src/lib/types';
import { addDays } from '../src/lib/utils';
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const at = (d: string) => Date.parse(`${d}T17:00:00+01:00`);
const today = '2026-12-31';
const mk = (opts: { deficit?: boolean } = {}): AppData => {
  const d = defaultData();
  const sessions: Session[] = [];
  // 6 Wochen, 2 Einheiten pro Woche
  for (let w = 0; w < 6; w++)
    for (const off of [0, 3]) {
      const date = addDays(today, -42 + w * 7 + off + 1);
      const k = w * 2 + (off ? 1 : 0); // 0..11
      const items: [string, number, number, number][] = [
        ['preacher-curl', 3, 25 + (k >= 4 ? 2.5 : 0) + (k >= 8 ? 2.5 : 0), 10 + (k % 4)], // Bizeps: steigt
        ['hammer-curl', 3, 16, 10],
        ['overhead-ext', 3, 30, 12], // Trizeps: gleich
        ['pushdown', 3, 30, 12],
        ['chest-press', 1, 60, 9], // Brust: nur 2 Sätze/Woche (+ indirekt)
        ['lat-pulldown', 3, 60, Math.max(4, 13 - k)], // Lat: sinkt
        ['cable-lateral', 2, 7.5, 15], // Seitl. Schulter: Erhaltungsbereich
      ];
      sessions.push({
        id: 's' + k, date, startedAt: at(date), endedAt: at(date) + 3.6e6, status: 'done', title: 'T', split: 'upper', plannedMinutes: 90,
        exercises: items.map(([id, n, w2, r], i) => ({ uid: `u${k}${i}`, exerciseId: id, repMin: 8, repMax: 15, targetRir: 1, restSec: 120, recWeight: w2, skipped: false, note: '', sets: Array.from({ length: n }, (_, j) => ({ id: `x${k}${i}${j}`, weight: w2, reps: r, rir: 1, failure: false, done: true, note: '' }) as SetLog) })),
      });
    }
  d.sessions = sessions;
  d.body = [0, 7, 14, 21].map((x, i) => ({ id: 'b' + i, date: addDays(today, -21 + x), weight: opts.deficit ? 80 - i * 0.4 : 80 + i * 0.1 }));
  return d;
};
const g = muscleGrowth(mk(), at(today));
const st = (m: string) => g.muscles.find((x) => x.muscle === m)!;
for (const m of ['biceps', 'triceps', 'chest', 'lats', 'sideDelts', 'quads']) console.log(`  ${m.padEnd(10)} ${st(m).status.padEnd(8)} Ø ${st(m).weekly}/Woche (Erhalt ${st(m).maintain.toFixed(1)}, Aufbau ${st(m).grow.toFixed(1)}) Trend ${st(m).trend} | ${st(m).text}`);
ok(st('biceps').status === 'build', 'Bizeps: genug Volumen + Kraft steigt → Aufbau');
ok(st('triceps').status === 'stall', 'Trizeps: genug Volumen, Kraft gleich → Stagnation');
ok(st('lats').status === 'decline', 'Lat: Kraft sinkt deutlich → Rückgang');
ok(['maintain', 'low'].includes(st('chest').status), 'Brust: wenig direktes Volumen → Erhalt bzw. zu wenig');
ok(st('quads').status === 'low', 'Quadrizeps: 3 Wochen nicht trainiert → zu wenig Reiz');
ok(st('sideDelts').status === 'maintain' || st('sideDelts').status === 'likely', 'Seitliche Schulter: Erhaltungsbereich');
const gd = muscleGrowth(mk({ deficit: true }), at(today));
ok(gd.deficit && gd.muscles.find((x) => x.muscle === 'biceps')!.status === 'likely', 'Kaloriendefizit: Aufbau nur „wahrscheinlich“ (gebremst)');
const empty = muscleGrowth(defaultData(), at(today));
ok(empty.muscles.every((x) => x.status === 'none'), 'ohne Trainings: keine Daten');
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
