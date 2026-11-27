// 4./5. Satz nur gezielt: nie, wenn eine Grundbewegung im 7-Tage-Fenster fehlt oder der Muskel ohne ihn schon > 115 % seines Wochenziels hat.
// Aufruf: TZ=Europe/Berlin npx tsx scripts/sets-audit.ts  (benötigt fixtures/export.json)
// @ts-expect-error – Node-Typen sind im Projekt nicht installiert
import { readFileSync } from 'node:fs';
import { parseExport } from '../src/lib/merge';
import { migrate } from '../src/lib/store';
import { buildPlan, personalTarget } from '../src/engine/planner';
import { computeAllStates } from '../src/engine/fatigue';
import { allEvents } from '../src/engine/activities';
import { addDays } from '../src/lib/utils';
import type { MuscleId } from '../src/lib/types';
const load = () => migrate(parseExport(readFileSync('fixtures/export.json', 'utf8')));
const at = (d: string, h: number) => Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00+01:00`);
const T = '2026-11-27';
const BASIC: [string, MuscleId[]][] = [['Ziehen', ['lats', 'upperBack']], ['Drücken', ['chest']], ['Quadrizeps', ['quads']], ['Beinbeuger', ['hamstrings']]];
const patterns: Record<string, number[]> = { '1×': [0], '2× (0,3)': [0, 3], '2× Folgetage': [0, 1], '3×': [0, 2, 4], '3× am Stück': [0, 1, 2], '4×': [0, 1, 3, 5] };
let fourth = 0, fourthGap = 0, fourthOver = 0, total = 0;
const lines: string[] = [];
const byMuscle: Record<string, number> = {};
for (const [pn, offs] of Object.entries(patterns))
  for (const min of [45, 60, 90, 120]) {
    const d = load();
    d.availability = {};
    for (let i = 0; i < 10; i++) d.availability[addDays(T, i)] = offs.includes(i) ? 'yes' : 'no';
    d.planOptions.todayMinutes = null; d.planOptions.dayMinutes = {};
    for (const o of offs) d.planOptions.dayMinutes[addDays(T, o)] = min;
    const p = buildPlan(d, at(T, 8));
    const ex = new Map(d.exercises.map((e) => [e.id, e]));
    // Sätze je Muskel im Plan (7 Tage) + letzte 7 Tage
    const st = computeAllStates(allEvents(d, at(T, 8)), at(T, 8), {});
    const planned: Partial<Record<MuscleId, number>> = {};
    for (const s of p.sessions) for (const pe of s.exercises) for (const [m, c] of Object.entries(ex.get(pe.exerciseId)!.muscles)) planned[m as MuscleId] = (planned[m as MuscleId] ?? 0) + (c as number) * pe.sets;
    const gaps = BASIC.filter(([, ms]) => ms.every((m) => (planned[m] ?? 0) + st[m].vol7 < 1)).map(([l]) => l);
    for (const s of p.sessions) for (const pe of s.exercises) {
      total++;
      if (pe.sets < 4) continue;
      fourth++;
      const e = ex.get(pe.exerciseId)!;
      byMuscle[e.primary] = (byMuscle[e.primary] ?? 0) + 1;
      const tgt = personalTarget(d, e.primary, p.spw);
      // rollierendes Fenster (Termin − 7 Tage, Termin]: absolvierte Reize + geplante Einheiten darin
      const tEnd = at(s.date, 17) + 3600_000;
      const ev = allEvents(d, at(T, 8)).filter((x) => x.muscle === e.primary && x.t > tEnd - 7 * 86400_000 && x.t <= tEnd).reduce((a, x) => a + x.sets, 0);
      let pl = 0;
      for (const s2 of p.sessions) {
        const t2 = at(s2.date, 17);
        if (t2 > tEnd - 7 * 86400_000 && t2 <= tEnd) for (const pe2 of s2.exercises) pl += ((ex.get(pe2.exerciseId)!.muscles as Record<string, number>)[e.primary] ?? 0) * pe2.sets;
      }
      const have = ev + pl;
      const over = have - 1 > tgt * 1.15; // ohne den 4. Satz schon > 115 % Wochenziel
      if (gaps.length) fourthGap++;
      if (over) fourthOver++;
      if (gaps.length || over) lines.push(`${pn} ${min} min ${s.date}: ${e.name}×${pe.sets} · ${e.primary} ${have.toFixed(1)}/${tgt}${gaps.length ? ' · Lücke: ' + gaps.join(',') : ''}`);
    }
  }
console.log(`Übungen geplant: ${total}, davon mit 4+ Sätzen: ${fourth}`);
console.log(`4. Satz obwohl Grundbewegung im 7-Tage-Fenster fehlt: ${fourthGap}`);
console.log(`4. Satz obwohl Wochenziel ohne ihn schon > 115 %: ${fourthOver}`);
console.log('4+ Sätze nach Zielmuskel:', JSON.stringify(byMuscle));
for (const l of lines.slice(0, 14)) console.log('  ' + l);
const ok = fourthGap === 0 && fourthOver === 0 && fourth / total < 0.35;
console.log(ok ? 'Alle Prüfungen bestanden' : 'FEHLER: Zusatzsätze ohne Bedarf');
if (!ok) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
