import { defaultData } from '../src/lib/store';
import { buildPlan } from '../src/engine/planner';
import { addDays, dateKey } from '../src/lib/utils';
const t = dateKey();
const d = defaultData();
const show = (title: string, av: number[]) => {
  const p = buildPlan({ ...d, availability: Object.fromEntries(av.map((i) => [addDays(t, i), 'yes'])) });
  console.log(`\n${title}: ${p.strategy.label}`);
  p.sessions.forEach((s) => console.log('  ', s.date, s.label));
  p.restDays.forEach((r) => console.log('   REST', r.date, r.reason.slice(0, 70)));
};
show('7 Tage Zeit', [0, 1, 2, 3, 4, 5, 6]);
show('4 am Stück', [0, 1, 2, 3]);
show('3 am Stück', [0, 1, 2]);
show('Mo Mi Fr', [0, 2, 4]);
