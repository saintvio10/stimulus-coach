import { useMemo, useState } from 'react';
import { exerciseImage } from '../data/exerciseImages';
import { CalendarDays, ChevronRight, Clock, Dumbbell, Layers, Play, Search, SlidersHorizontal } from 'lucide-react';
import { useStore } from '../lib/store';
import { useRouter, useSearch, useToast } from '../lib/hooks';
import type { AppData, AnimPattern, Availability } from '../lib/types';
import type { Plan, PlannedSession, TemplateId } from '../engine/planner';
import { planTemplate, planToday, PLAN_DAYS } from '../engine/planner';
import { MUSCLE } from '../lib/muscles';
import { readinessLabel, readinessScore } from '../engine/readiness';
import { addDays, cn, dateKey, fmtNum, relDayLabel, weekdayOf, WEEKDAYS_SHORT, WEEKDAYS_LONG, MONTHS } from '../lib/utils';
import { Badge, Button, Chip, Ring, Sheet } from './ui';
import { ExerciseAnimation, ExerciseIcon } from './ExerciseAnimation';
import { SwipeToStart } from './SwipeToStart';
import { PlanReasons, SessionPreview, CheckInSheet, QuickAvailability } from './Coach';
import { useStartScreen } from './StartScreen';
import { unlockAudio } from './RestTimer';
import { RECOVERY_COLORS } from '../lib/muscles';
import { sessionSets } from '../engine/stats';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function HomeHeader() {
  const s = useStore();
  const go = useRouter((r) => r.go);
  const openSearch = useSearch((x) => x.set);
  const [checkIn, setCheckIn] = useState(false);
  const readiness = readinessScore(s.checkIns[dateKey()]);
  const rl = readinessLabel(readiness);
  const d = new Date();
  const initials = s.profile.name ? s.profile.name.trim().slice(0, 1).toUpperCase() : null;
  return (
    <header className="flex items-center justify-between gap-3 pt-2">
      <div className="min-w-0">
        <div className="truncate text-[20px] leading-tight">
          {greeting()}
          {s.profile.name ? <span className="font-semibold">, {s.profile.name}!</span> : '!'}
        </div>
        <div className="truncate text-[13px] text-muted">
          {WEEKDAYS_SHORT[d.getDay()]}, {d.getDate()}. {MONTHS[d.getMonth()]}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-line/[0.08] bg-surface p-1">
        <button onClick={() => setCheckIn(true)} aria-label="Bereitschaft / Check-in" className="grid h-10 w-10 place-items-center rounded-full hover:bg-raised">
          <Ring value={(readiness ?? 0) / 100} size={34} stroke={3.5} color={RECOVERY_COLORS[rl.tone === 'gray' ? 'gray' : rl.tone]}>
            <span className="tnum text-[10.5px] font-semibold">{readiness ?? '–'}</span>
          </Ring>
        </button>
        <button onClick={() => openSearch(true)} aria-label="Suchen" className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg">
          <Search size={18} />
        </button>
        <button
          onClick={() => go('profil')}
          aria-label="Profil"
          className="grid h-10 w-10 place-items-center rounded-full bg-[conic-gradient(from_180deg,rgb(var(--accent)),rgb(var(--hl)),rgb(var(--rec-green)),rgb(var(--accent)))] p-[2px]"
        >
          <span className="grid h-full w-full place-items-center rounded-full bg-raised text-[14px] font-semibold">{initials ?? '•'}</span>
        </button>
      </div>
      <CheckInSheet open={checkIn} onClose={() => setCheckIn(false)} />
    </header>
  );
}


