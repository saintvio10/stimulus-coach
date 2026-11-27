// Gewichtsstufen pro Gerät: Gewichtsblock → Liste; Empfehlungen nutzen nur einstellbare Gewichte
import { stackWeights } from '../src/components/WeightSteps';
import { defaultData } from '../src/lib/store';
import { nextWeight, prevWeight, snapWeight } from '../src/lib/utils';
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const l1 = stackWeights(5, 5, 100);
ok(l1.length === 20 && l1[0] === 5 && l1[19] === 100, `Block 5–100 in 5er-Schritten → 20 Stufen`);
const l2 = stackWeights(5, 5, 100, 2.5);
ok(l2.length === 40 && l2.includes(62.5) && l2.includes(102.5), `+2,5-kg-Aufsteckgewicht → 40 Stufen inkl. 62,5 und 102,5`);
ok(stackWeights(10, 0, 50).length === 0 && stackWeights(50, 5, 10).length === 0, 'ungültige Eingaben → keine Stufen');
const d = defaultData();
const ex = { ...d.exercises.find((e) => e.id === 'lat-pulldown')!, weights: l1 };
ok(nextWeight(60, ex, d.settings) === 65 && prevWeight(60, ex, d.settings) === 55, 'Steigerung/Reduktion springen auf echte Stufen (60 → 65 / 55)');
ok(snapWeight(62, ex, d.settings) === 60, 'nicht einstellbares Gewicht (62) wird auf 60 gerundet');
const ex2 = { ...ex, weights: l2 };
ok(nextWeight(60, ex2, d.settings) === 62.5, 'mit Aufsteckgewicht: 60 → 62,5');
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
