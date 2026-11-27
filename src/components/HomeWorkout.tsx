import { useMemo, useState } from 'react';
import { House } from 'lucide-react';
import { useStore } from '../lib/store';
import { useRouter } from '../lib/hooks';
import type { AppData } from '../lib/types';
import { planHome, type HomeMode } from '../engine/planner';
import { Button, Chip, Sheet } from './ui';
import { SessionPreview } from './Coach';
import { unlockAudio } from './RestTimer';
import { cn, fmtMin } from '../lib/utils';

/** Training ohne Gym: der Coach plant mit Körpergewicht (optional deine Hantel und Flaschen) passend zu Erholung und Wochenvolumen */
export function HomeWorkoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const go = useRouter((r) => r.go);
  const [minutes, setMinutes] = useState(45);
  const [mode, setMode] = useState<HomeMode>('weights');
  const plan = useMemo(
    () => (open ? planHome(s as unknown as AppData, minutes, mode) : null),
    [open, minutes, mode, s.sessions, s.exercises, s.settings, s.checkIns, s.activities], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const active = s.sessions.some((x) => x.status === 'active');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Training ohne Gym"
      footer={
        plan ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => {
              unlockAudio();
              s.startSession(plan, undefined, 'home');
              onClose();
              go('training');
            }}
          >
            {active ? 'Neu starten (ersetzt laufendes Training)' : 'Unterwegs-Training starten'}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-muted">
          Der Coach plant wie im Studio nach Erholung und Wochenvolumen – nur mit Übungen, die überall gehen. Liegestütze & Co. bis nah ans Versagen (1–2 Wdh. Reserve) bauen genauso Muskeln auf; die
          Sätze zählen ganz normal fürs Wochenvolumen.
        </p>
        <div>
          <div className="label mb-2">Was hast du dabei?</div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['bw', 'Nur Körpergewicht', 'Liegestütze, Dips, Split Squats …'],
                ['weights', 'Hantel & Flaschen', `Hantel ${s.settings.homeDumbbell ?? 10} kg · Flaschen à ${s.settings.homeBottle ?? 1} kg`],
              ] as const
            ).map(([v, t, sub]) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                className={cn('rounded-2xl border p-3 text-left transition', mode === v ? 'border-accent/60 bg-accent/12' : 'border-line/10 bg-raised')}
              >
                <div className="text-[14px] font-semibold">{t}</div>
                <div className="mt-0.5 text-[11.5px] text-muted">{sub}</div>
              </button>
            ))}
          </div>
        </div>
        {mode === 'weights' && (
          <div className="flex items-center justify-between rounded-xl bg-raised px-3 py-2">
            <span className="text-[13px]">Gewicht deiner Hantel</span>
            <div className="flex items-center gap-2">
              <button className="grid h-8 w-8 place-items-center rounded-full bg-bg text-[16px]" aria-label="Hantel leichter" onClick={() => s.mutate((d) => void (d.settings.homeDumbbell = Math.max(1, (d.settings.homeDumbbell ?? 10) - 1)))}>
                −
              </button>
              <span className="tnum w-14 text-center text-[15px] font-semibold">{s.settings.homeDumbbell ?? 10} kg</span>
              <button className="grid h-8 w-8 place-items-center rounded-full bg-bg text-[16px]" aria-label="Hantel schwerer" onClick={() => s.mutate((d) => void (d.settings.homeDumbbell = (d.settings.homeDumbbell ?? 10) + 1))}>
                +
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {[20, 30, 45, 60, 75].map((m) => (
            <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)} className="h-8">
              {fmtMin(m)}
            </Chip>
          ))}
        </div>
        {plan ? <SessionPreview s={plan} /> : <p className="py-6 text-center text-[13px] text-muted">Gerade kein sinnvolles Training möglich – deine Muskeln brauchen noch Erholung.</p>}
        <p className="text-[11.5px] text-muted">
          Gewichtsauswahl unterwegs: 1 Flasche, 2 Flaschen oder deine Hantel. Bei Körpergewicht-Übungen ist das Zusatzgewicht (leer = ohne). Tage ohne Gym kannst du auch vorab markieren:
          in der Tagesleiste zweimal antippen (🏠) – dann plant der Coach diese Tage automatisch so und der Studio-Plan läuft danach weiter.
        </p>
      </div>
    </Sheet>
  );
}

export function HomeWorkoutButton({ className, label = 'Ohne Gym trainieren' }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border border-line/10 px-3.5 text-[12.5px] font-medium text-muted hover:text-fg', className)}
      >
        <House size={13} /> {label}
      </button>
      <HomeWorkoutSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
