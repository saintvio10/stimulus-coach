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
import { HomeWorkoutButton } from './HomeWorkout';

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
export function WeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const lastW = [...s.body].reverse().find((b) => b.weight)?.weight;
  const [w, setW] = useState('');
  const series = useWeightSeries(90);
  const trend = weightTrend(s as unknown as AppData);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Körpergewicht"
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => {
            const v = Number((w || String(lastW ?? '')).replace(',', '.'));
            if (!(v > 30 && v < 300)) return toast('Bitte ein gültiges Gewicht eintragen');
            s.addBody({ date: dateKey(), weight: v });
            toast(`${fmtNum(v)} kg gespeichert`);
            setW('');
            onClose();
          }}
        >
          Für heute speichern
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-3">
          <Field label="Gewicht heute (kg)" className="flex-1">
            <Input id="bw-today" inputMode="decimal" autoFocus placeholder={lastW ? fmtNum(lastW) : '74,0'} value={w} onChange={(e) => setW(e.target.value)} className="h-14 text-[24px] font-semibold" />
          </Field>
          <div className="flex gap-1.5 pb-1">
            {[-0.1, 0.1].map((d) => (
              <Button
                key={d}
                size="icon"
                variant="secondary"
                className="h-12 w-12"
                onClick={() => setW(fmtNum(+(Number((w || String(lastW ?? 0)).replace(',', '.')) + d).toFixed(1)))}
                aria-label={d > 0 ? 'plus 0,1 kg' : 'minus 0,1 kg'}
              >
                {d > 0 ? '+' : '−'}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-muted">Tipp: morgens nach dem Aufstehen, vor dem Essen wiegen. Schwankungen von Tag zu Tag sind normal – entscheidend ist der Durchschnitt.</p>
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
      return { label: fmtDate(p.date), weight: p.weight, avg: +(win.reduce((a, q) => a + q.weight, 0) / win.length).toFixed(2) };
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

/** Schnelleintrag-Leiste + letzte Aktivitäten */
export function QuickLog() {
  const s = useStore();
  const [act, setAct] = useState(false);
  const [wt, setWt] = useState(false);
  const today = dateKey();
  const recent = (s.activities ?? []).filter((a) => a.date >= addDays(today, -6)).slice().reverse();
  const todayW = s.body.find((b) => b.date === today && b.weight)?.weight;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setAct(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line/10 px-3.5 text-[12.5px] font-medium text-muted hover:text-fg">
          <Plus size={13} /> Aktivität (Ski, Spazieren …)
        </button>
        <button onClick={() => setWt(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line/10 px-3.5 text-[12.5px] font-medium text-muted hover:text-fg">
          <Scale size={13} /> {todayW ? `${fmtNum(todayW)} kg heute` : 'Gewicht eintragen'}
        </button>
        <HomeWorkoutButton />
      </div>
      {recent.length > 0 && (
        <ul className="flex flex-col gap-1">
          {recent.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-[12.5px] ring-1 ring-line/[0.06]">
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
      )}
      <ActivitySheet open={act} onClose={() => setAct(false)} />
      <WeightSheet open={wt} onClose={() => setWt(false)} />
    </div>
  );
}
