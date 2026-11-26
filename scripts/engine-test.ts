import { defaultData } from '../src/lib/store';
import { generateDemo } from '../src/lib/demo';
import { buildPlan } from '../src/engine/planner';
import { addDays, dateKey } from '../src/lib/utils';
import { MUSCLE } from '../src/lib/muscles';

const show = (title: string, p: ReturnType<typeof buildPlan>) => {
  console.log(`\n=== ${title}: ${p.strategy.label} — ${p.strategy.reason}`);
  for (const s of p.sessions) {
    console.log(` ${s.date} ${s.label} (${s.minutes}→est ${s.estMinutes} min)${s.tentative ? ' [vorläufig]' : ''}`);
    for (const e of s.exercises) console.log(`   ${e.exerciseId.padEnd(22)} ${e.sets}x ${e.repMin}-${e.repMax} RIR${e.targetRir} ${e.recWeight ?? '-'}kg ${e.superset ?? ''} | ${e.advice.type}`);
    console.log('   muscles:', s.decisions.map((d) => `${MUSCLE[d.muscle].short}:${d.sets}`).join(' '));
  }
  p.notes.forEach((n) => console.log(' note:', n));
};
const t = dateKey();
let d = defaultData();
show('Leer, Standard', buildPlan(d));
show('Leer, 3 Tage am Stück', buildPlan({ ...d, availability: { [t]: 'yes', [addDays(t,1)]: 'yes', [addDays(t,2)]: 'yes' } }));
show('Leer, heute 45 min, unsicher', buildPlan({ ...d, planOptions: { uncertain: true, weekCap: null, todayMinutes: { date: t, minutes: 45 } } }));
d = generateDemo(d);
console.log('\ndemo sessions', d.sessions.length, d.sessions.map(s=>s.date+':'+s.split).join(' '));
show('Demo, 2 Tage hintereinander', buildPlan({ ...d, availability: { [addDays(t,1)]: 'yes', [addDays(t,2)]: 'yes' } }));
show('Demo, Standard', buildPlan(d));
