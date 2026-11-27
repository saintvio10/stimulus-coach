// Regressionstest mit deinem echten Export: Datei als fixtures/export.json ablegen (Profil → Daten → Teilen/Export).
// Prüft für mehrere Zeitpunkte und kurzfristige Änderungen dieselben Regeln wie scripts/scenarios.ts.
// @ts-expect-error – Node-Typen sind im Projekt nicht installiert
import { existsSync, readFileSync } from 'node:fs';
import { parseExport } from '../src/lib/merge';
import { migrate } from '../src/lib/store';
import { buildPlan } from '../src/engine/planner';
import { adviseExercise } from '../src/engine/progression';
import { addDays, dateKey, parseKey, HOUR } from '../src/lib/utils';

const file = 'fixtures/export.json';
if (!existsSync(file)) {
  console.log(`Kein ${file} gefunden – bitte deinen JSON-Export dort ablegen. (Test übersprungen, NICHT bestanden.)`);
} else {
  const d = migrate(parseExport(readFileSync(file, 'utf8')));
  const cap = d.settings.maxSessionsPerWeek;
  const maxCons = d.settings.maxConsecutive;
  let fails = 0;
  const ok = (c: boolean, m: string) => {
    if (!c) {
      fails++;
      console.log('  ✗ ' + m);
    }
  };
  const lastDone = d.sessions.filter((s) => s.status === 'done').map((s) => s.date).sort().pop() ?? dateKey();
  const base = addDays(lastDone, 1);
  const check = (label: string, now: number) => {
    const plan = buildPlan(d, now);
    console.log(`\n── ${label}`);
    for (const s of plan.sessions) console.log(`   ${s.date} ${s.label} · ${s.estMinutes}/${s.minutes} min · ${s.exercises.reduce((a, e) => a + e.sets, 0)} Sätze`);
    for (const r of plan.restDays) console.log(`   ${r.date} ${r.reason.slice(0, 110)}`);
    const done = [...new Set(d.sessions.filter((s) => s.status === 'done').map((s) => s.date))];
    const all = [...new Set([...done, ...plan.sessions.map((s) => s.date)])].sort();
    for (const p of plan.sessions) {
      for (let k = 0; k < 7; k++) {
        const from = addDays(p.date, -k);
        const n = all.filter((x) => x >= from && x <= addDays(from, 6)).length;
        ok(n <= cap, `${label}: ${n} Einheiten ab ${from} (Limit ${cap})`);
      }
      let run = 1;
      for (let k = 1; all.includes(addDays(p.date, -k)); k++) run++;
      for (let k = 1; all.includes(addDays(p.date, k)); k++) run++;
      ok(run <= Math.max(2, maxCons), `${label}: ${run} Tage am Stück um ${p.date}`);
      ok(p.estMinutes <= p.minutes + 3, `${label}: ${p.date} zu lang`);
      for (const e of p.exercises) {
        ok(e.repMax === (e.advice.repMax ?? e.repMax), `${label}: ${e.exerciseId} Bereich ≠ Regel`);
        for (const m of e.advice.text.matchAll(/alle Sätze (\d+)|auf (\d+) Wdh\. steigern/g)) ok(Number(m[1] ?? m[2]) <= e.repMax, `${label}: ${e.exerciseId} Text > Zielbereich`);
      }
    }
  };
  check('Tag nach dem letzten Training, 8 Uhr', parseKey(base).getTime() + 8 * HOUR);
  check('… 18 Uhr', parseKey(base).getTime() + 18 * HOUR);
  const prev = d.availability[base];
  d.availability[base] = 'yes';
  check('… heute spontan „Zeit“', parseKey(base).getTime() + 9 * HOUR);
  d.availability[base] = prev as never;
  // Empfehlungen für alle Übungen mit Historie
  console.log('\n── Gewichtsempfehlungen');
  for (const ex of d.exercises) {
    const a = adviseExercise(ex, d.sessions, { settings: d.settings, checkIns: d.checkIns });
    if (a.type === 'new') continue;
    console.log(`   ${ex.name}: ${a.type}${a.cautious ? ' (vorsichtig)' : ''} ${a.weight ?? '–'} kg · ${ex.repMin}–${a.repMax} · ${a.text.slice(0, 120)}`);
    for (const m of a.text.matchAll(/alle Sätze (\d+)|auf (\d+) Wdh\. steigern/g)) ok(Number(m[1] ?? m[2]) <= (a.repMax ?? ex.repMax), `${ex.name}: Text > Zielbereich`);
  }
  console.log(fails ? `\n${fails} FEHLER` : '\nAlle Prüfungen mit deinem Export bestanden.');
}
