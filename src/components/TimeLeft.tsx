import { useMemo, useState } from 'react';
import { Hourglass } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/hooks';
import type { AppData, Session } from '../lib/types';
import { planTrim } from '../engine/trim';
import { cn, fmtMin } from '../lib/utils';
import { Button, Chip, Sheet } from './ui';

/** „Zeit übrig“: laufendes Training kürzen – mit Vorschau vor der Übernahme */
export function TimeLeftButton({ session }: { session: Session }) {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(20);
  const trim = useMemo(() => (open ? planTrim(s as unknown as AppData, session, min) : null), [open, min, session, s.sessions, s.exercises]); // eslint-disable-line react-hooks/exhaustive-deps
  const openSets = session.exercises.reduce((a, e) => a + (e.skipped ? 0 : e.sets.filter((x) => !x.done).length), 0);
  if (!openSets) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line/10 px-3 text-[12.5px] font-medium text-muted hover:text-fg">
        <Hourglass size={13} /> Zeit übrig? Training anpassen
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Wie viel Zeit hast du noch?"
        footer={
          trim && (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!trim.dropped}
              onClick={() => {
                s.trimSession(session.id, Object.fromEntries(trim.items.map((i) => [i.uid, i.keep])));
                toast(`Angepasst: ${trim.dropped} Sätze ausgelassen – die nächsten Einheiten rechnen mit der erledigten Arbeit`);
                setOpen(false);
              }}
            >
              {trim.dropped ? `Übernehmen (${trim.dropped} ${trim.dropped === 1 ? 'Satz' : 'Sätze'} weniger)` : 'Passt – alles schaffbar'}
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {[10, 15, 20, 30, 45, 60].map((m) => (
              <Chip key={m} active={min === m} onClick={() => setMin(m)} className="h-9">
                {fmtMin(m)}
              </Chip>
            ))}
          </div>
          {trim && (
            <>
              <p className="text-[13px] text-muted">
                Vorschau für {fmtMin(min)}: ~{fmtMin(trim.estMin)} mit Pausen, Gerätewechseln und – bei einseitigen Übungen – beiden Seiten. Zuerst bleibt je eine Übung für Grundbewegungen, die sonst diese Woche ganz
                ausfallen würden (letzte 7 Tage + nächster sicherer Termin); danach zählt, was nach deinen Prioritäten, dem offenen Wochenvolumen und dem heute schon Erledigten am meisten bringt.
              </p>
              {trim.warnings.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-xl bg-rec-orange/10 px-3 py-2.5 text-[12.5px]">
                  <div className="font-medium">Versorgungslücke</div>
                  {trim.warnings.map((w) => (
                    <div key={w} className="text-muted">
                      {w}
                    </div>
                  ))}
                </div>
              )}
              <ul className="flex flex-col gap-1.5">
                {trim.items.map((i) => (
                  <li key={i.uid} className={cn('rounded-xl px-3 py-2.5 text-[13px]', i.keep === i.open ? 'bg-raised' : i.keep === 0 ? 'bg-rec-orange/10' : 'bg-accent/10')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{i.name}</span>
                      <span className="tnum shrink-0 text-[12.5px]">
                        {i.keep === i.open ? `${i.open} ${i.open === 1 ? 'Satz' : 'Sätze'}` : i.keep === 0 ? `entfällt (${i.open})` : `${i.open} → ${i.keep} Sätze`}
                      </span>
                    </div>
                    {i.note && <div className="mt-0.5 text-[12px] text-muted">{i.note}</div>}
                  </li>
                ))}
              </ul>
              <p className="text-[11.5px] text-muted">Wegfallende Sätze werden als „ausgelassen“ dokumentiert (Rückgängig an der Übung möglich). Die nächsten Trainings werden anhand der tatsächlich erledigten Belastung neu berechnet; komplett entfallene Übungen werden bevorzugt nachgeholt.</p>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
