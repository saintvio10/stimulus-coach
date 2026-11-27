// Heim-Equipment: 2 Flaschen à 1 kg + eine 10-kg-Hantel; Schwerpunkt-Zusatz bei „Ganzkörper“
import { defaultData, migrate } from '../src/lib/store';
import { adviseExercise, maxedOut } from '../src/engine/progression';
import { buildPlan, planHome, sessionFocus } from '../src/engine/planner';
import { liveAdjust } from '../src/engine/liveAdjust';
import { loadHint, nextWeight, weightSteps } from '../src/lib/utils';
import type { Session, SetLog } from '../src/lib/types';
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const d = defaultData();
d.settings.homeBottle = 1;
d.settings.homeDumbbell = 10;
const ex = (id: string) => d.exercises.find((e) => e.id === id)!;
const steps = (id: string) => JSON.stringify(weightSteps(ex(id), d.settings).list);
ok(steps('home-lateral') === '[1]' && steps('home-reverse-fly') === '[1]', `2-Flaschen-Übungen: nur 1 kg pro Hand (${steps('home-lateral')})`);
ok(steps('home-oh-ext') === '[10]' && steps('home-goblet') === '[10]', 'beidhändig an der einen Hantel: nur 10 kg');
ok(steps('home-lateral-db') === '[1,2,10]', 'einarmig: Flasche(n) oder Hantel in einer Hand');
ok(nextWeight(1, ex('home-lateral'), d.settings) === 1, 'keine Steigerung über 1 kg pro Hand hinaus');
ok(loadHint(ex('home-lateral')) === 'pro Hand (Flasche)' && loadHint(ex('db-lateral')) === 'pro Hand' && loadHint(ex('home-goblet')) === 'eine Hantel, beidhändig' && loadHint(ex('preacher-curl')) === '', 'Anzeige: „pro Hand“ bei Kurzhanteln/Flaschen');
// Migration: gespeicherte Heimübungen bekommen die neuen Felder
const old = defaultData();
old.exercises = old.exercises.map((e) => (e.id === 'home-lateral' ? { ...e, homeLoad: undefined, upgradeTo: undefined } : e));
const mig = migrate(JSON.parse(JSON.stringify(old)));
ok(mig.exercises.find((e) => e.id === 'home-lateral')!.homeLoad === 'bottles', 'Migration: bestehende Daten bekommen homeLoad');

