import { useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { useCompletion, usePlan, useToast } from '../lib/hooks';
import { Badge, Button, Card, Confirm, PageHeader, SectionTitle, Sheet } from '../components/ui';
import { QuickAvailability, SessionPreview } from '../components/Coach';
import type { Availability, Session } from '../lib/types';
import { MONTHS, WEEKDAYS_LONG, addDays, cn, dateKey, fmtNum, parseKey, relDayLabel, weekdayOf } from '../lib/utils';
import { sessionSets, sessionVolume } from '../engine/stats';
import { ExerciseIcon } from '../components/ExerciseAnimation';
import { ActivitySheet } from '../components/Extras';
import { INTENSITY, activityLabel } from '../engine/activities';

export default function CalendarPage() {
  const s = useStore();
  const plan = usePlan();
  const today = dateKey();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [day, setDay] = useState<string | null>(null);

  const first = dateKey(month);
  const offset = (weekdayOf(first) + 6) % 7; // Montag zuerst
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => {
    const n = i - offset;
    return n >= 0 && n < daysInMonth ? addDays(first, n) : null;
  });
  const availOf = (d: string): Availability => s.availability[d] ?? (s.settings.preferredDays.includes(weekdayOf(d)) ? 'maybe' : 'no');

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Kalender" sub="Verfügbarkeit & Plan" />
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <Button size="icon" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Vorheriger Monat">
            <ChevronLeft size={18} />
          </Button>
          <div className="text-[15px] font-semibold">
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </div>
          <Button size="icon" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Nächster Monat">
            <ChevronRight size={18} />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => (
            <div key={w} className="pb-1">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const a = availOf(d);
            const done = s.sessions.some((x) => x.date === d && x.status === 'done');
            const planned = plan.sessions.find((x) => x.date === d);
            const explicit = s.availability[d];
            return (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-[14px] font-medium transition',
                  d === today && 'ring-1 ring-fg/40',
                  explicit === 'yes' ? 'bg-accent/15 text-fg' : explicit === 'no' ? 'text-muted/50 line-through' : a === 'maybe' ? 'bg-raised/60 text-fg' : 'text-muted',
                  d < today && !done && 'opacity-50',
                )}
              >
                <span className="tnum">{Number(d.slice(8))}</span>
                <span className="flex h-1.5 gap-0.5">
                  {done && <span className="h-1.5 w-1.5 rounded-full bg-rec-green" />}
                  {planned && !done && <span className={cn('h-1.5 w-1.5 rounded-full', planned.tentative ? 'border border-accent' : 'bg-accent')} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted">
          <Legend className="bg-accent/40">Verfügbar</Legend>
          <Legend className="bg-raised">Möglich (Standardtag)</Legend>
          <Legend className="bg-rec-green">Trainiert</Legend>
          <Legend className="bg-accent">Geplant</Legend>
          <Legend className="border border-accent">Vorläufig</Legend>
        </div>
      </Card>

      <Card>
        <SectionTitle>Schnellauswahl</SectionTitle>
        <QuickAvailability />
      </Card>

      <Card>
        <SectionTitle>Plan der nächsten Tage</SectionTitle>
        <div className="mb-3 rounded-xl bg-raised px-3 py-2.5 text-[13px]">
          <span className="font-medium">{plan.strategy.label}:</span> <span className="text-muted">{plan.strategy.reason}</span>
        </div>
        {plan.notes.map((n) => (
          <p key={n} className="mb-2 text-[12px] text-muted">
            {n}
          </p>
        ))}
        <ul className="flex flex-col divide-y divide-line/[0.06]">
          {plan.sessions.map((p) => (
            <li key={p.date}>
              <button className="flex w-full items-center justify-between gap-3 py-3 text-left" onClick={() => setDay(p.date)}>
                <div>
                  <div className="text-[14px] font-medium">{p.label}</div>
                  <div className="text-[12px] text-muted">
                    {relDayLabel(p.date)} · ca. {p.estMinutes} min{p.tentative ? ' · vorläufig' : ''}
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-muted">
          Verpasste Tage werden nicht „nachgeholt“, sondern der Plan wird aus deiner tatsächlichen Historie rollierend neu berechnet.
        </p>
      </Card>

      <DaySheet day={day} onClose={() => setDay(null)} />
    </div>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-full', className)} />
      {children}
    </span>
  );
}

function DaySheet({ day, onClose }: { day: string | null; onClose: () => void }) {
  const s = useStore();
  const plan = usePlan();
  const toast = useToast((t) => t.show);
  const [del, setDel] = useState<Session | null>(null);
  const [act, setAct] = useState(false);
  if (!day) return null;
  const acts = (s.activities ?? []).filter((a) => a.date === day);
  const today = dateKey();
  const sessions = s.sessions.filter((x) => x.date === day && x.status === 'done');
  const planned = plan.sessions.find((x) => x.date === day);
  const cur = s.availability[day];
  const exName = (id: string) => s.exercises.find((e) => e.id === id)?.name ?? id;
  const set = (a: Availability | null, msg: string) => {
    s.setAvailability(day, a);
    toast(msg);
  };
  return (
    <Sheet open={!!day} onClose={onClose} title={`${WEEKDAYS_LONG[parseKey(day).getDay()]}, ${parseKey(day).getDate()}. ${MONTHS[parseKey(day).getMonth()]}`}>
      <div className="flex flex-col gap-5">
        {day >= today && (
          <div>
            <div className="label mb-2">Verfügbarkeit</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ['yes', 'Habe Zeit'],
                  ['maybe', 'Vielleicht'],
                  ['no', 'Keine Zeit'],
                ] as const
              ).map(([a, l]) => (
                <Button key={a} variant={cur === a ? 'primary' : 'secondary'} size="sm" onClick={() => set(a, `${relDayLabel(day)}: ${l}`)}>
                  {l}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => set(null, 'Zurückgesetzt')}>
                Standard
              </Button>
            </div>
          </div>
        )}
        {planned && (
          <div>
            <div className="label mb-2">
              Geplant: {planned.label} {planned.tentative && <Badge>vorläufig</Badge>}
            </div>
            <SessionPreview s={planned} />
          </div>
        )}
        {sessions.map((x) => (
          <div key={x.id} className="rounded-2xl bg-raised p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold">{x.title}</div>
                <div className="tnum text-[12px] text-muted">
                  {x.endedAt ? `${Math.round((x.endedAt - x.startedAt) / 60000)} min · ` : ''}
                  {sessionSets(x)} Sätze · {fmtNum(sessionVolume(x) / 1000, 1)} t{x.demo ? ' · Beispiel' : ''}
                </div>
                <button className="mt-1 text-[12.5px] font-semibold text-accent" onClick={() => useCompletion.getState().open(x.id)}>
                  Zusammenfassung ansehen →
                </button>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setDel(x)} aria-label="Training löschen">
                <Trash2 size={15} />
              </Button>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
              {x.exercises.map((e) => (
                <li key={e.uid} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <ExerciseIcon id={e.exerciseId} pattern={s.exercises.find((x) => x.id === e.exerciseId)?.pattern ?? 'curl'} size={30} />
                    <span className="truncate">{exName(e.exerciseId)}</span>
                  </span>
                  <span className="tnum shrink-0 text-muted">{e.skipped ? 'übersprungen' : e.sets.map((st) => `${fmtNum(st.weight)}×${st.reps}`).join(' · ')}</span>
                </li>
              ))}
            </ul>
            {x.prs && x.prs.length > 0 && <div className="mt-2 text-[12px] text-rec-yellow">{x.prs.join(' · ')}</div>}
          </div>
        ))}
        {!planned && !sessions.length && <p className="text-[13px] text-muted">Kein Training an diesem Tag.</p>}
        {day <= today && (
          <div>
            <div className="label mb-2">Aktivitäten</div>
            {acts.map((a) => (
              <div key={a.id} className="mb-1.5 flex items-center gap-2 rounded-xl bg-raised px-3 py-2 text-[13px]">
                <span className="flex-1">
                  {activityLabel(a)} <span className="text-muted">· {INTENSITY[a.intensity].label}</span>
                </span>
                <button aria-label="Aktivität löschen" onClick={() => s.removeActivity(a.id)} className="text-muted hover:text-fg">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setAct(true)}>
              + Aktivität (Ski, Spazieren …)
            </Button>
          </div>
        )}
      </div>
      <ActivitySheet key={day} open={act} onClose={() => setAct(false)} date={day} />
      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={() => {
          if (del) s.deleteSession(del.id);
          toast('Training gelöscht');
        }}
        title="Training löschen?"
        text="Die Einheit wird endgültig entfernt. Regeneration, Volumen und Empfehlungen werden neu berechnet."
        confirmLabel="Löschen"
        danger
      />
    </Sheet>
  );
}
