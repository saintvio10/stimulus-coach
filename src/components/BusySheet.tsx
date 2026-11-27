import { useMemo } from 'react';
import { Clock, Search } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/hooks';
import type { AppData, Session, SessionExercise } from '../lib/types';
import { busyAlternatives } from '../engine/alternatives';
import { adviseExercise } from '../engine/progression';
import { dateKey, fmtNum } from '../lib/utils';
import { ExerciseIcon } from './ExerciseAnimation';
import { Sheet } from './ui';

/** „Gerät besetzt“: später machen oder gleichwertige Alternative nur für heute – ohne die Übung zu pausieren */
export function BusySheet({ open, onClose, session, se, onOther, onDone }: { open: boolean; onClose: () => void; session: Session; se: SessionExercise; onOther?: () => void; /** nach Aktion; bei Tausch mit der uid der Zeile, in der die neue Übung steht */ onDone?: (uid?: string) => void }) {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const cur = s.exercises.find((e) => e.id === se.exerciseId);
  const pain = s.checkIns[dateKey()]?.pain;
  const alts = useMemo(
    () => (open ? busyAlternatives(s as unknown as AppData, session, se, pain) : []),
    [open, s.exercises, s.sessions, session, se, pain], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const prior = useMemo(() => s.sessions.filter((x) => x.id !== session.id), [s.sessions, session.id]);
  if (!cur) return null;
  const openLeft = session.exercises.filter((x) => x.uid !== se.uid && !x.skipped && x.sets.some((y) => !y.done)).length;
  return (
    <Sheet open={open} onClose={onClose} title={`${cur.name}: Gerät besetzt`}>
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-muted">Nur für heute – {cur.name} bleibt in deinem Plan und kommt beim nächsten Mal wieder.</p>
        {openLeft > 0 && (
          <button
            onClick={() => {
              s.deferExercise(session.id, se.uid);
              toast(`${cur.name} ans Ende verschoben`);
              onClose();
              onDone?.();
            }}
            className="flex items-center gap-3 rounded-2xl bg-raised px-3.5 py-3 text-left"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <Clock size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold">Später machen</span>
              <span className="block text-[12.5px] text-muted">Ans Ende verschieben – erst die {openLeft} anderen Übungen, vielleicht ist das Gerät dann frei.</span>
            </span>
          </button>
        )}
        {alts.length > 0 && <div className="label px-1 pt-1">Gleichwertig ersetzen</div>}
        {alts.map((a) => {
          const adv = adviseExercise(a.ex, prior, { settings: s.settings, checkIns: s.checkIns });
          return (
            <button
              key={a.ex.id}
              onClick={() => {
                const nu = s.swapExercise(session.id, se.uid, a.ex);
                s.patchExercise(session.id, nu, { reason: `Gerät besetzt (statt ${cur.name})` });
                toast(`Heute ${a.ex.name} statt ${cur.name}`);
                onClose();
                onDone?.(nu);
              }}
              className="flex items-center gap-3 rounded-2xl bg-raised px-3 py-2.5 text-left"
            >
              <ExerciseIcon id={a.ex.id} pattern={a.ex.pattern} muscles={a.ex.muscles} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{a.ex.name}</span>
                <span className="block text-[12px] leading-snug text-muted">{a.why}</span>
              </span>
              {a.known && adv.weight != null && <span className="tnum shrink-0 text-[12.5px] text-muted">{fmtNum(adv.weight)} kg</span>}
            </button>
          );
        })}
        {!alts.length && <p className="rounded-xl bg-raised px-3 py-2.5 text-[13px] text-muted">Keine gleichwertige Alternative gefunden (gesperrt, pausiert, heute schon im Plan oder belastet ein Gelenk mit Beschwerden).</p>}
        {onOther && (
        <button
          onClick={() => {
            onClose();
            onOther();
          }}
          className="flex h-11 items-center justify-center gap-2 rounded-full text-[13.5px] font-medium text-muted hover:text-fg"
        >
          <Search size={15} /> Andere Übung wählen
        </button>
        )}
      </div>
    </Sheet>
  );
}
