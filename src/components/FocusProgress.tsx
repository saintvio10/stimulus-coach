import { useMemo } from 'react';
import type { Exercise, ProgressionAdvice, Session, SessionExercise } from '../lib/types';
import { exposures } from '../engine/progression';
import { cn, e1rm, fmtNum, fmtShortDay } from '../lib/utils';

interface SetGoal {
  k: number;
  /** Gewicht für diesen Satz (erledigt: tatsächlich, offen: geplant) */
  w: number | null;
  goal: number;
  last: { w: number; r: number } | null;
  today: { w: number; r: number; rir: number | null } | null;
  current: boolean;
}

/**
 * Satzziele für heute: gleiches Gewicht wie letztes Mal → 1 Wdh. mehr als im selben Satz damals (doppelte Progression,
 * innerhalb deines Zielbereichs). Neues/anderes Gewicht → Richtwert aus der Empfehlung, pro Folgesatz ~1 Wdh. weniger
 * (normale Ermüdung), nie unter dem unteren Ende des Bereichs. Modellregel – entscheidend bleibt: im Zielbereich, nah am Versagen.
 */
export function setGoals(se: SessionExercise, advice: ProgressionAdvice | null, last: { w: number; r: number }[] | null): SetGoal[] {
  const curIdx = se.sets.findIndex((x) => !x.done);
  return se.sets.map((x, k) => {
    const w = x.weight ?? null;
    const l = last?.[k] ?? null;
    let goal: number;
    if (l && w != null && l.w === w) goal = Math.min(Math.max(l.r + 1, se.repMin), Math.max(se.repMax, l.r));
    else goal = Math.max(se.repMin, (advice?.repTarget ?? Math.round((se.repMin + se.repMax) / 2)) - k);
    const r = x.repsL != null && x.repsR != null ? Math.min(x.repsL, x.repsR) : x.reps;
    return { k, w, goal, last: l, today: x.done && r != null ? { w: x.weight ?? 0, r, rir: x.failure ? 0 : x.rir } : null, current: k === curIdx };
  });
}

const vol = (sets: { w: number; r: number }[]) => sets.reduce((a, x) => a + x.w * x.r, 0);

