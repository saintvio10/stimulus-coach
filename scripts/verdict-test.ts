// Automatische Bewertung nach jeder Übung (App gibt Feedback anhand der Werte)
import { exerciseVerdict } from '../src/engine/verdict';
import { defaultData } from '../src/lib/store';
import type { Session, SetLog } from '../src/lib/types';
const d = defaultData();
const ex = d.exercises.find((e) => e.id === 'preacher-curl')!;
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const t0 = Date.parse('2026-11-20T17:00:00+01:00');
const mkSe = (w: number, reps: number[], rir = 1) => ({
  uid: 'u' + Math.random(), exerciseId: ex.id, repMin: 8, repMax: 12, targetRir: 1, restSec: 120, recWeight: w, skipped: false, note: '',
  sets: reps.map((r, k) => ({ id: 's' + k + Math.random(), weight: w, reps: r, rir, failure: false, done: true, doneAt: t0 + k * 1e5, note: '' }) as SetLog),
});
const last: Session = { id: 'last', date: '2026-11-20', startedAt: t0, endedAt: t0 + 3.6e6, status: 'done', title: 't', split: 'full', plannedMinutes: 60, exercises: [mkSe(25, [10, 9, 8])] };
const today = (se: ReturnType<typeof mkSe>): Session => ({ id: 'now', date: '2026-11-27', startedAt: t0 + 7 * 864e5, status: 'active', title: 't', split: 'full', plannedMinutes: 60, exercises: [se] });
const run = (se: ReturnType<typeof mkSe>) => exerciseVerdict(ex, se, today(se), [last, today(se)], { settings: d.settings, checkIns: {} })!;
const show = (name: string, v: ReturnType<typeof run>) => console.log(`  ${name}: ${v.title} | ${v.points.join(' | ')} | ${v.next}`);
const a = run(mkSe(25, [11, 10, 9]));
show('25×11/10/9', a);
ok(a.tone === 'good' && a.points.some((p) => p.includes('+3 Wdh.')), 'im Bereich + mehr Wdh. als letztes Mal → „Gewicht passt“, Fortschritt erkannt');
const b = run(mkSe(25, [15, 14, 13]));
show('25×15/14/13', b);
ok(b.tone === 'light' && /Nächstes Mal 27,5 kg/.test(b.next), 'über dem Bereich → „zu leicht“, nächstes Mal mehr Gewicht');
const c = run(mkSe(25, [7, 6, 5], 0));
show('25×7/6/5', c);
ok(c.tone === 'heavy', 'unter dem Bereich → „zu schwer“');
const e = run(mkSe(25, [10, 9, 9], 4));
show('25×10/9/9 mit 4 RIR', e);
ok(e.tone === 'light' && e.points.some((p) => p.includes('Reserve')), 'weit vom Versagen → „zu leicht“ mit Hinweis auf Reserve');
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
