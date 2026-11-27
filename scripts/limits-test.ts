// Persönliche Limits (max. Tage am Stück, max. Einheiten in 7 Tagen) – auch wenn kein verfügbarer Tag mehr zulässig ist
import { defaultData } from '../src/lib/store';
import { buildPlan } from '../src/engine/planner';
import { addDays } from '../src/lib/utils';
import type { AppData, Session } from '../src/lib/types';
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const at = (d: string, h = 8) => Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00+01:00`);
const today = '2026-12-10';
const mk = (trained: string[], avail: Record<string, 'yes' | 'no' | 'maybe'>): AppData => {
  const d = defaultData();
  d.settings = { ...d.settings, sessionsPerWeek: 2, maxSessionsPerWeek: 4, maxConsecutive: 3 };
  d.sessions = trained.map((date, i): Session => ({
    id: 's' + i, date, startedAt: at(date, 17), endedAt: at(date, 18), status: 'done', title: 'T', split: 'full', plannedMinutes: 60,
    exercises: [{ uid: 'u' + i, exerciseId: 'preacher-curl', repMin: 8, repMax: 12, targetRir: 1, restSec: 120, recWeight: 25, skipped: false, note: '', sets: [0, 1, 2].map((k) => ({ id: `x${i}${k}`, weight: 25, reps: 10, rir: 1, failure: false, done: true, note: '' })) }],
  }));
  d.availability = avail;
  return d;
};
const onlyToday = () => {
  const a: Record<string, 'yes' | 'no'> = { [today]: 'yes' };
  for (let k = 1; k <= 6; k++) a[addDays(today, k)] = 'no';
  return a;
};
const run = (trained: number[], avail = onlyToday()) => {
  const p = buildPlan(mk(trained.map((k) => addDays(today, -k)), avail), at(today));
  return { p, todayS: p.sessions.find((s) => s.date === today && !s.rest), rest: p.restDays.find((r) => r.date === today) };
};

// A: drei Vortage trainiert → heute wäre der 4. Tag in Folge
const A = run([3, 2, 1]);
console.log('  A:', A.rest?.reason);
ok(!A.todayS, 'A: kein Training heute (4. Tag in Folge, Limit 3)');
ok(A.rest?.kind === 'consecutive' && !!A.rest.noAlternative, 'A: Ruhetag „Tage am Stück“, ohne Ausweichtag');
ok(/4\. Trainingstag in Folge \(Limit 3\)/.test(A.rest?.reason ?? '') && /nächste Einheit ab morgen/.test(A.rest?.reason ?? ''), 'A: Begründung nennt Limit und nächsten möglichen Tag');
ok(A.p.notes.some((n) => /passt gerade in deine Limits/.test(n)), 'A: Hinweis im Plan');
// B: vor 6, 4, 2, 1 Tagen → heute wäre die 5. Einheit in 7 Tagen
const B = run([6, 4, 2, 1]);
console.log('  B:', B.rest?.reason);
ok(!B.todayS, 'B: kein Training heute (5. Einheit in 7 Tagen, Limit 4)');
ok(B.rest?.kind === 'cap' && /5\. Einheit innerhalb von 7 Tagen/.test(B.rest.reason), 'B: Ruhetag „Wochenlimit“ mit Begründung');
// C: nur gestern + vorgestern → dritter Tag erlaubt
const C = run([2, 1]);
ok(!!C.todayS && !C.rest, 'C: 3. Tag in Folge bleibt möglich');
// D: beide Limits gleichzeitig → beide genannt
const D = run([4, 3, 2, 1]);
console.log('  D:', D.rest?.reason);
ok(!D.todayS && /5\. Trainingstag in Folge/.test(D.rest?.reason ?? '') && /5\. Einheit innerhalb von 7 Tagen/.test(D.rest?.reason ?? ''), 'D: beide Limits verletzt → beide in der Begründung');
// E: Block aus der Jahressimulation – So trainiert, Di–Do trainiert, Fr+Sa verfügbar, danach nichts eingetragen
{
  const fr = '2027-06-04';
  const d = mk(['2027-05-30', '2027-06-01', '2027-06-02', '2027-06-03'], { '2027-06-04': 'yes', '2027-06-05': 'yes', '2027-06-06': 'no' });
  const p = buildPlan(d, at(fr));
  const planned = p.sessions.filter((s) => !s.rest).map((s) => s.date);
  ok(!planned.includes('2027-06-04') && !planned.includes('2027-06-05'), `E: Fr/Sa nicht geplant (wären 4./5. Tag in Folge und 5./6. Einheit in 7 Tagen) – geplant: ${planned.join(', ') || '—'}`);
  ok(p.restDays.filter((r) => r.date === '2027-06-04' || r.date === '2027-06-05').length === 2, 'E: beide Tage als Ruhetag mit Begründung');
}
// F: Gegenprobe – heute verboten, morgen erlaubt → morgen wird geplant, heute Ruhetag (mit Ausweichtag)
{
  const a: Record<string, 'yes' | 'no'> = { [today]: 'yes', [addDays(today, 1)]: 'yes' };
  for (let k = 2; k <= 6; k++) a[addDays(today, k)] = 'no';
  const F = run([3, 2, 1], a);
  ok(!F.todayS && F.p.sessions.some((s) => s.date === addDays(today, 1) && !s.rest), 'F: heute Ruhetag, morgen Training');
  ok(!!F.rest && !F.rest.noAlternative, 'F: Ausweichtag vorhanden → „Lieber an diesem Tag“ bleibt möglich');
}
// G: maxConsecutive 4 im Profil → 4. Tag erlaubt
{
  const d = mk([3, 2, 1].map((k) => addDays(today, -k)), onlyToday());
  d.settings.maxConsecutive = 4;
  ok(!!buildPlan(d, at(today)).sessions.find((s) => s.date === today && !s.rest), 'G: Limit 4 Tage im Profil → heute erlaubt');
}
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
