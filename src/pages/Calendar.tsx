import { useState } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { useCompletion, usePlan, useToast } from '../lib/hooks';
import { Badge, Button, Card, Confirm, PageHeader, SectionTitle, Sheet, Switch } from '../components/ui';
import { DayDuration, SessionPreview } from '../components/Coach';
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
  // Wochen untereinander statt Monaten: ab der aktuellen Woche 5 Wochen (über den Monatswechsel hinweg),
  // „Frühere Wochen“ / „Weitere Wochen“ erweitern
  const [past, setPast] = useState(0);
  const [ahead, setAhead] = useState(4);
  const [day, setDay] = useState<string | null>(null);
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  const weeks = Array.from({ length: past + 1 + ahead }, (_, i) => addDays(monday, (i - past) * 7));
  const away = new Set(s.awayDays ?? []);

  const cell = (d: string) => {
    const explicit = s.availability[d];
    const done = s.sessions.some((x) => x.date === d && x.status === 'done');
    const planned = plan.sessions.find((x) => x.date === d && !x.rest);
    const rest = plan.restDays?.find((r) => r.date === d);
    const past = d < today;
    // gleiche Farben wie die Wochenleiste auf der Startseite
    const look = done ? 'done' : past ? 'past' : rest && explicit !== 'no' ? 'rest' : explicit === 'yes' ? (away.has(d) ? 'away' : 'yes') : explicit === 'maybe' ? 'maybe' : explicit === 'no' ? 'no' : 'open';
    const firstOfMonth = d.slice(8) === '01';
    return (
      <button
        key={d}
        onClick={() => setDay(d)}
        aria-label={`${relDayLabel(d)}: ${LOOK_LABEL[look]}${planned ? ' · Training geplant' : ''}`}
        className={cn(
          'relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border text-[14px] font-medium transition active:scale-95',
          look === 'done'
            ? 'border-rec-green/50 bg-rec-green/[0.16] text-fg'
            : look === 'yes'
              ? 'border-rec-green/40 bg-rec-green/[0.08] text-fg'
              : look === 'away'
                ? 'border-sky-400/45 bg-sky-400/[0.09] text-fg'
                : look === 'maybe'
                  ? 'border-rec-yellow/40 bg-rec-yellow/[0.07] text-fg'
                  : look === 'no'
                    ? 'border-rec-red/35 bg-rec-red/[0.07] text-muted'
                    : look === 'rest'
                      ? 'border-[#8b7cf6]/45 bg-[linear-gradient(180deg,rgba(139,124,246,0.18),rgba(139,124,246,0.04))] text-fg'
                      : look === 'past'
                        ? 'border-transparent text-muted/45'
                        : 'border-line/[0.06] bg-surface text-muted',
          d === today && 'ring-2 ring-fg/30',
        )}
      >
        {firstOfMonth && <span className="absolute left-1 top-0.5 text-[8.5px] font-semibold uppercase text-accent">{MONTHS[parseKey(d).getMonth()].slice(0, 3)}</span>}
        <span className="tnum">{Number(d.slice(8))}</span>
        <span className="flex h-1.5 items-center gap-0.5">
          {done ? (
            <span className="h-1.5 w-1.5 rounded-full bg-rec-green" />
          ) : planned ? (
            <span className={cn('h-1.5 w-1.5 rounded-full', planned.tentative ? 'border border-accent' : 'bg-accent')} />
          ) : look === 'rest' ? (
            <span className="text-[8px] leading-none text-[#c4b9ff]">☾</span>
          ) : null}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Kalender" sub="Verfügbarkeit & Plan" />
      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <button onClick={() => setPast(past + 4)} className="-mt-1 self-center rounded-full bg-raised px-3.5 py-1.5 text-[12.5px] font-medium text-muted hover:text-fg">
          ↑ Frühere Wochen
        </button>
        <div className="flex flex-col gap-1">
          {weeks.map((w) => {
            const days = Array.from({ length: 7 }, (_, i) => addDays(w, i));
            const monthStart = days.find((x) => x.slice(8) === '01');
            return (
              <div key={w} className="flex flex-col gap-1">
                {(w === weeks[0] || monthStart) && (
                  <div className="px-0.5 pt-1 text-[13px] font-semibold">
                    {MONTHS[parseKey(monthStart ?? w).getMonth()]} {parseKey(monthStart ?? w).getFullYear()}
                  </div>
                )}
                <div className="grid grid-cols-7 gap-1">{days.map(cell)}</div>
              </div>
            );
          })}
        </div>
        <button onClick={() => setAhead(ahead + 4)} className="self-center rounded-full bg-raised px-3.5 py-1.5 text-[12.5px] font-medium text-muted hover:text-fg">
          Weitere Wochen ↓
        </button>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted">
          <Legend className="border border-rec-green/60 bg-rec-green/20">Zeit</Legend>
          <Legend className="border border-sky-400/60 bg-sky-400/20">Ohne Gym</Legend>
          <Legend className="border border-rec-yellow/60 bg-rec-yellow/20">Vielleicht</Legend>
          <Legend className="border border-rec-red/50 bg-rec-red/15">Keine Zeit</Legend>
          <Legend className="border border-[#8b7cf6]/60 bg-[#8b7cf6]/25">Ruhetag</Legend>
          <Legend className="bg-rec-green">Trainiert</Legend>
          <Legend className="bg-accent">Training geplant</Legend>
          <Legend className="border border-accent">Vorläufig</Legend>
        </div>
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

const LOOK_LABEL: Record<string, string> = { done: 'trainiert', yes: 'Zeit', away: 'Zeit ohne Gym', maybe: 'vielleicht', no: 'keine Zeit', rest: 'Ruhetag', past: 'vergangen', open: 'offen' };

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
            <div className="mt-3 flex items-center justify-between rounded-xl bg-raised px-3 py-2.5">
              <div>
                <div className="text-[13.5px] font-medium">🏠 Ohne Gym (unterwegs)</div>
                <div className="text-[11.5px] text-muted">Plan nur mit Körpergewicht, Hantel & Flaschen</div>
              </div>
              <Switch
                id="cal-away"
                checked={(s.awayDays ?? []).includes(day)}
                onChange={(v) => {
                  s.setAway(day, v);
                  toast(v ? `${relDayLabel(day)}: ohne Gym` : `${relDayLabel(day)}: im Studio`);
                }}
                label="Ohne Gym"
              />
            </div>
          </div>
        )}
        {planned && (
          <div>
            <div className="label mb-2">
              Geplant: {planned.label} {planned.tentative && <Badge>vorläufig</Badge>}
            </div>
            <div className="mb-3">
              <DayDuration date={day} plan={planned} />
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
