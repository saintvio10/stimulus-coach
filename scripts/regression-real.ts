// Prüfungen mit deinem echten Export (fixtures/export.json) – alle Fälle aus deiner Anfrage.
// @ts-expect-error – Node-Typen sind im Projekt nicht installiert
import { existsSync, readFileSync } from 'node:fs';
import { parseExport } from '../src/lib/merge';
import { migrate } from '../src/lib/store';
import { buildPlan, planToday } from '../src/engine/planner';
import { planTrim } from '../src/engine/trim';
import { liveAdjust } from '../src/engine/liveAdjust';
import { painConflict } from '../src/engine/joints';
import { adviseExercise } from '../src/engine/progression';
import type { AppData, Session } from '../src/lib/types';
import { addDays, uid } from '../src/lib/utils';

const file = 'fixtures/export.json';
if (!existsSync(file)) {
  console.log('fixtures/export.json fehlt – Test NICHT ausgeführt.');
} else {
  const load = (): AppData => migrate(parseExport(readFileSync(file, 'utf8')));
  let fails = 0,
    checks = 0;
  const ok = (c: boolean, m: string) => {
    checks++;
    if (!c) {
      fails++;
      console.log('   ✗ ' + m);
    }
  };
  const T = '2026-11-27';
  const at = (h: number, day = T) => Date.parse(`${day}T${String(h).padStart(2, '0')}:00:00+01:00`);
  const exOf = (d: AppData, id: string) => d.exercises.find((e) => e.id === id)!;
  const show = (label: string, d: AppData, now: number) => {
    const p = buildPlan(d, now);
    console.log(`\n── ${label}`);
    for (const s of p.sessions) {
      console.log(`   ${s.date} ${s.label} · ${s.estMinutes}/${s.minutes} min · ${s.exercises.reduce((a, e) => a + e.sets, 0)} Sätze`);
      console.log(`      ${s.exercises.map((e) => `${exOf(d, e.exerciseId).name}×${e.sets}`).join(' | ')}`);
    }
    for (const r of p.restDays) console.log(`   ${r.date} ${r.reason.slice(0, 120)}`);
    // Regeln
    const done = [...new Set(d.sessions.filter((s) => s.status === 'done').map((s) => s.date))];
    const all = [...new Set([...done, ...p.sessions.map((s) => s.date)])].sort();
    for (const s of p.sessions) {
      for (let k = 0; k < 7; k++) {
        const from = addDays(s.date, -k);
        ok(all.filter((x) => x >= from && x <= addDays(from, 6)).length <= d.settings.maxSessionsPerWeek, `${label}: Wochenlimit ab ${from}`);
      }
      ok(s.estMinutes <= s.minutes + 3, `${label}: ${s.date} zu lang`);
      for (const e of s.exercises) {
        ok(e.repMax === (e.advice.repMax ?? e.repMax), `${label}: ${e.exerciseId} Bereich ≠ Regel`);
        ok(!e.advice.increaseRule || e.advice.increaseRule.includes(`${e.repMax} Wdh.`), `${label}: ${e.exerciseId} Erhöhungsregel ≠ Zielbereich (${e.advice.increaseRule})`);
      }
    }
    return p;
  };

  // 1) Ist-Zustand, mit und ohne Check-in
  {
    const d = load();
    const p0 = show('Export, heute 9 Uhr, ohne Check-in', d, at(9));
    d.checkIns[T] = { sleepHours: 8, sleepQuality: 4, energy: 4, stress: 2, soreness: {}, pain: [] };
    const p1 = show('… mit Check-in (gut geschlafen, kein Muskelkater)', d, at(9));
    const sets0 = p0.sessions[0].exercises.reduce((a, e) => a + e.sets, 0);
    const sets1 = p1.sessions[0].exercises.reduce((a, e) => a + e.sets, 0);
    ok(sets1 >= sets0, 'Mit gutem Check-in nicht mindestens so viel Volumen wie ohne');
    ok(p0.sessions[0].reasons.some((r) => r.includes('Ohne Check-in')) || sets0 === sets1, 'Ohne Check-in: Vorsicht nicht erklärt');
    console.log(`   Sätze heute: ohne Check-in ${sets0}, mit Check-in ${sets1}`);
    // Muskelkater Trizeps + Beschwerden Schulter
    d.checkIns[T] = { sleepHours: 6, sleepQuality: 2, energy: 2, stress: 4, soreness: { triceps: 3, chest: 2 }, pain: ['shoulder'] };
    const p2 = show('… Check-in: Muskelkater Trizeps (stark) & Brust, Beschwerden Schulter, schlecht geschlafen', d, at(9));
    const today = p2.sessions[0];
    ok(!today.exercises.some((e) => painConflict(exOf(d, e.exerciseId), ['shoulder']).length), 'Schulter-belastende Übung trotz Beschwerden geplant');
    ok((today.decisions.find((x) => x.muscle === 'triceps')?.sets ?? 0) < (p1.sessions[0].decisions.find((x) => x.muscle === 'triceps')?.sets ?? 0), 'Starker Trizeps-Muskelkater reduziert Trizeps-Volumen nicht');
    ok(today.reasons.some((r) => r.includes('Beschwerden')), 'Beschwerden nicht begründet');
    console.log('   Gründe:', today.reasons.filter((r) => /Beschwerden|Bereitschaft/.test(r)).join(' | '));
  }
  // 2) Einziger sicherer Termin
  {
    const d = load();
    d.availability = { [T]: 'yes', [addDays(T, 2)]: 'maybe', [addDays(T, 4)]: 'maybe' };
    const p = show('Nur heute sicher (+2× vielleicht)', d, at(9));
    ok(['full', 'fbA', 'fbB'].includes(p.sessions[0].templateId), 'Einziger sicherer Termin ist nicht Ganzkörper');
    const muscles = p.sessions[0].decisions.filter((x) => x.sets >= 1).length;
    console.log(`   abgedeckte Muskelgruppen heute: ${muscles}`);
  }
  // 3) Drei Tage hintereinander
  {
    const d = load();
    d.availability = { '2026-11-28': 'yes', '2026-11-29': 'yes', '2026-11-30': 'yes' };
    d.planOptions.todayMinutes = null;
    const p = show('Drei Tage am Stück (Sa–Mo), Do absolviert', d, at(9));
    ok(p.sessions.length >= 2, 'Drei Tage am Stück: zu wenige Einheiten');
  }
  // 4) Spontane Einheit bei erreichtem Wochenlimit
  {
    const d = load();
    d.availability = { '2026-11-28': 'yes', '2026-11-29': 'yes', '2026-12-02': 'yes' };
    d.planOptions.todayMinutes = null;
    const before = show('Plan ohne heute (Sa, So, Mi)', d, at(9));
    d.availability[T] = 'yes';
    const after = show('… heute spontan Zeit (Limit 4)', d, at(9));
    ok(after.sessions.some((s) => s.date === T), 'Spontane Einheit heute nicht geplant');
    ok(after.restDays.some((r) => r.because === 'today'), 'Kein Verschiebe-Angebot für einen späteren Termin');
    ok(before.sessions.length >= after.sessions.length - 1, 'Spontane Einheit hebelt Limit aus');
    // Nutzer lehnt ab → späteren Termin bevorzugen
    const shifted = after.restDays.find((r) => r.because === 'today')!;
    d.planOptions.preferDates = [shifted.date];
    const back = show(`… Nutzer wählt „Lieber ${shifted.date} trainieren“`, d, at(9));
    ok(back.sessions.some((s) => s.date === shifted.date), 'Bevorzugter Termin nicht geplant');
  }
  // 5) Kurzfristiger Ausfall
  {
    const d = load();
    d.availability['2026-11-30'] = 'no';
    show('Montag fällt aus', d, at(9));
  }
  // 6) Begonnenes Training verkürzen
  {
    const d = load();
    const plan = planToday(d, 120, at(17))!;
    const ses: Session = {
      id: 'live', date: T, startedAt: at(17), status: 'active', title: plan.label, split: plan.templateId, plannedMinutes: 120,
      exercises: plan.exercises.map((p, i) => ({
        uid: 'u' + i, exerciseId: p.exerciseId, repMin: p.repMin, repMax: p.repMax, targetRir: p.targetRir, restSec: p.restSec, recWeight: p.recWeight, skipped: false, note: '',
        sets: Array.from({ length: p.sets }, (_, k) => ({ id: uid(), weight: p.recWeight ?? 20, reps: i < 2 ? p.advice.repTarget : null, rir: 1, failure: false, done: i < 2, note: '' })),
      })),
    };
    d.sessions.push(ses);
    console.log(`\n── Training läuft (${plan.label}), 2 Übungen erledigt – „Zeit übrig“`);
    for (const m of [15, 20, 30]) {
      const tr = planTrim(d, ses, m, at(18));
      console.log(`   ${m} min → ~${tr.estMin} min, ${tr.dropped} Sätze weniger: ${tr.items.map((x) => `${exOf(d, x.exerciseId).name} ${x.open}→${x.keep}`).join(' | ')}`);
      ok(tr.estMin <= m, `Zeit übrig ${m}: Schätzung ${tr.estMin} > ${m}`);
      ok(tr.items.every((x) => x.keep <= x.open), 'Mehr Sätze als offen');
      ok(tr.items.every((x) => x.keep === x.open || x.note), 'Kürzung ohne Erklärung');
    }
    // übernehmen (wie Store-Aktion) und Folgeplanung prüfen
    const tr = planTrim(d, ses, 15, at(18));
    for (const se of ses.exercises) {
      const k = tr.items.find((x) => x.uid === se.uid);
      if (!k) continue;
      const open = se.sets.filter((x) => !x.done);
      const cut = open.length - k.keep;
      if (cut > 0) {
        const drop = new Set(open.slice(open.length - cut).map((x) => x.id));
        se.sets = se.sets.filter((x) => !drop.has(x.id));
        se.missed = cut;
        if (!se.sets.length) se.skipped = true;
      }
    }
    ses.status = 'done';
    ses.endedAt = at(18, T) + 15 * 60_000;
    show('Folgeplanung nach verkürztem Training', d, at(20));
  }
  // 7) Unerwarteter Leistungsabfall im ersten Arbeitssatz
  {
    const d = load();
    const ex = exOf(d, 'preacher-curl');
    const a = adviseExercise(ex, d.sessions, { settings: d.settings, checkIns: {} });
    const se = { uid: 'x', exerciseId: ex.id, repMin: ex.repMin, repMax: a.repMax ?? ex.repMax, targetRir: 1, restSec: 120, recWeight: a.weight, skipped: false, note: '',
      sets: [{ id: 'a', weight: 25, reps: 5, rir: 0, failure: true, done: true, note: '' }, { id: 'b', weight: 25, reps: 10, rir: 1, failure: false, done: false, note: '' }] };
    const la = liveAdjust(se, ex, d.settings);
    console.log(`\n── Preacher 1. Satz nur 5 Wdh. (sonst 11/10) → ${la ? la.title : 'kein Hinweis'}`);
    ok(!!la && la.dir === 'down', 'Leistungsabfall im 1. Satz: keine Anpassung angeboten');
    const se2 = { ...se, sets: [{ ...se.sets[0], reps: 16, rir: 3, failure: false }, se.sets[1]] };
    const lb = liveAdjust(se2, ex, d.settings);
    console.log(`── Preacher 1. Satz 16 Wdh. mit 3 RIR → ${lb ? lb.title : 'kein Hinweis'}`);
    ok(!!lb && lb.dir === 'up', 'Stärker als erwartet: keine Anpassung angeboten');
  }
  console.log(`\n${checks - fails}/${checks} Prüfungen mit deinem Export bestanden${fails ? ` – ${fails} FEHLER` : ''}`);
}
