import { defaultData } from '../src/lib/store';
import { adviseExercise } from '../src/engine/progression';
import type { Session } from '../src/lib/types';
const d = defaultData();
const ex = d.exercises.find((e) => e.id === 'preacher-curl')!; // 8–12, Schritt 2,5
const mk = (i: number, reps: number[], w: number, fb?: 'easy' | 'ok' | 'hard', dec?: 'accepted' | 'declined'): Session => ({
  id: 's' + i, date: `2026-11-${10 + i}`, startedAt: Date.UTC(2026, 10, 10 + i), endedAt: Date.UTC(2026, 10, 10 + i) + 3.6e6, status: 'done', title: '', split: 'full', plannedMinutes: 90,
  exercises: [{ uid: 'u' + i, exerciseId: ex.id, repMin: 8, repMax: 12, targetRir: 1, restSec: 120, recWeight: w, skipped: false, note: '', feedback: fb, decision: dec,
    sets: reps.map((r, k) => ({ id: `x${i}${k}`, weight: w, reps: r, rir: 1, failure: false, done: true, note: '' })) }],
});
const ctx = { settings: d.settings, checkIns: {} };
const show = (t: string, ss: Session[]) => { const a = adviseExercise(ex, ss, ctx); console.log(t.padEnd(34), a.type.padEnd(9), a.weight, '|', a.text); };
show('12/12/12 ohne Feedback', [mk(1, [12, 12, 12], 25)]);
show('12/12/12 „zu schwer“', [mk(1, [12, 12, 12], 25, 'hard')]);
show('11/11/10 „zu leicht“', [mk(1, [11, 11, 10], 25, 'easy')]);
show('7/7/6 „zu schwer“', [mk(1, [7, 7, 6], 27.5, 'hard')]);
show('12/12/12, 2× abgelehnt', [mk(1, [12, 12, 12], 25, 'ok', 'declined'), mk(2, [12, 12, 12], 25, 'ok', 'declined')]);
show('13/13/13, 2× abgelehnt', [mk(1, [12, 12, 12], 25, 'ok', 'declined'), mk(2, [13, 13, 13], 25, 'ok', 'declined')]);