/** Wochenleiste: Tag auswählen, Zeit / keine Zeit erkennbar */
export function DayPicker({ plan, selected, onSelect }: { plan: Plan; selected: string; onSelect: (d: string) => void }) {
  const s = useStore();
  const go = useRouter((r) => r.go);
  const openStart = useStartScreen((x) => x.set);
  const toast = useToast((t) => t.show);
  const today = dateKey();
  const days = Array.from({ length: PLAN_DAYS }, (_, i) => addDays(today, i));
  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-semibold tracking-tight">Wann hast du Zeit?</h2>
          <div className="text-[12px] text-muted">Tag antippen – der Plan passt sich an</div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => openStart(true)} aria-label="Verfügbarkeit planen" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg">
            <SlidersHorizontal size={18} />
          </button>
          <button onClick={() => go('kalender')} aria-label="Kalender" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg">
            <CalendarDays size={18} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const a = s.availability[d] ?? 'maybe'; // nicht gewählt = neutral
          const done = s.sessions.some((x) => x.date === d && x.status === 'done');
          const planned = plan.sessions.find((x) => x.date === d);
          const rest = plan.restDays?.find((x) => x.date === d);
          const isToday = d === today;
          return (
            <button
              key={d}
              onClick={() => {
                const next: Availability = a === 'yes' ? 'no' : 'yes';
                s.setAvailability(d, next);
                try {
                  navigator.vibrate?.(10);
                } catch {
                  /* ignore */
                }
                toast(`${relDayLabel(d)}: ${next === 'yes' ? 'Zeit ✓ – Plan wird neu berechnet' : 'keine Zeit'}`);
              }}
              aria-pressed={a === 'yes'}
              aria-label={`${relDayLabel(d)}: ${a === 'yes' ? 'Zeit' : a === 'no' ? 'keine Zeit' : 'offen'} – tippen zum Umschalten`}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-full border pb-3 pt-3 transition active:scale-95',
                a === 'yes' ? 'border-rec-green/40 bg-rec-green/[0.08]' : a === 'no' ? 'border-rec-red/35 bg-rec-red/[0.07]' : 'border-line/[0.07] bg-surface',
                isToday && 'ring-2 ring-fg/25',
              )}
            >
              <span className={cn('text-[11px] font-medium', a === 'maybe' ? 'text-muted' : 'text-fg')}>{isToday ? 'Heute' : WEEKDAYS_SHORT[weekdayOf(d)]}</span>
              <span className={cn('tnum text-[17px] font-semibold leading-none', a === 'yes' ? 'text-fg' : a === 'no' ? 'text-rec-red/80' : 'text-muted')}>{Number(d.slice(8))}</span>
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full transition',
                  a === 'yes'
                    ? 'bg-rec-green shadow-[0_0_8px_2px_rgb(var(--rec-green)/0.75),0_0_18px_4px_rgb(var(--rec-green)/0.35)]'
                    : a === 'no'
                      ? 'bg-rec-red shadow-[0_0_8px_2px_rgb(var(--rec-red)/0.75),0_0_18px_4px_rgb(var(--rec-red)/0.35)]'
                      : 'bg-line/15',
                )}
              />
              {rest && !done && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-[#3b4a6b] px-1.5 text-[8.5px] font-bold uppercase leading-[14px] text-[#c9d6ff]">
                  Ruhe
                </span>
              )}
              {(done || planned) && (
                <span
                  className={cn(
                    'absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[8.5px] font-bold uppercase leading-[14px]',
                    done ? 'bg-rec-green text-bg' : planned!.tentative ? 'bg-raised text-muted' : 'bg-accent text-bg',
                  )}
                >
                  {done ? '✓' : planned!.tentative ? 'evtl.' : 'Plan'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rec-green shadow-[0_0_6px_2px_rgb(var(--rec-green)/0.6)]" /> Zeit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rec-red shadow-[0_0_6px_2px_rgb(var(--rec-red)/0.6)]" /> keine Zeit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-line/20" /> offen
        </span>
      </div>
    </section>
  );
}

export function DayHero({ plan, day, onNext }: { plan: Plan; day: string; onNext: (d: string) => void }) {
  const s = useStore();
  const data = s as unknown as AppData;
  const go = useRouter((r) => r.go);
  const toast = useToast((t) => t.show);
  const [why, setWhy] = useState(false);
  const [all, setAll] = useState(false);
  const today = dateKey();
  const isToday = day === today;
  const active = s.sessions.find((x) => x.status === 'active');
  const doneHere = s.sessions.filter((x) => x.date === day && x.status === 'done');
  const planned = plan.sessions.find((p) => p.date === day) ?? null;
  const restHere = plan.restDays?.find((r) => r.date === day);
  const nextPlanned = plan.sessions.find((p) => p.date > day);
  const avail: Availability = s.availability[day] ?? (s.settings.preferredDays.includes(weekdayOf(day)) ? 'maybe' : 'no');
  const exMap = new Map(s.exercises.map((e) => [e.id, e]));
  const lead = planned?.exercises[0] ? exMap.get(planned.exercises[0].exerciseId) : undefined;

  const start = (p: PlannedSession | null) => {
    unlockAudio();
    s.startSession(p ?? planToday(data));
    go('training');
  };
  const setAvail = (a: Availability) => {
    s.setAvailability(day, a);
    toast(a === 'yes' ? `${relDayLabel(day)}: Zeit – Plan wird neu berechnet` : a === 'no' ? `${relDayLabel(day)}: keine Zeit` : `${relDayLabel(day)}: vielleicht`);
  };

  const availBar = (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-black/30 p-1 backdrop-blur">
      {(
        [
          ['yes', 'Ich habe Zeit'],
          ['no', 'Keine Zeit'],
        ] as const
      ).map(([v, l]) => (
        <button
          key={v}
          onClick={() => setAvail(v)}
          className={cn('h-10 rounded-full px-3 text-[13.5px] font-semibold transition', avail === v ? (v === 'no' ? 'bg-rec-red text-bg shadow-[0_0_14px_rgb(var(--rec-red)/0.55)]' : 'bg-rec-green text-bg shadow-[0_0_14px_rgb(var(--rec-green)/0.55)]') : 'text-fg/70')}
        >
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-line/[0.08] bg-[linear-gradient(160deg,rgb(var(--raised)),rgb(var(--surface))_55%)]">
      {/* Hintergrundmotiv */}
      {lead && exerciseImage(lead.id) ? (
        <img
          src={exerciseImage(lead.id)}
          alt=""
          className="pointer-events-none absolute -right-6 -top-2 h-52 w-52 object-cover opacity-30 [mask-image:radial-gradient(circle_at_60%_40%,#000_35%,transparent_70%)]"
        />
      ) : lead ? (
        <div className="pointer-events-none absolute -right-12 top-2 h-44 w-60 opacity-[0.12]">
          <ExerciseAnimation pattern={lead.pattern} className="h-full w-full" />
        </div>
      ) : null}
      <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[15px] font-medium text-fg/80">
            {isToday ? 'Heute' : `${WEEKDAYS_LONG[weekdayOf(day)]}, ${Number(day.slice(8))}.`}
            {!isToday && (
              <button onClick={() => onNext(today)} className="rounded-full bg-fg/10 px-2.5 py-1 text-[12px] font-semibold text-fg">
                ← Heute
              </button>
            )}
          </span>
          {planned && <Badge tone="accent">{plan.strategy.label.toUpperCase()}</Badge>}
        </div>

        {active && isToday ? (
          <>
            <h2 className="text-[26px] font-semibold leading-tight">{active.title}</h2>
            <p className="text-[13px] text-muted">Training läuft · {active.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0)} Sätze erledigt</p>
            <Button variant="primary" size="lg" className="h-14" onClick={() => go('training')}>
              <Play size={16} /> Fortsetzen
            </Button>
          </>
        ) : doneHere.length ? (
          <>
            <h2 className="text-[26px] font-semibold leading-tight">{doneHere[0].title} ✓</h2>
            <p className="text-[13px] text-muted">
              Erledigt · {sessionSets(doneHere[0])} Sätze{doneHere[0].endedAt ? ` · ${Math.round((doneHere[0].endedAt - doneHere[0].startedAt) / 60000)} min` : ''}. Die
              nächste Einheit berücksichtigt dieses Training bereits.
            </p>
            {nextPlanned && (
              <Button variant="secondary" onClick={() => onNext(nextPlanned.date)}>
                Nächste Einheit: {relDayLabel(nextPlanned.date)} <ChevronRight size={15} />
              </Button>
            )}
          </>
        ) : planned && !planned.rest ? (
          <>
            <div>
              <div className="text-[13px] text-muted">{isToday ? 'Deine Empfehlung' : planned.tentative ? 'Vorläufig geplant' : 'Geplant'}</div>
              <h2 className="mt-0.5 text-[28px] font-semibold leading-[1.1] tracking-tight">{planned.label}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill icon={<Clock size={14} />}>~{planned.estMinutes} Min</Pill>
              <Pill icon={<Dumbbell size={14} />}>{planned.exercises.length} Übungen</Pill>
              <Pill icon={<Layers size={14} />}>{planned.exercises.reduce((a, p) => a + p.sets, 0)} Sätze</Pill>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {planned.decisions
                .filter((d) => d.sets >= 1)
                .sort((a, b) => b.sets - a.sets)
                .map((d) => (
                  <span key={d.muscle} className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-medium', d.status === 'focus' ? 'bg-[rgb(var(--hl)/0.15)] text-[rgb(var(--hl))]' : 'bg-fg/[0.07] text-fg/75')}>
                    {MUSCLE[d.muscle].short} <span className="tnum opacity-70">{fmtNum(d.sets)}</span>
                  </span>
                ))}
            </div>
            <ul className="flex flex-col gap-1">
              {(all ? planned.exercises : planned.exercises.slice(0, 4)).map((p, i) => {
                const ex = exMap.get(p.exerciseId);
                if (!ex) return null;
                return (
                  <li key={p.exerciseId} className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
                    <div className="relative">
                      <ExerciseIcon id={ex.id} pattern={ex.pattern} muscles={ex.muscles} size={46} />
                      <span className="tnum absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-bg text-[10px] font-semibold text-muted ring-1 ring-line/10">{i + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate text-[14px] font-medium">
                        {ex.name}
                        {p.superset && <Badge tone="accent">{p.superset}</Badge>}
                      </div>
                      <div className="tnum text-[12px] text-muted">
                        {p.sets} × {p.repMin}–{p.repMax} · RIR {p.targetRir}
                        {p.recWeight != null && ` · ${fmtNum(p.recWeight)} kg`}
                        {p.advice.type === 'increase' && <span className="ml-1 text-rec-green">↑</span>}
                        {p.advice.type === 'deload' && <span className="ml-1 text-rec-orange">↓</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-4 text-[13px] font-medium">
              {planned.exercises.length > 4 && (
                <button className="text-accent" onClick={() => setAll(!all)}>
                  {all ? 'Weniger anzeigen' : `Alle ${planned.exercises.length} Übungen`}
                </button>
              )}
              <button className="text-muted hover:text-fg" onClick={() => setWhy(!why)}>
                Warum diese Auswahl?
              </button>
            </div>
            {why && <PlanReasons s={planned} />}
            <div className="flex items-center gap-2">
              {isToday ? (
                <SwipeToStart onComplete={() => start(planned)} />
              ) : (
                <div className="flex-1 text-[12.5px] text-muted">Wird automatisch neu berechnet, wenn sich Training oder Verfügbarkeit ändern.</div>
              )}
              {nextPlanned && (
                <button
                  onClick={() => onNext(nextPlanned.date)}
                  className="flex h-14 shrink-0 items-center gap-1 rounded-full bg-fg/[0.08] px-5 text-[15px] font-medium hover:bg-fg/[0.12]"
                >
                  Weiter <ChevronRight size={16} />
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[24px] font-semibold leading-tight">
              {avail === 'no' ? 'Keine Zeit – kein Training' : restHere || planned?.rest ? 'Ruhetag empfohlen 🌙' : 'Kein Training geplant'}
            </h2>
            <p className="text-[13px] text-muted">
              {restHere && avail !== 'no'
                ? restHere.reason
                : avail === 'no'
                ? 'Der Plan verteilt dein Volumen auf die anderen Tage.'
                : planned?.rest
                  ? 'Laut Schätzung sind die relevanten Muskeln noch stark ermüdet.'
                  : `Bei ${s.settings.sessionsPerWeek}× pro Woche wird dieser Tag gerade nicht gebraucht.${nextPlanned ? ` Nächste Einheit: ${relDayLabel(nextPlanned.date)}.` : ''}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {isToday && avail !== 'no' && (
                <Button variant="primary" onClick={() => start(null)}>
                  Heute trotzdem trainieren
                </Button>
              )}
              {nextPlanned && (
                <Button variant="secondary" onClick={() => onNext(nextPlanned.date)}>
                  Nächste Einheit <ChevronRight size={15} />
                </Button>
              )}
            </div>
          </>
        )}

        {!(active && isToday) && !doneHere.length && (
          <div className="flex flex-col gap-2 border-t border-line/[0.07] pt-3">
            <span className="text-[12px] text-muted">{isToday ? 'Hast du heute Zeit?' : `Hast du ${relDayLabel(day).split(',')[0]} Zeit?`}</span>
            {availBar}
          </div>
        )}
      </div>
    </section>
  );
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="tnum inline-flex h-8 items-center gap-1.5 rounded-full bg-fg/[0.07] px-3 text-[12.5px] font-medium text-fg/85 backdrop-blur">
      {icon}
      {children}
    </span>
  );
}

const QUICK: { id: TemplateId; title: string; pattern: AnimPattern; sub: string; img: string }[] = [
  { id: 'full', img: 'leg-press', title: 'Ganzkörper', pattern: 'legPress', sub: 'Alles in einer Einheit' },
  { id: 'arms', img: 'preacher-curl', title: 'Arme & Schultern', pattern: 'curl', sub: 'Prioritäten 1–3' },
  { id: 'push', img: 'incline-press', title: 'Push', pattern: 'inclinePress', sub: 'Brust · Trizeps · Schulter' },
  { id: 'pull', img: 'lat-pulldown', title: 'Pull', pattern: 'pulldown', sub: 'Rücken · Bizeps · hint. Schulter' },
  { id: 'legsPlus', img: 'rdl', title: 'Legs+', pattern: 'rdl', sub: 'Beine + Arme/Schulter' },
  { id: 'upper', img: 'chest-supported-row', title: 'Oberkörper', pattern: 'row', sub: 'Komplett ohne Beine' },
];

export function QuickStart() {
  const s = useStore();
  const data = s as unknown as AppData;
  const today = dateKey();
  const defaultMin = s.planOptions.todayMinutes?.date === today ? s.planOptions.todayMinutes.minutes : 45;
  const [open, setOpen] = useState<TemplateId | null>(null);
  const [minutes, setMinutes] = useState(defaultMin);
  const go = useRouter((r) => r.go);
  const plans = useMemo(
    () => Object.fromEntries(QUICK.map((q) => [q.id, planTemplate(data, q.id, defaultMin)])) as Record<TemplateId, PlannedSession>,
    [s.sessions, s.exercises, s.settings, s.profile, s.checkIns, defaultMin], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const sheetPlan = useMemo(() => (open ? planTemplate(data, open, minutes) : null), [open, minutes, s.sessions, s.exercises]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = s.sessions.some((x) => x.status === 'active');
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[19px] font-semibold tracking-tight">Schnellstart</h2>
        <span className="text-[12px] text-muted">angepasst an deine Erholung</span>
      </div>
      <div className="scroll-x -mx-4 flex snap-x gap-3 px-4 pb-1">
        {QUICK.map((q) => {
          const p = plans[q.id];
          const recov = p.decisions.filter((d) => d.sets >= 1);
          return (
            <button
              key={q.id}
              onClick={() => {
                setMinutes(defaultMin);
                setOpen(q.id);
              }}
              className="group relative h-[210px] w-[170px] shrink-0 snap-start overflow-hidden rounded-[24px] border border-line/[0.08] bg-[radial-gradient(120%_80%_at_50%_30%,rgb(var(--raised)),rgb(var(--bg)))] text-left transition active:scale-[0.98]"
            >
              <div className="absolute left-2.5 right-2.5 top-2.5 flex gap-1.5">
                <span className="tnum inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[11px] font-medium backdrop-blur">
                  <Clock size={11} /> {defaultMin} Min
                </span>
                <span className="tnum inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[11px] font-medium backdrop-blur">
                  {p.exercises.length} Üb.
                </span>
              </div>
              {exerciseImage(q.img) ? (
                <img src={exerciseImage(q.img)} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              ) : (
                <ExerciseAnimation pattern={q.pattern} still={0.8} className="absolute inset-x-0 top-8 h-[120px] w-full transition group-hover:scale-105" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-3 pt-8">
                <div className="text-[15px] font-semibold">{q.title}</div>
                <div className="truncate text-[11px] text-white/60">{p.rest || !recov.length ? 'Muskeln noch ermüdet' : q.sub}</div>
              </div>
            </button>
          );
        })}
      </div>
      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? QUICK.find((q) => q.id === open)?.title : ''}
        footer={
          sheetPlan && !sheetPlan.rest ? (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => {
                unlockAudio();
                s.startSession(sheetPlan);
                setOpen(null);
                go('training');
              }}
            >
              {active ? 'Neu starten (ersetzt laufendes Training)' : 'Training starten'}
            </Button>
          ) : undefined
        }
      >
        <div className="mb-4 flex flex-wrap gap-1.5">
          {[30, 45, 60, 75, 90].map((m) => (
            <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)} className="h-8">
              {m} Min
            </Chip>
          ))}
        </div>
        {sheetPlan && !sheetPlan.rest ? (
          <SessionPreview s={sheetPlan} />
        ) : (
          <p className="text-[13px] text-muted">Alle Zielmuskeln dieser Vorlage sind laut Schätzung noch stark ermüdet. Wähle eine andere Vorlage.</p>
        )}
      </Sheet>
    </section>
  );
}

export function MoreAvailability() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line/10 px-3.5 text-[12.5px] font-medium text-muted hover:text-fg" onClick={() => setOpen(!open)}>
        <SlidersHorizontal size={13} /> {open ? 'Weniger Optionen' : 'Zeit heute & weitere Optionen'}
      </button>
      {open && (
        <div className="mt-3">
          <QuickAvailability compact />
        </div>
      )}
    </div>
  );
}

/** Kommende Tage als Karten zum Wischen */
export function UpcomingDays({ plan }: { plan: Plan }) {
  const s = useStore();
  const [open, setOpen] = useState<PlannedSession | null>(null);
  const [restOpen, setRestOpen] = useState<{ date: string; reason: string } | null>(null);
  const today = dateKey();
  const days = Array.from({ length: PLAN_DAYS - 1 }, (_, i) => addDays(today, i + 1));
  const exMap = new Map(s.exercises.map((e) => [e.id, e]));
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[19px] font-semibold tracking-tight">Die nächsten Tage</h2>
        <span className="text-[12px] text-muted">wischen →</span>
      </div>
      <div className="scroll-x -mx-4 flex snap-x snap-mandatory gap-3 px-4 pb-1">
        {days.map((d) => {
          const p = plan.sessions.find((x) => x.date === d);
          const a = s.availability[d];
          const rest = plan.restDays?.find((r) => r.date === d);
          const label = d === addDays(today, 1) ? 'Morgen' : `${WEEKDAYS_LONG[weekdayOf(d)]}, ${Number(d.slice(8))}.`;
          if (!p && rest)
            return (
              <button
                key={d}
                onClick={() => setRestOpen(rest)}
                className="flex h-[236px] w-[56%] max-w-[240px] shrink-0 snap-start flex-col justify-between rounded-[24px] border border-[#3b4a6b]/60 bg-[linear-gradient(160deg,#1d2433,rgb(var(--surface)))] p-4 text-left"
              >
                <div>
                  <div className="text-[13px] font-medium text-muted">{label}</div>
                  <div className="mt-1 text-[17px] font-semibold">Ruhetag</div>
                  <div className="text-[12px] text-[#9fb2e6]">bewusst eingeplant</div>
                </div>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[#3b4a6b]/50 text-[20px] shadow-[0_0_18px_rgb(120_150_230/0.35)]">☾</span>
                <div className="line-clamp-3 text-[12px] text-muted">{rest.reason.replace(/^Ruhetag: /, '')}</div>
              </button>
            );
          if (!p)
            return (
              <div key={d} className="flex h-[236px] w-[44%] max-w-[200px] shrink-0 snap-start flex-col justify-between rounded-[24px] border border-line/[0.07] bg-surface p-4">
                <div>
                  <div className="text-[13px] font-medium text-muted">{label}</div>
                  <div className="mt-1 text-[17px] font-semibold">{a === 'no' ? 'Keine Zeit' : 'Regeneration'}</div>
                </div>
                <span
                  className={cn(
                    'grid h-12 w-12 place-items-center rounded-full text-[18px]',
                    a === 'no' ? 'bg-rec-red/15 text-rec-red shadow-[0_0_16px_rgb(var(--rec-red)/0.35)]' : 'bg-raised text-muted',
                  )}
                >
                  {a === 'no' ? '✕' : '☾'}
                </span>
                <div className="text-[12px] text-muted">{a === 'no' ? 'Volumen wird verteilt' : 'Kein Training geplant'}</div>
              </div>
            );
          const lead = exMap.get(p.exercises[0]?.exerciseId ?? '');
          const img = lead ? exerciseImage(lead.id) : undefined;
          const muscles = p.decisions.filter((x) => x.sets >= 1).sort((x, y) => y.sets - x.sets);
          return (
            <button
              key={d}
              onClick={() => setOpen(p)}
              className="relative h-[236px] w-[78%] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-[24px] border border-line/[0.08] text-left transition active:scale-[0.99]"
              style={{ background: '#262628' }}
            >
              {img ? (
                <img src={img} alt="" className="absolute -right-6 top-0 h-[190px] w-[190px] object-cover opacity-90" />
              ) : lead ? (
                <ExerciseAnimation pattern={lead.pattern} muscles={lead.muscles} still={0.8} className="absolute -right-2 top-2 h-40 w-48" />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-r from-[#262628] via-[#262628]/70 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="relative flex h-full flex-col justify-between p-4">
                <div>
                  <div className="text-[13px] font-medium text-white/70">
                    {label}
                    {p.tentative && ' · Vorschlag'}
                  </div>
                  <div className="mt-1 max-w-[60%] text-[20px] font-semibold leading-tight text-white">{p.label.split(' (')[0]}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="tnum rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-medium text-white/85 backdrop-blur">~{p.estMinutes} Min</span>
                    <span className="tnum rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-medium text-white/85 backdrop-blur">{p.exercises.length} Übungen</span>
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {muscles.slice(0, 4).map((x) => (
                      <span key={x.muscle} className="rounded-full bg-[rgb(var(--hl)/0.22)] px-2 py-0.5 text-[10.5px] font-medium text-[rgb(var(--hl))]">
                        {MUSCLE[x.muscle].short}
                      </span>
                    ))}
                  </div>
                  <div className="flex -space-x-2.5">
                    {p.exercises.slice(0, 5).map((pe) => {
                      const ex = exMap.get(pe.exerciseId);
                      return ex ? <ExerciseIcon key={pe.exerciseId} id={ex.id} pattern={ex.pattern} muscles={ex.muscles} size={36} className="rounded-full ring-2 ring-[#262628]" /> : null;
                    })}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `${relDayLabel(open.date)}: ${open.label}` : ''}>
        {open && <SessionPreview s={open} />}
      </Sheet>
      <Sheet open={!!restOpen} onClose={() => setRestOpen(null)} title={restOpen ? `${relDayLabel(restOpen.date)}: Ruhetag` : ''}>
        {restOpen && (
          <div className="flex flex-col gap-3 text-[14px]">
            <p>{restOpen.reason}</p>
            <p className="text-[13px] text-muted">
              Du kannst trotzdem trainieren – tippe den Tag dann einfach erneut an oder starte ihn über „Training“. Regeln (max. Tage am Stück, max. Einheiten pro Woche)
              lassen sich im Profil anpassen.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                s.setAvailability(restOpen.date, 'no');
                setRestOpen(null);
              }}
            >
              Als „keine Zeit“ markieren
            </Button>
          </div>
        )}
      </Sheet>
    </section>
  );
}
