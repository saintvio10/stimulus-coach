import { useMemo, useState } from 'react';
import { exerciseImage } from '../data/exerciseImages';
import { create } from 'zustand';
import { ArrowRight, CalendarCheck2, HelpCircle, Sparkles } from 'lucide-react';
import { useStore } from '../lib/store';
import { useRouter, useToast } from '../lib/hooks';
import type { AppData, Availability } from '../lib/types';
import { addDays, cn, dateKey, endOfWeek, weekdayOf, WEEKDAYS_LONG, fmtDate } from '../lib/utils';
import { buildPlan, PLAN_DAYS } from '../engine/planner';
import { generateDemo } from '../lib/demo';
import { exportData } from '../lib/store';
import { ExerciseAnimation } from './ExerciseAnimation';
import { Button, Chip, Switch } from './ui';
import { Logo } from './Logo';

export const useStartScreen = create<{ open: boolean | null; set: (v: boolean) => void }>((set) => ({
  open: null,
  set: (v) => set({ open: v }),
}));

/** Soll der Startbildschirm automatisch erscheinen? Erster Start oder noch nicht heute gefragt. */
export function shouldAutoOpen(d: AppData): boolean {
  if (d.sessions.some((s) => s.status === 'active')) return false;
  if (!d.settings.onboarded) return true;
  return d.planOptions.askedOn !== dateKey();
}

const STATES: { v: Availability; label: string }[] = [
  { v: 'yes', label: 'Zeit' },
  { v: 'maybe', label: 'Vielleicht' },
  { v: 'no', label: 'Nein' },
];

