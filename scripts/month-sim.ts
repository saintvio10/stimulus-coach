// Monats-Simulation ab deinem echten Export (27.11.–27.12.2026).
// Der „Körper“ ist ein einfaches Modell (wahre Maximalkraft je Übung, Ermüdung, Tagesform, Kraftzuwachs).
// Die App sieht nur die protokollierten Sätze – genau wie im echten Training.
// @ts-expect-error – Node-Typen sind im Projekt nicht installiert
import { readFileSync } from 'node:fs';
import { parseExport } from '../src/lib/merge';
import { migrate } from '../src/lib/store';
import { buildPlan, personalTarget, type PlannedSession } from '../src/engine/planner';
import { liveAdjust } from '../src/engine/liveAdjust';
import { planTrim } from '../src/engine/trim';
import { computeVolumeAdjust } from '../src/engine/adapt';
import { computeAllStates, recoveryInfo } from '../src/engine/fatigue';
import { allEvents } from '../src/engine/activities';
import { painConflict } from '../src/engine/joints';
import { MUSCLE, MUSCLES } from '../src/lib/muscles';
import type { AppData, Exercise, MuscleId, Session, SessionExercise, SetLog } from '../src/lib/types';
import { addDays, e1rm, fmtNum, snapWeight, uid, weekdayOf } from '../src/lib/utils';

