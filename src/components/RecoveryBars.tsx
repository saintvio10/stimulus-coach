import { recoveryInfo } from '../engine/fatigue';
import { MUSCLES } from '../lib/muscles';
import type { MuscleId } from '../lib/types';

type St = Parameters<typeof recoveryInfo>[0];

/** Balkenwert passend zum Text: „erholt“ = 100 %, sonst höchstens 89 % */
export function recPct(st: St): number {
  const lv = recoveryInfo(st).level;
  return lv === 'recovered' || lv === 'idle' ? 100 : Math.min(89, st.recovery);
}

/** Farbverlauf der Erholung: rot (frisch belastet) → orange → gelb → grün (erholt) */
export function recoveryBarColor(pct: number): string {
  if (pct >= 90) return 'rgb(var(--rec-green))';
  if (pct >= 65) return 'linear-gradient(90deg, rgb(var(--rec-yellow)), rgb(var(--rec-green)))';
  if (pct >= 40) return 'linear-gradient(90deg, rgb(var(--rec-orange)), rgb(var(--rec-yellow)))';
  return 'linear-gradient(90deg, rgb(var(--rec-red)), rgb(var(--rec-orange)))';
}

/**
 * Muskelregeneration als Balken (rot → grün) mit „erholt ca. …“.
 * sortByNeed: Muskeln, die noch Erholung brauchen, zuerst.
 */
export function RecoveryBars({ states, sortByNeed = false }: { states: Record<MuscleId, St>; sortByNeed?: boolean }) {
  const list = MUSCLES.filter((m) => !m.indirectOnly);
  const shown = sortByNeed ? [...list].sort((a, b) => recPct(states[a.id]) - recPct(states[b.id])) : list;
  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {shown.map((m) => {
          const st = states[m.id];
          const pct = recPct(st);
          return (
            <li key={m.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px]">{m.label}</span>
                <span className="tnum shrink-0 text-[12px] text-muted">{recoveryInfo(st).short}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-raised">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(4, pct)}%`, background: recoveryBarColor(pct) }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-muted">Balken = geschätzte Erholung (rot frisch belastet → grün erholt) aus Satzvolumen, Abstand zum Versagen, Zeit und Muskelkater – keine Messung.</p>
    </>
  );
}
