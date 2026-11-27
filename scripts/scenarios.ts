// Szenario-Regressionstests für die Trainingsplanung.
// Nach jedem Fall müssen Wochenlimit, Tage am Stück, Satzsummen, Wiederholungsziele, Ziele und Zeit zusammenpassen.
import { defaultData } from '../src/lib/store';
import { generateDemo } from '../src/lib/demo';
import { buildPlan, personalTarget, planToday, type Plan } from '../src/engine/planner';
import { adviseExercise } from '../src/engine/progression';
import type { AppData, Session, SetLog } from '../src/lib/types';
import { addDays, dateKey, parseKey, uid, HOUR } from '../src/lib/utils';

let fails = 0;
let checks = 0;
const ok = (cond: boolean, msg: string) => {
  checks++;
  if (!cond) {
    fails++;
    console.log('   ✗ ' + msg);
  }
};

const TODAY = '2026-11-27'; // Freitag
const at = (d: string, h = 9) => parseKey(d).getTime() + h * HOUR;

function base(withHistory = true): AppData {
  let d = defaultData();
  d.body = [];
  if (withHistory) {
    // Demo-Historie relativ zu „heute“
    const realNow = Date.now;
    Date.now = () => at(TODAY, 8);
    d = generateDemo(d, 6);
    Date.now = realNow;
  }
  d.availability = {};
  d.settings.preferredDays = [];
  return d;
}

const sets = (n: number, w: number, reps: number[], rir = 1, t0 = 0): SetLog[] =>
  Array.from({ length: n }, (_, i) => ({ id: uid(), weight: w, reps: reps[i] ?? reps[reps.length - 1], rir, failure: false, done: true, note: '', doneAt: t0 ? t0 + i * 150_000 : undefined }));

function session(date: string, ex: { id: string; sets: SetLog[]; repMin?: number; repMax?: number }[], split = 'upper'): Session {
  const t = at(date, 17);
  return {
    id: uid(), date, startedAt: t, endedAt: t + 80 * 60_000, status: 'done', title: 'Test', split, plannedMinutes: 90,
    exercises: ex.map((e) => ({ uid: uid(), exerciseId: e.id, repMin: e.repMin ?? 8, repMax: e.repMax ?? 12, targetRir: 1, restSec: 120, recWeight: null, skipped: false, note: '', sets: e.sets })),
  };
}

