import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, Scale, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/hooks';
import type { Activity, AppData } from '../lib/types';
import { ACTIVITY_TYPES, INTENSITY, activityLabel, activityMinutes, activityMuscles, type ActivityType } from '../engine/activities';
import { weightTrend } from '../engine/stats';
import { MUSCLE } from '../lib/muscles';
import { addDays, cn, dateKey, fmtDate, fmtNum, parseKey, relDayLabel, DAY } from '../lib/utils';
import { Button, Chip, Field, Input, Sheet } from './ui';
import { ChartTooltip, axisProps } from '../pages/Progress';
import { HomeWorkoutSheet } from './HomeWorkout';
import { QuickAvailability } from './Coach';

/** Aktivität außerhalb des Studios eintragen (Ski, Spazieren …) */
export function ActivitySheet({ open, onClose, date: initialDate }: { open: boolean; onClose: () => void; date?: string }) {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const [type, setType] = useState<ActivityType>('walk');
  const [date, setDate] = useState(initialDate ?? dateKey());
  const [minutes, setMinutes] = useState<string>('');
  const [steps, setSteps] = useState('');
  const [km, setKm] = useState('');
  const [intensity, setIntensity] = useState<Activity['intensity']>('light');
  const t = ACTIVITY_TYPES[type];
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));
  const draft: Activity = { id: 'x', date, type, minutes: num(minutes), steps: num(steps), km: num(km), intensity };
  const effect = Object.entries(activityMuscles(draft))
    .filter(([, v]) => (v ?? 0) >= 0.3)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  // auch geplante Aktivitäten (z. B. Skitag morgen) – der Plan legt dann keine Beine davor/danach
  const days = [2, 1, 0, -1, -2, -3].map((i) => addDays(dateKey(), i)).reverse();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Aktivität eintragen"
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => {
            if (!draft.minutes && !draft.steps && !draft.km) return toast('Bitte Dauer, Schritte oder km angeben');
            s.addActivity({ date, type, minutes: draft.minutes, steps: draft.steps, km: draft.km, intensity });
            toast(`${t.label} gespeichert – Regeneration & Plan aktualisiert`);
            setMinutes('');
            setSteps('');
            setKm('');
            setIntensity(type === 'walk' ? 'light' : 'medium');
            onClose();
          }}
        >
          Speichern
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(ACTIVITY_TYPES) as ActivityType[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                setType(k);
                setIntensity(k === 'walk' ? 'light' : 'medium');
              }}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl border py-3 text-[12.5px] font-medium transition',
                type === k ? 'border-accent/60 bg-accent/15 text-fg' : 'border-line/10 bg-raised text-muted',
              )}
            >
              <span className="text-[22px]">{ACTIVITY_TYPES[k].emoji}</span>
              {ACTIVITY_TYPES[k].label}
            </button>
          ))}
        </div>
        <div>
          <div className="mb-1.5 text-[12px] font-medium text-muted">Wann?</div>
          <div className="flex flex-wrap gap-1.5">
            {days.map((d) => (
              <Chip key={d} active={date === d} onClick={() => setDate(d)} className="h-8">
                {relDayLabel(d).split(',')[0]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Dauer (min)">
            <Input id="act-min" inputMode="numeric" placeholder="z. B. 120" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
          {t.usesSteps && (
            <Field label="Schritte">
              <Input id="act-steps" inputMode="numeric" placeholder="12000" value={steps} onChange={(e) => setSteps(e.target.value)} />
            </Field>
          )}
          {t.usesKm && (
            <Field label="km">
              <Input id="act-km" inputMode="decimal" placeholder="8,5" value={km} onChange={(e) => setKm(e.target.value)} />
            </Field>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[30, 60, 120, 180, 240].map((m) => (
            <Chip key={m} active={minutes === String(m)} onClick={() => setMinutes(String(m))} className="h-8">
              {m >= 60 ? `${m / 60} h` : `${m} min`}
            </Chip>
          ))}
        </div>
        <div>
          <div className="mb-1.5 text-[12px] font-medium text-muted">Intensität</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(INTENSITY) as Activity['intensity'][]).map((k) => (
              <button
                key={k}
                onClick={() => setIntensity(k)}
                className={cn('h-10 rounded-xl text-[13.5px] font-semibold', intensity === k ? 'bg-fg text-bg' : 'bg-raised text-muted')}
              >
                {INTENSITY[k].label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-raised p-3 text-[13px]">
          <div className="mb-1.5 font-semibold">Belastet dadurch (Schätzung)</div>
          {effect.length ? (
            <div className="flex flex-wrap gap-1.5">
              {effect.map(([m, v]) => (
                <span key={m} className="rounded-full bg-[rgb(var(--hl)/0.15)] px-2 py-0.5 text-[12px] font-medium text-[rgb(var(--hl))]">
                  {MUSCLE[m as keyof typeof MUSCLE].short} {v! >= 2 ? '●●●' : v! >= 1 ? '●●' : '●'}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-muted">Kaum Muskelbelastung – zählt kaum für die Regeneration.</span>
          )}
          <p className="mt-2 text-[12px] text-muted">
            ~{Math.round(activityMinutes(draft))} min. Aktivitäten zählen nicht als Hypertrophie-Sätze, aber als Ermüdung: Die Muskelkarte zeigt sie, und der Planer legt belastete
            Muskeln nicht direkt auf den Folgetag. Lange oder intensive Aktivitäten zählen bei der Ruhetag-Regel wie ein Trainingstag.
          </p>
        </div>
      </div>
    </Sheet>
  );
}

/** Körpergewicht schnell eintragen, mit Verlaufskurve und 7-Tage-Durchschnitt */
/** Gewicht mit Schieberegler – startet beim letzten Gewicht (±3 kg, 0,1-kg-Schritte) */
export function WeightSlider({ onSaved, compact }: { onSaved?: () => void; compact?: boolean }) {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const today = dateKey();
  const withW = s.body.filter((b) => b.weight);
  const todayEntry = withW.find((b) => b.date === today);
  const lastBefore = [...withW].reverse().find((b) => b.date < today);
  const ref = todayEntry?.weight ?? lastBefore?.weight ?? s.profile.weight ?? 74;
  const [v, setV] = useState(ref);
  const base = Math.round((lastBefore?.weight ?? ref) * 10) / 10;
  const min = Math.floor((base - 3) * 10) / 10;
  const max = Math.ceil((base + 3) * 10) / 10;
  const diff = lastBefore ? v - lastBefore.weight! : null;
  const clamp1 = (x: number) => Math.round(Math.min(max, Math.max(min, x)) * 10) / 10;
  const save = () => {
    s.addBody({ date: today, weight: v });
    toast(`${fmtNum(v)} kg gespeichert`);
    onSaved?.();
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="tnum text-[40px] font-bold leading-none tracking-tight">
            {fmtNum(v)}
            <span className="ml-1 text-[18px] font-semibold text-muted">kg</span>
          </div>
          <div className="mt-1 text-[12.5px] text-muted">
            {diff != null && lastBefore ? (
              <>
                <span className={cn('font-semibold', Math.abs(diff) < 0.05 ? 'text-fg' : diff > 0 ? 'text-rec-green' : 'text-accent')}>
                  {diff > 0 ? '+' : ''}
                  {fmtNum(diff, 1)} kg
                </span>{' '}
                ggü. {relDayLabel(lastBefore.date).split(',')[0]} ({fmtNum(lastBefore.weight!)} kg)
              </>
            ) : (
              'Erster Eintrag'
            )}
          </div>
        </div>
        <div className="flex gap-1.5 pb-1">
          {[-0.1, 0.1].map((d) => (
            <button
              key={d}
              onClick={() => setV(clamp1(v + d))}
              className="grid h-11 w-11 place-items-center rounded-full bg-raised text-[20px] font-semibold active:scale-95"
              aria-label={d > 0 ? 'plus 0,1 kg' : 'minus 0,1 kg'}
            >
              {d > 0 ? '+' : '−'}
            </button>
          ))}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.1}
        value={v}
        onChange={(e) => {
          setV(clamp1(Number(e.target.value)));
          try {
            navigator.vibrate?.(3);
          } catch {
            /* ignore */
          }
        }}
        aria-label="Körpergewicht"
        className="weight-range w-full"
        style={{ ['--p' as string]: `${((v - min) / (max - min)) * 100}%` }}
      />
      <div className="tnum -mt-1 flex justify-between text-[11px] text-muted">
        <span>{fmtNum(min)}</span>
        <span>{fmtNum(base)}</span>
        <span>{fmtNum(max)}</span>
      </div>
      <Button variant="primary" size={compact ? 'md' : 'lg'} className="w-full" onClick={save}>
        {todayEntry ? 'Aktualisieren' : 'Für heute speichern'}
      </Button>
    </div>
  );
}

/** Körpergewicht: Schieberegler + Verlaufskurve */
export function WeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const series = useWeightSeries(90);
  const trend = weightTrend(s as unknown as AppData);
  return (
    <Sheet open={open} onClose={onClose} title="Körpergewicht">
      <div className="flex flex-col gap-4">
        <WeightSlider onSaved={onClose} />
        <p className="text-[12px] text-muted">Am besten morgens nach dem Aufstehen wiegen – wann immer es passt, nicht zwingend täglich. Entscheidend ist der Durchschnitt.</p>
        <WeightChart series={series} />
        {trend && (
          <div className="tnum rounded-xl bg-raised px-3 py-2 text-[13px]">
            Trend (21 Tage): <span className="font-semibold">{trend.perWeek >= 0 ? '+' : ''}{fmtNum(trend.perWeek, 2)} kg/Woche</span>{' '}
            <span className="text-muted">({fmtNum(trend.pctPerWeek, 2)} %)</span>
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function useWeightSeries(days: number) {
  const body = useStore((s) => s.body);
  return useMemo(() => {
    const from = parseKey(dateKey()).getTime() - days * DAY;
    const pts = body.filter((b) => b.weight && parseKey(b.date).getTime() >= from).map((b) => ({ date: b.date, t: parseKey(b.date).getTime(), weight: b.weight! }));
    return pts.map((p) => {
      const win = pts.filter((q) => q.t <= p.t && q.t > p.t - 7 * DAY);
      return { date: p.date, label: fmtDate(p.date), weight: p.weight, avg: +(win.reduce((a, q) => a + q.weight, 0) / win.length).toFixed(2) };
    });
  }, [body, days]);
}

export function WeightChart({ series, height = 200 }: { series: { label: string; weight: number; avg: number }[]; height?: number }) {
  if (series.length < 2) return <p className="py-6 text-center text-[13px] text-muted">Ab zwei Einträgen erscheint hier deine Verlaufskurve.</p>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="rgb(var(--line) / 0.06)" />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v) => fmtNum(v, 1)} />
          <Tooltip content={<ChartTooltip unit=" kg" />} />
          <Line type="monotone" dataKey="weight" name="Gewicht" stroke="rgb(var(--rec-green) / 0.45)" strokeWidth={1.5} isAnimationActive={false} dot={{ r: 2.5, fill: 'rgb(var(--rec-green) / 0.6)', strokeWidth: 0 }} />
          <Line type="monotone" dataKey="avg" name="Ø 7 Tage" stroke="rgb(var(--rec-green))" strokeWidth={2.5} isAnimationActive={false} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gewichtskarte auf der Übersicht: groß, mit Verlauf (Tageswerte + 7-Tage-Schnitt), Trend und Einordnung für den Muskelaufbau */
export function WeightCard() {
  const s = useStore();
  const today = dateKey();
  const todayW = s.body.find((b) => b.date === today && b.weight)?.weight;
  const [edit, setEdit] = useState(false);
  const [sheet, setSheet] = useState(false);
  const series = useWeightSeries(42);
  const avg7 = series.length ? series[series.length - 1].avg : null;
  const trend = weightTrend(s as unknown as AppData);
  const last = s.body.filter((b) => b.weight).sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
  // Veränderung über 4 Wochen anhand des 7-Tage-Schnitts (glättet Wasser-/Salzschwankungen)
  const fourWeeksAgo = parseKey(today).getTime() - 28 * DAY;
  const old = series.find((p) => parseKey(p.date).getTime() >= fourWeeksAgo - 3 * DAY);
  const delta4 = avg7 != null && old && parseKey(old.date).getTime() <= fourWeeksAgo + 7 * DAY ? avg7 - old.avg : null;
  const pct = trend?.pctPerWeek ?? null;
  // Richtwert für fortgeschrittenen Muskelaufbau: ~0,1–0,3 % Körpergewicht pro Woche (wie Ernährungs-Empfehlung der App)
  const assess =
    pct == null
      ? { tone: 'muted', title: 'Noch kein Trend', text: 'Ab 3 Messungen über ≥ 10 Tage zeigt die App, ob du im Aufbau-Korridor liegst. Am besten morgens nach dem Aufstehen wiegen.' }
      : pct < 0.1
        ? { tone: 'yellow', title: pct < -0.05 ? 'Gewicht sinkt' : 'Zunahme sehr langsam', text: `Für Muskelaufbau bei Fortgeschrittenen sind ~0,1–0,3 % pro Woche ein guter Richtwert (bei dir ~${fmtNum(((last?.weight ?? 75) * 0.1) / 100, 2)}–${fmtNum(((last?.weight ?? 75) * 0.3) / 100, 2)} kg/Woche).${s.settings.nutritionEnabled ? ' Etwas mehr essen (~+150–200 kcal/Tag).' : ''}` }
        : pct > 0.35
          ? { tone: 'orange', title: 'Zunahme recht schnell', text: `Über ~0,3 % pro Woche steigt vor allem der Fettanteil. Richtwert bei dir: ~${fmtNum(((last?.weight ?? 75) * 0.1) / 100, 2)}–${fmtNum(((last?.weight ?? 75) * 0.3) / 100, 2)} kg/Woche.` }
          : { tone: 'green', title: 'Im Aufbau-Korridor', text: 'Langsame, stetige Zunahme – passt zu Muskelaufbau mit wenig Fettzuwachs. Steigt dazu deine Kraft, ist das ein gutes Zeichen.' };
  const toneCls = { green: 'bg-rec-green/10 text-rec-green', yellow: 'bg-rec-yellow/10 text-rec-yellow', orange: 'bg-rec-orange/10 text-rec-orange', muted: 'bg-raised text-muted' }[assess.tone as 'green'];
  const sign = (x: number, d = 1) => `${x >= 0 ? '+' : '−'}${fmtNum(Math.abs(x), d)}`;
  return (
    <div className="card flex flex-col gap-3.5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[14px] font-semibold">
          <Scale size={16} className="text-muted" /> Körpergewicht
        </div>
        <button onClick={() => setSheet(true)} className="text-[12.5px] text-muted hover:text-fg">
          Alle Einträge →
        </button>
      </div>
      {todayW && !edit ? (
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="tnum text-[40px] font-semibold leading-none tracking-tight">
              {fmtNum(todayW)}
              <span className="ml-1 text-[18px] font-medium text-muted">kg</span>
            </div>
            <div className="mt-1 text-[12px] text-muted">heute gewogen</div>
          </div>
          <button onClick={() => setEdit(true)} className="h-9 rounded-full bg-raised px-3.5 text-[12.5px] font-medium">
            Ändern
          </button>
        </div>
      ) : (
        <WeightSlider compact onSaved={() => setEdit(false)} />
      )}
      <div className="tnum grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-raised px-2.5 py-2">
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted">Ø 7 Tage</div>
          <div className="text-[16px] font-semibold">{avg7 != null ? `${fmtNum(avg7, 1)} kg` : '–'}</div>
        </div>
        <div className="rounded-2xl bg-raised px-2.5 py-2">
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted">pro Woche</div>
          <div className="text-[16px] font-semibold">{trend ? `${sign(trend.perWeek, 2)} kg` : '–'}</div>
        </div>
        <div className="rounded-2xl bg-raised px-2.5 py-2">
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted">4 Wochen</div>
          <div className="text-[16px] font-semibold">{delta4 != null ? `${sign(delta4)} kg` : '–'}</div>
        </div>
      </div>
      <WeightChart series={series} height={150} />
      <div className={cn('rounded-2xl px-3 py-2.5', toneCls)}>
        <div className="text-[13.5px] font-semibold">
          {assess.title}
          {pct != null && <span className="tnum font-normal opacity-80"> · {sign(pct, 2)} %/Woche</span>}
        </div>
        <div className="mt-0.5 text-[12px] leading-snug text-fg/75">{assess.text}</div>
      </div>
      <p className="text-[11px] text-muted">Die Waage zeigt Muskeln, Fett und Wasser zusammen – aussagekräftig ist der Trend über Wochen, zusammen mit steigender Kraft.</p>
      <WeightSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}

/** „+“ in der Kopfzeile: Aktivität, Training ohne Gym, Gewicht, Verfügbarkeit */
export function AddMenu() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(false);
  const [home, setHome] = useState(false);
  const [wt, setWt] = useState(false);
  const [more, setMore] = useState(false);
  const today = dateKey();
  const recent = (s.activities ?? []).filter((a) => a.date >= addDays(today, -6)).slice().reverse();
  const item = (icon: React.ReactNode, title: string, sub: string, run: () => void) => (
    <button
      onClick={() => {
        setOpen(false);
        setTimeout(run, 180);
      }}
      className="flex w-full items-center gap-3 rounded-2xl bg-raised px-3.5 py-3 text-left active:scale-[0.99]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bg text-[18px]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold">{title}</span>
        <span className="block truncate text-[12px] text-muted">{sub}</span>
      </span>
    </button>
  );
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Hinzufügen" className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg">
        <Plus size={20} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Hinzufügen">
        <div className="flex flex-col gap-2">
          {item('⛷️', 'Aktivität eintragen', 'Ski, Spazieren, Wandern … – auch für morgen', () => setAct(true))}
          {item('🏠', 'Training ohne Gym', 'Körpergewicht, Hantel & Flaschen', () => setHome(true))}
          {item('⚖️', 'Gewicht eintragen', 'Schieberegler ab deinem letzten Gewicht', () => setWt(true))}
          {item('🗓️', 'Zeit & Verfügbarkeit', 'Heute/Morgen Zeit, nur 1× diese Woche …', () => setMore(true))}
          {recent.length > 0 && (
            <div className="mt-3">
              <div className="label mb-1.5">Letzte Aktivitäten</div>
              <ul className="flex flex-col gap-1">
                {recent.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-xl bg-raised px-3 py-2 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-muted">{relDayLabel(a.date).split(',')[0]}: </span>
                      {activityLabel(a)} <span className="text-muted">· {INTENSITY[a.intensity].label}</span>
                    </span>
                    <button aria-label="Aktivität löschen" onClick={() => s.removeActivity(a.id)} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:text-fg">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Sheet>
      <ActivitySheet open={act} onClose={() => setAct(false)} />
      <HomeWorkoutSheet open={home} onClose={() => setHome(false)} />
      <WeightSheet open={wt} onClose={() => setWt(false)} />
      <Sheet open={more} onClose={() => setMore(false)} title="Zeit & Verfügbarkeit">
        <QuickAvailability />
      </Sheet>
    </>
  );
}
