import type { CheckIn } from '../lib/types';
import { clamp } from '../lib/utils';

/** Trainingsbereitschaft 0–100 aus dem täglichen Check-in (transparente Heuristik, kein Messwert) */
export function readinessScore(c: CheckIn | undefined): number | null {
  if (!c) return null;
  const sleep = clamp((c.sleepHours - 4.5) / (8 - 4.5), 0, 1);
  const quality = (c.sleepQuality - 1) / 4;
  const energy = (c.energy - 1) / 4;
  const stress = 1 - (c.stress - 1) / 4;
  const soreVals = Object.values(c.soreness ?? {}).filter((x): x is number => typeof x === 'number');
  const soreAvg = soreVals.length ? soreVals.reduce((a, b) => a + b, 0) / soreVals.length : 0;
  const score = 100 * (0.35 * sleep + 0.15 * quality + 0.3 * energy + 0.2 * stress) - soreAvg * 6;
  return Math.round(clamp(score, 0, 100));
}

export function readinessLabel(score: number | null): { label: string; tone: 'green' | 'yellow' | 'orange' | 'gray' } {
  if (score == null) return { label: 'Kein Check-in', tone: 'gray' };
  if (score >= 75) return { label: 'Bereit', tone: 'green' };
  if (score >= 50) return { label: 'Moderat', tone: 'yellow' };
  return { label: 'Reduziert', tone: 'orange' };
}

/** Auswirkung auf den Plan */
export function readinessAdjust(score: number | null): { volume: number; rir: number; note: string | null } {
  if (score == null) return { volume: 1, rir: 0, note: null };
  if (score < 45)
    return { volume: 0.75, rir: 1, note: `Bereitschaft niedrig (${score}/100): ca. 25 % weniger Sätze und +1 RIR.` };
  if (score < 60) return { volume: 0.9, rir: 0, note: `Bereitschaft moderat (${score}/100): Volumen leicht reduziert.` };
  return { volume: 1, rir: 0, note: null };
}
