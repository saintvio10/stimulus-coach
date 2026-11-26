import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, Pill, Plus, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/hooks';
import { Button, Card, Field, Input, PageHeader, Ring, SectionTitle, Switch } from '../components/ui';
import { calorieAdvice } from '../engine/stats';
import type { AppData } from '../lib/types';
import { addDays, cn, dateKey, fmtDate, fmtNum, relDayLabel } from '../lib/utils';
import { ChartTooltip, axisProps } from './Progress';

const QUICK = [
  { name: 'Proteinshake (30 g Whey)', kcal: 120, protein: 24 },
  { name: 'Skyr 500 g', kcal: 315, protein: 55 },
  { name: '3 Eier', kcal: 230, protein: 19 },
  { name: 'Hähnchenbrust 200 g', kcal: 330, protein: 62 },
];

export default function NutritionPage() {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const [day, setDay] = useState(dateKey());
  const n = s.nutrition[day] ?? { entries: [], creatine: false };
  const t = s.settings.targets;
  const kcal = n.entries.reduce((a, e) => a + e.kcal, 0);
  const protein = n.entries.reduce((a, e) => a + e.protein, 0);
  const [form, setForm] = useState({ name: '', kcal: '', protein: '' });
  const advice = calorieAdvice(s as unknown as AppData);
  const recent = useMemo(() => {
    const seen = new Map<string, { name: string; kcal: number; protein: number }>();
    Object.keys(s.nutrition)
      .sort()
      .reverse()
      .forEach((d) => s.nutrition[d].entries.forEach((e) => !seen.has(e.name) && seen.set(e.name, e)));
    return [...seen.values()].slice(0, 6);
  }, [s.nutrition]);
  const week = Array.from({ length: 14 }, (_, i) => addDays(dateKey(), -13 + i)).map((d) => {
    const x = s.nutrition[d];
    return {
      label: fmtDate(d),
      kcal: x ? x.entries.reduce((a, e) => a + e.kcal, 0) : 0,
      protein: x ? x.entries.reduce((a, e) => a + e.protein, 0) : 0,
      logged: !!x?.entries.length,
    };
  });
  const logged = week.slice(-7).filter((w) => w.logged);
  const avgK = logged.length ? logged.reduce((a, w) => a + w.kcal, 0) / logged.length : null;
  const avgP = logged.length ? logged.reduce((a, w) => a + w.protein, 0) / logged.length : null;
  const creatineDays = Array.from({ length: 7 }, (_, i) => s.nutrition[addDays(dateKey(), -i)]?.creatine).filter(Boolean).length;
  const sleep = n.sleep ?? s.checkIns[day]?.sleepHours;
  const add = (e: { name: string; kcal: number; protein: number }) => {
    s.addFood(day, e);
    toast(`${e.name} hinzugefügt`);
  };

  if (!s.settings.nutritionEnabled)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Ernährung" />
        <Card className="flex items-center justify-between gap-3">
          <span className="text-[14px]">Ernährungstagebuch ist deaktiviert.</span>
          <Button variant="primary" onClick={() => s.mutate((d) => void (d.settings.nutritionEnabled = true))}>
            Aktivieren
          </Button>
        </Card>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Ernährung" sub="Tagebuch (optional)" />
      <div className="flex items-center justify-between">
        <Button size="icon" variant="ghost" onClick={() => setDay(addDays(day, -1))} aria-label="Vorheriger Tag">
          <ChevronLeft size={18} />
        </Button>
        <div className="text-[15px] font-semibold">{relDayLabel(day)}</div>
        <Button size="icon" variant="ghost" disabled={day >= dateKey()} onClick={() => setDay(addDays(day, 1))} aria-label="Nächster Tag">
          <ChevronRight size={18} />
        </Button>
      </div>

      <Card className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Target label="Kalorien" value={kcal} goal={t.kcalMin} display={`${fmtNum(kcal, 0)}`} sub={`Ziel ${fmtNum(t.kcalMin, 0)}–${fmtNum(t.kcalMax, 0)} kcal`} ok={kcal >= t.kcalMin && kcal <= t.kcalMax} />
        <Target label="Protein" value={protein} goal={t.protein} display={`${fmtNum(protein, 0)} g`} sub={`Ziel ${t.protein} g (${fmtNum(t.protein / s.profile.weight, 1)} g/kg)`} ok={protein >= t.protein} />
        <div className="flex flex-col items-center gap-2 text-center">
          <Ring value={n.creatine ? 1 : 0} color="rgb(var(--rec-green))">
            <Pill size={20} className={n.creatine ? 'text-rec-green' : 'text-muted'} />
          </Ring>
          <div className="text-[13px] font-medium">Kreatin {t.creatine} g</div>
          <Switch id="creatine" checked={n.creatine} onChange={(v) => s.setCreatine(day, v)} label="Kreatin genommen" />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <Ring value={sleep ? sleep / t.sleepMax : 0} color={sleep && sleep >= t.sleepMin ? 'rgb(var(--rec-green))' : 'rgb(var(--rec-yellow))'}>
            <span className="tnum text-[14px] font-semibold">{sleep ? fmtNum(sleep) : '–'}</span>
          </Ring>
          <div className="text-[13px] font-medium">Schlaf (h)</div>
          <Input
            id="sleep-h"
            inputMode="decimal"
            className="h-8 w-20 text-center text-[14px]"
            placeholder={`${t.sleepMin}–${t.sleepMax}`}
            value={n.sleep ?? ''}
            onChange={(e) => s.setSleep(day, e.target.value === '' ? undefined : Number(e.target.value.replace(',', '.')))}
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <SectionTitle>Mahlzeiten</SectionTitle>
          <form
            className="grid grid-cols-[1fr_5rem_5rem_auto] items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name || !form.kcal) return toast('Name und Kalorien angeben');
              add({ name: form.name, kcal: Number(form.kcal), protein: Number(form.protein || 0) });
              setForm({ name: '', kcal: '', protein: '' });
            }}
          >
            <Field label="Lebensmittel">
              <Input id="f-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z. B. Mittagessen" />
            </Field>
            <Field label="kcal">
              <Input id="f-kcal" inputMode="numeric" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} />
            </Field>
            <Field label="Protein g">
              <Input id="f-prot" inputMode="numeric" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} />
            </Field>
            <Button type="submit" variant="primary" size="icon" className="h-10 w-10" aria-label="Hinzufügen">
              <Plus size={18} />
            </Button>
          </form>
          <div className="scroll-x mt-3 flex gap-1.5">
            {[...recent, ...QUICK.filter((q) => !recent.some((r) => r.name === q.name))].slice(0, 8).map((q) => (
              <button key={q.name} onClick={() => add(q)} className="shrink-0 rounded-full border border-line/10 px-3 py-1.5 text-[12px] text-muted hover:text-fg">
                + {q.name} <span className="tnum opacity-60">{q.kcal}</span>
              </button>
            ))}
          </div>
          <ul className="mt-4 flex flex-col divide-y divide-line/[0.06]">
            {n.entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-[14px]">
                <span className="min-w-0 flex-1 truncate">{e.name}</span>
                <span className="tnum text-[13px] text-muted">
                  {e.kcal} kcal · {e.protein} g
                </span>
                <Button size="icon" variant="ghost" onClick={() => s.removeFood(day, e.id)} aria-label="Löschen">
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
            {!n.entries.length && <li className="py-4 text-center text-[13px] text-muted">Noch nichts eingetragen.</li>}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className={cn(advice.status === 'low' && 'border-rec-yellow/25', advice.status === 'high' && 'border-rec-orange/25', advice.status === 'ok' && 'border-rec-green/25')}>
            <SectionTitle>Kalorienanpassung</SectionTitle>
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-full',
                  advice.status === 'low' ? 'bg-rec-yellow/15 text-rec-yellow' : advice.status === 'high' ? 'bg-rec-orange/15 text-rec-orange' : 'bg-rec-green/15 text-rec-green',
                )}
              >
                {advice.status === 'low' ? <TrendingUp size={18} /> : advice.status === 'high' ? <TrendingDown size={18} /> : <Minus size={18} />}
              </div>
              <div>
                <div className="text-[15px] font-semibold">{advice.title}</div>
                <p className="mt-1 text-[13px] text-muted">{advice.text}</p>
                {advice.delta !== 0 && (
                  <p className="tnum mt-2 text-[13px]">
                    Neues Ziel: {fmtNum(t.kcalMin + advice.delta, 0)}–{fmtNum(t.kcalMax + advice.delta, 0)} kcal{' '}
                    <button
                      className="ml-1 text-accent underline-offset-2 hover:underline"
                      onClick={() => {
                        s.mutate((d) => {
                          d.settings.targets.kcalMin += advice.delta;
                          d.settings.targets.kcalMax += advice.delta;
                        });
                        toast('Kalorienziel angepasst');
                      }}
                    >
                      übernehmen
                    </button>
                  </p>
                )}
              </div>
            </div>
          </Card>
          <Card className="grid grid-cols-3 gap-3">
            <div>
              <div className="label">Ø kcal 7 T</div>
              <div className="tnum mt-1 text-[18px] font-semibold">{avgK ? fmtNum(avgK, 0) : '–'}</div>
            </div>
            <div>
              <div className="label">Ø Protein</div>
              <div className="tnum mt-1 text-[18px] font-semibold">{avgP ? `${fmtNum(avgP, 0)} g` : '–'}</div>
            </div>
            <div>
              <div className="label">Kreatin</div>
              <div className="tnum mt-1 text-[18px] font-semibold">{creatineDays}/7</div>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <SectionTitle>Kalorien der letzten 14 Tage</SectionTitle>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={week} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--line) / 0.06)" />
              <XAxis dataKey="label" {...axisProps} interval={1} />
              <YAxis {...axisProps} />
              <ReferenceArea y1={t.kcalMin} y2={t.kcalMax} fill="rgb(var(--rec-green))" fillOpacity={0.08} />
              <Tooltip content={<ChartTooltip unit=" kcal" />} cursor={{ fill: 'rgb(var(--line) / 0.04)' }} />
              <Bar dataKey="kcal" name="Kalorien" fill="rgb(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-muted">Grüner Bereich = Zielkorridor. Die Empfehlung basiert auf deinem Gewichtstrend der letzten 21 Tage (lineare Regression).</p>
      </Card>
    </div>
  );
}

function Target({ label, value, goal, display, sub, ok }: { label: string; value: number; goal: number; display: string; sub: string; ok: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Ring value={value / goal} color={ok ? 'rgb(var(--rec-green))' : 'rgb(var(--accent))'}>
        <span className="tnum text-[13px] font-semibold">{Math.round((value / goal) * 100)}%</span>
      </Ring>
      <div>
        <div className="tnum text-[14px] font-semibold">{display}</div>
        <div className="text-[11px] text-muted">
          {label} · {sub}
        </div>
      </div>
    </div>
  );
}
