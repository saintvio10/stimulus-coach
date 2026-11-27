// „Noch Zeit?“ nach dem Training: Vorschläge passen zu Plan und Erholung
// @ts-expect-error – Node-Typen sind im Projekt nicht installiert
import { readFileSync, existsSync } from 'node:fs';
import { parseExport } from '../src/lib/merge';
import { migrate } from '../src/lib/store';
import { extraSuggestions } from '../src/engine/extra';
import type { AppData, Session, SetLog } from '../src/lib/types';
import { addDays, uid } from '../src/lib/utils';
if (!existsSync('fixtures/export.json')) console.log('fixtures/export.json fehlt – Test NICHT ausgeführt.');
else {
  let fails = 0;
  const ok = (c: boolean, m: string) => {
    if (!c) fails++;
    console.log(`${c ? '✓' : '✗'} ${m}`);
  };
  const T = '2026-11-27';
  const now = Date.parse(`${T}T21:10:00+01:00`);
  const mk = (id: string, n: number, w: number) => ({ uid: uid(), exerciseId: id, repMin: 8, repMax: 12, targetRir: 1, restSec: 120, recWeight: w, skipped: false, note: '', sets: Array.from({ length: n }, (_, k) => ({ id: uid(), weight: w, reps: 10, rir: 1, failure: false, done: true, doneAt: now - (20 - k) * 180_000, note: '' }) as SetLog) });
  const run = (avail: Record<string, 'yes' | 'no'>, min: number) => {
    const d: AppData = migrate(parseExport(readFileSync('fixtures/export.json', 'utf8')));
    d.availability = {};
    for (let i = 0; i < 10; i++) d.availability[addDays(T, i)] = 'no';
    Object.assign(d.availability, avail);
    const ses: Session = { id: uid(), date: T, startedAt: now - 82 * 60_000, status: 'active', title: 'Oberkörper', split: 'upper', plannedMinutes: 90,
      exercises: [mk('incline-press', 3, 60), mk('lat-pulldown', 3, 60), mk('chest-supported-row', 3, 50), mk('cable-lateral', 5, 7.5), mk('reverse-cable-fly', 3, 7.5)] };
    d.sessions.push(ses);
    return { d, r: extraSuggestions(d, ses, min, now) };
  };
  const trained = ['chest', 'lats', 'upperBack', 'sideDelts', 'rearDelts'];
  for (const [label, avail] of [['nächster Termin in 4 Tagen', { '2026-12-01': 'yes' }], ['Beine morgen geplant', { '2026-11-28': 'yes' }]] as const) {
    for (const min of [15, 30]) {
      const { d, r } = run(avail as Record<string, 'yes'>, min);
      console.log(`\n${label}, +${min} min → ${r.items.map((i) => `${i.ex.name} ${i.sets}× (~${i.minutes} min)`).join(' | ') || '–'} (~${r.minutes} min)`);
      for (const i of r.items) console.log(`   ${i.why}`);
      if (r.skipped.length) console.log(`   nicht: ${r.skipped.join(' · ')}`);
      ok(r.minutes <= min + 1, `${label} +${min}: Zeit eingehalten`);
      ok(r.items.every((i) => !trained.includes(i.ex.primary)), `${label} +${min}: kein heute trainierter Muskel`);
      ok(r.items.every((i) => !['incline-press', 'lat-pulldown', 'chest-supported-row', 'cable-lateral', 'reverse-cable-fly'].includes(i.ex.id)), `${label} +${min}: keine Übung von heute`);
      void d;
    }
  }
  console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
  if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
}