// Mehrere Heimeinheiten mit Flaschen: nie > 1 kg, am oberen Ende → Wechsel auf einarmig mit Hantel
const at = (day: string, h = 17) => Date.parse(`${day}T${h}:00:00+01:00`);
const days = ['2026-12-01', '2026-12-05', '2026-12-09', '2026-12-13', '2026-12-17', '2026-12-21'];
let reps = 18;
const recs: (number | null)[] = [];
for (const day of days) {
  for (const id of ['home-lateral', 'home-reverse-fly']) {
    const a = adviseExercise(ex(id), d.sessions, { settings: d.settings, checkIns: {} });
    recs.push(a.weight);
    const sets: SetLog[] = [0, 1, 2].map((i) => ({ id: `${day}${id}${i}`, weight: 1, reps: Math.min(30, reps - i), rir: 1, failure: false, done: true, note: '' })); // ohne Zeitstempel: keine gelernten Satzzeiten, die die Auswahl verschieben
    const se = { uid: day + id, exerciseId: id, repMin: 12, repMax: 30, targetRir: 1, restSec: 60, recWeight: a.weight, skipped: false, note: '', sets };
    const la = liveAdjust({ ...se, sets: [sets[0], { ...sets[1], done: false }, { ...sets[2], done: false }] }, ex(id), d.settings);
    ok(!la || la.to <= 1, `${day} ${id}: Live-Hinweis nie über 1 kg (${la ? la.to : '–'})`);
    d.sessions.push({ id: day + id, date: day, startedAt: at(day), endedAt: at(day) + 3e6, status: 'done', title: 'Heim', split: 'home', plannedMinutes: 45, location: 'home', exercises: [se] } as Session);
  }
  reps += 4;
}
ok(recs.every((w) => w == null || w <= 1), `Empfehlungen über 6 Einheiten nie > 1 kg (${[...new Set(recs)].join(', ')})`);
// letzte Einheit: 30/30/29 → noch nicht ausgereizt; eine mehr mit 30/30/30
d.sessions.push({ id: 'max', date: '2026-12-25', startedAt: at('2026-12-25'), endedAt: at('2026-12-25') + 3e6, status: 'done', title: 'Heim', split: 'home', plannedMinutes: 45, location: 'home', exercises: [{ uid: 'mx', exerciseId: 'home-lateral', repMin: 12, repMax: 30, targetRir: 1, restSec: 60, recWeight: 1, skipped: false, note: '', sets: [0, 1, 2].map((i) => ({ id: 'mx' + i, weight: 1, reps: 30, rir: 1, failure: false, done: true, note: '' })) }] } as Session);
ok(maxedOut(ex('home-lateral'), d.sessions, d.settings), 'Seitheben (2 Flaschen) mit 1 kg × 30/30/30 = ausgereizt');
const adv = adviseExercise(ex('home-lateral'), d.sessions, { settings: d.settings, checkIns: {} });
console.log('  Empfehlung:', adv.type, adv.weight, '–', adv.text);
ok(adv.type === 'extend' && adv.weight === 1 && /Seitheben einarmig \(Hantel\)/.test(adv.text), 'Empfehlung: bei 1 kg bleiben, nächster Schritt einarmig mit Hantel');
ok(!/Stagnation/.test(adv.text), 'keine „Stagnation“-Meldung, wenn nur das Equipment begrenzt');
// Seitliche Schulter gezielt gefragt (Priorität 1), 60 min
d.profile.priorities = ['sideDelts', 'rearDelts', 'biceps', 'triceps', 'chest', 'back', 'legs', 'absCalves'];
const hp = planHome(d, 60, 'weights', at('2027-01-06', 17)); // 12 Tage nach der letzten Schultereinheit
const ids = hp?.exercises.map((e) => e.exerciseId) ?? [];
console.log('  Heimplan:', ids.join(', '), '|', hp?.reasons.find((r) => /ausgereizt/.test(r)));
ok(!ids.includes('home-lateral'), 'Heimplan danach ohne „Seitheben (2 Flaschen)“');
ok(ids.includes('home-lateral-db') && !!hp?.reasons.some((r) => /ausgereizt/.test(r)), 'Seitheben kommt dran → einarmige Hantel-Variante, mit Begründung im Plan');
ok(!maxedOut(ex('home-reverse-fly'), d.sessions, d.settings) || !ex('home-reverse-fly').upgradeTo, 'Reverse Flys: keine Hantel-Variante → bleibt mit Tipps zum Schwerer-Machen');

// Schwerpunkt-Zusatz
const all = d.exercises;
ok(sessionFocus('Ganzkörper A', [{ exerciseId: 'leg-press', sets: 6 }, { exerciseId: 'seated-leg-curl', sets: 4 }, { exerciseId: 'calf-raise', sets: 3 }, { exerciseId: 'cable-crunch', sets: 6 }], all) === 'Beine & Bauch', 'nur Beine/Waden/Bauch → „Schwerpunkt Beine & Bauch“');
ok(sessionFocus('Ganzkörper B', [{ exerciseId: 'preacher-curl', sets: 4 }, { exerciseId: 'leg-press', sets: 3 }, { exerciseId: 'lat-pulldown', sets: 3 }, { exerciseId: 'chest-press', sets: 3 }], all) === undefined, 'gemischte Einheit → kein Zusatz');
ok(sessionFocus('Oberkörper', [{ exerciseId: 'preacher-curl', sets: 4 }], all) === undefined, 'nur bei „Ganzkörper“-Namen');
ok(sessionFocus('Ganzkörper C (Arme & Schultern)', [{ exerciseId: 'preacher-curl', sets: 6 }, { exerciseId: 'overhead-ext', sets: 6 }], all) === undefined, 'kein doppelter Zusatz, wenn der Name schon passt');
// im echten Plan: Oberkörper gestern schwer → Ganzkörper mit Fokus
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
void buildPlan;