export function StartScreen({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const go = useRouter((r) => r.go);
  const name = s.profile.name?.trim();
  const hello = name ? `Hallo ${name}` : 'Hallo';
  const [step, setStep] = useState<'welcome' | 'availability'>(s.settings.onboarded ? 'availability' : 'welcome');
  const [howto, setHowto] = useState(false);
  const today = dateKey();
  const days = Array.from({ length: PLAN_DAYS }, (_, i) => addDays(today, i));
  const defaultOf = (d: string): Availability => (s.settings.preferredDays.includes(weekdayOf(d)) ? 'maybe' : 'no');
  const [draft, setDraft] = useState<Record<string, Availability>>(() => Object.fromEntries(days.map((d) => [d, s.availability[d] === 'yes' ? 'yes' : s.availability[d] === 'no' ? 'no' : 'maybe'])));
  const initialMin = s.planOptions.todayMinutes?.date === today ? s.planOptions.todayMinutes.minutes : s.settings.defaultMinutes;
  const [minutes, setMinutes] = useState(initialMin);
  const [uncertain, setUncertain] = useState(s.planOptions.uncertain);
  const [onlyOnce, setOnlyOnce] = useState(!!s.planOptions.weekCap);

  const preview = useMemo(() => {
    const data = s as unknown as AppData;
    const avail = { ...data.availability };
    days.forEach((d) => (avail[d] = draft[d]));
    return buildPlan({
      ...data,
      availability: avail,
      planOptions: {
        uncertain,
        weekCap: onlyOnce ? { count: 1, until: endOfWeek(today) } : null,
        todayMinutes: { date: today, minutes },
      },
    });
  }, [draft, uncertain, onlyOnce, minutes, s.sessions, s.exercises, s.settings, s.profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    s.mutate((d) => {
      days.forEach((day) => {
        if (draft[day] === 'maybe') delete d.availability[day];
        else d.availability[day] = draft[day];
      });
      d.planOptions.uncertain = uncertain;
      d.planOptions.weekCap = onlyOnce ? { count: 1, until: endOfWeek(today) } : null;
      d.planOptions.todayMinutes = minutes !== d.settings.defaultMinutes ? { date: today, minutes } : null;
      d.planOptions.askedOn = today;
      d.settings.onboarded = true;
    });
    toast(draft[today] === 'no' ? 'Plan erstellt – heute frei' : 'Plan erstellt – hier ist dein Training für heute');
    onClose();
    // direkt zum heutigen Plan (bei "Nein" zur Übersicht mit der nächsten Einheit)
    go(draft[today] === 'no' ? 'uebersicht' : 'training');
  };
  const later = () => {
    s.mutate((d) => {
      d.planOptions.askedOn = today;
      d.settings.onboarded = true;
    });
    onClose();
  };

  if (step === 'welcome')
    return (
      <Shell>
        <div className="flex min-h-full flex-col gap-6 pb-6">
          <div className="flex items-center gap-2.5 pt-2">
            <Logo size={34} />
            <span className="text-[15px] font-semibold tracking-tight">Stimulus</span>
          </div>
          <div className="relative overflow-hidden rounded-[28px] bg-[#262628] ring-1 ring-line/[0.07]">
            {exerciseImage('preacher-curl') ? (
              <img src={exerciseImage('preacher-curl')} alt="Preacher Curls an der Bizepsmaschine" className="mx-auto h-72 w-full max-w-md object-cover sm:h-80" />
            ) : (
              <ExerciseAnimation pattern="pulldown" className="mx-auto h-64 w-full max-w-md sm:h-80" />
            )}
          </div>
          <div>
            <div className="mb-2 text-[22px] font-semibold tracking-tight text-accent">{hello} 👋</div>
            <h1 className="text-[34px] font-light leading-[1.08] tracking-tight sm:text-[42px]">
              Dein Training, <span className="font-semibold">jeden Tag</span> neu <span className="font-semibold">berechnet.</span>
            </h1>
            <p className="mt-3 max-w-md text-[15px] text-muted">
              Sag der App, wann du Zeit hast. Sie wählt Split, Übungen, Sätze und Gewichte anhand deiner Historie, Regeneration und Muskelprioritäten – und erklärt jede Entscheidung.
            </p>
          </div>
          <button onClick={() => setHowto(!howto)} className="flex w-fit items-center gap-2 rounded-full border border-line/15 px-4 py-2.5 text-[13px] font-medium tracking-wide">
            SO FUNKTIONIERT’S <HelpCircle size={14} />
          </button>
          {howto && (
            <ol className="flex flex-col gap-3 text-[14px]">
              {[
                ['Verfügbarkeit', 'Markiere, wann du Zeit hast und wann nicht – oder dass du es nicht weißt.'],
                ['Plan', 'Die App wählt Ganzkörper, A/B, PPL+ oder einen Hybrid – passend zu deinen Tagen.'],
                ['Training', 'Gewicht, Wiederholungen und RIR eintragen; die nächste Empfehlung passt sich an.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-full bg-raised text-[12px] font-semibold">{i + 1}</span>
                  <span>
                    <span className="font-medium">{t}:</span> <span className="text-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-auto flex flex-col gap-2">
            <Button variant="primary" size="lg" className="h-14 w-full text-[16px]" onClick={() => setStep('availability')}>
              Wann habe ich Zeit? <ArrowRight size={17} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                s.replaceAll(generateDemo(exportData()));
                setStep('availability');
              }}
            >
              <Sparkles size={15} /> Mit Beispieldaten erkunden
            </Button>
          </div>
        </div>
      </Shell>
    );

  const yesCount = days.filter((d) => draft[d] === 'yes').length;
  const todayAvail = draft[today] !== 'no';

  return (
    <Shell>
      <div className="flex flex-col gap-5 pb-4">
        <div className="pt-2">
          <div className="text-[17px] font-medium text-accent">{hello}!</div>
          <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-tight">Wann hast du Zeit?</h1>
          <div className="label mt-1">Nächste {PLAN_DAYS} Tage</div>
          <p className="mt-1 text-[14px] text-muted">Nur die nächsten Tage – grün = Zeit, nochmal tippen: rot = keine Zeit. Der Plan wird genau dafür optimiert und rollt danach automatisch weiter.</p>
        </div>

        <ul className="flex flex-col gap-2">
          {days.map((d, idx) => {
            const v = draft[d];
            const planned = preview.sessions.find((p) => p.date === d);
            const on = v === 'yes';
            return (
              <li key={d}>
                <button
                  onClick={() => {
                    setDraft({ ...draft, [d]: on ? 'no' : 'yes' }); // offen → Zeit → keine Zeit → Zeit
                    try {
                      navigator.vibrate?.(10);
                    } catch {
                      /* ignore */
                    }
                  }}
                  aria-pressed={on}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition active:scale-[0.99]',
                    on ? 'border-rec-green/40 bg-rec-green/[0.08]' : v === 'no' ? 'border-rec-red/35 bg-rec-red/[0.07]' : 'border-line/[0.07] bg-surface',
                  )}
                >
                  <span
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 rounded-full transition',
                      on
                        ? 'bg-rec-green shadow-[0_0_10px_3px_rgb(var(--rec-green)/0.7),0_0_22px_6px_rgb(var(--rec-green)/0.3)]'
                        : v === 'no'
                          ? 'bg-rec-red shadow-[0_0_10px_3px_rgb(var(--rec-red)/0.7),0_0_22px_6px_rgb(var(--rec-red)/0.3)]'
                          : 'bg-line/15',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{d === today ? 'Heute' : d === addDays(today, 1) ? 'Morgen' : WEEKDAYS_LONG[weekdayOf(d)]}</span>
                    <span className="tnum block truncate text-[12px] text-muted">
                      {fmtDate(d)} {planned ? `· ${planned.label.split(' (')[0]}` : ''}
                    </span>
                  </span>
                  <span className={cn('text-[13.5px] font-semibold', on ? 'text-rec-green' : v === 'no' ? 'text-rec-red' : 'text-muted')}>{on ? 'Zeit' : v === 'no' ? 'Keine Zeit' : 'offen'}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {todayAvail && (
          <div>
            <div className="mb-2 text-[13px] font-medium">Zeit heute</div>
            <div className="scroll-x flex gap-1.5">
              {[30, 45, 60, 75, 90, 120].map((m) => (
                <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)} className="h-9">
                  {m} Min
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line/[0.06]">
          <label className="flex items-center justify-between gap-3">
            <span className="text-[14px]">
              Ich weiß nicht, wann ich wieder kann
              <span className="block text-[12px] text-muted">Heute möglichst viele Muskelgruppen abdecken</span>
            </span>
            <Switch id="st-unc" checked={uncertain} onChange={setUncertain} label="Unsicher" />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-[14px]">Diese Woche nur 1×</span>
            <Switch id="st-once" checked={onlyOnce} onChange={setOnlyOnce} label="Nur einmal" />
          </label>
        </div>

        <div className="rounded-2xl bg-raised p-4">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <CalendarCheck2 size={15} className="text-accent" /> Vorschau: {preview.sessions.length ? preview.strategy.label : 'kein Training'}
          </div>
          <p className="mt-1 text-[12.5px] text-muted">
            {preview.sessions.length
              ? preview.sessions.map((p) => `${p.date === today ? 'Heute' : WEEKDAYS_LONG[weekdayOf(p.date)].slice(0, 2)}: ${p.label.split(' (')[0]}${p.tentative ? ' (vorläufig)' : ''}`).join(' · ')
              : 'Tippe mindestens einen Tag an, an dem du Zeit hast.'}
          </p>
          {yesCount > 0 && <p className="mt-1 text-[12px] text-muted">{yesCount} {yesCount === 1 ? 'Tag' : 'Tage'} mit Zeit.</p>}
        </div>

        <div className="sticky bottom-0 -mx-4 flex gap-2 bg-gradient-to-t from-bg via-bg to-transparent px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-6">
          <Button variant="ghost" size="lg" className="h-14" onClick={later}>
            Später
          </Button>
          <Button variant="primary" size="lg" className="h-14 flex-1 text-[16px]" onClick={save}>
            {draft[today] === 'no' ? 'Plan erstellen' : 'Zum heutigen Plan'} <ArrowRight size={17} />
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-bg">
      <div className="safe-t mx-auto min-h-full max-w-xl pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))] pt-4 animate-fade-up">{children}</div>
    </div>
  );
}
