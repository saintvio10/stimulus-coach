// Automatische Bewertung nach jeder Übung (App gibt Feedback anhand der Werte)
import { exerciseVerdict, setFeedback } from '../src/engine/verdict';
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
// Pop-up nach jedem Satz (letztes Mal: 25×10/9/8)
const sf = (k: number, w: number, reps: number, rir = 1) => setFeedback(ex, mkSe(w, [10]), k, { w, reps, rir }, [last], 10);
const f1 = sf(0, 25, 11);
console.log('  Satz 1, 25×11:', f1.title, '|', f1.line);
ok(f1.tone === 'good' && f1.line.includes('letztes Mal 10 (+1)'), 'Satz 1: 11 Wdh. bei Ziel 11 → „Ziel erreicht“, +1 ggü. letztem Mal');
const f2 = sf(1, 25, 12);
ok(f2.tone === 'great', 'Satz 2: 12 Wdh. bei Ziel 10 → „Stark! Ziel übertroffen“');
const f3 = sf(2, 25, 7, 0);
console.log('  Satz 3, 25×7:', f3.title, '|', f3.line, '|', f3.hint);
ok(f3.tone === 'low' && !!f3.hint, 'Satz 3: 7 Wdh. → „Unter dem Zielbereich“ mit Hinweis auf normale Ermüdung');
const f4 = sf(0, 25, 14);
ok(f4.tone === 'light' && /höher/.test(f4.hint ?? ''), '14 Wdh. → „Zu leicht“, nächster Satz schwerer');
const f5 = sf(0, 27.5, 9);
console.log('  Satz 1, 27,5×9:', f5.title, '|', f5.line);
ok(f5.line.includes('Kraft'), 'anderes Gewicht → Vergleich über Kraft (e1RM)');
const f6 = sf(0, 25, 11, 4);
ok(!!f6.hint && f6.hint.includes('im Tank'), '4 Wdh. Reserve → Hinweis näher ans Versagen');
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