/** Fokusmodus: Ziel je Satz, Vergleich mit dem letzten Mal und Verlauf (Volumen & Sätze) */
export function FocusProgress({ ex, se, sessionId, sessions, advice, part }: { ex: Exercise; se: SessionExercise; sessionId: string; sessions: Session[]; advice: ProgressionAdvice | null; part: 'goal' | 'history' }) {
  const hist = useMemo(
    () =>
      exposures(ex.id, sessions.filter((s) => s.id !== sessionId))
        .slice(0, 6)
        .reverse()
        .map((e) => ({ date: e.date, sets: e.sets.map((x) => ({ w: x.weight ?? 0, r: x.repsL != null && x.repsR != null ? Math.min(x.repsL, x.repsR) : x.reps ?? 0, rir: x.rir })) })),
    [ex.id, sessions, sessionId],
  );
  const last = hist.length ? hist[hist.length - 1] : null;
  const goals = setGoals(se, advice, last?.sets ?? null);
  const doneToday = goals.filter((g) => g.today).map((g) => g.today!);
  const bw = ex.equipment === 'bodyweight';
  const fmtSet = (s: { w: number; r: number } | null) => (s ? (bw && !s.w ? `${s.r}` : `${fmtNum(s.w)}×${s.r}`) : '–');

  // Vergleich auf gleicher Satzzahl (fair, solange die Übung noch läuft)
  const n = doneToday.length;
  const lastSame = last ? last.sets.slice(0, n) : [];
  const metric = bw ? 'Wdh.' : 'kg × Wdh.';
  const volOf = (sets: { w: number; r: number }[]) => (bw ? sets.reduce((a, x) => a + x.r, 0) : vol(sets));
  const vToday = volOf(doneToday);
  const vLast = volOf(lastSame);
  const diff = n && vLast ? ((vToday - vLast) / vLast) * 100 : null;
  const bestToday = doneToday.length ? Math.max(...doneToday.map((x) => e1rm(x.w, x.r, x.rir))) : 0;
  const bestLast = last ? Math.max(...last.sets.map((x) => e1rm(x.w, x.r, x.rir))) : 0;

  // Verlauf: Volumen (kg × Wdh.) je Einheit, heute (bisher) hervorgehoben
  const bars = [...hist.map((h) => ({ label: h.date.slice(8, 10) + '.' + h.date.slice(5, 7) + '.', v: volOf(h.sets), sets: h.sets.length, today: false })), { label: 'heute', v: vToday, sets: n, today: true }];
  const maxV = Math.max(1, ...bars.map((b) => b.v));
  const goalW = goals.find((g) => g.current)?.w ?? goals[0]?.w;

  if (part === 'history')
    return (
      <div className="flex flex-col gap-2 rounded-[24px] bg-white/[0.06] p-4">
        {hist.length ? (
          <>
            <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="font-medium text-white/80">Verlauf · Volumen ({metric})</span>
              {diff != null ? (
                <span className={cn('tnum font-semibold', diff > 0.5 ? 'text-rec-green' : diff < -0.5 ? 'text-rec-orange' : 'text-white/60')}>
                  {diff > 0 ? '+' : ''}
                  {fmtNum(diff, 0)} % ggü. letztem Mal
                </span>
              ) : (
                <span className="text-white/40">Vergleich ab dem 1. Satz</span>
              )}
            </div>
            {diff != null && (
              <div className="-mt-1 text-[11px] text-white/40">
                Verglichen auf gleicher Satzzahl: heute {n} {n === 1 ? 'Satz' : 'Sätze'} = {fmtNum(vToday, 0)} · letztes Mal nach {n} = {fmtNum(vLast, 0)}
              </div>
            )}
            <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Verlauf Volumen je Einheit">
              {bars.map((b, i) => (
                <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className={cn('tnum text-[10px]', b.today ? 'text-rec-green' : 'text-white/45')}>{b.v ? fmtNum(b.v, 0) : ''}</span>
                  <div
                    className={cn('w-full rounded-t-md transition-[height] duration-500', b.today ? 'bg-rec-green' : i === bars.length - 2 ? 'bg-white/45' : 'bg-white/20')}
                    style={{ height: `${Math.max(3, (b.v / maxV) * 64)}px` }}
                  />
                  <span className={cn('tnum truncate text-[10px]', b.today ? 'font-semibold text-white' : 'text-white/45')}>{b.label}</span>
                  <span className="tnum text-[9.5px] text-white/35">
                    {b.sets} {b.sets === 1 ? 'Satz' : 'Sätze'}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-between gap-x-3 text-[11.5px] text-white/50">
              <span>
                Letztes Mal ({fmtShortDay(last!.date)}): {last!.sets.length} Sätze · {fmtNum(volOf(last!.sets), 0)} {metric}
              </span>
              {!bw && bestToday > 0 && bestLast > 0 && (
                <span className={cn(bestToday > bestLast * 1.005 ? 'text-rec-green' : bestToday < bestLast * 0.97 ? 'text-rec-orange' : '')}>
                  Kraft (e1RM) {fmtNum(bestLast, 1)} → {fmtNum(bestToday, 1)} kg
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-[12px] text-white/45">Erstes Mal mit dieser Übung – ab dem nächsten Mal siehst du hier den Vergleich und den Verlauf.</p>
        )}
      </div>
    );

  return (
    <div className="flex flex-col gap-3 rounded-[24px] bg-white/[0.06] p-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">Dein Ziel heute</div>
        <div className="tnum mt-1 text-[19px] font-semibold leading-snug">
          {se.sets.length} Sätze × {goals[0]?.goal ?? se.repMin}
          {goals.length > 1 && goals[goals.length - 1].goal !== goals[0].goal ? `–${goals[goals.length - 1].goal}` : ''} Wdh.
          {goalW != null && goalW > 0 && <span className="text-white/70"> · {fmtNum(goalW)} kg</span>}
          <span className="text-white/50"> · RIR {se.targetRir}</span>
        </div>
        <div className="mt-0.5 text-[12px] text-white/45">
          Bereich {se.repMin}–{se.repMax} Wdh. ·{' '}
          {goals.some((g) => g.last && g.w === g.last.w) ? 'gleiches Gewicht: 1 Wdh. mehr als letztes Mal' : 'Richtwert, Folgesätze je ~1 Wdh. weniger'}
        </div>
      </div>
      <div className="tnum overflow-hidden rounded-2xl bg-black/30 text-[13px]">
        <div className="grid grid-cols-[2.4rem_1fr_1fr_1fr] px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-white/40">
          <span>Satz</span>
          <span>Letztes Mal</span>
          <span>Ziel</span>
          <span className="text-right">Heute</span>
        </div>
        {goals.map((g) => {
          const t = g.today;
          const tone = !t ? '' : t.r >= g.goal ? 'text-rec-green' : t.r >= se.repMin ? 'text-rec-yellow' : 'text-rec-red';
          return (
            <div key={g.k} className={cn('grid grid-cols-[2.4rem_1fr_1fr_1fr] items-center px-3 py-1.5', g.current && 'bg-white/[0.07]')}>
              <span className={cn('font-semibold', g.current ? 'text-white' : 'text-white/50')}>{g.k + 1}</span>
              <span className="text-white/55">{fmtSet(g.last)}</span>
              <span className="text-white/85">{g.w != null && !(bw && !g.w) ? `${fmtNum(g.w)}×${g.goal}` : `${g.goal}`}</span>
              <span className={cn('text-right font-semibold', tone || 'text-white/30')}>
                {t ? (
                  <>
                    {fmtSet(t)}
                    {g.last && g.last.w === t.w && t.r !== g.last.r && <span className="ml-1 text-[11px]">{t.r > g.last.r ? `+${t.r - g.last.r}` : t.r - g.last.r}</span>}
                  </>
                ) : g.current ? (
                  'jetzt'
                ) : (
                  '–'
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