const START = '2026-11-27';
const END = '2026-12-27';
const at = (day: string, h: number, m = 0) => Date.parse(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+01:00`);
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const lbl = (d: string) => `${WD[weekdayOf(d)]} ${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`;

const d: AppData = migrate(parseExport(readFileSync('fixtures/export.json', 'utf8')));
const exMap = new Map(d.exercises.map((e) => [e.id, e]));

// ───── Körper-Modell ─────
const BASE: Record<string, number> = { 'preacher-curl': 25, 'hammer-curl': 16, 'bayesian-curl': 10, 'db-curl': 14, 'overhead-ext': 32.5, pushdown: 30, 'dip-machine': 60, 'incline-press': 60, 'chest-press': 70, butterfly: 55, 'lat-pulldown': 60, 'chest-supported-row': 55, 'cable-row': 55, 'cable-lateral': 7.5, 'db-lateral': 9, 'reverse-cable-fly': 10, 'shoulder-press': 45, 'leg-press': 150, 'seated-leg-curl': 35, 'leg-extension': 50, 'calf-raise': 80, 'cable-crunch': 40, 'ab-machine': 50 };
const truth = new Map<string, number>(); // wahre Maximalkraft (1RM) je Übung
for (const e of d.exercises) {
  const hist = d.sessions.flatMap((s) => s.exercises.filter((x) => x.exerciseId === e.id).flatMap((x) => x.sets.filter((y) => y.done && y.reps && y.weight)));
  const fromHist = hist.length ? Math.max(...hist.map((y) => e1rm(y.weight!, y.reps!, y.rir))) : 0;
  truth.set(e.id, fromHist || (BASE[e.id] ?? 20) * (1 + 11 / 30));
}
const truthStart = new Map(truth);
/** unabhängige Ermüdung des Körpers (nicht das Modell der App): direkte Sätze der letzten Tage */
const bodyLoad: { t: number; m: MuscleId; sets: number }[] = [];
const bodyFatigue = (m: MuscleId, t: number) => bodyLoad.filter((x) => x.m === m && x.t < t).reduce((a, x) => a + x.sets * Math.exp(-(t - x.t) / (36 * 3600_000)), 0);

// ───── Szenario ─────
type Day = { avail?: 'yes' | 'no' | 'maybe'; addToday?: boolean; cancelToday?: boolean; minutes?: number; away?: boolean; ski?: boolean; checkIn?: 'good' | 'bad' | 'sore' | 'pain'; trimTo?: number; swipeLast?: boolean; note?: string };
const S: Record<string, Day> = {
  // KW 48 (Rest): Plan aus deinem Export (Fr/Sa/So/Mo ja, Di nein, Mi ja, Do vielleicht)
  '2026-11-27': { checkIn: 'good', note: 'Export-Stand, heute 120 min' },
  '2026-12-02': { cancelToday: true, note: 'Mi kurzfristig abgesagt' },
  '2026-12-03': { addToday: true, minutes: 60, note: 'Do „vielleicht“ wird morgens zu „Zeit“ (60 min)' },
  // KW 49: nur 1 sicherer Termin (Sa), Mi vielleicht, So Skifahren
  '2026-12-07': { note: 'Wochenplanung: nur Sa sicher, Mi vielleicht' },
  '2026-12-09': { avail: 'no', note: 'Mi fällt doch weg' },
  '2026-12-12': { checkIn: 'bad', trimTo: 20, note: 'Sa schlecht geschlafen, nach 2 Übungen nur noch 20 min' },
  '2026-12-13': { ski: true, note: 'So 4 h Skifahren (intensiv)' },
  // KW 50: Di unterwegs (ohne Gym), Fr–So drei Tage am Stück, Schulterbeschwerden Fr/Sa
  '2026-12-15': { away: true, minutes: 45, note: 'Di unterwegs: Hantel & Flaschen, 45 min' },
  '2026-12-18': { checkIn: 'pain', note: 'Fr Schulter zwickt' },
  '2026-12-19': { checkIn: 'pain', note: 'Sa Schulter zwickt noch' },
  '2026-12-20': { checkIn: 'sore', note: 'So Muskelkater' },
  // KW 51: Mo/Di je 60 min, Mi spontan 45 min, Feiertage frei, So 90 min
  '2026-12-21': { minutes: 60, swipeLast: true, note: 'Mo 60 min, letzte Übung weggewischt' },
  '2026-12-22': { minutes: 60 },
  '2026-12-23': { addToday: true, minutes: 45, note: 'Mi spontan 45 min (Limit?)' },
};
const weekAvail: Record<string, Record<string, 'yes' | 'no' | 'maybe'>> = {
  '2026-12-04': { '2026-12-05': 'no', '2026-12-06': 'no' },
  '2026-12-07': { '2026-12-07': 'no', '2026-12-08': 'no', '2026-12-09': 'maybe', '2026-12-10': 'no', '2026-12-11': 'no', '2026-12-12': 'yes', '2026-12-13': 'no' },
  '2026-12-14': { '2026-12-14': 'no', '2026-12-15': 'yes', '2026-12-16': 'no', '2026-12-17': 'no', '2026-12-18': 'yes', '2026-12-19': 'yes', '2026-12-20': 'yes' },
  '2026-12-21': { '2026-12-21': 'yes', '2026-12-22': 'yes', '2026-12-23': 'no', '2026-12-24': 'no', '2026-12-25': 'no', '2026-12-26': 'no', '2026-12-27': 'yes' },
};

// ───── Protokoll ─────
const log: string[] = [];
const issues: string[] = [];
const sessionsDone: { date: string; label: string; sets: number; est: number; real: number; minutes: number; home: boolean }[] = [];
let liveOffers = 0,
  liveAccepted = 0,
  incOffers = 0,
  incDeclined = 0,
  decOffers = 0,
  warmupAdj = 0;
const tiredTrained: string[] = [];

function snap(ex: Exercise, w: number) {
  return snapWeight(w, ex, d.settings);
}

function train(day: string, p: PlannedSession, opts: Day) {
  const t0 = at(day, 17);
  const form = (opts.checkIn === 'bad' ? 0.95 : 1) * (1 + (rnd() - 0.5) * 0.06); // Tagesform ±3 %, schlechte Nacht −5 %
  const ses: Session = { id: uid(), date: day, startedAt: t0, status: 'active', title: p.label, split: p.templateId, plannedMinutes: p.minutes, estMinutes: p.estMinutes, plannedSets: p.exercises.reduce((a, e) => a + e.sets, 0), location: p.home ? 'home' : undefined, exercises: [] };
  ses.exercises = p.exercises.map((pe) => ({
    uid: uid(), exerciseId: pe.exerciseId, repMin: pe.repMin, repMax: pe.repMax, targetRir: pe.targetRir, restSec: pe.restSec, recWeight: pe.recWeight, skipped: false, note: '', adviceType: pe.advice.type, lastWeight: pe.advice.lastWeight,
    sets: Array.from({ length: pe.sets }, () => ({ id: uid(), weight: pe.recWeight, reps: pe.advice.repTarget, rir: pe.targetRir, failure: false, done: false, note: '' }) as SetLog),
  }));
  d.sessions.push(ses);
  // Erholungs-Check: wird ein laut eigenem Körper stark belasteter Muskel direkt trainiert?
  const st = computeAllStates(allEvents(d, t0), t0, d.checkIns);
  for (const se of ses.exercises) {
    const ex = exMap.get(se.exerciseId)!;
    const cat = recoveryInfo(st[ex.primary], t0).short;
    if (cat === 'frisch belastet') tiredTrained.push(`${lbl(day)} ${ex.name} (${MUSCLE[ex.primary].short}: ${cat})`);
  }
  let t = t0;
  let exIdx = 0;
  for (const se of ses.exercises) {
    const ex = exMap.get(se.exerciseId)!;
    const pe = p.exercises.find((x) => x.exerciseId === se.exerciseId)!;
    exIdx++;
    if (opts.trimTo != null && exIdx === 3) {
      // „Zeit übrig“: nach 2 Übungen nur noch X min
      const tr = planTrim(d, ses, opts.trimTo, t);
      log.push(`      ⏱ Zeit übrig ${opts.trimTo} min → ${tr.items.map((x) => `${exMap.get(x.exerciseId)!.name} ${x.open}→${x.keep}`).join(', ')} (~${tr.estMin} min)`);
      for (const x of ses.exercises) {
        const k = tr.items.find((i) => i.uid === x.uid);
        if (!k) continue;
        const open = x.sets.filter((y) => !y.done);
        const cut = open.length - k.keep;
        if (cut > 0) {
          const drop = new Set(open.slice(open.length - cut).map((y) => y.id));
          x.sets = x.sets.filter((y) => !drop.has(y.id));
          x.missed = cut;
          if (!x.sets.length) x.skipped = true;
        }
      }
    }
    if (opts.swipeLast && se === ses.exercises[ses.exercises.length - 1]) {
      se.missed = se.sets.length;
      se.sets = [];
      se.skipped = true;
      log.push(`      ↤ ${ex.name} weggewischt (wird nachgeholt)`);
    }
    if (se.skipped || !se.sets.length) continue;
    if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.TRACE === ex.id) console.log(`TRACE ${day} ${ex.name}: ${pe.advice.type} rec ${pe.recWeight} · ${pe.advice.text.slice(0, 160)} | form ${form.toFixed(3)}`);
    // Gewicht: Empfehlung übernehmen bzw. bei neuer Übung passend wählen
    const tr1 = truth.get(ex.id)!;
    const bw = ex.equipment === 'bodyweight';
    let w = se.recWeight ?? (bw ? 0 : snap(ex, tr1 / (1 + (pe.advice.repTarget + se.targetRir) / 30)));
    if (pe.advice.type === 'increase' && pe.advice.lastWeight != null) {
      incOffers++;
      if (rnd() < 0.15) {
        incDeclined++;
        w = pe.advice.lastWeight;
        se.decision = 'declined';
      } else se.decision = 'accepted';
    }
    if (pe.advice.type === 'decrease' && pe.advice.cautious) {
      decOffers++;
      if (rnd() < 0.3 && pe.advice.lastWeight) {
        w = pe.advice.lastWeight;
        se.decision = 'declined';
        se.declineReason = 'dayform';
      }
    }
    // Aufwärmen: deutlich schwächer → eine Stufe leichter (Vorschlag angenommen)
    if (form < 0.965 && !bw && w > 0) {
      w = snap(ex, w * 0.92) < w ? snap(ex, w * 0.92) : w;
      se.warmup = 'hard';
      warmupAdj++;
    }
    se.sets.forEach((x) => (x.weight = w));
    const fat = 1 - Math.min(0.15, 0.012 * bodyFatigue(ex.primary, t));
    for (let k = 0; k < se.sets.length; k++) {
      const st2 = se.sets[k];
      const wk = st2.weight ?? w;
      const cap = bw ? tr1 * fat * form * (1 - 0.07 * k) : 30 * ((tr1 * fat * form * (1 - 0.035 * k)) / Math.max(1, wk) - 1);
      const rir = Math.max(0, Math.round(se.targetRir + (rnd() - 0.5) * 1.6));
      const reps = Math.max(1, Math.floor(cap - rir));
      st2.reps = Math.min(reps, 40);
      st2.rir = Math.max(0, Math.min(5, Math.round(cap - st2.reps)));
      st2.done = true;
      const uniF = ex.unilateral || ex.pattern === 'bayesian' ? 2 : 1;
      t += (Math.max(ex.compound ? 45 : 35, st2.reps * 3) * uniF + se.restSec) * 1000; // ~3 s pro Wdh.
      st2.doneAt = t;
      // Live-Anpassung nach dem Satz
      const la = liveAdjust(se, ex, d.settings);
      if (la) {
        liveOffers++;
        if (rnd() < 0.8) {
          liveAccepted++;
          for (const y of se.sets) if (!y.done) y.weight = la.to;
        }
        se.liveDismissed = la.afterSetId;
      }
    }
    t += (ex.location === 'home' ? 0.5 : ex.compound ? 2 : 1) * 60_000;
    // Körper: Ermüdung + Kraftzuwachs (abnehmender Ertrag, schwächer bei hoher Vorermüdung)
    const hard = se.sets.filter((x) => x.done && (x.rir ?? 3) <= 3).length;
    for (const [m, c] of Object.entries(ex.muscles) as [MuscleId, number][]) if (c >= 0.5) bodyLoad.push({ t, m, sets: c * se.sets.filter((x) => x.done).length });
    const gain = 0.0045 * Math.min(hard, 4) / 4 * fat;
    truth.set(ex.id, tr1 * (1 + gain));
    for (const o of d.exercises) if (o.id !== ex.id && o.primary === ex.primary) truth.set(o.id, truth.get(o.id)! * (1 + gain * 0.4));
  }
  ses.status = 'done';
  ses.endedAt = t;
  const sets = ses.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const real = Math.round((t - t0) / 60_000) + 8;
  sessionsDone.push({ date: day, label: p.label, sets, est: p.estMinutes, real, minutes: p.minutes, home: !!p.home });
  log.push(`   🏋 ${lbl(day)} ${p.label} · ${sets} Sätze · Plan ~${p.estMinutes} min, real ~${real} min (verfügbar ${p.minutes})`);
  log.push(`      ${ses.exercises.filter((e) => e.sets.some((x) => x.done)).map((e) => `${exMap.get(e.exerciseId)!.name} ${fmtNum(e.sets[0].weight ?? 0)}kg×${e.sets.filter((x) => x.done).map((x) => x.reps).join('/')}`).join(' | ')}`);
  if (real > p.minutes + 10 && opts.trimTo == null) issues.push(`${lbl(day)}: Einheit dauerte ~${real} min, verfügbar ${p.minutes} min (Zeitschätzung zu optimistisch)`);
  // App-Nachbereitung wie in finishSession: wöchentliche Volumen-Anpassung
  d.volumeAdjust = computeVolumeAdjust(d, t).map;
}

// ───── Monat durchlaufen ─────
const weekStats: string[] = [];
let weekStart = '2026-11-23';
for (let day = START; day <= END; day = addDays(day, 1)) {
  if (weekAvail[day]) Object.assign(d.availability, weekAvail[day]);
  const o = S[day] ?? {};
  if (o.note) log.push(`\n${lbl(day)}: ${o.note}`);
  if (o.avail) d.availability[day] = o.avail;
  if (o.cancelToday) d.availability[day] = 'no';
  if (o.addToday) d.availability[day] = 'yes';
  if (o.away) d.awayDays = [...(d.awayDays ?? []), day];
  if (o.minutes) d.planOptions.dayMinutes = { ...(d.planOptions.dayMinutes ?? {}), [day]: o.minutes };
  if (o.checkIn) {
    const c = o.checkIn;
    d.checkIns[day] =
      c === 'good' ? { sleepHours: 8, sleepQuality: 4, energy: 4, stress: 2, soreness: {}, pain: [] }
      : c === 'bad' ? { sleepHours: 5.5, sleepQuality: 2, energy: 2, stress: 3, soreness: {}, pain: [] }
      : c === 'sore' ? { sleepHours: 7.5, sleepQuality: 3, energy: 3, stress: 2, soreness: { quads: 2, chest: 2, triceps: 1 }, pain: [] }
      : { sleepHours: 7, sleepQuality: 3, energy: 3, stress: 2, soreness: {}, pain: ['shoulder'] };
  }
  if (o.ski) d.activities.push({ id: uid(), date: day, type: 'ski', minutes: 240, intensity: 'hard' });
  // Morgens: Plan ansehen, abends trainieren, wenn heute geplant
  const plan = buildPlan(d, at(day, 8));
  const p = plan.sessions.find((s) => s.date === day && !s.rest);
  const rest = plan.restDays.find((r) => r.date === day);
  if (rest && d.availability[day] === 'yes') log.push(`   ☾ ${lbl(day)}: ${rest.reason.slice(0, 150)}`);
  if (o.addToday && !p && !rest) issues.push(`${lbl(day)}: spontan „Zeit“ markiert, aber keine Einheit geplant und kein Grund genannt`);
  if (o.addToday && !p && rest) log.push(`      spontaner Termin nicht eingeplant – Begründung: ${rest.reason.slice(0, 160)}`);
  if (p) {
    const p17 = buildPlan(d, at(day, 17)).sessions.find((s) => s.date === day && !s.rest) ?? p;
    if (o.checkIn === 'pain') {
      const bad = p17.exercises.filter((e) => painConflict(exMap.get(e.exerciseId)!, ['shoulder']).length);
      if (bad.length) issues.push(`${lbl(day)}: trotz Schulterbeschwerden geplant: ${bad.map((e) => e.exerciseId).join(', ')}`);
    }
    if (o.ski || d.activities.some((a) => a.date === addDays(day, -1) && a.type === 'ski')) {
      const legs = p17.decisions.filter((x) => ['quads', 'glutes', 'hamstrings'].includes(x.muscle) && x.sets >= 2);
      log.push(`      Ski-Check: Beinsätze heute ${legs.map((x) => `${MUSCLE[x.muscle].short} ${x.sets}`).join(', ') || 'keine'}`);
      if (legs.length) issues.push(`${lbl(day)}: Beine trotz Skifahren eingeplant`);
    }
    if (o.addToday) log.push(`      spontaner Termin → ${p17.label}; verschoben: ${plan.restDays.filter((r) => r.because === 'today').map((r) => lbl(r.date)).join(', ') || '—'}`);
    const DBG = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DBG;
    if (DBG === day) {
      console.log(`DEBUG ${day} ${p17.label} ${p17.estMinutes}/${p17.minutes}`);
      for (const x of p17.decisions) console.log('  ', x.muscle.padEnd(11), x.status.padEnd(8), x.sets, '|', x.reason);
      console.log('  Gründe:', p17.reasons.join(' / '));
    }
    train(day, p17, o);
  }
  // Wochenbilanz am Sonntag
  if (weekdayOf(day) === 0) {
    const from = addDays(day, -6);
    const done = d.sessions.filter((s) => s.status === 'done' && s.date >= from && s.date <= day);
    const spw = buildPlan(d, at(day, 20)).spw;
    const sets: Partial<Record<MuscleId, number>> = {};
    for (const s of done) for (const se of s.exercises) for (const [m, c] of Object.entries(exMap.get(se.exerciseId)!.muscles) as [MuscleId, number][]) sets[m] = (sets[m] ?? 0) + c * se.sets.filter((x) => x.done).length;
    const prio = MUSCLES.filter((m) => !m.indirectOnly);
    weekStats.push(
      `KW ${lbl(from)}–${lbl(day)}: ${done.length} Einheiten (${done.map((s) => lbl(s.date)).join(', ') || '—'})\n     ` +
        prio.map((m) => `${m.short} ${fmtNum(sets[m.id] ?? 0)}/${fmtNum(personalTarget(d, m.id, spw))}`).join(' · '),
    );
    weekStart = addDays(day, 1);
  }
}
void weekStart;

// ───── Regeln über den ganzen Monat ─────
const trainedDates = [...new Set(d.sessions.filter((s) => s.status === 'done').map((s) => s.date))].sort();
for (const x of trainedDates) {
  const n = trainedDates.filter((y) => y >= x && y <= addDays(x, 6)).length;
  if (n > d.settings.maxSessionsPerWeek) issues.push(`Wochenlimit verletzt: ${n} Einheiten ab ${lbl(x)}`);
  let run = 1;
  for (let k = 1; trainedDates.includes(addDays(x, k)); k++) run++;
  if (run > d.settings.maxConsecutive) issues.push(`${run} Trainingstage am Stück ab ${lbl(x)}`);
}
// Progression: wurde bei erreichtem oberen Ende gesteigert?
const progLines: string[] = [];
const stuck: string[] = [];
for (const ex of d.exercises) {
  const exps = d.sessions
    .filter((s) => s.status === 'done')
    .flatMap((s) => s.exercises.filter((e) => e.exerciseId === ex.id && e.sets.some((x) => x.done)).map((e) => ({ date: s.date, e })));
  if (exps.length < 2) continue;
  const path = exps.map((x) => {
    const done = x.e.sets.filter((y) => y.done);
    return `${fmtNum(done[0].weight ?? 0)}×${done.map((y) => y.reps).join('/')}`;
  });
  const appE1 = (x: (typeof exps)[number]) => Math.max(...x.e.sets.filter((y) => y.done).map((y) => e1rm(y.weight ?? 0, y.reps ?? 0, y.rir)));
  progLines.push(`   ${ex.name.padEnd(34)} ${exps.length}× · e1RM ${fmtNum(appE1(exps[0]), 1)} → ${fmtNum(appE1(exps[exps.length - 1]), 1)} kg · wahr ${fmtNum(truthStart.get(ex.id)!, 1)} → ${fmtNum(truth.get(ex.id)!, 1)}\n      ${path.join(' → ')}`);
  for (let i = 0; i + 1 < exps.length; i++) {
    const a = exps[i].e;
    const b = exps[i + 1].e;
    const done = a.sets.filter((y) => y.done);
    const wA = done[0].weight ?? 0;
    const wB = b.sets.find((y) => y.done)?.weight ?? 0;
    if (done.every((y) => (y.reps ?? 0) >= a.repMax) && wB <= wA && b.decision !== 'declined' && b.warmup !== 'hard') stuck.push(`${ex.name}: ${lbl(exps[i].date)} alle Sätze ≥ ${a.repMax}, danach nicht gesteigert (${fmtNum(wA)} → ${fmtNum(wB)} kg)`);
  }
}

// ───── Ausgabe ─────
console.log('════ ABLAUF ════');
console.log(log.join('\n'));
console.log('\n════ WOCHEN (Sätze je Muskel / Wochenziel) ════');
console.log(weekStats.join('\n'));
console.log('\n════ ÜBUNGEN (Verlauf & Kraft) ════');
console.log(progLines.join('\n'));
console.log('\n════ KENNZAHLEN ════');
console.log(`Einheiten: ${sessionsDone.length} (${sessionsDone.filter((x) => x.home).length} ohne Gym) · Sätze gesamt ${sessionsDone.reduce((a, x) => a + x.sets, 0)}`);
console.log(`Zeit: Ø Abweichung real − Plan ${fmtNum(sessionsDone.reduce((a, x) => a + (x.real - x.est), 0) / sessionsDone.length, 1)} min`);
console.log(`Steigerungen angeboten ${incOffers}, abgelehnt ${incDeclined} · vorsichtige Reduktionen ${decOffers} · Live-Hinweise ${liveOffers} (angenommen ${liveAccepted}) · Aufwärm-Anpassungen ${warmupAdj}`);
console.log(`Trainiert trotz „frisch belastet“: ${tiredTrained.length}${tiredTrained.length ? ' – ' + tiredTrained.slice(0, 6).join('; ') : ''}`);
console.log(`Nicht gesteigert trotz oberem Ende: ${stuck.length}${stuck.length ? '\n   ' + stuck.join('\n   ') : ''}`);
console.log(`\n════ AUFFÄLLIGKEITEN (${issues.length}) ════\n${issues.length ? issues.map((x) => ' • ' + x).join('\n') : ' keine'}`);