/** Prüft die Invarianten eines Plans */
function invariants(name: string, d: AppData, plan: Plan, now: number) {
  const today = dateKey(now);
  const cap = d.settings.maxSessionsPerWeek;
  const done = [...new Set(d.sessions.filter((s) => s.status === 'done').map((s) => s.date))];
  const planned = plan.sessions.filter((s) => !s.rest).map((s) => s.date);
  const all = [...new Set([...done, ...planned])].sort();
  // 1) rollierendes Wochenlimit
  for (const p of planned)
    for (let k = 0; k < 7; k++) {
      const from = addDays(p, -k);
      const to = addDays(from, 6);
      const n = all.filter((x) => x >= from && x <= to).length;
      ok(n <= cap, `${name}: ${n} Einheiten zwischen ${from} und ${to} (Limit ${cap})`);
    }
  // 2) Tage am Stück
  for (const p of planned) {
    let run = 1;
    for (let k = 1; all.includes(addDays(p, -k)); k++) run++;
    for (let k = 1; all.includes(addDays(p, k)); k++) run++;
    ok(run <= Math.max(2, d.settings.maxConsecutive), `${name}: ${run} Tage am Stück um ${p} (Limit ${d.settings.maxConsecutive})`);
  }
  const exMap = new Map(d.exercises.map((e) => [e.id, e]));
  for (const s of plan.sessions) {
    // 3) Zeit
    ok(s.estMinutes <= s.minutes + 3, `${name} ${s.date}: geschätzt ${s.estMinutes} min > verfügbar ${s.minutes} min`);
    // 4) Satzsummen: Muskel-Sätze aus Übungen = Begründung
    const sum: Record<string, number> = {};
    for (const p of s.exercises) for (const [m, c] of Object.entries(exMap.get(p.exerciseId)!.muscles)) sum[m] = (sum[m] ?? 0) + (c ?? 0) * p.sets;
    for (const dec of s.decisions) ok(Math.abs((sum[dec.muscle] ?? 0) - dec.sets) < 0.6, `${name} ${s.date}: ${dec.muscle} Begründung ${dec.sets} ≠ Übungen ${(sum[dec.muscle] ?? 0).toFixed(1)}`);
    // 5) Ziele identisch mit gemeinsamem Wochenziel
    for (const dec of s.decisions) ok(Math.abs(dec.target - personalTarget(d, dec.muscle, plan.spw)) < 0.01, `${name} ${s.date}: Ziel ${dec.muscle} ${dec.target} ≠ gemeinsames Ziel ${personalTarget(d, dec.muscle, plan.spw)}`);
    for (const p of s.exercises) {
      const ex = exMap.get(p.exerciseId)!;
      // 6) keine gesperrten / unpassenden Übungen
      ok(!ex.locked, `${name} ${s.date}: gesperrte Übung ${ex.id} geplant`);
      ok(s.home ? ex.location === 'home' : ex.location !== 'home', `${name} ${s.date}: Ort passt nicht (${ex.id})`);
      // 7) Wiederholungsziel = Steigerungsregel
      ok(p.repMax === (p.advice.repMax ?? ex.repMax), `${name} ${s.date} ${ex.id}: Karte ${p.repMin}–${p.repMax}, Regel bis ${p.advice.repMax}`);
      for (const m of p.advice.text.matchAll(/alle Sätze (\d+)|auf (\d+) Wdh\. steigern/g)) {
        const n = Number(m[1] ?? m[2]);
        ok(n <= p.repMax, `${name} ${s.date} ${ex.id}: Text verlangt ${n} Wdh., Zielbereich endet bei ${p.repMax}`);
      }
      if (p.repMax > ex.repMax) ok(!!p.advice.rangeNote && p.why.includes('Zielbereich'), `${name} ${s.date} ${ex.id}: erweiterter Bereich ohne Erklärung`);
      // 8) max. 4 Sätze (5 nur Seitheben/Waden)
      ok(p.sets <= (ex.pattern === 'lateralRaise' || ex.pattern === 'calfRaise' ? 5 : 4), `${name} ${s.date} ${ex.id}: ${p.sets} Sätze`);
    }
  }
  void today;
}

function run(name: string, d: AppData, now: number, show = true) {
  const plan = buildPlan(d, now);
  if (show) {
    console.log(`\n── ${name}`);
    for (const s of plan.sessions)
      console.log(`   ${s.date} ${s.label.padEnd(34)} ${String(s.estMinutes).padStart(3)}/${s.minutes} min · ${s.exercises.length} Üb. · ${s.exercises.reduce((a, e) => a + e.sets, 0)} Sätze${s.tentative ? ' (vorläufig)' : ''}`);
    for (const r of plan.restDays) console.log(`   ${r.date} Ruhetag – ${r.reason.slice(0, 120)}`);
  }
  invariants(name, d, plan, now);
  return plan;
}

const now = at(TODAY, 8);
const legs = ['quads', 'hamstrings', 'glutes'];

