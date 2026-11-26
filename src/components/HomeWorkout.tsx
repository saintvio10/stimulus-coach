import { useMemo, useState } from 'react';
import { House } from 'lucide-react';
import { useStore } from '../lib/store';
import { useRouter } from '../lib/hooks';
import type { AppData } from '../lib/types';
import { planHome, type HomeMode } from '../engine/planner';
import { Button, Chip, Sheet } from './ui';
import { SessionPreview } from './Coach';
import { unlockAudio } from './RestTimer';
import { cn } from '../lib/utils';

/** Training ohne Gym: der Coach plant mit Körpergewicht (optional Hantel/Rucksack) passend zu Erholung und Wochenvolumen */
export function HomeWorkoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const go = useRouter((r) => r.go);
  const [minutes, setMinutes] = useState(45);
  const [mode, setMode] = useState<HomeMode>('bw');
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
                ['weights', 'Auch Gewichte', 'Kurzhantel, Rucksack, Flaschen'],
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
        <div className="flex flex-wrap gap-1.5">
          {[20, 30, 45, 60, 75].map((m) => (
            <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)} className="h-8">
              {m} Min
            </Chip>
          ))}
        </div>
        {plan ? <SessionPreview s={plan} /> : <p className="py-6 text-center text-[13px] text-muted">Gerade kein sinnvolles Training möglich – deine Muskeln brauchen noch Erholung.</p>}
        <p className="text-[11.5px] text-muted">
          Gewicht bei Körpergewicht-Übungen = Zusatzgewicht (leer lassen = ohne). Bei Hantel/Rucksack trägst du das echte Gewicht in 0,5–1-kg-Schritten ein. Unter „Übungen“ kannst du weitere eigene
          Übungen anlegen.
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
