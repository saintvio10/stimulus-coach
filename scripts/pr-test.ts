import { defaultData } from '../src/lib/store';
import { setPR } from '../src/engine/prs';
import type { Session } from '../src/lib/types';
const d = defaultData();
const ex = d.exercises.find((e) => e.id === 'preacher-curl')!;
const mk = (id: string, status: 'done' | 'active', sets: [number, number][], t: number): Session => ({ id, date: '2027-01-0' + (t + 1), startedAt: t * 1e8, endedAt: t * 1e8 + 1, status, title: 't', split: 'arms', plannedMinutes: 60,
  exercises: [{ uid: id + 'u', exerciseId: ex.id, repMin: 8, repMax: 12, targetRir: 1, restSec: 90, recWeight: 25, skipped: false, note: '', sets: sets.map(([w, r], i) => ({ id: id + i, weight: w, reps: r, rir: 1, failure: false, done: true, note: '', doneAt: t * 1e8 + i })) }] });
const hist = [mk('h1', 'done', [[25, 12], [25, 11]], 1)];
const cur = mk('c', 'active', [], 2);
const test = (l: string, w: number, r: number, earlier: [number, number][] = []) => {
  const c2 = mk('c', 'active', earlier, 2);
  const p = setPR([...hist, c2], c2, ex, { id: 'new', w, reps: r, rir: 1 });
  console.log(l.padEnd(40), '→', p ? `${p.kind}: ${p.title} ${p.sub}` : '–');
};
test('25 × 10 (schlechter)', 25, 10);
test('25 × 13 (mehr Wdh. bei Höchstgewicht)', 25, 13);
test('27,5 × 8 (neues Höchstgewicht)', 27.5, 8);
test('27,5 × 8, nachdem 27,5 × 9 schon heute', 27.5, 8, [[27.5, 9]]);
test('22,5 × 20 (e1RM höher)', 22.5, 20);
const first = setPR([cur], cur, ex, { id: 'x', w: 30, reps: 10, rir: 1 });
console.log('erstes Mal überhaupt'.padEnd(40), '→', first ? 'PR' : '– (kein Rekord beim ersten Mal)');
