// „Gerät besetzt“: gleichwertige Alternativen für heute
// @ts-expect-error – Node-Typen sind im Projekt nicht installiert
import { readFileSync, existsSync } from 'node:fs';
import { parseExport } from '../src/lib/merge';
import { defaultData, migrate } from '../src/lib/store';
import { busyAlternatives } from '../src/engine/alternatives';
import type { AppData, Session, SetLog } from '../src/lib/types';
import { uid } from '../src/lib/utils';
const d: AppData = existsSync('fixtures/export.json') ? migrate(parseExport(readFileSync('fixtures/export.json', 'utf8'))) : defaultData();
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const mkSe = (id: string) => ({ uid: uid(), exerciseId: id, repMin: 8, repMax: 12, targetRir: 1, restSec: 120, recWeight: 20, skipped: false, note: '', sets: [{ id: uid(), weight: 20, reps: 10, rir: 1, failure: false, done: false, note: '' } as SetLog] });
const ses: Session = { id: uid(), date: '2026-11-27', startedAt: Date.now(), status: 'active', title: 't', split: 'full', plannedMinutes: 60, exercises: ['preacher-curl', 'lat-pulldown', 'leg-press', 'dip-machine'].map(mkSe) };
const name = (id: string) => d.exercises.find((e) => e.id === id)?.name;
for (const se of ses.exercises) {
  const alts = busyAlternatives(d, ses, se);
  console.log(`${name(se.exerciseId)} besetzt → ${alts.map((a) => `${a.ex.name} [${a.why}]`).join(' | ')}`);
  const cur = d.exercises.find((e) => e.id === se.exerciseId)!;
  ok(alts.length > 0, `${cur.name}: mindestens eine Alternative`);
  ok(alts.every((a) => (a.ex.muscles[cur.primary] ?? 0) >= 0.5), `${cur.name}: alle Alternativen trainieren ${cur.primary} mit`);
  ok(alts.every((a) => !ses.exercises.some((x) => x.exerciseId === a.ex.id)), `${cur.name}: keine Übung, die heute schon im Plan ist`);
  ok(alts.every((a) => !a.ex.locked), `${cur.name}: keine gesperrte Übung`);
}
// Beschwerden: Knie → keine kniebelastende Alternative zur Beinpresse
const legs = busyAlternatives(d, ses, ses.exercises[2], ['knee']);
console.log(`Beinpresse besetzt + Knieschmerz → ${legs.map((a) => a.ex.name).join(', ') || '– (keine)'}`);
ok(!legs.some((a) => ['leg-extension', 'hack-squat', 'squat'].includes(a.ex.id)), 'Knieschmerz: keine kniebelastende Alternative');
// gleicher Muskel zuerst
const bi = busyAlternatives(d, ses, ses.exercises[0]);
ok(bi[0] && d.exercises.find((e) => e.id === bi[0].ex.id)!.primary === 'biceps', 'Preacher Curls → zuerst eine Bizepsübung');
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
