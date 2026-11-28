// Heim-Equipment: 2 Flaschen à 1 kg + eine 10-kg-Hantel; Schwerpunkt-Zusatz bei „Ganzkörper“
import { defaultData, migrate } from '../src/lib/store';
import { adviseExercise, maxedOut } from '../src/engine/progression';
import { buildPlan, planHome, sessionFocus } from '../src/engine/planner';
import { liveAdjust } from '../src/engine/liveAdjust';
import { homeFeasible, loadHint, nextWeight, weightSteps } from '../src/lib/utils';
import type { Session, SetLog } from '../src/lib/types';
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const at = (day: string, h = 17) => Date.parse(`${day}T${h}:00:00+01:00`);
const d = defaultData();
d.settings.homeBottle = 1;
d.settings.homeDumbbell = 10;
const ex = (id: string) => d.exercises.find((e) => e.id === id)!;
const steps = (id: string) => JSON.stringify(weightSteps(ex(id), d.settings).list);
ok(steps('home-lateral') === '[1]' && steps('home-reverse-fly') === '[1]', `2-Flaschen-Übungen: nur 1 kg pro Hand (${steps('home-lateral')})`);
ok(steps('home-goblet') === '[10]', 'Goblet Squat (beidhändig an der einen Hantel): nur die Hantel');
ok(!!ex('home-oh-ext').unilateral && steps('home-oh-ext') === '[1,2,10]' && /einarmig/.test(ex('home-oh-ext').name), 'Trizeps über Kopf zu Hause: einarmig, Hantel oder Flaschen in einer Hand');
ok(steps('home-lateral-db') === '[1,2,10]', 'einarmig: Flasche(n) oder Hantel in einer Hand');
ok(steps('bench-dip') === '[0,10]' && steps('pullup') === '[0,10]', 'Körpergewicht: ohne oder mit Hantel als Zusatzlast – keine 1-kg-Flaschen');
ok(steps('pike-pushup') === '[0]' && steps('nordic-curl') === '[0]' && steps('leg-raise') === '[0]', 'Pike, Nordic Curls, Beinheben: keine Zusatzlast');
// Ausrüstung: Anzahl Hanteln/Flaschen und Flaschengröße
{
  const st = (o: Partial<typeof d.settings>) => ({ ...d.settings, ...o });
  const L = (id: string, o: Partial<typeof d.settings>) => JSON.stringify(weightSteps(ex(id), st(o)).list);
  ok(L('home-lateral', { homeBottleCount: 2, homeDumbbellCount: 2 }) === '[1,10]', 'Seitheben: 2 Flaschen oder 2 Hanteln (je eins pro Hand)');
  ok(L('home-lateral', { homeBottleCount: 1, homeDumbbellCount: 1 }) === '[]' && !homeFeasible(ex('home-lateral'), st({ homeBottleCount: 1, homeDumbbellCount: 1 })), 'nur 1 Flasche + 1 Hantel: Seitheben mit 2 Gewichten nicht machbar');
  ok(L('home-lateral', { homeBottleCount: 2, homeBottle: 1.5 }) === '[1.5]', 'Flaschengröße 1,5 l → 1,5 kg pro Hand');
  ok(L('home-goblet', { homeDumbbellCount: 2 }) === '[10,20]', 'Goblet mit 2 Hanteln: 10 oder 20 kg');
  ok(L('bench-dip', { homeDumbbellCount: 0 }) === '[0]' && L('bench-dip', { homeDumbbellCount: 2 }) === '[0,10,20]', 'Körpergewicht: Zusatzlast nur mit vorhandenen Hanteln');
  ok(L('home-curl', { homeBottleCount: 1, homeDumbbellCount: 1 }) === '[1,10]' && L('home-curl', { homeBottleCount: 0, homeDumbbellCount: 0 }) === '[]', 'einarmig: Flasche oder Hantel; ohne Ausrüstung nicht machbar');
  const dd = defaultData();
  dd.settings = { ...dd.settings, homeDumbbellCount: 0, homeBottleCount: 0 };
  const hp0 = planHome(dd, 45, 'weights', at('2026-12-02', 17));
  ok(!!hp0 && hp0.exercises.every((e) => dd.exercises.find((x) => x.id === e.exerciseId)!.equipment === 'bodyweight'), 'ohne Hanteln und Flaschen: nur Körpergewichtsübungen');
  const dd1 = defaultData();
  dd1.settings = { ...dd1.settings, homeDumbbellCount: 1, homeBottleCount: 1 };
  dd1.profile.priorities = ['sideDelts', 'rearDelts', 'biceps', 'triceps', 'chest', 'back', 'legs', 'absCalves'];
  const hp1 = planHome(dd1, 60, 'weights', at('2026-12-02', 17));
  ok(!!hp1 && !hp1.exercises.some((e) => ['home-lateral', 'home-reverse-fly'].includes(e.exerciseId)), 'nur 1 Flasche: keine 2-Flaschen-Übungen im Plan');
  ok(defaultData().settings.homeBottle === 1 && defaultData().settings.homeBottleCount === 2 && defaultData().settings.homeDumbbellCount === 1, 'Standard: 1 Hantel, 2 Flaschen à 1 l');
}
ok(nextWeight(1, ex('home-lateral'), d.settings) === 1, 'keine Steigerung über 1 kg pro Hand hinaus');
ok(loadHint(ex('home-lateral')) === 'pro Hand' && loadHint(ex('db-lateral')) === 'pro Hand' && loadHint(ex('home-goblet')) === 'eine Hantel, beidhändig' && loadHint(ex('preacher-curl')) === '', 'Anzeige: „pro Hand“ bei Kurzhanteln/Flaschen');
// Hantel 7,5 kg: alter Standard 10 kg wird einmalig korrigiert, eigene Werte bleiben
{
  const a = defaultData(); (a.settings as any).homeDumbbell = 10; delete (a.settings as any).homeDumbbellSet;
  const b = defaultData(); (b.settings as any).homeDumbbell = 12; delete (b.settings as any).homeDumbbellSet;
  const c = defaultData(); (c.settings as any).homeDumbbell = 10; (c.settings as any).homeDumbbellSet = true;
  ok(migrate(JSON.parse(JSON.stringify(a))).settings.homeDumbbell === 7.5, 'Migration: Heim-Hantel 10 → 7,5 kg');
  ok(migrate(JSON.parse(JSON.stringify(b))).settings.homeDumbbell === 12, 'Migration: selbst eingestelltes Hantelgewicht bleibt');
  ok(migrate(JSON.parse(JSON.stringify(c))).settings.homeDumbbell === 10, 'Migration: nach Bestätigung keine erneute Korrektur');
  ok(defaultData().settings.homeDumbbell === 7.5, 'Standard: 7,5 kg');
}
// Migration: gespeicherte Heimübungen bekommen die neuen Felder
const old = defaultData();
old.exercises = old.exercises.map((e) => (e.id === 'home-lateral' ? { ...e, homeLoad: undefined, upgradeTo: undefined } : e));
const mig = migrate(JSON.parse(JSON.stringify(old)));
ok(mig.exercises.find((e) => e.id === 'home-lateral')!.homeLoad === 'bottles', 'Migration: bestehende Daten bekommen homeLoad');

