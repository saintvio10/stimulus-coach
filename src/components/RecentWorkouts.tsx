import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Trophy } from 'lucide-react';
import { useStore } from '../lib/store';
import type { Exercise, Session } from '../lib/types';
import { exerciseImage, IMAGE_BG } from '../data/exerciseImages';
import { ExerciseIcon } from './ExerciseAnimation';
import { SessionComplete } from './SessionComplete';
import { Sheet } from './ui';
import { MONTHS, fmtMin, relDayLabel } from '../lib/utils';

/**
 * Grobe Kalorienschätzung fürs Krafttraining: MET × Körpergewicht × Stunden.
 * MET 5 liegt zwischen „Krafttraining, moderat“ (3,5) und „intensiv“ (6,0) im Compendium of Physical Activities –
 * nur ein Richtwert, Pausen und Intensität variieren stark.
 */
export const estimateKcal = (minutes: number, kg: number) => Math.round((5 * kg * minutes) / 60 / 5) * 5;

function summary(s: Session, exercises: Exercise[]) {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const doneEx = s.exercises.filter((e) => e.sets.some((x) => x.done));
  const sets = doneEx.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const times = doneEx.flatMap((e) => e.sets.map((x) => x.doneAt).filter((t): t is number => !!t));
  const end = s.endedAt ?? (times.length ? Math.max(...times) : s.startedAt);
  const minutes = Math.max(1, Math.round((end - s.startedAt) / 60_000));
  // Bild: Übung mit den meisten Sätzen, die ein Rendering hat
  const main = [...doneEx].sort((a, b) => b.sets.filter((x) => x.done).length - a.sets.filter((x) => x.done).length).map((e) => exMap.get(e.exerciseId)).filter((e): e is Exercise => !!e);
  const withImg = main.find((e) => exerciseImage(e.id));
  return { sets, minutes, ex: withImg ?? main[0], img: withImg ? exerciseImage(withImg.id) : undefined, prs: s.prs?.length ?? 0 };
}

function WorkoutRow({ s, onOpen }: { s: Session; onOpen: () => void }) {
  const exercises = useStore((st) => st.exercises);
  const body = useStore((st) => st.body);
  const kg = [...body].reverse().find((b) => b.weight)?.weight ?? 75;
  const sum = summary(s, exercises);
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3.5 rounded-3xl bg-raised p-2.5 pr-3.5 text-left transition active:scale-[0.99]">
      <div className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-2xl" style={{ background: IMAGE_BG }}>
        {sum.img ? (
          <img src={sum.img} alt="" className="h-full w-full scale-[1.35] object-cover" draggable={false} />
        ) : sum.ex ? (
          <div className="grid h-full w-full place-items-center">
            <ExerciseIcon id={sum.ex.id} pattern={sum.ex.pattern} muscles={sum.ex.muscles} size={52} />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold">{s.title.split(' (')[0]}</span>
          {sum.prs > 0 && <Trophy size={14} className="shrink-0 text-rec-yellow" aria-label={`${sum.prs} Rekorde`} />}
        </div>
        <div className="truncate text-[12px] text-muted">{relDayLabel(s.date)}</div>
        <div className="tnum mt-0.5 truncate text-[12.5px] text-fg/80">
          {fmtMin(sum.minutes)} · {sum.sets} Sätze · ~{estimateKcal(sum.minutes, kg)} kcal
        </div>
      </div>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rec-green text-black shadow-[0_0_14px_rgba(61,220,151,0.35)]">
        <Check size={17} strokeWidth={3} />
      </span>
    </button>
  );
}

/** Übersicht: die letzten Trainings – antippen öffnet die Auswertung, „Alle ansehen“ die komplette Liste */
export function RecentWorkouts() {
  const sessions = useStore((s) => s.sessions);
  const done = useMemo(() => sessions.filter((s) => s.status === 'done' && s.exercises.some((e) => e.sets.some((x) => x.done))).sort((a, b) => b.startedAt - a.startedAt), [sessions]);
  const [open, setOpen] = useState<Session | null>(null);
  const [all, setAll] = useState(false);
  if (!done.length) return null;
  const groups = done.reduce<{ key: string; label: string; items: Session[] }[]>((acc, s) => {
    const key = s.date.slice(0, 7);
    const g = acc.find((x) => x.key === key);
    if (g) g.items.push(s);
    else acc.push({ key, label: `${MONTHS[+s.date.slice(5, 7) - 1]} ${s.date.slice(0, 4)}`, items: [s] });
    return acc;
  }, []);
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[19px] font-semibold tracking-tight">Letzte Trainings</h2>
        <button onClick={() => setAll(true)} className="flex items-center gap-0.5 text-[13.5px] font-semibold text-rec-green">
          Alle ansehen <ChevronRight size={15} />
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        {done.slice(0, 3).map((s) => (
          <WorkoutRow key={s.id} s={s} onOpen={() => setOpen(s)} />
        ))}
      </div>
      <Sheet open={all} onClose={() => setAll(false)} title={`Alle Trainings (${done.length})`}>
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-2">
              <div className="label px-1">
                {g.label} · {g.items.length} {g.items.length === 1 ? 'Training' : 'Trainings'}
              </div>
              {g.items.map((s) => (
                <WorkoutRow
                  key={s.id}
                  s={s}
                  onOpen={() => {
                    setAll(false);
                    setOpen(s);
                  }}
                />
              ))}
            </div>
          ))}
          <p className="px-1 text-[11px] text-muted">kcal = grobe Schätzung (MET 5 × Körpergewicht × Dauer), keine Messung.</p>
        </div>
      </Sheet>
      {open && createPortal(<SessionComplete session={open} review onClose={() => setOpen(null)} />, document.body)}
    </section>
  );
}
