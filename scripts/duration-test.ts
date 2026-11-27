// Kürzere/längere Tage: passt sich der Plan an und gleichen die Folgetage aus?
import { defaultData } from '../src/lib/store';
import { buildPlan } from '../src/engine/planner';
import { MUSCLE } from '../src/lib/muscles';
import type { AppData } from '../src/lib/types';
import { addDays, parseKey, HOUR, fmtMin } from '../src/lib/utils';

const day = '2027-01-06';
const at = parseKey(day).getTime() + 8 * HOUR;
const run = (label: string, wed?: number) => {
  const d: AppData = defaultData();
  for (let k = 0; k < 7; k++) d.availability[addDays(day, k)] = [0, 2, 4].includes(k) ? 'yes' : 'no';
  if (wed) d.planOptions.dayMinutes = { [day]: wed };
  const p = buildPlan(d, at);
  const tot: Record<string, number> = {};
  console.log(`\n══ ${label}`);
  for (const s of p.sessions) {
    console.log(`${s.date} ${s.label.padEnd(30)} Zeit ${fmtMin(s.minutes).padEnd(10)} geschätzt ${fmtMin(s.estMinutes).padEnd(10)} ${s.exercises.length} Üb., ${s.exercises.reduce((a, e) => a + e.sets, 0)} Sätze`);
    for (const x of s.decisions) tot[x.muscle] = (tot[x.muscle] ?? 0) + x.sets;
  }
  console.log('Woche gesamt:', Object.entries(tot).filter(([m]) => !MUSCLE[m as keyof typeof MUSCLE].indirectOnly).map(([m, v]) => `${MUSCLE[m as keyof typeof MUSCLE].short} ${v.toFixed(1)}`).join(' · '));
};
run('Standard (Mi/Fr/So je 1 h 30 min)');
run('Mittwoch nur 45 min', 45);
run('Mittwoch 2 h 30 min', 150);
run('Mittwoch 3 h', 180);