// Mehrere Heimeinheiten mit Flaschen: nie > 1 kg, am oberen Ende → Wechsel auf einarmig mit Hantel
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
// Seitliche Schulter gezielt gefragt (Priorität 1), 90 min
d.profile.priorities = ['sideDelts', 'rearDelts', 'biceps', 'triceps', 'chest', 'back', 'legs', 'absCalves'];
const hp = planHome(d, 90, 'weights', at('2027-01-06', 17)); // 12 Tage nach der letzten Schultereinheit
const ids = hp?.exercises.map((e) => e.exerciseId) ?? [];
console.log('  Heimplan:', ids.join(', '), '|', hp?.reasons.find((r) => /ausgereizt/.test(r)));
ok(!ids.includes('home-lateral'), 'Heimplan danach ohne „Seitheben (2 Flaschen)“');
ok(ids.includes('home-lateral-db') && !!hp?.reasons.some((r) => /ausgereizt/.test(r)), 'Seitheben kommt dran → einarmige Hantel-Variante, mit Begründung im Plan');
ok(!maxedOut(ex('home-reverse-fly'), d.sessions, d.settings) || !ex('home-reverse-fly').upgradeTo, 'Reverse Flys: keine Hantel-Variante → bleibt mit Tipps zum Schwerer-Machen');

