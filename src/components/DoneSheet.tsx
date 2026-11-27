import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/hooks';
import type { AppData, Session } from '../lib/types';
import { extraSuggestions } from '../engine/extra';
import { fmtMin } from '../lib/utils';
import { ExerciseIcon } from './ExerciseAnimation';
import { Button, Chip, Sheet } from './ui';

/** Alle Sätze erledigt: beenden – oder bei „Noch Zeit?“ passende Zusatzübungen (Plan + Erholung) hinzufügen */
export function DoneSheet({ open, session, onClose, onFinish, onAdded }: { open: boolean; session: Session; onClose: () => void; onFinish: () => void; onAdded: (uid: string) => void }) {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const [extra, setExtra] = useState<number | null>(null);
  const total = session.exercises.filter((e) => !e.skipped).reduce((a, e) => a + e.sets.length, 0);
  const mins = Math.max(1, Math.round((Date.now() - session.startedAt) / 60_000));
  const sug = useMemo(() => (open && extra ? extraSuggestions(s as unknown as AppData, session, extra) : null), [open, extra, session, s.sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = (items: NonNullable<typeof sug>['items']) => {
    let last = '';
    for (const it of items) {
      s.addExerciseToSession(session.id, it.ex, undefined, it.sets);
      last = useStore.getState().sessions.find((x) => x.id === session.id)?.exercises.slice(-1)[0]?.uid ?? last;
    }
    toast(items.length === 1 ? `${items[0].ex.name} hinzugefügt` : `${items.length} Übungen hinzugefügt`);
    setExtra(null);
    onClose();
    if (last) onAdded(last);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Training geschafft! 🎉">
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-muted">
          Alle {total} Sätze erledigt in {fmtMin(mins)}.
        </p>
        <Button variant="primary" size="lg" className="h-14" onClick={onFinish}>
          Training beenden & Auswertung
        </Button>
        <div className="rounded-2xl bg-raised p-3.5">
          <div className="text-[14px] font-semibold">Noch Zeit?</div>
          <p className="mt-0.5 text-[12.5px] text-muted">Die App schlägt Übungen vor, die zu deinem Wochenplan und deiner Erholung passen – nichts, was heute schon dran war oder in den nächsten 2 Tagen geplant ist.</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[10, 15, 20, 30].map((m) => (
              <Chip key={m} active={extra === m} onClick={() => setExtra(extra === m ? null : m)} className="h-9">
                +{m} min
              </Chip>
            ))}
          </div>
          {sug && (
            <div className="mt-3 flex flex-col gap-2">
              {sug.items.length ? (
                <>
                  {sug.items.map((it) => (
                    <div key={it.ex.id} className="flex items-center gap-3 rounded-xl bg-bg p-2.5">
                      <ExerciseIcon id={it.ex.id} pattern={it.ex.pattern} muscles={it.ex.muscles} size={42} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-semibold">{it.ex.name}</div>
                        <div className="text-[12px] text-muted">
                          {it.sets} Sätze · ~{fmtMin(it.minutes)}
                        </div>
                        <div className="text-[11.5px] leading-snug text-muted/90">{it.why}</div>
                      </div>
                      <button onClick={() => add([it])} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fg text-bg" aria-label={`${it.ex.name} hinzufügen`}>
                        <Plus size={17} />
                      </button>
                    </div>
                  ))}
                  {sug.items.length > 1 && (
                    <Button variant="secondary" onClick={() => add(sug.items)}>
                      Alle hinzufügen (~{fmtMin(sug.minutes)})
                    </Button>
                  )}
                </>
              ) : (
                <p className="rounded-xl bg-bg px-3 py-2.5 text-[13px] text-muted">Heute nichts Sinnvolles mehr: Die offenen Muskeln sind entweder schon trainiert, noch ermüdet oder bald im Plan. Mehr bringt diese Woche wenig – gut erholen.</p>
              )}
              {sug.skipped.length > 0 && <p className="text-[11.5px] text-muted">Nicht vorgeschlagen: {sug.skipped.join(' · ')}</p>}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
