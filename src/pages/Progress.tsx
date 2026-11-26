import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/hooks';
import { Button, Card, Field, Input, PageHeader, SectionTitle, Segmented, Select, Empty } from '../components/ui';
import { RANGE_DAYS, doneSessions, exerciseSeries, inRange, personalRecords, weeklyBuckets, type RangeKey } from '../engine/stats';
import type { AppData } from '../lib/types';
import { dateKey, fmtDate, fmtNum, fmtShortDay } from '../lib/utils';
import { WeightChart, useWeightSeries } from '../components/Extras';

export const axisProps = {
  tick: { fill: 'rgb(var(--muted))', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export function ChartTooltip({ active, payload, label, unit = '' }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line/10 bg-raised px-3 py-2 text-[12px] shadow-xl">
      <div className="mb-1 text-muted">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="tnum flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold">{fmtNum(p.value, 1)}{unit}</span>
        </div>
      ))}
    </div>
  );
}

const C1 = 'rgb(var(--accent))';
const C2 = 'rgb(var(--rec-green))';
const C3 = 'rgb(var(--rec-yellow))';

export default function ProgressPage() {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const data = s as unknown as AppData;
  const [range, setRange] = useState<RangeKey>('3M');
  const done = useMemo(() => doneSessions(data), [s.sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  const used = useMemo(() => {
    const c = new Map<string, number>();
    done.forEach((x) => x.exercises.forEach((e) => e.sets.some((st) => st.done) && c.set(e.exerciseId, (c.get(e.exerciseId) ?? 0) + 1)));
    return s.exercises.filter((e) => c.has(e.id)).sort((a, b) => (c.get(b.id) ?? 0) - (c.get(a.id) ?? 0));
  }, [done, s.exercises]);
  const [exId, setExId] = useState<string>('');
  const ex = used.find((e) => e.id === exId) ?? used[0];
  const series = useMemo(() => (ex ? exerciseSeries(ex.id, done).filter((p) => inRange(p.date, range)).map((p) => ({ ...p, label: fmtDate(p.date) })) : []), [ex, done, range]);
  const weeks = useMemo(() => weeklyBuckets(done, range), [done, range]);
  const body = s.body.filter((b) => inRange(b.date, range)).map((b) => ({ ...b, label: fmtDate(b.date) }));
  const prs = useMemo(() => [...personalRecords(s.sessions).values()].sort((a, b) => b.e1rm.value - a.e1rm.value), [s.sessions]);
  const weightSeries = useWeightSeries(365);
  const [form, setForm] = useState({ date: dateKey(), weight: '', arm: '', chest: '', waist: '' });
  const num = (v: string) => (v === '' ? undefined : Number(v.replace(',', '.')));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Fortschritt" sub="Analyse" />
      <Segmented
        value={range}
        onChange={setRange}
        options={(Object.keys(RANGE_DAYS) as RangeKey[]).map((r) => ({ value: r, label: r === '1J' ? '1 Jahr' : r === '1W' ? '1 Woche' : r.replace('M', ' Mon.') }))}
      />

      <Card>
        <SectionTitle
          action={
            used.length > 0 && (
              <Select id="pr-ex" className="h-9 max-w-[220px] text-[13px]" value={ex?.id ?? ''} onChange={(e) => setExId(e.target.value)}>
                {used.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            )
          }
        >
          Kraftentwicklung
        </SectionTitle>
        {series.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartBox title="Geschätztes 1RM & Trainingsgewicht (kg)">
              <LineChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--line) / 0.06)" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip unit=" kg" />} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'rgb(var(--muted))' }} iconType="circle" iconSize={7} />
                <Line type="monotone" dataKey="e1rm" name="e1RM" stroke={C1} strokeWidth={2} dot={{ r: 2.5, fill: C1 }} />
                <Line type="stepAfter" dataKey="topWeight" name="Arbeitsgewicht" stroke={C2} strokeWidth={1.8} dot={false} />
              </LineChart>
            </ChartBox>
            <ChartBox title="Wiederholungen">
              <LineChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--line) / 0.06)" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
                <Line type="monotone" dataKey="bestReps" name="Beste Wdh. (Arbeitsgewicht)" stroke={C3} strokeWidth={2} dot={{ r: 2.5, fill: C3 }} />
                <Line type="monotone" dataKey="totalReps" name="Gesamt-Wdh." stroke={C1} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ChartBox>
            <ChartBox title="Volumen dieser Übung (kg × Wdh.)">
              <BarChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--line) / 0.06)" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip content={<ChartTooltip unit=" kg" />} cursor={{ fill: 'rgb(var(--line) / 0.04)' }} />
                <Bar dataKey="volume" name="Volumen" fill={C1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartBox>
          </div>
        ) : (
          <Empty title="Noch keine Daten im Zeitraum" text="Absolvierte Sätze erscheinen hier automatisch. Wähle ggf. einen längeren Zeitraum." />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Trainingsvolumen pro Woche</SectionTitle>
          <ChartBox>
            <BarChart data={weeks} margin={{ top: 6, right: 8, bottom: 0, left: -6 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--line) / 0.06)" />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => `${Math.round(v / 1000)}t`} />
              <Tooltip content={<ChartTooltip unit=" kg" />} cursor={{ fill: 'rgb(var(--line) / 0.04)' }} />
              <Bar dataKey="volume" name="Volumen" fill={C1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Card>
        <Card>
          <SectionTitle>Trainingshäufigkeit</SectionTitle>
          <ChartBox>
            <BarChart data={weeks} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--line) / 0.06)" />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--line) / 0.04)' }} />
              <Bar dataKey="sessions" name="Einheiten" fill={C2} radius={[4, 4, 0, 0]} />
              <Bar dataKey="sets" name="Sätze" fill="rgb(var(--accent) / 0.45)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Körpergewicht</SectionTitle>
          <WeightChart series={weightSeries} height={220} />
          <p className="mt-2 text-[11.5px] text-muted">Punkte = einzelne Messungen · Linie = Ø 7 Tage</p>
        </Card>
        <Card>
          <SectionTitle>Umfänge (cm)</SectionTitle>
          {body.some((b) => b.arm || b.chest || b.waist) ? (
            <ChartBox>
              <LineChart data={body.filter((b) => b.arm || b.chest || b.waist)} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--line) / 0.06)" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis yAxisId="l" {...axisProps} domain={['auto', 'auto']} />
                <YAxis yAxisId="r" orientation="right" {...axisProps} domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip unit=" cm" />} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
                <Line yAxisId="r" connectNulls type="monotone" dataKey="arm" name="Oberarm" stroke={C1} strokeWidth={2} dot={{ r: 2 }} />
                <Line yAxisId="l" connectNulls type="monotone" dataKey="chest" name="Brust" stroke={C2} strokeWidth={2} dot={{ r: 2 }} />
                <Line yAxisId="l" connectNulls type="monotone" dataKey="waist" name="Taille" stroke={C3} strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ChartBox>
          ) : (
            <Empty title="Noch keine Umfänge" text="Trage Oberarm, Brust und Taille unten ein – idealerweise alle 2–4 Wochen unter gleichen Bedingungen." />
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>Körperdaten eintragen</SectionTitle>
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.weight && !form.arm && !form.chest && !form.waist) return toast('Mindestens einen Wert eintragen');
            s.addBody({ date: form.date, weight: num(form.weight), arm: num(form.arm), chest: num(form.chest), waist: num(form.waist) });
            setForm({ ...form, weight: '', arm: '', chest: '', waist: '' });
            toast('Gespeichert');
          }}
        >
          <Field label="Datum" className="col-span-2 sm:col-span-1">
            <Input id="b-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Gewicht (kg)">
            <Input id="b-w" inputMode="decimal" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder={fmtNum(s.profile.weight)} />
          </Field>
          <Field label="Oberarm (cm)">
            <Input id="b-arm" inputMode="decimal" value={form.arm} onChange={(e) => setForm({ ...form, arm: e.target.value })} />
          </Field>
          <Field label="Brust (cm)">
            <Input id="b-chest" inputMode="decimal" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} />
          </Field>
          <Field label="Taille (cm)">
            <Input id="b-waist" inputMode="decimal" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="primary" className="w-full">
              Speichern
            </Button>
          </div>
        </form>
        {s.body.length > 0 && (
          <ul className="mt-4 flex max-h-56 flex-col divide-y divide-line/[0.06] overflow-y-auto text-[13px]">
            {[...s.body].reverse().map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-muted">{fmtShortDay(b.date)}</span>
                <span className="tnum flex-1 text-right">
                  {[b.weight && `${fmtNum(b.weight)} kg`, b.arm && `Arm ${fmtNum(b.arm)}`, b.chest && `Brust ${fmtNum(b.chest)}`, b.waist && `Taille ${fmtNum(b.waist)}`].filter(Boolean).join(' · ')}
                </span>
                <Button size="icon" variant="ghost" onClick={() => s.removeBody(b.id)} aria-label="Eintrag löschen">
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Persönliche Rekorde</SectionTitle>
        {prs.length ? (
          <div className="overflow-x-auto">
            <table className="tnum w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="py-2 font-medium">Übung</th>
                  <th className="py-2 font-medium">Bestes e1RM</th>
                  <th className="py-2 font-medium">Höchstgewicht</th>
                  <th className="py-2 font-medium">Datum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/[0.06]">
                {prs.map((p) => (
                  <tr key={p.e1rm.exerciseId}>
                    <td className="py-2 pr-3">{s.exercises.find((e) => e.id === p.e1rm.exerciseId)?.name ?? p.e1rm.exerciseId}</td>
                    <td className="py-2 pr-3">
                      {fmtNum(p.e1rm.value, 1)} kg <span className="text-muted">({fmtNum(p.e1rm.weight)}×{p.e1rm.reps})</span>
                    </td>
                    <td className="py-2 pr-3">
                      {fmtNum(p.weight.value)} kg × {p.weight.reps}
                    </td>
                    <td className="py-2 text-muted">{fmtShortDay(p.e1rm.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Noch keine Rekorde" />
        )}
        <p className="mt-3 text-[11px] text-muted">e1RM = geschätztes Ein-Wiederholungs-Maximum (Epley-Formel, Wiederholungen + RIR). Nur eine Schätzung, kein getestetes Maximum.</p>
      </Card>
    </div>
  );
}

function ChartBox({ title, children }: { title?: string; children: React.ReactElement }) {
  return (
    <div>
      {title && <div className="mb-2 text-[12px] text-muted">{title}</div>}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
