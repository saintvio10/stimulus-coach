import { useMemo, useRef, useState } from 'react';
import { exerciseImage } from '../data/exerciseImages';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Dumbbell, Info, Layers, Moon, Play, Search, SlidersHorizontal, TrendingUp, Trophy, House } from 'lucide-react';
import { useStore } from '../lib/store';
import { useCompletion, useRouter, useSearch, useToast } from '../lib/hooks';
import type { AppData, AnimPattern, Availability, Session } from '../lib/types';
import type { Plan, PlannedSession, TemplateId } from '../engine/planner';
import { planTemplate, planToday, PLAN_DAYS, personalTarget, TEMPLATE_SHORT, TEMPLATES } from '../engine/planner';
import { MUSCLES } from '../lib/muscles';
import type { MuscleId } from '../lib/types';
import { useMuscleStates } from '../lib/hooks';
import { MUSCLE } from '../lib/muscles';
import { readinessLabel, readinessScore } from '../engine/readiness';
import { addDays, cn, dateKey, fmtNum, relDayLabel, weekdayOf, WEEKDAYS_SHORT, WEEKDAYS_LONG, MONTHS, fmtMin } from '../lib/utils';
import { Badge, Button, Chip, GlowProgress, Ring, Sheet } from './ui';
import { sessionStats, sessionsThisWeek } from '../engine/sessionStats';
import { AddMenu } from './Extras';
import { ExerciseAnimation, ExerciseIcon } from './ExerciseAnimation';
import { SwipeToStart } from './SwipeToStart';
import { PlanReasons, SessionPreview, CheckInSheet, QuickAvailability, DayDuration } from './Coach';
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
        <AddMenu />
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
  // Wischen: 7-Tage-Seiten vor/zurück (0 = ab heute)
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<'l' | 'r' | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const turn = (d: number) => {
    const np = Math.max(-8, Math.min(3, page + d));
    if (np === page) return;
    setDir(d > 0 ? 'r' : 'l');
    setPage(np);
    try {
      navigator.vibrate?.(6);
    } catch {
      /* ignore */
    }
  };
  const days = Array.from({ length: PLAN_DAYS }, (_, i) => addDays(today, page * 7 + i));
  const rangeLabel =
    page === 0 ? 'Ab heute' : page === 1 ? 'Nächste 7 Tage' : page === -1 ? 'Letzte 7 Tage' : `${Number(days[0].slice(8))}.${Number(days[0].slice(5, 7))}. – ${Number(days[6].slice(8))}.${Number(days[6].slice(5, 7))}.`;
  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-semibold tracking-tight">Wann hast du Zeit?</h2>
          <div className="text-[12px] text-muted">Antippen: Zeit → Ohne Gym → Vielleicht → Keine Zeit</div>
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
      <div className="mb-2 flex items-center justify-between">
        <button aria-label="Frühere Tage" onClick={() => turn(-1)} disabled={page <= -8} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-raised disabled:opacity-30">
          <ChevronLeft size={17} />
        </button>
        <button onClick={() => page !== 0 && turn(-page)} className={cn('text-[12.5px] font-medium', page === 0 ? 'text-muted' : 'text-accent')}>
          {rangeLabel}
          {page !== 0 && ' · zurück zu heute'}
        </button>
        <button aria-label="Spätere Tage" onClick={() => turn(1)} disabled={page >= 3} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-raised disabled:opacity-30">
          <ChevronRight size={17} />
        </button>
      </div>
      <div
        key={page}
        data-noswipe
        className={cn('grid grid-cols-7 gap-1.5', dir === 'r' && 'animate-slide-in-r', dir === 'l' && 'animate-slide-in-l')}
        style={{ touchAction: 'pan-y' }}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const st = touch.current;
          touch.current = null;
          if (!st) return;
          const dx = e.changedTouches[0].clientX - st.x;
          const dy = e.changedTouches[0].clientY - st.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            if (e.cancelable) e.preventDefault();
            turn(dx < 0 ? 1 : -1);
          }
        }}
      >
        {days.map((d) => {
          const past = d < today;
          const a = s.availability[d]; // undefined = offen
          const done = s.sessions.some((x) => x.date === d && x.status === 'done');
          const planned = plan.sessions.find((x) => x.date === d);
          const rest = plan.restDays?.find((x) => x.date === d);
          const isToday = d === today;
          const away = (s.awayDays ?? []).includes(d);
          const look = done ? 'done' : past ? 'open' : rest ? 'rest' : a === 'yes' ? (away ? 'away' : 'yes') : a === 'maybe' ? 'maybe' : a === 'no' ? 'no' : 'open';
          return (
            <button
              key={d}
              onClick={() => {
                if (past) {
                  const ses = s.sessions.find((x) => x.date === d && x.status === 'done');
                  if (ses) return useCompletion.getState().open(ses.id);
                  return toast(`${relDayLabel(d)}: kein Training gespeichert`);
                }
                // Zeit → Zeit ohne Gym → Vielleicht → Keine Zeit → Zeit
                try {
                  navigator.vibrate?.(10);
                } catch {
                  /* ignore */
                }
                if (a === 'yes' && !away) {
                  s.setAway(d, true);
                  return toast(`${relDayLabel(d)}: ohne Gym – Plan nur mit Körpergewicht, Hantel & Flaschen`);
                }
                const next: Availability = a === 'yes' ? 'maybe' : a === 'maybe' ? 'no' : 'yes';
                s.setAvailability(d, next);
                toast(`${relDayLabel(d)}: ${next === 'yes' ? 'Zeit ✓' : next === 'maybe' ? 'Vielleicht – wird vorläufig eingeplant' : 'Keine Zeit'}`);
              }}
              aria-pressed={a === 'yes'}
              aria-label={`${relDayLabel(d)}: ${STATUS_LABEL[look]} – tippen zum Umschalten`}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-full border pb-3 pt-3 transition active:scale-95',
                look === 'yes' || look === 'done'
                  ? 'border-rec-green/40 bg-rec-green/[0.08]'
                  : look === 'away'
                    ? 'border-sky-400/45 bg-sky-400/[0.09]'
                  : look === 'maybe'
                    ? 'border-rec-yellow/40 bg-rec-yellow/[0.07]'
                    : look === 'no'
                      ? 'border-rec-red/35 bg-rec-red/[0.07]'
                      : look === 'rest'
                        ? 'border-[#8b7cf6]/45 bg-[linear-gradient(180deg,rgba(139,124,246,0.18),rgba(139,124,246,0.04))]'
                        : 'border-line/[0.07] bg-surface',
                isToday && 'ring-2 ring-fg/25',
              )}
            >
              <span className={cn('text-[11px] font-medium', look === 'open' ? 'text-muted' : 'text-fg')}>{isToday ? 'Heute' : WEEKDAYS_SHORT[weekdayOf(d)]}</span>
              <span
                className={cn(
                  'tnum text-[17px] font-semibold leading-none',
                  look === 'no' ? 'text-rec-red/80' : look === 'open' ? 'text-muted' : look === 'rest' ? 'text-[#c4b9ff]' : 'text-fg',
                )}
              >
                {Number(d.slice(8))}
              </span>
              {look === 'away' ? (
                <House size={12} className="text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]" strokeWidth={2.5} />
              ) : look === 'rest' ? (
                <Moon size={12} className="text-[#c4b9ff] drop-shadow-[0_0_6px_rgba(167,150,255,0.9)]" fill="currentColor" />
              ) : look === 'done' ? (
                <Check size={12} className="text-rec-green" strokeWidth={3} />
              ) : (
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full transition',
                    look === 'yes'
                      ? 'bg-rec-green shadow-[0_0_8px_2px_rgb(var(--rec-green)/0.75),0_0_18px_4px_rgb(var(--rec-green)/0.35)]'
                      : look === 'maybe'
                        ? 'bg-rec-yellow shadow-[0_0_8px_2px_rgb(var(--rec-yellow)/0.7),0_0_18px_4px_rgb(var(--rec-yellow)/0.3)]'
                        : look === 'no'
                          ? 'bg-rec-red shadow-[0_0_8px_2px_rgb(var(--rec-red)/0.75),0_0_18px_4px_rgb(var(--rec-red)/0.35)]'
                          : 'bg-line/15',
                  )}
                />
              )}
              {(() => {
                // Tages-Plan als Etikett: erledigt/laufend → tatsächliches Training, sonst geplanter Split
                const real = s.sessions.find((x) => x.date === d && (x.status === 'active' || x.status === 'done'));
                const tid = (real?.split ?? (done ? undefined : planned?.templateId)) as keyof typeof TEMPLATE_SHORT | undefined;
                const txt = tid && tid in TEMPLATE_SHORT ? TEMPLATE_SHORT[tid] : real ? real.title.split(' (')[0] : null;
                if (!txt) return null;
                return (
                  <span
                    title={tid && tid in TEMPLATES ? TEMPLATES[tid].label : txt}
                    className={cn(
                      'absolute -top-2 left-1/2 max-w-[calc(100%+10px)] -translate-x-1/2 truncate whitespace-nowrap rounded-full px-1.5 text-[9px] font-bold leading-[15px]',
                      real ? 'bg-fg text-bg' : planned?.tentative ? 'bg-rec-yellow text-bg' : planned?.home ? 'bg-sky-400 text-bg' : 'bg-accent text-bg',
                    )}
                  >
                    {txt}
                  </span>
                );
              })()}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rec-green shadow-[0_0_6px_2px_rgb(var(--rec-green)/0.6)]" /> Zeit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rec-yellow shadow-[0_0_6px_2px_rgb(var(--rec-yellow)/0.6)]" /> Vielleicht
        </span>
        <span className="flex items-center gap-1.5">
          <House size={10} className="text-sky-300" strokeWidth={2.5} /> Ohne Gym
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rec-red shadow-[0_0_6px_2px_rgb(var(--rec-red)/0.6)]" /> Keine Zeit
        </span>
        <span className="flex items-center gap-1.5">
          <Moon size={10} className="text-[#c4b9ff]" fill="currentColor" /> Ruhetag
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
  const [whyOpen, setWhyOpen] = useState<string | null>(null);
  const today = dateKey();
  const isToday = day === today;
  const active = s.sessions.find((x) => x.status === 'active');
  const doneHere = s.sessions.filter((x) => x.date === day && x.status === 'done');
  const planned = plan.sessions.find((p) => p.date === day) ?? null;
  const restHere = plan.restDays?.find((r) => r.date === day);
  const nextPlanned = plan.sessions.find((p) => p.date > day);
  const avail: Availability | undefined = s.availability[day];
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
    <div className="grid grid-cols-3 gap-1 rounded-full bg-black/30 p-1 backdrop-blur">
      {(
        [
          ['yes', 'Zeit'],
          ['maybe', 'Vielleicht'],
          ['no', 'Keine Zeit'],
        ] as const
      ).map(([v, l]) => (
        <button
          key={v}
          onClick={() => setAvail(v)}
          className={cn('h-10 rounded-full px-3 text-[13.5px] font-semibold transition', avail === v ? (v === 'no' ? 'bg-rec-red text-bg shadow-[0_0_14px_rgb(var(--rec-red)/0.55)]' : v === 'maybe' ? 'bg-rec-yellow text-bg shadow-[0_0_14px_rgb(var(--rec-yellow)/0.5)]' : 'bg-rec-green text-bg shadow-[0_0_14px_rgb(var(--rec-green)/0.55)]') : 'text-fg/70')}
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
            <ul className="flex flex-col gap-1.5">
              {active.exercises.map((e) => {
                const ex = exMap.get(e.exerciseId);
                if (!ex) return null;
                const cur = active.exercises.find((x) => !x.skipped && x.sets.some((y) => !y.done))?.uid === e.uid;
                const d = e.sets.filter((x) => x.done).length;
                const fin = d === e.sets.length && d > 0;
                return (
                  <li
                    key={e.uid}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-2 py-1.5 transition',
                      cur && 'bg-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.55),0_0_22px_rgba(255,255,255,0.22)]',
                      e.skipped && 'opacity-40',
                    )}
                  >
                    <ExerciseIcon id={ex.id} pattern={ex.pattern} muscles={ex.muscles} size={40} />
                    <span className={cn('min-w-0 flex-1 truncate text-[14px]', cur ? 'font-semibold' : fin ? 'text-muted line-through decoration-muted/50' : '')}>{ex.name}</span>
                    {cur ? (
                      <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase text-white">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" /> Jetzt
                      </span>
                    ) : (
                      <span className={cn('tnum shrink-0 text-[12px]', fin ? 'text-rec-green' : 'text-muted')}>{fin ? '✓' : `${d}/${e.sets.length}`}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <Button variant="primary" size="lg" className="h-14" onClick={() => go('training')}>
              <Play size={16} /> Fortsetzen
            </Button>
          </>
        ) : doneHere.length ? (
          <DoneToday session={doneHere[doneHere.length - 1]} nextPlanned={nextPlanned} onNext={onNext} />
        ) : planned && !planned.rest ? (
          <>
            <div>
              <div className="text-[13px] text-muted">{planned.tentative ? 'Vielleicht – falls du Zeit hast' : isToday ? 'Deine Empfehlung' : 'Geplant'}</div>
              <h2 className="mt-0.5 text-[28px] font-semibold leading-[1.1] tracking-tight">{planned.label}</h2>
            </div>
            <DayDuration date={planned.date} plan={planned} />
            <div className="flex flex-wrap gap-2">
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
                  <li key={p.exerciseId}>
                    <button className="flex w-full items-center gap-3 rounded-2xl px-1 py-1.5 text-left" onClick={() => setWhyOpen(whyOpen === p.exerciseId ? null : p.exerciseId)} aria-expanded={whyOpen === p.exerciseId}>
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
                    <Info size={15} className={cn('shrink-0 transition', whyOpen === p.exerciseId ? 'text-accent' : 'text-muted/60')} />
                    </button>
                    {whyOpen === p.exerciseId && (
                      <div className="mb-1 ml-[58px] mr-1 animate-fade-up rounded-xl bg-fg/[0.06] px-3 py-2 text-[12.5px] leading-relaxed text-fg/85">
                        <span className="font-semibold">Warum? </span>
                        {p.why}
                      </div>
                    )}
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
                Alle Details
              </button>
            </div>
            {why && <PlanReasons s={planned} />}
            <div className="flex items-center gap-2">
              {isToday ? (
                <div data-noswipe className="flex min-w-0 flex-1">
                  <SwipeToStart onComplete={() => start(planned)} />
                </div>
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
            <h2 className="flex items-center gap-2 text-[24px] font-semibold leading-tight">
              {(restHere || planned?.rest) && avail !== 'no' && <Moon size={22} className="text-[#c4b9ff] drop-shadow-[0_0_8px_rgba(167,150,255,0.8)]" fill="currentColor" />}
              {avail === 'no' ? 'Keine Zeit – kein Training' : restHere || planned?.rest ? 'Ruhetag' : 'Kein Training geplant'}
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

const STATUS_LABEL: Record<string, string> = {
  yes: 'Zeit',
  maybe: 'Vielleicht',
  away: 'Zeit, ohne Gym',
  no: 'Keine Zeit',
  rest: 'Ruhetag',
  done: 'trainiert',
  open: 'offen',
};

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
                  <Clock size={11} /> {fmtMin(defaultMin)}
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
              {fmtMin(m)}
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
                className="flex h-[236px] w-[56%] max-w-[240px] shrink-0 snap-start flex-col justify-between rounded-[24px] border border-[#8b7cf6]/45 bg-[linear-gradient(160deg,#241d3d,rgb(var(--surface)))] p-4 text-left"
              >
                <div>
                  <div className="text-[13px] font-medium text-muted">{label}</div>
                  <div className="mt-1 text-[17px] font-semibold">Ruhetag</div>
                  <div className="text-[12px] text-[#c4b9ff]">bewusst eingeplant</div>
                </div>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[#8b7cf6]/25 text-[#d6ceff] shadow-[0_0_22px_rgba(139,124,246,0.55)]"><Moon size={22} fill="currentColor" /></span>
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
                    {p.tentative && ' · Vielleicht'}
                  </div>
                  <div className="mt-1 max-w-[60%] text-[20px] font-semibold leading-tight text-white">{p.label.split(' (')[0]}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="tnum rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-medium text-white/85 backdrop-blur">~{fmtMin(p.estMinutes)}</span>
                    <span className="tnum rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-medium text-white/85 backdrop-blur">{p.exercises.length} Übungen</span>
                    {p.exercises.some((x) => x.why?.startsWith('Nachholen') || x.why?.includes(' Nachholen:')) && (
                      <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300 backdrop-blur">↺ Nachholen</span>
                    )}
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

/** Wochenbilanz je Muskel: erledigt (rollierende 7 Tage) + geplant (nächste Tage) vs. persönliches Wochenziel */
export function WeeklyNeed({ plan }: { plan: Plan }) {
  const s = useStore();
  const data = s as unknown as AppData;
  const { states } = useMuscleStates();
  const [open, setOpen] = useState<MuscleId | null>(null);
  const spw = plan.spw; // gemeinsames Wochenziel für alle Ansichten
  const today = dateKey();
  const rows = s.profile.priorities
    .flatMap((g) => MUSCLES.filter((m) => m.group === g))
    .map((m) => {
      const target = personalTarget(data, m.id, spw);
      const done = states[m.id].vol7;
      const days = plan.sessions
        .map((p) => ({ date: p.date, sets: p.decisions.find((d) => d.muscle === m.id)?.sets ?? 0, label: p.label }))
        .filter((x) => x.sets >= 1);
      const planned = days.reduce((a, x) => a + x.sets, 0);
      const gap = Math.max(0, target - done - planned);
      const status: 'reached' | 'covered' | 'gap' = done >= target * 0.95 ? 'reached' : done + planned >= target * 0.9 ? 'covered' : 'gap';
      return { m, target, done, planned, gap, days, status };
    });
  const reached = rows.filter((r) => r.status === 'reached').length;
  const covered = rows.filter((r) => r.status === 'covered').length;
  const dayLbl = (d: string) => (d === today ? 'heute' : d === addDays(today, 1) ? 'morgen' : WEEKDAYS_SHORT[weekdayOf(d)]);
  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-[19px] font-semibold tracking-tight">Wochenbilanz</h2>
        <span className="tnum text-[12px] text-muted">
          {reached} erreicht · {covered} geplant · {rows.length - reached - covered} offen
        </span>
      </div>
      <p className="mb-1 text-[12px] text-muted">Sätze pro Muskel in den letzten 7 Tagen (grün) plus Prognose aus dem Plan (schraffiert) – gemessen am Wochenziel (Strich).</p>
      <p className="mb-4 text-[11px] text-muted/80">{plan.goalNote}</p>
      <div className="card flex flex-col gap-0.5 p-2">
        {rows.map((r) => {
          const max = Math.max(r.target, r.done + r.planned) || 1;
          const pct = (x: number) => `${(Math.min(x, max) / max) * 100}%`;
          const isOpen = open === r.m.id;
          return (
            <div key={r.m.id}>
              <button onClick={() => setOpen(isOpen ? null : r.m.id)} className="flex w-full flex-col gap-1.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-raised" aria-expanded={isOpen}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-medium">{r.m.label}</span>
                  <span
                    className={cn(
                      'tnum shrink-0 text-[12px] font-medium',
                      r.status === 'reached' ? 'text-rec-green' : r.status === 'covered' ? 'text-accent' : 'text-muted',
                    )}
                  >
                    {r.status === 'reached'
                      ? 'Ziel erreicht ✓'
                      : r.status === 'covered'
                        ? `Abgedeckt: ${r.days.map((d) => dayLbl(d.date)).join(', ')}`
                        : `Fehlen noch ~${fmtNum(Math.ceil(r.gap))} Sätze`}
                  </span>
                </div>
                <div className="relative flex h-2.5 w-full overflow-hidden rounded-full bg-raised">
                  <span className="h-full bg-rec-green transition-all" style={{ width: pct(r.done) }} />
                  <span
                    className="h-full bg-accent/70 transition-all"
                    style={{ width: pct(Math.min(r.planned, Math.max(0, max - r.done))), backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 4px, rgb(255 255 255 / 0.18) 4px 7px)' }}
                  />
                  <span className="absolute inset-y-0 w-0.5 bg-fg/60" style={{ left: `calc(${(r.target / max) * 100}% - 1px)` }} title="Wochenziel" />
                </div>
              </button>
              {isOpen && (
                <div className="mx-2.5 mb-2 rounded-xl bg-raised px-3 py-2.5 text-[12.5px]">
                  <div className="tnum grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[15px] font-semibold text-rec-green">{fmtNum(r.done)}</div>
                      <div className="text-muted">erledigt</div>
                      <div className="text-[10.5px] text-muted/80">
                        {fmtNum(states[r.m.id].direct7)} direkt + {fmtNum(states[r.m.id].indirect7 * 2)} × ½
                      </div>
                    </div>
                    <div>
                      <div className="text-[15px] font-semibold text-accent">{fmtNum(r.planned)}</div>
                      <div className="text-muted">Prognose</div>
                    </div>
                    <div>
                      <div className="text-[15px] font-semibold">{fmtNum(r.target)}</div>
                      <div className="text-muted">Wochenziel</div>
                    </div>
                  </div>
                  {r.days.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-0.5 text-muted">
                      {r.days.map((d) => (
                        <li key={d.date}>
                          {relDayLabel(d.date)}: <span className="text-fg/85">{d.label}</span> · {fmtNum(d.sets)} Sätze
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-muted">
                    {r.status === 'reached'
                      ? 'Wochenziel erreicht – der Plan setzt jetzt andere Schwerpunkte (der Zusatznutzen weiterer Sätze nimmt laut Studien ab; die genaue Grenze ist individuell).'
                      : r.status === 'covered'
                        ? 'Die geplanten Einheiten bringen den Muskel ins Ziel.'
                        : r.days.length
                          ? 'Trotz Plan bleibt eine Lücke – ein zusätzlicher Tag mit Zeit oder etwas mehr Zeit pro Einheit würde sie schließen. Sonst gleicht die App sie in der Folgewoche aus.'
                          : 'Aktuell keine Einheit mit diesem Muskel geplant – markiere einen weiteren Tag mit „Zeit“, dann plant die App ihn ein. Sonst wird er nächste Woche bevorzugt.'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-2.5 pb-1.5 pt-2 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-full bg-rec-green" /> erledigt
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-full bg-accent/70" /> geplant
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-0.5 bg-fg/60" /> Wochenziel
          </span>
          <span>Antippen für Details</span>
        </div>
      </div>
    </section>
  );
}

/** Heute-Karte zum Wischen: links = nächster Tag, rechts = vorheriger Tag */
export function SwipeDays({ plan, day, onDay }: { plan: Plan; day: string; onDay: (d: string) => void }) {
  const today = dateKey();
  const days = Array.from({ length: PLAN_DAYS }, (_, i) => addDays(today, i));
  const idx = Math.max(0, days.indexOf(day));
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const go = (i: number) => {
    if (i < 0 || i >= days.length || i === idx) return;
    setDir(i > idx ? 1 : -1);
    onDay(days[i]);
  };
  return (
    <div className="flex flex-col gap-3">
      <div
        className="touch-pan-y"
        onTouchStart={(e) => {
          if ((e.target as HTMLElement).closest('[data-noswipe]')) return;
          start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
        }}
        onTouchMove={(e) => {
          if (!start.current) return;
          const ddx = e.touches[0].clientX - start.current.x;
          const ddy = e.touches[0].clientY - start.current.y;
          if (Math.abs(ddx) > Math.abs(ddy)) setDx(Math.max(-90, Math.min(90, ddx * 0.6)));
        }}
        onTouchEnd={(e) => {
          if (!start.current) return;
          const ddx = e.changedTouches[0].clientX - start.current.x;
          const ddy = e.changedTouches[0].clientY - start.current.y;
          start.current = null;
          setDx(0);
          if (Math.abs(ddx) > 60 && Math.abs(ddx) > Math.abs(ddy) * 1.3) go(idx + (ddx < 0 ? 1 : -1));
        }}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .25s ease-out' }}
      >
        <div key={day} className={dir > 0 ? 'animate-slide-in-r' : 'animate-slide-in-l'}>
          <DayHero plan={plan} day={day} onNext={onDay} />
        </div>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <button aria-label="Vorheriger Tag" disabled={idx === 0} onClick={() => go(idx - 1)} className="grid h-8 w-8 place-items-center rounded-full text-muted disabled:opacity-25">
          <ChevronRight size={16} className="rotate-180" />
        </button>
        {days.map((d, i) => {
          const p = plan.sessions.find((x) => x.date === d);
          return (
            <button
              key={d}
              onClick={() => go(i)}
              aria-label={relDayLabel(d)}
              className={cn('h-2 rounded-full transition-all', i === idx ? 'w-6 bg-fg' : p ? 'w-2 bg-accent/70' : 'w-2 bg-line/20')}
            />
          );
        })}
        <button aria-label="Nächster Tag" disabled={idx === days.length - 1} onClick={() => go(idx + 1)} className="grid h-8 w-8 place-items-center rounded-full text-muted disabled:opacity-25">
          <ChevronRight size={16} />
        </button>
      </div>
      <p className="-mt-2 text-center text-[11px] text-muted">Wischen für die nächsten Tage</p>
    </div>
  );
}

/** Erledigtes Training: befriedigende Abschlusskarte mit Ring, Fortschrittsbalken und Kennzahlen */
function DoneToday({ session, nextPlanned, onNext }: { session: Session; nextPlanned?: { date: string } | null; onNext: (d: string) => void }) {
  const s = useStore();
  const openSummary = useCompletion((c) => c.open);
  const st = useMemo(() => sessionStats(session, s.sessions, s.exercises), [session, s.sessions, s.exercises]);
  const planned = st.plannedSets && st.plannedSets > 0 ? st.plannedSets : st.sets;
  const ratio = planned ? Math.min(1, st.sets / planned) : 1;
  const week = sessionsThisWeek(s.sessions, session.date);
  const goal = Math.max(1, s.settings.sessionsPerWeek);
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <>
      <div className="flex items-center gap-4">
        <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center">
          <svg viewBox="0 0 76 76" className="absolute inset-0 -rotate-90 drop-shadow-[0_0_12px_rgba(61,220,151,0.5)]">
            <circle cx="38" cy="38" r={R} fill="none" stroke="rgb(var(--line) / 0.1)" strokeWidth="7" />
            <circle cx="38" cy="38" r={R} fill="none" stroke="rgb(var(--rec-green))" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ratio)} className="transition-[stroke-dashoffset] duration-1000" />
          </svg>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-rec-green text-black shadow-[0_0_16px_rgba(61,220,151,0.6)]">
            <Check size={20} strokeWidth={3} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-bold uppercase tracking-wider text-rec-green">{ratio >= 0.9 ? 'Geschafft' : 'Training beendet'}</div>
          <h2 className="truncate text-[26px] font-semibold leading-tight">{session.title.split(' (')[0]}</h2>
          <div className="tnum text-[13px] text-muted">
            {st.sets}/{planned} Sätze · {Math.round(ratio * 100)} %
          </div>
        </div>
      </div>
      <GlowProgress value={ratio} height={14} />
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Dauer', fmtMin(st.durationMin)],
          st.volume > 0 ? ['Volumen', st.volume >= 1000 ? `${fmtNum(st.volume / 1000, 1)} t` : `${Math.round(st.volume)} kg`] : ['Wdh.', `${st.reps}`],
          ['Pausen', st.restMin != null ? `${Math.round(st.restMin)} min` : `${st.reps} Wdh.`],
        ].map(([l, v], i) => (
          <div key={l} className="rounded-2xl bg-fg/[0.05] px-3 py-2.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">{i === 2 && st.restMin == null ? 'Wdh.' : l}</div>
            <div className="tnum mt-0.5 text-[17px] font-semibold">{v}</div>
          </div>
        ))}
      </div>
      {(st.bestGain || (session.prs?.length ?? 0) > 0) && (
        <div className="flex items-center gap-2 rounded-2xl bg-rec-green/10 px-3 py-2.5 text-[13px] ring-1 ring-rec-green/20">
          {(session.prs?.length ?? 0) > 0 ? <Trophy size={15} className="shrink-0 text-rec-yellow" /> : <TrendingUp size={15} className="shrink-0 text-rec-green" />}
          <span className="min-w-0">
            {(session.prs?.length ?? 0) > 0
              ? `${session.prs!.length} neue${session.prs!.length === 1 ? 'r' : ''} Rekord${session.prs!.length === 1 ? '' : 'e'}`
              : `${st.bestGain!.name} +${fmtNum(st.bestGain!.pct, 1)} % stärker`}
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {st.muscles.slice(0, 6).map((m) => (
          <span key={m.muscle} className="rounded-full bg-rec-green/12 px-2.5 py-1 text-[11.5px] font-medium text-rec-green">
            ✓ {MUSCLE[m.muscle].short} <span className="tnum opacity-70">{fmtNum(m.sets)}</span>
          </span>
        ))}
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-[12px] text-muted">
          <span>Diese Woche</span>
          <span className="tnum">
            {week}/{goal} Einheiten
          </span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: Math.max(goal, week) }, (_, i) => (
            <span key={i} className={cn('h-2 flex-1 rounded-full', i < week ? 'bg-rec-green shadow-[0_0_8px_rgb(var(--rec-green)/0.5)]' : 'bg-fg/10')} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => openSummary(session.id)}>
          Zusammenfassung
        </Button>
        {nextPlanned && (
          <Button variant="secondary" onClick={() => onNext(nextPlanned.date)}>
            Nächste: {relDayLabel(nextPlanned.date).split(',')[0]} <ChevronRight size={15} />
          </Button>
        )}
      </div>
    </>
  );
}