// 1 fester Termin mit 30 / 45 / 90 min
for (const m of [30, 45, 90]) {
  const d = base();
  d.availability[TODAY] = 'yes';
  d.planOptions.dayMinutes = { [TODAY]: m };
  d.planOptions.todayMinutes = { date: TODAY, minutes: m };
  const p = run(`1 Termin, ${m} min`, d, now);
  const s = p.sessions[0];
  const groups = new Set(s.decisions.filter((x) => x.sets >= 1).map((x) => x.muscle));
  ok(['chest', 'lats', 'upperBack'].some((g) => groups.has(g as never)), `1 Termin ${m} min: kein Oberkörper-Grundmuster`);
  if (m >= 45) ok(legs.some((g) => groups.has(g as never)), `1 Termin ${m} min: keine Beine`);
  ok(groups.has('biceps') && groups.has('triceps'), `1 Termin ${m} min: Armprioritäten fehlen`);
}
// 1 fester + 2 vorläufige: fester Tag deckt breit ab
{
  const d = base();
  d.availability[TODAY] = 'yes';
  d.availability[addDays(TODAY, 2)] = 'maybe';
  d.availability[addDays(TODAY, 4)] = 'maybe';
  const p = run('1 fest + 2 vielleicht', d, now);
  ok(['full', 'fbA', 'fbB'].includes(p.sessions[0].templateId), `1 fest + 2 vielleicht: fester Tag ist ${p.sessions[0].templateId} statt Ganzkörper`);
}
// 2 verteilte, 2 und 3 aufeinanderfolgende, 4 verfügbare Tage
for (const [name, offs] of [['2 verteilt', [0, 3]], ['2 am Stück', [0, 1]], ['3 am Stück', [0, 1, 2]], ['4 verfügbar', [0, 2, 3, 5]]] as const) {
  const d = base();
  for (const o of offs) d.availability[addDays(TODAY, o)] = 'yes';
  const p = run(name, d, now);
  if (name === '3 am Stück') {
    // gemeinsame Belastung: kein Muskel an zwei Folgetagen direkt mit vielen Sätzen
    for (let i = 1; i < p.sessions.length; i++) {
      const a = p.sessions[i - 1];
      const b = p.sessions[i];
      for (const x of b.decisions) {
        const y = a.decisions.find((z) => z.muscle === x.muscle);
        if (y && y.sets >= 3 && x.sets >= 3) ok(false, `3 am Stück: ${x.muscle} an ${a.date} und ${b.date} je ≥ 3 Sätze`);
      }
    }
  }
}
// Kurzfristiger Ausfall: Plan neu, erledigte Arbeit zählt
{
  const d = base();
  for (const o of [0, 2, 4]) d.availability[addDays(TODAY, o)] = 'yes';
  const p1 = run('3 Termine', d, now, false);
  d.availability[TODAY] = 'no';
  const p2 = run('Ausfall heute → neu verteilt', d, now);
  ok(!p2.sessions.some((s) => s.date === TODAY), 'Ausfall: heute noch geplant');
  ok(p2.sessions.length === p1.sessions.length - 1, 'Ausfall: Anzahl Einheiten nicht angepasst');
}
// Importierter Datenstand (nachgestellt): Do 26.11. trainiert, verfügbar 27., 28., 30.11., 02.12., Limit 4
{
  const d = base(false);
  d.settings.maxSessionsPerWeek = 4;
  d.sessions.push(
    session('2026-11-26', [
      { id: 'preacher-curl', sets: sets(4, 25, [10, 9, 9, 8]) },
      { id: 'overhead-ext', sets: sets(4, 30, [12, 11, 10, 10]) },
      { id: 'cable-lateral', sets: [...sets(2, 10, [9, 8], 1, at('2026-11-26', 17)), ...sets(1, 12.5, [5], 0, at('2026-11-26', 17) + 400_000)], repMin: 12, repMax: 20 },
    ]),
    session('2026-11-19', [{ id: 'seated-leg-curl', sets: sets(3, 35, [12, 12, 12]) }], 'lowerPlus'),
    session('2026-11-12', [{ id: 'seated-leg-curl', sets: sets(3, 35, [11, 10, 10]) }], 'lowerPlus'),
  );
  for (const x of ['2026-11-27', '2026-11-28', '2026-11-30', '2026-12-02']) d.availability[x] = 'yes';
  const p = run('Import-Fall: Do trainiert + Fr/Sa/Mo/Mi verfügbar, Limit 4', d, now);
  ok(p.sessions.length <= 3, `Import-Fall: ${p.sessions.length} geplant + 1 absolviert > 4`);
  ok(p.restDays.some((r) => r.reason.includes('Limit') || r.reason.includes('am Stück')), 'Import-Fall: gestrichener Tag ohne nachvollziehbaren Grund');
  // Beinbeuger: großer Gewichtssprung → erweiterter, erklärter Bereich
  const ex = d.exercises.find((e) => e.id === 'seated-leg-curl')!;
  const a = adviseExercise(ex, d.sessions, { settings: d.settings, checkIns: {} });
  console.log(`   Beinbeuger: ${a.type} · Bereich ${ex.repMin}–${a.repMax} · ${a.text}`);
  if (a.rangeNote) console.log(`   ${a.rangeNote}`);
  ok(a.repMax! >= 14 || !/14/.test(a.text), 'Beinbeuger: Text verlangt 14, Bereich nicht erweitert');
  // Seitheben: 10 × 9/8 + 12,5 × 5 bei Ziel 12–20
  const lat = d.exercises.find((e) => e.id === 'cable-lateral')!;
  const b = adviseExercise(lat, d.sessions, { settings: d.settings, checkIns: {} });
  console.log(`   Seitheben: ${b.type}${b.cautious ? ' (vorsichtig)' : ''} → ${b.weight} kg · ${b.text}`);
  ok(b.type === 'decrease' && b.weight! < 10, 'Seitheben: keine nachvollziehbare Anpassung nach 9/8 Wdh. bei Ziel 12–20');
  ok(b.text.includes('12,5 kg'), 'Seitheben: schwerere Sätze (12,5 kg) nicht berücksichtigt');
  // Zweite schwache Einheit → klare (nicht vorsichtige) Reduktion
  d.sessions.push(session('2026-11-27', [{ id: 'cable-lateral', sets: sets(3, 10, [9, 9, 8]), repMin: 12, repMax: 20 }]));
  const c = adviseExercise(lat, d.sessions, { settings: d.settings, checkIns: {} });
  ok(c.type === 'decrease' && !c.cautious, 'Seitheben: wiederholte Unterschreitung führt nicht zu klarer Anpassung');
}
// „Nur einmal“ → mehrere Termine
{
  const d = base();
  for (const o of [0, 2, 4]) d.availability[addDays(TODAY, o)] = 'yes';
  d.planOptions.weekCap = { count: 1, until: addDays(TODAY, 2) };
  const p1 = run('Nur 1× diese Woche', d, now);
  ok(p1.sessions.filter((s) => s.date <= addDays(TODAY, 2)).length <= 1, 'Nur 1×: mehr als eine Einheit bis Sonntag');
  d.planOptions.weekCap = null;
  const p2 = run('… dann wieder mehrere Termine', d, now);
  ok(p2.sessions.length >= 2, 'Nach Aufheben von „nur 1×“ keine weiteren Einheiten');
}
// Gesperrte Übung + übersprungene Übung
{
  const d = base();
  d.exercises = d.exercises.map((e) => (e.id === 'preacher-curl' ? { ...e, locked: true } : e));
  d.availability[TODAY] = 'yes';
  const p = run('Preacher gesperrt', d, now, false);
  ok(!p.sessions.some((s) => s.exercises.some((e) => e.exerciseId === 'preacher-curl')), 'gesperrte Übung geplant');
  const s0 = planToday(d);
  ok(!!s0 && s0.exercises.some((e) => d.exercises.find((x) => x.id === e.exerciseId)!.primary === 'biceps'), 'Bizeps ohne Preacher nicht abgedeckt');
}

console.log(`\n${checks - fails}/${checks} Prüfungen bestanden${fails ? ` – ${fails} FEHLER` : ''}`);
if (fails) (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