// Schwerpunkt beim Training ohne Gym
{
  const h = defaultData();
  const t = at('2026-12-02', 17);
  const prim = (p: ReturnType<typeof planHome>) => (p?.exercises ?? []).map((e) => h.exercises.find((x) => x.id === e.exerciseId)!.primary);
  const up = planHome(h, 45, 'weights', t, 'upper');
  const lo = planHome(h, 45, 'weights', t, 'lower');
  const arms = planHome(h, 45, 'weights', t, 'arms');
  const all = planHome(h, 45, 'weights', t, 'all');
  console.log('  Oberkörper:', up?.label, '|', prim(up).join(','));
  console.log('  Beine & Bauch:', lo?.label, '|', prim(lo).join(','));
  ok(!!up && prim(up).length > 0 && prim(up).every((m) => !['quads', 'hamstrings', 'glutes', 'calves', 'abs'].includes(m)), 'Schwerpunkt Oberkörper: keine Bein-/Bauchübungen');
  ok(!!up && ['chest', 'biceps', 'triceps'].every((m) => prim(up).includes(m as any)) && prim(up).some((m) => m === 'lats' || m === 'upperBack'), 'Oberkörper: Brust, Rücken, Bizeps und Trizeps dabei');
  ok(!!lo && prim(lo).every((m) => ['quads', 'hamstrings', 'glutes', 'calves', 'abs'].includes(m)), 'Schwerpunkt Beine & Bauch: nur Beine/Bauch');
  ok(!!arms && prim(arms).every((m) => ['biceps', 'triceps', 'sideDelts', 'rearDelts', 'frontDelts', 'forearms'].includes(m)), 'Schwerpunkt Arme & Schultern');
  ok(up?.label === 'Unterwegs · Oberkörper' && lo?.label === 'Unterwegs · Beine & Bauch', 'Name zeigt den Schwerpunkt');
  ok(!!up?.decisions.find((x) => x.muscle === 'quads' && /nicht gewählt/.test(x.reason)), 'nicht gewählte Muskeln mit Begründung');
  ok(!!all && prim(all).some((m) => ['quads', 'hamstrings', 'glutes'].includes(m)), 'Ganzkörper: Beine weiter möglich');
  // vorab markierter Tag ohne Gym mit gespeichertem Schwerpunkt
  const h2 = defaultData();
  h2.availability = { '2026-12-03': 'yes' };
  h2.awayDays = ['2026-12-03'];
  h2.planOptions.homeFocus = { '2026-12-03': 'upper' };
  const pd = buildPlan(h2, at('2026-12-03', 10)).sessions.find((x) => x.date === '2026-12-03');
  ok(!!pd && pd.label === 'Unterwegs · Oberkörper' && prim(pd as any).every((m) => !['quads', 'hamstrings', 'glutes', 'calves', 'abs'].includes(m)), 'gespeicherter Schwerpunkt gilt auch im Tagesplan');
}
// Schwerpunkt-Zusatz
const all = d.exercises;
ok(sessionFocus('Ganzkörper A', [{ exerciseId: 'leg-press', sets: 6 }, { exerciseId: 'seated-leg-curl', sets: 4 }, { exerciseId: 'calf-raise', sets: 3 }, { exerciseId: 'cable-crunch', sets: 6 }], all) === 'Beine & Bauch', 'nur Beine/Waden/Bauch → „Schwerpunkt Beine & Bauch“');
ok(sessionFocus('Ganzkörper B', [{ exerciseId: 'preacher-curl', sets: 4 }, { exerciseId: 'leg-press', sets: 3 }, { exerciseId: 'lat-pulldown', sets: 3 }, { exerciseId: 'chest-press', sets: 3 }], all) === undefined, 'gemischte Einheit → kein Zusatz');
ok(sessionFocus('Oberkörper', [{ exerciseId: 'preacher-curl', sets: 4 }], all) === undefined, 'nur bei „Ganzkörper“-Namen');
ok(sessionFocus('Ganzkörper C (Arme & Schultern)', [{ exerciseId: 'preacher-curl', sets: 6 }, { exerciseId: 'overhead-ext', sets: 6 }], all) === undefined, 'kein doppelter Zusatz, wenn der Name schon passt');
// im echten Plan: Oberkörper gestern schwer → Ganzkörper mit Fokus
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
