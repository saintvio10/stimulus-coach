import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Exercise, Session } from '../lib/types';
import { cn, e1rm, fmtNum, fmtShortDay } from '../lib/utils';

/** Verlauf einer Übung: letzte Einheiten mit allen Sätzen, RIR, e1RM und Vergleichbarkeits-Hinweisen */
export function ExerciseHistory({ ex, sessions, excludeSessionId }: { ex: Exercise; sessions: Session[]; excludeSessionId?: string }) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => {
    const out: { date: string; sets: { w: number; r: number; rir: number | null }[]; e1: number; avgRir: number | null; excluded: boolean; reason?: string }[] = [];
    for (const s of [...sessions].sort((a, b) => b.startedAt - a.startedAt)) {
      if (s.status !== 'done' || s.id === excludeSessionId) continue;
      for (const se of s.exercises) {
        if (se.exerciseId !== ex.id || se.skipped) continue;
        const sets = se.sets.filter((x) => x.done && x.reps).map((x) => ({ w: x.weight ?? 0, r: x.repsL != null && x.repsR != null ? Math.min(x.repsL, x.repsR) : x.reps!, rir: x.failure ? 0 : x.rir }));
        if (!sets.length) continue;
        const rirs = sets.map((x) => x.rir).filter((x): x is number => x != null);
        out.push({
          date: s.date,
          sets,
          e1: Math.max(...sets.map((x) => e1rm(x.w, x.r, x.rir))),
          avgRir: rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null,
          excluded: !!se.excluded,
          reason: se.declineReason,
        });
      }
      if (out.length >= 6) break;
    }
    return out;
  }, [sessions, ex.id, excludeSessionId]);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.e1), 1);
  return (
    <div className="rounded-2xl bg-raised">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3.5 py-2.5 text-[13px] font-medium" aria-expanded={open}>
        Verlauf ({rows.length} Einheiten)
        <ChevronDown size={16} className={cn('text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-3.5 pb-3">
          {rows.map((r, i) => {
            const prev = rows[i + 1];
            const notes: string[] = [];
            if (r.excluded) notes.push(r.reason === 'device' ? 'anderes Gerät – nicht gewertet' : r.reason === 'typo' ? 'Eingabefehler – nicht gewertet' : 'nicht gewertet');
            if (prev && prev.sets.length !== r.sets.length) notes.push(`${r.sets.length} statt ${prev.sets.length} Sätze`);
            if (prev && r.avgRir != null && prev.avgRir != null && Math.abs(r.avgRir - prev.avgRir) >= 1.5) notes.push(`andere Anstrengung (Ø ${fmtNum(r.avgRir, 1)} vs. ${fmtNum(prev.avgRir, 1)} RIR)`);
            return (
              <div key={r.date + i} className={cn('flex flex-col gap-1 text-[12.5px]', r.excluded && 'opacity-50')}>
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-muted">{fmtShortDay(r.date)}</span>
                  <span className="tnum min-w-0 flex-1 truncate">{r.sets.map((x) => `${fmtNum(x.w)}×${x.r}`).join(' · ')}</span>
                  <span className="tnum shrink-0 text-muted">{r.avgRir != null ? `RIR ${fmtNum(r.avgRir, 1)}` : ''}</span>
                </div>
                <div className="flex items-center gap-2 pl-[4.5rem]">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(r.e1 / max) * 100}%` }} />
                  </span>
                  <span className="tnum w-16 shrink-0 text-right text-[11.5px] text-muted">e1RM {fmtNum(r.e1, 1)}</span>
                </div>
                {notes.length > 0 && <div className="pl-[4.5rem] text-[11px] text-muted">eingeschränkt vergleichbar: {notes.join(', ')}</div>}
              </div>
            );
          })}
          <p className="text-[11px] text-muted">e1RM = geschätzte Maximalkraft aus Gewicht, Wdh. und RIR – macht Einheiten mit unterschiedlichen Gewichten vergleichbar. Stagnation erkennt die App erst über mindestens 3 Einheiten, nie aus einer einzelnen schwächeren.</p>
        </div>
      )}
    </div>
  );
}
