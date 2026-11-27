// Prüft: Tag ohne Gym im Wochenplan + Skifahren am selben Tag wie das Training
import { defaultData } from '../src/lib/store';
import { buildPlan } from '../src/engine/planner';
import { MUSCLE } from '../src/lib/muscles';
import type { AppData } from '../src/lib/types';
import { addDays, parseKey, HOUR } from '../src/lib/utils';

const day = '2027-01-06'; // Mittwoch
const base = (): AppData => {
  const d = defaultData();
  d.body = [];
  for (let k = 0; k < 7; k++) d.availability[addDays(day, k)] = [0, 2, 3, 4].includes(k) ? 'yes' : 'no';
  return d;
};
const exName = (d: AppData, id: string) => d.exercises.find((e) => e.id === id)!.name;
const legs = ['quads', 'hamstrings', 'glutes', 'calves'];
const print = (title: string, d: AppData, at: number) => {
  console.log(`\n══ ${title}`);
  for (const s of buildPlan(d, at).sessions) {
    const legSets = s.decisions.filter((x) => legs.includes(x.muscle)).reduce((a, x) => a + x.sets, 0);
    console.log(`${s.date} ${s.label}${s.home ? ' 🏠' : ''} · Beine ${legSets.toFixed(1)} Sätze`);
    console.log('   ' + s.exercises.map((e) => `${exName(d, e.exerciseId)}×${e.sets}`).join(' | '));
    const tired = s.decisions.filter((x) => x.reason.startsWith('Noch ermüdet')).map((x) => MUSCLE[x.muscle].short);
    if (tired.length) console.log('   ausgelassen (ermüdet):', tired.join(', '));
  }
};
// 1) Freitag ohne Gym
const d1 = base();
d1.awayDays = [addDays(day, 2)];
print('Fr ohne Gym (Mi, Fr, Sa, So verfügbar)', d1, parseKey(day).getTime() + 8 * HOUR);
// 2) Heute Ski (4 h, intensiv) – Plan um 9 Uhr und um 18 Uhr
for (const h of [9, 18]) {
  const d2 = base();
  d2.activities = [{ id: 'a', date: day, type: 'ski', minutes: 240, intensity: 'hard' }];
  print(`Heute 4 h Ski intensiv, Plan um ${h} Uhr`, d2, parseKey(day).getTime() + h * HOUR);
}

// 3) Gestern Oberkörper trainiert → heute wären Beine dran; heute vormittag 4 h Ski
import { uid } from '../src/lib/utils';
for (const ski of [false, true]) {
  const d3 = base();
  const y = addDays(day, -1);
  const yAt = parseKey(y).getTime() + 17 * HOUR;
  const ids = ['incline-press', 'lat-pulldown', 'cable-row', 'cable-lateral', 'preacher-curl', 'overhead-ext'];
  d3.sessions.push({ id: 'y', date: y, startedAt: yAt, endedAt: yAt + HOUR, status: 'done', title: 'Oberkörper', split: 'upper', plannedMinutes: 90,
    exercises: ids.map((id) => ({ uid: uid(), exerciseId: id, repMin: 8, repMax: 12, targetRir: 1, restSec: 120, recWeight: 20, skipped: false, note: '', sets: Array.from({ length: 4 }, () => ({ id: uid(), weight: 20, reps: 10, rir: 1, failure: false, done: true, note: '' })) })) });
  if (ski) d3.activities = [{ id: 'a', date: day, type: 'ski', minutes: 240, intensity: 'hard' }];
  print(`Gestern Oberkörper, heute ${ski ? 'vormittags 4 h Ski' : 'kein Ski'} – Plan um 13 Uhr`, d3, parseKey(day).getTime() + 13 * HOUR);
}
