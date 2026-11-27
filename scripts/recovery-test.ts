// Erholungsanzeige als geschätzter Zeitpunkt („erholt ca. morgen früh“)
import { computeAllStates, recoveryInfo, recoveryWhen } from '../src/engine/fatigue';
import type { StimulusEvent } from '../src/engine/fatigue';
const HOUR = 3_600_000;
const now = Date.parse('2026-11-27T19:00:00+01:00'); // Fr 19 Uhr
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const ev = (m: string, sets: number, hAgo: number): StimulusEvent => ({ t: now - hAgo * HOUR, muscle: m as never, sets, fatigue: sets, direct: true, load: 0 });
const st = computeAllStates([ev('biceps', 8, 1), ev('quads', 6, 30), ev('chest', 3, 70), ev('calves', 3, 2)], now, {});
for (const m of ['biceps', 'quads', 'chest', 'calves', 'lats'] as const) {
  const r = recoveryInfo(st[m], now);
  console.log(`  ${m.padEnd(8)} ${r.label.padEnd(30)} · ${r.advice} (bereit ${new Date(r.readyAt).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })})`);
}
const bi = recoveryInfo(st.biceps, now);
ok(bi.label.startsWith('Erholt ca.') && bi.level === 'fresh', 'Bizeps 8 Sätze vor 1 h → „Erholt ca. …“, frisch belastet');
ok(bi.readyAt > now + 24 * HOUR, 'Bizeps braucht > 24 h');
ok(recoveryInfo(st.lats, now).label === 'Erholt', 'Unbelasteter Muskel → „Erholt“');
ok(recoveryWhen(now + 3 * HOUR, now) === 'in ~3 h', 'kurze Zeitspanne in Stunden');
ok(recoveryWhen(now + 14 * HOUR, now) === 'morgen früh', 'Sa 9 Uhr → „morgen früh“');
ok(recoveryWhen(now + 42 * HOUR, now) === 'übermorgen mittags', 'So 13 Uhr → „übermorgen mittags“');
ok(recoveryWhen(now + 56 * HOUR, now) === 'Mo früh', 'Mo 3 Uhr → „Mo früh“');
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
