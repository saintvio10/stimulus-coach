// Prüfung der Befunde aus dem Testbericht vom 27.11.2026 (Bundle index-BNYeDsJG.js) gegen den aktuellen Code.
// Grundlage: deine Einstellungen + dein Training vom 26.11. (fixtures/export.json), danach simulierte Eingaben.
// Aufruf: TZ=Europe/Berlin npx tsx scripts/report-1127.ts   (ASSERT=1 → Exit-Code ≠ 0 bei Fehlern)
// @ts-expect-error – Node-Typen sind im Projekt nicht installiert
import { existsSync, readFileSync } from 'node:fs';
import { parseExport } from '../src/lib/merge';
import { migrate } from '../src/lib/store';
import { buildPlan, personalTarget, type PlannedSession } from '../src/engine/planner';
import { planTrim } from '../src/engine/trim';
import { computeVolumeAdjust } from '../src/engine/adapt';
import { MUSCLE } from '../src/lib/muscles';
import type { AppData, MuscleId, Session, SetLog } from '../src/lib/types';
import { addDays, uid } from '../src/lib/utils';

const FILE = 'fixtures/export.json';
const env = (globalThis as { process?: { env: Record<string, string | undefined>; exit: (n: number) => void } }).process;
if (!existsSync(FILE)) {
  console.log('fixtures/export.json fehlt – Test NICHT ausgeführt.');
} else {
  const load = (): AppData => migrate(parseExport(readFileSync(FILE, 'utf8')));
  const at = (day: string, h: number) => Date.parse(`${day}T${String(h).padStart(2, '0')}:00:00+01:00`);
  let checks = 0;
  const fails: string[] = [];
  const ok = (c: boolean, m: string) => {
    checks++;
    if (!c) fails.push(m);
    console.log(`   ${c ? '✓' : '✗'} ${m}`);
  };
  const name = (d: AppData, id: string) => d.exercises.find((e) => e.id === id)?.name ?? id;
  const prim = (d: AppData, id: string) => d.exercises.find((e) => e.id === id)!.primary;
  /** alle Tage ab `from` für `n` Tage auf „nein“, dann gezielt setzen */
  const avail = (d: AppData, from: string, n: number, set: Record<string, 'yes' | 'maybe'>) => {
    d.availability = {};
    for (let i = 0; i < n; i++) d.availability[addDays(from, i)] = 'no';
    Object.assign(d.availability, set);
  };
  /** geplante Einheit als absolviert eintragen (Empfehlung übernommen, Zielwiederholungen erreicht) */
  const complete = (d: AppData, p: PlannedSession, h = 17) => {
    const t0 = at(p.date, h);
    const ses: Session = {
      id: uid(), date: p.date, startedAt: t0, endedAt: t0 + p.estMinutes * 60_000, status: 'done', title: p.label, split: p.templateId,
      plannedMinutes: p.minutes, estMinutes: p.estMinutes, plannedSets: p.exercises.reduce((a, e) => a + e.sets, 0),
      exercises: p.exercises.map((pe) => ({
        uid: uid(), exerciseId: pe.exerciseId, repMin: pe.repMin, repMax: pe.repMax, targetRir: pe.targetRir, restSec: pe.restSec, recWeight: pe.recWeight, skipped: false, note: '',
        sets: Array.from({ length: pe.sets }, (_, k) => ({ id: uid(), weight: pe.recWeight, reps: Math.max(pe.repMin, pe.advice.repTarget - k), rir: pe.targetRir, failure: false, done: true, doneAt: t0 + k * 60_000, note: '' }) as SetLog),
      })),
    };
    d.sessions.push(ses);
    return ses;
  };
  const setsOf = (d: AppData, p: PlannedSession, groups: MuscleId[]) =>
    p.exercises.filter((e) => groups.includes(prim(d, e.exerciseId))).reduce((a, e) => a + e.sets, 0);

  // ════════ 1) Wochenziel sinkt durch absolvierte Einheiten ════════
  console.log('\n═══ 1) Wochenziel bei 3 festen Terminen 04./05./06.12. ═══');
  for (const variant of ['fest', 'mit Vielleicht 08./09.12.'] as const) {
    const d = load();
    avail(d, '2026-11-27', 20, { '2026-12-04': 'yes', '2026-12-05': 'yes', '2026-12-06': 'yes', ...(variant !== 'fest' ? { '2026-12-08': 'maybe' as const, '2026-12-09': 'maybe' as const } : {}) });
    const targets: number[] = [];
    for (const day of ['2026-12-04', '2026-12-05', '2026-12-06']) {
      const p = buildPlan(d, at(day, 8));
      const t = personalTarget(d, 'biceps', p.spw);
      targets.push(t);
      console.log(`   ${variant} · vor ${day}: spw ${p.spw}, Bizeps-Ziel ${t} · ${p.goalNote.slice(0, 110)}…`);
      const s = p.sessions.find((x) => x.date === day);
      if (s) complete(d, s);
    }
    ok(targets[1] === targets[0] && targets[2] === targets[0], `${variant}: Ziel bleibt nach absolvierten Einheiten gleich (${targets.join(' → ')})`);
  }
  {
    // Echte Änderung der Verfügbarkeit: 06.12. abgesagt → begründete Anpassung erlaubt
    const d = load();
    avail(d, '2026-11-27', 20, { '2026-12-04': 'yes', '2026-12-05': 'yes', '2026-12-06': 'yes' });
    const p1 = buildPlan(d, at('2026-12-04', 8));
    complete(d, p1.sessions[0]);
    d.availability['2026-12-06'] = 'no';
    d.availability['2026-12-05'] = 'no';
    const p2 = buildPlan(d, at('2026-12-05', 8));
    console.log(`   Absage 05.+06.12.: spw ${p1.spw} → ${p2.spw} · ${p2.goalNote.slice(0, 120)}`);
    ok(p2.spw < p1.spw, 'Absage der übrigen Termine darf das Ziel senken (mit Begründung)');
  }
  {
    // „Vielleicht“ zählt nicht wie sicher
    const d = load();
    avail(d, '2026-11-27', 20, { '2026-12-04': 'yes', '2026-12-06': 'maybe', '2026-12-08': 'maybe' });
    const pm = buildPlan(d, at('2026-12-04', 8));
    const d2 = load();
    avail(d2, '2026-11-27', 20, { '2026-12-04': 'yes', '2026-12-06': 'yes', '2026-12-08': 'yes' });
    const ps = buildPlan(d2, at('2026-12-04', 8));
    console.log(`   1 fest + 2 vielleicht: spw ${pm.spw} (Bizeps-Ziel ${personalTarget(d, "biceps", pm.spw)}) · 3 fest: spw ${ps.spw}`);
    ok(pm.spw < ps.spw, `Vielleicht-Termine erhöhen das Ziel nicht wie feste (${pm.spw} vs. ${ps.spw})`);
  }

  // ════════ 2) Ein einziger Termin → Abdeckung ════════
  console.log('\n═══ 2) Ein sicherer Termin heute, danach 6 Tage keine Zeit (keine Vortrainings) ═══');
  for (const withMaybe of [false, true])
    for (const min of [30, 45, 60, 90, 120]) {
      const d = load();
      d.sessions = [];
      avail(d, '2026-11-27', 14, { '2026-11-27': 'yes', ...(withMaybe ? { '2026-11-30': 'maybe' as const, '2026-12-02': 'maybe' as const } : {}) });
      d.planOptions.dayMinutes = {};
      d.planOptions.todayMinutes = { date: '2026-11-27', minutes: min };
      const p = buildPlan(d, at('2026-11-27', 9));
      const s = p.sessions.find((x) => x.date === '2026-11-27')!;
      const g = (ms: MuscleId[]) => setsOf(d, s, ms);
      const sets = s.exercises.reduce((a, e) => a + e.sets, 0);
      console.log(`   ${min} min${withMaybe ? ' + Vielleicht' : ''}: ${s.label} · ${sets} Sätze · ~${s.estMinutes} min`);
      console.log(`      ${s.exercises.map((e) => `${name(d, e.exerciseId)}×${e.sets}`).join(' | ')}`);
      const cov = { Drücken: g(['chest', 'triceps']), Ziehen: g(['lats', 'upperBack']), Quadrizeps: g(['quads', 'glutes']), Beinbeuger: g(['hamstrings']) };
      console.log(`      Abdeckung: ${Object.entries(cov).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      if (s.coverageNote) console.log(`      Hinweis: ${s.coverageNote}`);
      ok(s.estMinutes <= min + 3, `${min} min${withMaybe ? ' + V.' : ''}: Zeitbudget eingehalten (${s.estMinutes})`);
      if (!withMaybe && min >= 45) ok(cov.Drücken > 0 && cov.Ziehen > 0 && cov.Quadrizeps > 0 && cov.Beinbeuger > 0, `${min} min: Drücken, Ziehen, Quadrizeps, Beinbeuger abgedeckt`);
      if (!withMaybe && min === 30) ok((cov.Quadrizeps > 0 && cov.Beinbeuger > 0) || !!s.coverageNote, `30 min: Beine abgedeckt oder Abstrich angezeigt`);
    }

  // ════════ 3) Gewichtskorrektur Seitheben → keine Fehldiagnose ════════
  console.log('\n═══ 3) Seitheben: 10×9, 10×8, 12,5×5 (26.11.) → danach 7,5 kg mit steigenden Wdh. ═══');
  {
    const d = load();
    const base = d.sessions.find((s) => s.date === '2026-11-26')!;
    const lat = base.exercises.find((e) => e.exerciseId === 'cable-lateral')!;
    console.log(`   Start: ${lat.sets.filter((x) => x.done).map((x) => `${x.weight}×${x.reps}`).join(', ')} (Bereich ${lat.repMin}–${lat.repMax})`);
    const days = ['2026-11-30', '2026-12-03', '2026-12-07', '2026-12-10', '2026-12-14', '2026-12-17'];
    const reps = [[12, 11, 10], [13, 12, 10], [14, 12, 11], [14, 13, 12], [15, 13, 12], [15, 14, 13]];
    days.forEach((day, i) => {
      const t0 = at(day, 17);
      d.sessions.push({
        id: uid(), date: day, startedAt: t0, endedAt: t0 + 3_600_000, status: 'done', title: 'Test', split: 'upper', plannedMinutes: 60,
        exercises: [{ uid: uid(), exerciseId: 'cable-lateral', repMin: lat.repMin, repMax: lat.repMax, targetRir: 1, restSec: 90, recWeight: 7.5, skipped: false, note: '',
          sets: reps[i].map((r, k) => ({ id: uid(), weight: 7.5, reps: r, rir: 1, failure: false, done: true, doneAt: t0 + k * 120_000, note: '' }) as SetLog) }],
      });
    });
    const res = computeVolumeAdjust(d, at('2026-12-18', 9));
    const sd = res.map.sideDelts!;
    console.log(`   Anpassung Seitl. Schulter: Faktor ${sd.factor}, Trend ${sd.trend} % · ${sd.reason}`);
    ok(sd.factor >= 1, 'Gewichtskorrektur erzeugt keine Volumenreduktion');
    // Gegenprobe: echter Leistungsabfall bei gleichem Gewicht wird weiter erkannt
    const d2 = load();
    const days2 = ['2026-11-30', '2026-12-03', '2026-12-07', '2026-12-10', '2026-12-14', '2026-12-17'];
    const reps2 = [[12, 11, 10], [11, 10, 9], [11, 9, 8], [10, 9, 8], [9, 8, 7], [9, 7, 6]];
    days2.forEach((day, i) => {
      const t0 = at(day, 17);
      d2.sessions.push({
        id: uid(), date: day, startedAt: t0, endedAt: t0 + 3_600_000, status: 'done', title: 'Test', split: 'upper', plannedMinutes: 60,
        exercises: [{ uid: uid(), exerciseId: 'cable-lateral', repMin: lat.repMin, repMax: lat.repMax, targetRir: 1, restSec: 90, recWeight: 7.5, skipped: false, note: '',
          sets: reps2[i].map((r, k) => ({ id: uid(), weight: 7.5, reps: r, rir: 1, failure: false, done: true, doneAt: t0 + k * 120_000, note: '' }) as SetLog) }],
      });
    });
    const sd2 = computeVolumeAdjust(d2, at('2026-12-18', 9)).map.sideDelts!;
    console.log(`   Gegenprobe echter Abfall bei 7,5 kg: Faktor ${sd2.factor}, Trend ${sd2.trend} % · ${sd2.reason}`);
    ok(sd2.factor < 1, 'Echter Leistungsabfall bei gleichem Gewicht senkt weiterhin das Volumen');
  }

  // ════════ 4) Kürzen: Beinabdeckung ════════
  console.log('\n═══ 4) Kürzen auf 15 min nach 8 Bizepssätzen, Beine seit >7 Tagen nicht trainiert ═══');
  {
    const d = load();
    const day = '2026-12-06';
    avail(d, '2026-11-27', 20, { [day]: 'yes', '2026-12-11': 'yes' });
    const t0 = at(day, 17);
    const mk = (id: string, n: number, done: number, w: number, r: number) => ({
      uid: uid(), exerciseId: id, repMin: 8, repMax: 12, targetRir: 1, restSec: 120, recWeight: w, skipped: false, note: '',
      sets: Array.from({ length: n }, (_, k) => ({ id: uid(), weight: w, reps: r, rir: 1, failure: false, done: k < done, doneAt: k < done ? t0 + k * 120_000 : undefined, note: '' }) as SetLog),
    });
    const ses: Session = {
      id: uid(), date: day, startedAt: t0, status: 'active', title: 'Ganzkörper', split: 'full', plannedMinutes: 60,
      exercises: [mk('preacher-curl', 4, 4, 25, 10), mk('hammer-curl', 4, 4, 16, 10), mk('butterfly', 3, 0, 55, 10), mk('leg-press', 3, 0, 145, 10), mk('seated-leg-curl', 3, 0, 35, 10), mk('calf-raise', 3, 0, 75, 12)],
    };
    d.sessions.push(ses);
    const tr = planTrim(d, ses, 15, t0 + 20 * 60_000);
    for (const it of tr.items) console.log(`   ${it.name}: ${it.open} offen → ${it.keep}${it.note ? ' · ' + it.note : ''}`);
    if (tr.warnings?.length) for (const w of tr.warnings) console.log(`   ⚠ ${w}`);
    const keep = (id: string) => tr.items.find((x) => x.exerciseId === id)?.keep ?? 0;
    ok(tr.estMin <= 15, `Restzeit eingehalten (~${tr.estMin} min)`);
    ok(keep('leg-press') + keep('seated-leg-curl') > 0, 'Mindestens eine Beinübung (Quadrizeps/Beinbeuger) bleibt erhalten');
    ok(ses.exercises.slice(0, 2).every((e) => e.sets.filter((x) => x.done).length === 4), 'Erledigte Sätze bleiben erhalten');
    // Gegenprobe: Beine gestern trainiert + morgen sicher geplant → Kürzen der Beine erlaubt
    const d2 = load();
    avail(d2, '2026-11-27', 20, { [day]: 'yes', '2026-12-07': 'yes' });
    const y = at('2026-12-05', 17);
    d2.sessions.push({ id: uid(), date: '2026-12-05', startedAt: y, endedAt: y + 3_600_000, status: 'done', title: 'Beine', split: 'legs', plannedMinutes: 60, exercises: [mk('leg-press', 4, 4, 145, 10), mk('seated-leg-curl', 3, 3, 35, 10)].map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, doneAt: y })) })) });
    const ses2 = { ...ses, id: uid(), exercises: ses.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) })) };
    d2.sessions.push(ses2);
    const tr2 = planTrim(d2, ses2, 15, t0 + 20 * 60_000);
    const keep2 = (id: string) => tr2.items.find((x) => x.exerciseId === id)?.keep ?? 0;
    console.log(`   Gegenprobe (Beine gestern): ${tr2.items.map((x) => `${x.name} ${x.keep}`).join(', ')}`);
    ok(keep2('leg-press') + keep2('seated-leg-curl') <= keep('leg-press') + keep('seated-leg-curl'), 'Frisch trainierte Beine werden nicht bevorzugt behalten');
    ok(!tr2.warnings.some((w) => w.startsWith('Quadrizeps') || w.startsWith('Beinbeuger')), 'Keine Lückenwarnung für frisch trainierte Beine');
    ok(tr.warnings.some((w) => w.startsWith('Beinbeuger')), 'Vorschau nennt die Gruppe, die sonst komplett ausfällt (Beinbeuger)');
    // Wie im Bericht: Brust/Rücken in der Woche schon versorgt, Beine nicht → Beine statt 3× Butterfly
    const d3 = load();
    avail(d3, '2026-11-27', 20, { [day]: 'yes', '2026-12-11': 'yes' });
    const y3 = at('2026-12-03', 17);
    d3.sessions.push({ id: uid(), date: '2026-12-03', startedAt: y3, endedAt: y3 + 3_600_000, status: 'done', title: 'Oberkörper', split: 'upper', plannedMinutes: 60, exercises: [mk('incline-press', 3, 3, 60, 9), mk('butterfly', 3, 3, 55, 10), mk('lat-pulldown', 3, 3, 60, 9), mk('cable-row', 3, 3, 55, 9)].map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, doneAt: y3 })) })) });
    const ses3 = { ...ses, id: uid(), exercises: ses.exercises.map((e) => ({ ...e, uid: uid(), sets: e.sets.map((x) => ({ ...x })) })) };
    d3.sessions.push(ses3);
    const tr3 = planTrim(d3, ses3, 15, t0 + 20 * 60_000);
    const keep3 = (id: string) => tr3.items.find((x) => x.exerciseId === id)?.keep ?? 0;
    console.log(`   Brust/Rücken am 03.12. versorgt: ${tr3.items.map((x) => `${x.name} ${x.keep}`).join(', ')} (~${tr3.estMin} min)`);
    for (const w of tr3.warnings) console.log(`   ⚠ ${w}`);
    ok(keep3('leg-press') >= 2 || keep3('seated-leg-curl') >= 2, 'Bericht-Fall: eine Beinübung mit ≥ 2 Sätzen bleibt');
    ok(keep3('butterfly') < 3, 'Bericht-Fall: Butterfly (Brust schon versorgt) wird gekürzt statt der Beine');
    ok(tr3.estMin <= 15, `Bericht-Fall: Restzeit eingehalten (~${tr3.estMin} min)`);
    // Großzügige Restzeit: nichts wird künstlich gestrichen
    const tr4 = planTrim(d, ses, 60, t0 + 20 * 60_000);
    ok(tr4.dropped === 0 && tr4.warnings.length === tr4.warnings.filter((w) => w.startsWith('Ziehen')).length, 'Bei 60 min Restzeit bleibt alles (nur Hinweis auf fehlendes Ziehen)');
  }

  // ════════ 3b) weitere Fälle zur Trendberechnung ════════
  console.log('\n═══ 3b) Unsichere Datenlage und einzelner alter Spitzenwert ═══');
  {
    const mkS = (day: string, w: number, reps: number[], extra: Partial<Session['exercises'][number]> = {}): Session => {
      const t0 = at(day, 17);
      return {
        id: uid(), date: day, startedAt: t0, endedAt: t0 + 3_600_000, status: 'done', title: 'Test', split: 'upper', plannedMinutes: 60,
        exercises: [{ uid: uid(), exerciseId: 'cable-lateral', repMin: 12, repMax: 20, targetRir: 1, restSec: 90, recWeight: w, skipped: false, note: '', ...extra,
          sets: reps.map((r, k) => ({ id: uid(), weight: w, reps: r, rir: 1, failure: false, done: true, doneAt: t0 + k * 120_000, note: '' }) as SetLog) }],
      };
    };
    // a) Korrektur erst vor kurzem: nur 2 vergleichbare Einheiten → keine automatische Änderung
    const d = load();
    d.sessions.push(mkS('2026-11-30', 10, [9, 8, 7]), mkS('2026-12-03', 10, [9, 8, 7]), mkS('2026-12-07', 10, [9, 8, 6]), mkS('2026-12-14', 7.5, [12, 11, 10]), mkS('2026-12-17', 7.5, [13, 12, 10]));
    const a = computeVolumeAdjust(d, at('2026-12-18', 9)).map.sideDelts!;
    console.log(`   a) Korrektur vor 4 Tagen: Faktor ${a.factor} · ${a.reason}`);
    ok(a.factor >= 1 && !/Leistung −|Leistung -/.test(a.reason), 'Frische Gewichtskorrektur: kein Leistungsabfall, erst vergleichbare Daten sammeln');
    // b) gleiches Gewicht, ein alter Ausreißer-Spitzensatz (12,5 × 5) → kein Abfall durch diesen einen Wert
    const d2 = load();
    d2.sessions.push(mkS('2026-12-01', 10, [9, 9, 8]), mkS('2026-12-05', 10, [10, 9, 8]), mkS('2026-12-10', 10, [10, 9, 9]), mkS('2026-12-15', 10, [11, 10, 9]));
    const b = computeVolumeAdjust(d2, at('2026-12-18', 9)).map.sideDelts!;
    console.log(`   b) 10 kg konstant, alter 12,5×5-Satz: Faktor ${b.factor}, Trend ${b.trend} % · ${b.reason}`);
    ok(b.factor >= 1 && (b.trend ?? 0) > 0, 'Einzelner alter Spitzensatz verzerrt den Trend nicht');
    // c) schwache Tage (schweres Aufwärmen) zählen nicht als Abfall
    const d3 = load();
    d3.sessions.push(mkS('2026-11-30', 7.5, [12, 11, 10]), mkS('2026-12-04', 7.5, [13, 12, 11]), mkS('2026-12-09', 7.5, [13, 12, 11]), mkS('2026-12-14', 7.5, [9, 8, 7], { warmup: 'hard' }), mkS('2026-12-17', 7.5, [14, 13, 12]));
    const c = computeVolumeAdjust(d3, at('2026-12-18', 9)).map.sideDelts!;
    console.log(`   c) mit schwachem Tag: Faktor ${c.factor}, Trend ${c.trend} %`);
    ok(c.factor >= 1, 'Schwacher Tag (Aufwärmen schwer) löst keine Ermüdungsdiagnose aus');
  }

  // ════════ 2b) Grundabdeckung respektiert Sperren/Beschwerden ════════
  console.log('\n═══ 2b) Grundabdeckung mit gesperrter Übung und Knieschmerz ═══');
  {
    const d = load();
    d.sessions = [];
    avail(d, '2026-11-27', 14, { '2026-11-27': 'yes' });
    d.planOptions.dayMinutes = {};
    d.planOptions.todayMinutes = { date: '2026-11-27', minutes: 60 };
    d.exercises.find((e) => e.id === 'seated-leg-curl')!.locked = true;
    const p = buildPlan(d, at('2026-11-27', 9));
    const s = p.sessions[0];
    console.log(`   Beinbeuger gesperrt: ${s.exercises.map((e) => `${name(d, e.exerciseId)}×${e.sets}`).join(' | ')}`);
    console.log(`   Hinweis: ${s.coverageNote}`);
    ok(!s.exercises.some((e) => e.exerciseId === 'seated-leg-curl' || e.exerciseId === 'rdl'), 'Gesperrte Übungen werden für die Grundabdeckung nicht erzwungen');
    ok(!!s.coverageNote && s.coverageNote.includes('Beinbeuger'), 'Fehlender Beinbeuger wird mit Grund angezeigt');
    d.checkIns['2026-11-27'] = { sleepHours: 8, sleepQuality: 4, energy: 4, stress: 2, soreness: {}, pain: ['knee'] };
    const p2 = buildPlan(d, at('2026-11-27', 9));
    console.log(`   + Knieschmerz: ${p2.sessions[0].exercises.map((e) => `${name(d, e.exerciseId)}×${e.sets}`).join(' | ')}`);
    ok(!p2.sessions[0].exercises.some((e) => ['leg-press', 'leg-extension'].includes(e.exerciseId)), 'Knieschmerz: keine kniebelastende Übung trotz Grundabdeckung');
    ok(p2.sessions[0].estMinutes <= 63, 'Zeitbudget bleibt eingehalten');
  }

  console.log(`\n${checks - fails.length}/${checks} Prüfungen bestanden`);
  for (const f of fails) console.log('   ✗ ' + f);
  if (env?.env.ASSERT && fails.length) env.exit(1);
}
void MUSCLE;
