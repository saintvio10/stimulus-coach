import { Clock, Dumbbell, Layers, Repeat2, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Exercise, MuscleId } from '../lib/types';
import type { PlannedExercise } from '../engine/planner';
import { MUSCLE } from '../lib/muscles';
import { cn, fmtClock, fmtNum, loadHint } from '../lib/utils';
import { Badge, Sheet } from './ui';
import { ExerciseVisual } from './ExerciseVisual';
import { BodyMap, targetFills } from './BodyMap';

function Goal({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-raised px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
        {icon}
        {label}
      </div>
      <div className="tnum mt-0.5 truncate text-[17px] font-semibold">{value}</div>
      {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

/** Kurze Übungserklärung mit dem Ziel für heute – öffnet sich beim Tipp auf das Übungsbild */
export function ExerciseInfoSheet({ ex, plan, onClose }: { ex: Exercise; plan?: PlannedExercise; onClose: () => void }) {
  const fills = targetFills(ex.muscles);
  const rest = plan?.restSec ?? ex.restSec;
  const w = plan?.recWeight;
  const bw = ex.equipment === 'bodyweight';
  const weightTxt = w != null && w > 0 ? `${fmtNum(w)} kg` : bw ? 'Körpergewicht' : 'frei wählen';
  const hint = w != null && w > 0 ? loadHint(ex) : '';
  return (
    <Sheet open onClose={onClose} title={ex.name} wide>
      <div className="flex flex-col gap-4">
        <div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(90%_70%_at_50%_40%,rgb(var(--raised)),rgb(var(--bg)))]">
          <div className="relative h-60 sm:h-72">
            <ExerciseVisual ex={ex} />
          </div>
          <div className="absolute right-3 top-3 flex gap-1 rounded-2xl bg-bg/50 p-1.5 backdrop-blur">
            <BodyMap side="front" colors={{}} fills={fills} className="h-20 w-9" />
            <BodyMap side="back" colors={{}} fills={fills} className="h-20 w-9" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(ex.muscles) as [MuscleId, number][])
            .sort((a, b) => b[1] - a[1])
            .map(([m, c]) => (
              <Badge key={m} tone={c >= 0.75 ? 'accent' : 'default'}>
                {MUSCLE[m].label}
                {c < 0.75 && ' · indirekt'}
              </Badge>
            ))}
        </div>

        <div>
          <div className="label mb-2">{plan ? 'Dein Ziel heute' : 'Richtwerte'}</div>
          <div className="grid grid-cols-2 gap-2">
            <Goal icon={<Layers size={12} />} label="Sätze" value={plan ? `${plan.sets} Arbeitssätze` : '2–4'} />
            <Goal icon={<Repeat2 size={12} />} label="Wiederholungen" value={`${plan?.repMin ?? ex.repMin}–${plan?.repMax ?? ex.repMax}${ex.unilateral ? ' pro Seite' : ''}`} sub={plan ? `heute ${plan.advice.repTarget}+ anpeilen` : undefined} />
            <Goal icon={<Dumbbell size={12} />} label="Gewicht" value={weightTxt} sub={hint || undefined} />
            <Goal icon={<Clock size={12} />} label="Satzpause" value={`${fmtClock(rest)} min`} sub={rest >= 150 ? 'schwere Grundübung' : rest <= 90 ? 'kleiner Muskel' : undefined} />
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-raised px-3 py-2.5 text-[13px]">
            <Target size={14} className="shrink-0 text-accent" />
            <span>
              Jeden Satz mit <b>{plan?.targetRir ?? ex.targetRir} Wdh. Reserve</b> beenden (RIR {plan?.targetRir ?? ex.targetRir}) – also kurz vor dem Punkt, an dem keine saubere Wiederholung mehr geht.
            </span>
          </div>
        </div>

        <div>
          <div className="label mb-2">So geht’s richtig</div>
          <ol className="flex flex-col gap-2">
            {ex.cues.map((c, i) => (
              <li key={c} className="flex gap-3 text-[14px] leading-snug">
                <span className="tnum grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[12px] font-semibold text-accent">{i + 1}</span>
                <span className="pt-0.5">{c}</span>
              </li>
            ))}
          </ol>
        </div>

        {(plan?.why || ex.benefit) && (
          <div className={cn('rounded-2xl bg-fg/[0.05] px-3.5 py-3 text-[13px] leading-relaxed text-fg/85')}>
            <div className="mb-0.5 font-semibold">{plan?.why ? 'Warum heute?' : 'Wofür?'}</div>
            {plan?.why ?? ex.benefit}
          </div>
        )}
        {plan?.advice.text && (
          <div className="rounded-2xl bg-fg/[0.05] px-3.5 py-3 text-[13px] leading-relaxed text-fg/85">
            <div className="mb-0.5 font-semibold">Gewicht & Steigerung</div>
            {plan.advice.text}
            {plan.advice.increaseRule && <div className="mt-1 text-muted">{plan.advice.increaseRule}</div>}
          </div>
        )}
      </div>
    </Sheet>
  );
}
