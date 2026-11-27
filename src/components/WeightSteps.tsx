import { useState } from 'react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/hooks';
import type { Exercise } from '../lib/types';
import { fmtNum, weightSteps } from '../lib/utils';
import { Button, Chip, Field, Input, Sheet } from './ui';

/** Stufen eines Gewichtsblocks: Start, Schritt, Maximum, optional Zusatzgewicht (z. B. +2,5 kg Aufsteckgewicht) */
export function stackWeights(min: number, step: number, max: number, add = 0): number[] {
  if (!(min > 0) || !(step > 0) || !(max >= min)) return [];
  const out = new Set<number>();
  for (let v = min; v <= max + 1e-6 && out.size < 400; v += step) {
    const r = Math.round(v * 100) / 100;
    out.add(r);
    if (add > 0 && add < step) out.add(Math.round((r + add) * 100) / 100);
  }
  return [...out].sort((a, b) => a - b);
}

const num = (s: string) => Number(s.replace(',', '.'));
const preview = (list: number[]) =>
  list.length <= 8 ? list.map((x) => fmtNum(x, 2)).join(' · ') : `${list.slice(0, 4).map((x) => fmtNum(x, 2)).join(' · ')} … ${list.slice(-2).map((x) => fmtNum(x, 2)).join(' · ')}`;

/** Eingabe „Gewichtsblock am Gerät“ → Liste der einstellbaren Gewichte */
export function StackGenerator({ onGenerate, initial }: { onGenerate: (list: number[]) => void; initial?: number[] }) {
  const guess = initial && initial.length > 2 ? { min: initial[0], max: initial[initial.length - 1], step: initial[1] - initial[0] } : null;
  const [min, setMin] = useState(guess ? String(guess.min) : '5');
  const [step, setStep] = useState(guess ? String(guess.step) : '5');
  const [max, setMax] = useState(guess ? String(guess.max) : '100');
  const [add, setAdd] = useState(0);
  const list = stackWeights(num(min), num(step), num(max), add);
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-raised p-3">
      <div className="text-[13px] font-semibold">Gewichtsblock am Gerät</div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Leichtestes (kg)">
          <Input id="st-min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
        </Field>
        <Field label="Schritt (kg)">
          <Input id="st-step" inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} />
        </Field>
        <Field label="Schwerstes (kg)">
          <Input id="st-max" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
        </Field>
      </div>
      <div>
        <div className="mb-1.5 text-[12px] text-muted">Zusatzgewicht zum Aufstecken (für Zwischenstufen)</div>
        <div className="flex flex-wrap gap-1.5">
          {[0, 1.25, 2.5].map((a) => (
            <Chip key={a} active={add === a} onClick={() => setAdd(a)} className="h-8">
              {a ? `+${fmtNum(a, 2)} kg` : "keins"}
            </Chip>
          ))}
        </div>
      </div>
      <div className="tnum text-[12px] text-muted">{list.length ? `${list.length} Stufen: ${preview(list)} kg` : 'Bitte gültige Werte eingeben.'}</div>
      <Button size="sm" variant="secondary" disabled={!list.length} onClick={() => onGenerate(list)}>
        Diese Stufen übernehmen
      </Button>
    </div>
  );
}

/** Schnellzugriff aus dem Training: Gewichtsstufen dieser Übung festlegen (gilt ab sofort für Empfehlungen) */
export function WeightStepsSheet({ ex, open, onClose }: { ex: Exercise; open: boolean; onClose: () => void }) {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const cur = weightSteps(ex, s.settings);
  const save = (weights: number[] | undefined) => {
    s.mutate((d) => {
      const x = d.exercises.find((y) => y.id === ex.id);
      if (x) x.weights = weights;
    });
    toast(weights ? `${ex.name}: ${weights.length} Gewichtsstufen gespeichert` : `${ex.name}: wieder Gerätestandard`);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Gewichtsstufen: ${ex.name}`}>
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-muted">
          Trage ein, welche Gewichte du an diesem Gerät wirklich einstellen kannst. Empfehlungen, Steigerungen und „eine Stufe leichter“ nutzen dann genau diese Stufen.
        </p>
        <div className="tnum rounded-xl bg-raised px-3 py-2 text-[12.5px]">
          Aktuell: {cur.list ? `${cur.list.length} eigene Stufen (${preview(cur.list)} kg)` : `Standard-Schritt ${fmtNum(cur.step)} kg`}
        </div>
        <StackGenerator initial={ex.weights} onGenerate={(l) => save(l)} />
        {ex.weights && (
          <Button size="sm" variant="ghost" onClick={() => save(undefined)}>
            Eigene Stufen entfernen (Gerätestandard)
          </Button>
        )}
      </div>
    </Sheet>
  );
}
