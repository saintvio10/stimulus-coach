import { useState } from 'react';
import { CalendarCheck2, CalendarPlus, Clock, HelpCircle, Repeat2, Sun, Sunrise, Info, ChevronDown } from 'lucide-react';
import { quick, useStore } from '../lib/store';
import { useToast } from '../lib/hooks';
import { addDays, cn, dateKey, endOfWeek, fmtNum, relDayLabel, weekdayOf, WEEKDAYS_SHORT, fmtMin, minutesFor } from '../lib/utils';
import { Badge, Button, Chip, Sheet } from './ui';
import type { Plan, PlannedSession } from '../engine/planner';
import { MUSCLE, MUSCLE_IDS } from '../lib/muscles';
import type { CheckIn, Joint, MuscleId } from '../lib/types';
import { JOINT_LABEL } from '../engine/joints';
import { readinessScore } from '../engine/readiness';
import { ExerciseIcon } from './ExerciseAnimation';

export function QuickAvailability({ compact }: { compact?: boolean }) {
  const toast = useToast((s) => s.show);
  const opts = useStore((s) => s.planOptions);
  const availability = useStore((s) => s.availability);
  const today = dateKey();
  const tMin = opts.todayMinutes?.date === today ? opts.todayMinutes.minutes : null;
  const sunday = endOfWeek(today);
  const items: { key: string; label: string; icon: typeof Sun; active: boolean; run: () => void; msg: string }[] = [
    { key: 'today', label: 'Heute habe ich Zeit', icon: Sun, active: availability[today] === 'yes', run: quick.today, msg: 'Heute als Trainingstag markiert' },
    {
      key: 'tomorrow',
      label: 'Morgen habe ich Zeit',
      icon: Sunrise,
      active: availability[addDays(today, 1)] === 'yes',
      run: quick.tomorrow,
      msg: 'Morgen als Trainingstag markiert',
    },
    {
      key: 'sunday',
      label: weekdayOf(today) === 0 ? 'Sonntag (heute)' : 'Sonntag habe ich Zeit',
      icon: CalendarPlus,
      active: availability[sunday] === 'yes',
      run: quick.sunday,
      msg: 'Sonntag als Trainingstag markiert',
    },
    {
      key: 'once',
      label: 'Diese Woche nur 1×',
      icon: CalendarCheck2,
      active: !!opts.weekCap,
      run: () => (opts.weekCap ? quick.clearWeekCap() : quick.onlyOnceThisWeek()),
      msg: opts.weekCap ? 'Wochenlimit entfernt' : 'Nur eine Einheit bis Sonntag – Plan wird Ganzkörper',
    },
    { key: 'two', label: '2 Tage hintereinander', icon: Repeat2, active: false, run: quick.twoInARow, msg: 'Zwei aufeinanderfolgende Tage markiert' },
    {
      key: 'unknown',
      label: 'Weiß nicht, wann wieder',
      icon: HelpCircle,
      active: opts.uncertain,
      run: quick.toggleUncertain,
      msg: opts.uncertain ? 'Unsicherheitsmodus aus' : 'Heute möglichst viele Muskelgruppen abdecken',
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className={cn('flex gap-2', compact ? 'scroll-x -mx-1 px-1' : 'flex-wrap')}>
        {items.map((i) => (
          <Chip
            key={i.key}
            active={i.active}
            onClick={() => {
              i.run();
              toast(i.msg);
            }}
          >
            <i.icon size={15} />
            {i.label}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Clock size={15} className="shrink-0 text-muted" />
        <span className="shrink-0 text-[13px] text-muted">Zeit heute</span>
        <div className="scroll-x flex gap-1.5">
          {[30, 45, 60, 75, 90, 120].map((m) => (
            <Chip
              key={m}
              className="h-8 px-3"
              active={tMin === m}
              onClick={() => {
                quick.minutesToday(tMin === m ? null : m);
                toast(tMin === m ? 'Standarddauer' : `Heute ${fmtMin(m)} – Plan wird angepasst`);
              }}
            >
              {fmtMin(m)}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WeekStrip({ plan, onDay }: { plan: Plan; onDay?: (d: string) => void }) {
  const availability = useStore((s) => s.availability);
  const prefs = useStore((s) => s.settings.preferredDays);
  const sessions = useStore((s) => s.sessions);
  const today = dateKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((d) => {
        const a = availability[d] ?? (prefs.includes(weekdayOf(d)) ? 'maybe' : 'no');
        const planned = plan.sessions.find((s) => s.date === d);
        const done = sessions.some((s) => s.date === d && s.status === 'done');
        return (
          <button
            key={d}
            onClick={() => onDay?.(d)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-2xl border py-2 transition',
              d === today ? 'border-line/20 bg-raised' : 'border-line/[0.06]',
              a === 'no' && 'opacity-45',
            )}
          >
            <span className="text-[10.5px] font-medium text-muted">{WEEKDAYS_SHORT[weekdayOf(d)]}</span>
            <span className="tnum text-[15px] font-semibold">{Number(d.slice(8))}</span>
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                done ? 'bg-rec-green' : planned ? (planned.tentative ? 'border border-accent bg-transparent' : 'bg-accent') : a === 'yes' ? 'bg-fg/40' : 'bg-transparent',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function SessionPreview({ s, onStart, startLabel = 'Training starten', showReasons = true }: { s: PlannedSession; onStart?: () => void; startLabel?: string; showReasons?: boolean }) {
  const exercises = useStore((st) => st.exercises);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const [open, setOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState<string | null>(null);
  const focus = s.decisions.filter((d) => d.sets >= 1).sort((a, b) => b.sets - a.sets);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {focus.map((d) => (
          <Badge key={d.muscle} tone={d.status === 'focus' ? 'accent' : 'default'}>
            {MUSCLE[d.muscle].short} <span className="tnum opacity-70">{fmtNum(d.sets)}</span>
          </Badge>
        ))}
      </div>
      {s.decisions.some((d) => d.status === 'skipped' && d.reason) && (
        <div className="rounded-xl bg-raised px-3 py-2 text-[12px]">
          <div className="mb-0.5 font-medium">Heute nicht dabei</div>
          <ul className="flex flex-col gap-0.5 text-muted">
            {s.decisions
              .filter((d) => d.status === 'skipped' && d.reason)
              .slice(0, 5)
              .map((d) => (
                <li key={d.muscle}>
                  <span className="text-fg/80">{MUSCLE[d.muscle].short}:</span> {d.reason}
                </li>
              ))}
          </ul>
        </div>
      )}
      <ol className="flex flex-col divide-y divide-line/[0.06]">
        {s.exercises.map((p, i) => {
          const ex = exMap.get(p.exerciseId);
          if (!ex) return null;
          return (
            <li key={p.exerciseId} className="py-1">
              <button className="flex w-full items-center gap-3 py-1.5 text-left" onClick={() => setWhyOpen(whyOpen === p.exerciseId ? null : p.exerciseId)} aria-expanded={whyOpen === p.exerciseId}>
              <div className="relative">
                <ExerciseIcon id={ex.id} pattern={ex.pattern} muscles={ex.muscles} size={44} />
                <span className="tnum absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-bg text-[10px] font-semibold text-muted ring-1 ring-line/10">{i + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 truncate text-[14px] font-medium">
                  {ex.name}
                  {p.superset && <Badge tone="accent">Supersatz {p.superset}</Badge>}
                </div>
                <div className="tnum text-[12px] text-muted">
                  {p.sets} × {p.repMin}–{p.repMax} · RIR {p.targetRir}
                  {p.recWeight != null && ` · ${fmtNum(p.recWeight)} kg`}
                  {p.advice.type === 'increase' && <span className="ml-1 text-rec-green">↑</span>}
                  {p.advice.type === 'deload' && <span className="ml-1 text-rec-orange">↓</span>}
                </div>
              </div>
              <span className="tnum shrink-0 text-[12px] text-muted" title="Geschätzte Dauer inkl. Pausen und Gerät einstellen">~{fmtMin(Math.max(1, Math.round(p.minutes)))}</span>
              <Info size={15} className={cn('shrink-0', whyOpen === p.exerciseId ? 'text-accent' : 'text-muted/60')} />
              </button>
              {whyOpen === p.exerciseId && (
                <div className="mb-1 ml-[56px] rounded-xl bg-raised px-3 py-2 text-[12.5px] leading-relaxed">
                  <span className="font-semibold">Warum? </span>
                  {p.why}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {showReasons && (
        <div>
          <button className="flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-fg" onClick={() => setOpen(!open)}>
            <Info size={14} /> Alle Details zur Auswahl
            <ChevronDown size={14} className={cn('transition', open && 'rotate-180')} />
          </button>
          {open && <PlanReasons s={s} />}
        </div>
      )}
      {onStart && (
        <Button variant="primary" size="lg" className="w-full" onClick={onStart}>
          {startLabel}
        </Button>
      )}
    </div>
  );
}

export function PlanReasons({ s }: { s: PlannedSession }) {
  const exercises = useStore((st) => st.exercises);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  return (
    <div className="mt-3 flex flex-col gap-4 text-[13px]">
      {s.reasons.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {s.reasons.map((r, i) => (
            <li key={i} className="text-fg/90">
              {r}
            </li>
          ))}
        </ul>
      )}
      <div>
        <div className="label mb-2">Muskelgruppen</div>
        <ul className="flex flex-col gap-1.5">
          {s.decisions.map((d) => (
            <li key={d.muscle} className="flex gap-2">
              <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', d.status === 'skipped' ? 'bg-rec-gray' : d.status === 'focus' ? 'bg-accent' : 'bg-fg/60')} />
              <span>
                <span className="font-medium">{MUSCLE[d.muscle].label}:</span> <span className="text-muted">{d.reason}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="label mb-2">Übungen</div>
        <ul className="flex flex-col gap-2">
          {s.exercises.map((p) => (
            <li key={p.exerciseId}>
              <div className="font-medium">{exMap.get(p.exerciseId)?.name}</div>
              <div className="text-fg/85">{p.why}</div>
              <div className="text-muted">{p.reason}</div>
              <div className="text-muted">{p.advice.text}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const SORE_GROUPS: { label: string; muscles: MuscleId[] }[] = [
  { label: 'Bizeps', muscles: ['biceps'] },
  { label: 'Trizeps', muscles: ['triceps'] },
  { label: 'Schultern', muscles: ['sideDelts', 'frontDelts', 'rearDelts'] },
  { label: 'Brust', muscles: ['chest'] },
  { label: 'Rücken', muscles: ['lats', 'upperBack'] },
  { label: 'Quadrizeps', muscles: ['quads'] },
  { label: 'Beinbeuger/Gesäß', muscles: ['hamstrings', 'glutes'] },
  { label: 'Waden', muscles: ['calves'] },
  { label: 'Bauch', muscles: ['abs'] },
];

export function CheckInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = dateKey();
  const existing = useStore((s) => s.checkIns[today]);
  const save = useStore((s) => s.saveCheckIn);
  const toast = useToast((s) => s.show);
  const [c, setC] = useState<CheckIn>(existing ?? { sleepHours: 7.5, sleepQuality: 3, energy: 3, stress: 2, soreness: {}, pain: [] });
  const scale = (key: 'sleepQuality' | 'energy' | 'stress', label: string, lo: string, hi: string) => (
    <div>
      <div className="mb-2 flex justify-between text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="text-muted">
          {lo} → {hi}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            onClick={() => setC({ ...c, [key]: v })}
            className={cn('h-10 rounded-xl text-[14px] font-medium transition', c[key] === v ? 'bg-fg text-bg' : 'bg-raised text-muted')}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
  const score = readinessScore(c);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Täglicher Check-in"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="tnum text-[13px] text-muted">Bereitschaft (Schätzung): {score}/100</span>
          <Button
            variant="primary"
            onClick={() => {
              save(today, c);
              toast('Check-in gespeichert – Plan aktualisiert');
              onClose();
            }}
          >
            Speichern
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-2 flex justify-between text-[13px]">
            <span className="font-medium">Schlaf letzte Nacht</span>
            <span className="tnum text-fg">{fmtNum(c.sleepHours)} h</span>
          </div>
          <input
            id="ci-sleep"
            type="range"
            min={3}
            max={11}
            step={0.25}
            value={c.sleepHours}
            onChange={(e) => setC({ ...c, sleepHours: +e.target.value })}
            className="w-full accent-[rgb(var(--accent))]"
          />
        </div>
        {scale('sleepQuality', 'Schlafqualität', 'schlecht', 'sehr gut')}
        {scale('energy', 'Energie', 'erschöpft', 'voller Energie')}
        {scale('stress', 'Stress', 'entspannt', 'sehr hoch')}
        <div>
          <div className="mb-2 text-[13px] font-medium">Muskelkater</div>
          <div className="flex flex-col gap-2">
            {SORE_GROUPS.map((g) => {
              const v = c.soreness[g.muscles[0]] ?? 0;
              return (
                <div key={g.label} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-muted">{g.label}</span>
                  <div className="flex gap-1">
                    {['–', 'leicht', 'mittel', 'stark'].map((l, i) => (
                      <button
                        key={l}
                        onClick={() => {
                          const so = { ...c.soreness };
                          g.muscles.forEach((m) => (so[m] = i));
                          setC({ ...c, soreness: so });
                        }}
                        className={cn(
                          'h-8 rounded-lg px-2.5 text-[12px] font-medium transition',
                          v === i ? (i === 0 ? 'bg-fg text-bg' : i === 1 ? 'bg-rec-yellow/25 text-rec-yellow' : i === 2 ? 'bg-rec-orange/25 text-rec-orange' : 'bg-rec-red/25 text-rec-red') : 'bg-raised text-muted',
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[13px] font-medium">Beschwerden (optional)</div>
          <p className="mb-2 text-[12px] text-muted">Zwickt etwas? Übungen, die diesen Bereich stark belasten, werden heute durch schonendere Alternativen ersetzt oder ausgelassen.</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(JOINT_LABEL) as Joint[]).map((j) => {
              const on = (c.pain ?? []).includes(j);
              return (
                <button
                  key={j}
                  onClick={() => setC({ ...c, pain: on ? (c.pain ?? []).filter((x) => x !== j) : [...(c.pain ?? []), j] })}
                  className={cn('h-9 rounded-full px-3.5 text-[13px] font-medium transition', on ? 'bg-rec-red/20 text-rec-red ring-1 ring-rec-red/40' : 'bg-raised text-muted')}
                >
                  {JOINT_LABEL[j]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11.5px] text-muted">Bei starken oder anhaltenden Schmerzen bitte ärztlich abklären lassen – die App ersetzt keine Diagnose.</p>
        </div>
        <p className="text-[12px] text-muted">
          Alles ist optional: Ohne Check-in plant die App etwas vorsichtiger (größere Unsicherheit). Muskelkater erhöht die geschätzte Ermüdung des Muskels. Er ist allerdings nur ein grober Indikator für Regeneration – kein Muskelkater heißt nicht automatisch
          „vollständig erholt“.
        </p>
      </div>
    </Sheet>
  );
}

export const ALL_MUSCLES = MUSCLE_IDS;
export { relDayLabel };

/** Trainingsdauer für einen bestimmten Tag einstellen – der Plan rechnet sofort neu (auch die Folgetage) */
export function DayDuration({ date, plan, dark }: { date: string; plan?: PlannedSession | null; dark?: boolean }) {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const [open, setOpen] = useState(false);
  const cur = minutesFor(s, date);
  const def = s.settings.defaultMinutes;
  const custom = cur !== def;
  const opts = [45, 60, 75, 90, 105, 120, 150, 180];
  const unused = plan && !plan.rest ? cur - plan.estMinutes : 0;
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'tnum inline-flex h-8 w-fit items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium backdrop-blur',
          custom ? 'bg-accent/20 text-fg ring-1 ring-accent/40' : dark ? 'bg-white/10 text-white/85' : 'bg-fg/[0.07] text-fg/85',
        )}
        aria-expanded={open}
      >
        <Clock size={14} /> {plan && !plan.rest ? `~${fmtMin(plan.estMinutes)}` : fmtMin(cur)}
        <span className="text-muted">· Zeit {fmtMin(cur)} ändern</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 rounded-2xl bg-fg/[0.05] p-3">
          <div className="text-[12px] text-muted">Wie viel Zeit hast du an diesem Tag?</div>
          <div className="flex flex-wrap gap-1.5">
            {opts.map((m) => (
              <Chip
                key={m}
                active={cur === m}
                onClick={() => {
                  quick.dayMinutes(date, m);
                  toast(`${relDayLabel(date).split(',')[0]}: ${fmtMin(m)} – Plan neu berechnet`);
                }}
                className="h-8"
              >
                {fmtMin(m)}
              </Chip>
            ))}
            {custom && (
              <Chip active={false} onClick={() => quick.dayMinutes(date, null)} className="h-8">
                Standard ({fmtMin(def)})
              </Chip>
            )}
          </div>
          <p className="text-[11.5px] text-muted">
            {cur < def
              ? 'Kürzer: heute weniger Sätze, priorisiert nach dem, was am meisten bringt. Fehlendes Wochenvolumen holen die nächsten Einheiten automatisch nach.'
              : cur > def
                ? 'Länger: mehr Übungen und Sätze, solange das Modell noch Nutzen sieht (Obergrenze pro Muskel und Einheit ist eine Modellregel). Pausen werden nur verlängert, wenn deine Wdh. zuletzt deutlich abfielen – nicht allein wegen der Zeit. Die Folgetage werden entsprechend entlastet.'
                : 'Standarddauer aus deinem Profil.'}
            {unused >= 15 && ` Der Plan ist nach ~${fmtMin(plan!.estMinutes)} fertig: Die passenden Muskeln haben ihr geplantes Pensum für heute, andere sind laut Schätzung noch in Erholung.`}
          </p>
        </div>
      )}
    </div>
  );
}
