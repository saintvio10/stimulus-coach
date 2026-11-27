import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { ArrowRight, BarChart3, Flame, Play, Trophy, TrendingUp, AlertTriangle, Moon } from 'lucide-react';
import { useStore } from '../lib/store';
import { useMuscleStates, useNow, usePlan, useRouter } from '../lib/hooks';
import { Badge, Bar, Button, Card, Ring, SectionTitle, Stat } from '../components/ui';
import { DayHero, DayPicker, HomeHeader, QuickStart, SwipeDays, UpcomingDays, WeeklyNeed } from '../components/Home';
import { MUSCLE, MUSCLES, RECOVERY_COLORS, minDose14, weeklyTarget } from '../lib/muscles';
import { readinessLabel, readinessScore } from '../engine/readiness';
import { avgDurationMin, doneSessions, exerciseSeries, personalRecords, sessionSets, weekStreak } from '../engine/stats';
import { cn, dateKey, fmtDuration, fmtNum, fmtShortDay, parseKey, relDayLabel, WEEKDAYS_LONG, MONTHS, DAY, fmtMin } from '../lib/utils';
import type { AppData } from '../lib/types';
import { planToday, personalTarget } from '../engine/planner';
import { WeightCard } from '../components/Extras';
import { WeekReviewCard } from './WeekReview';

export default function Dashboard() {
  const s = useStore();
  const data = s as unknown as AppData;
  const plan = usePlan();
  const { states } = useMuscleStates();
  const go = useRouter((r) => r.go);
  const todayKey = dateKey(useNow());
  const [day, setDay] = useState(todayKey);
  useEffect(() => setDay(todayKey), [todayKey]);
  const today = dateKey();
  const d = new Date();
  const active = s.sessions.find((x) => x.status === 'active');
  const done = useMemo(() => doneSessions(data), [s.sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  const readiness = readinessScore(s.checkIns[today]);
  const rl = readinessLabel(readiness);
  const first = plan.sessions[0];
  const todayPlan = first?.date === today ? first : null;
  const next = todayPlan ? plan.sessions[1] : first;
  const spw = s.settings.sessionsPerWeek;

  const startToday = () => {
    const p = todayPlan ?? planToday(data);
    s.startSession(p);
    go('training');
  };

  const prs = useMemo(() => {
    const m = personalRecords(s.sessions);
    return [...m.values()].map((v) => v.e1rm).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  }, [s.sessions]);

  const strength = useMemo(() => {
    const counts = new Map<string, number>();
    done.forEach((x) => x.exercises.forEach((e) => counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1)));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => {
        const ser = exerciseSeries(id, done);
        const change = ser.length >= 2 ? (ser[ser.length - 1].e1rm / ser[0].e1rm - 1) * 100 : 0;
        return { id, ser, change, name: s.exercises.find((e) => e.id === id)?.name ?? id };
      });
  }, [done, s.exercises]);

  const bw = s.body.filter((b) => b.weight).slice(-30);
  const last30 = done.filter((x) => parseKey(x.date).getTime() > Date.now() - 30 * DAY).length;
  const avgDur = avgDurationMin(done);
  const streak = weekStreak(s.sessions);
  const vol7 = MUSCLES.filter((m) => !m.indirectOnly).reduce((a, m) => a + states[m.id].direct7, 0);
  const under = MUSCLES.filter((m) => !m.indirectOnly && states[m.id].vol14 < minDose14(m.id, s.profile.priorities, spw));

  return (
    <div className="flex flex-col gap-6">
      <HomeHeader />
      <div className="flex flex-col gap-3">
        <DayPicker plan={plan} selected={day} onSelect={setDay} />
      </div>
      <SwipeDays plan={plan} day={day} onDay={setDay} />
      <UpcomingDays plan={plan} />
      <WeightCard />
      <WeekReviewCard onOpen={() => go('rueckblick')} />
      <WeeklyNeed plan={plan} />
      <QuickStart />

      {/* Kennzahlen */}
      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Stat label="Trainings" value={done.length} sub={`${last30} in 30 Tagen`} />
        <Stat label="Ø Dauer" value={avgDur ? fmtMin(avgDur) : '–'} sub="pro Einheit" />
        <Stat
          label="Serie"
          value={
            <span className="flex items-center gap-1.5">
              {streak}
              <Flame size={18} className={streak ? 'text-rec-orange' : 'text-muted'} />
            </span>
          }
          sub={streak === 1 ? 'Woche in Folge' : 'Wochen in Folge'}
        />
        <Stat label="Direkte Sätze" value={fmtNum(vol7, 0)} sub="letzte 7 Tage" />
        </div>
        <button onClick={() => go('statistik')} className="flex items-center justify-between rounded-xl bg-raised px-3.5 py-3 text-[14px] font-medium">
          <span className="flex items-center gap-2">
            <BarChart3 size={16} className="text-accent" /> Alle Statistiken
          </span>
          <ArrowRight size={16} className="text-muted" />
        </button>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 md:gap-4">
        {/* Regeneration */}
        <Card>
          <SectionTitle action={<button className="text-[13px] text-muted hover:text-fg" onClick={() => go('muskeln')}>Muskelkarte</button>}>
            Muskelregeneration
          </SectionTitle>
          <ul className="flex flex-col gap-2.5">
            {MUSCLES.filter((m) => !m.indirectOnly).map((m) => {
              const st = states[m.id];
              return (
                <li key={m.id} className="flex items-center gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: RECOVERY_COLORS[st.color] }} />
                  <span className="w-28 shrink-0 truncate text-[13px]">{m.label}</span>
                  <Bar value={st.lastAny ? st.recovery / 100 : 0} color={RECOVERY_COLORS[st.color]} />
                  <span className="tnum w-10 shrink-0 text-right text-[12px] text-muted">{st.lastAny ? `${st.recovery}%` : '–'}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-muted">Geschätzte Werte aus Satzvolumen, Abstand zum Versagen, Zeit und Muskelkater – keine Messung.</p>
        </Card>

        {/* Volumen */}
        <Card>
          <SectionTitle>Trainingsvolumen 7 / 14 Tage</SectionTitle>
          <ul className="flex flex-col gap-2.5">
            {MUSCLES.filter((m) => !m.indirectOnly).map((m) => {
              const st = states[m.id];
              const t = personalTarget(data, m.id, spw);
              const adj = s.volumeAdjust?.[m.id]?.factor ?? 1;
              return (
                <li key={m.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
                  <span className="flex min-w-0 items-center gap-1 truncate text-[13px]">
                    {m.label}
                    {adj !== 1 && <span className={cn('text-[10.5px] font-semibold', adj > 1 ? 'text-rec-green' : 'text-rec-yellow')}>{adj > 1 ? '↑' : '↓'}</span>}
                  </span>
                  <div className="flex flex-col gap-1">
                    <Bar value={st.vol7 / t} />
                    <Bar value={st.vol14 / (2 * t)} color="rgb(var(--accent) / 0.4)" />
                  </div>
                  <span className="tnum text-right text-[12px] text-muted">
                    {fmtNum(st.vol7)}/{fmtNum(t)} · {fmtNum(st.vol14)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-muted">Fraktionale Sätze: direkte Sätze = 1, indirekte = 0,5. Ziel abhängig von Priorität und {spw}× Training/Woche. Fehlendes Volumen gleicht der Planer automatisch aus. ↑/↓ = persönlich angepasstes Ziel (siehe Muskelanalyse).</p>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:gap-4">
        <Card>
          <SectionTitle action={<button className="text-[13px] text-muted hover:text-fg" onClick={() => go('fortschritt')}>Details</button>}>
            Kraftentwicklung
          </SectionTitle>
          {strength.length ? (
            <ul className="flex flex-col gap-3">
              {strength.map((x) => (
                <li key={x.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{x.name}</div>
                    <div className={cn('tnum text-[12px]', x.change >= 0 ? 'text-rec-green' : 'text-rec-orange')}>
                      e1RM {x.change >= 0 ? '+' : ''}
                      {fmtNum(x.change)} %
                    </div>
                  </div>
                  <div className="h-10 w-28">
                    <Spark data={x.ser.map((p) => ({ v: p.e1rm }))} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Nach den ersten Trainings erscheinen hier deine Kraftkurven.</p>
          )}
        </Card>
        <Card>
          <SectionTitle action={<button className="text-[13px] text-muted hover:text-fg" onClick={() => go('fortschritt')}>Eintragen</button>}>
            Körpergewicht
          </SectionTitle>
          <div className="flex items-end justify-between gap-3">
            <Stat label="Aktuell" value={bw.length ? `${fmtNum(bw[bw.length - 1].weight)} kg` : '–'} sub={bw.length > 1 ? `${fmtNum(bw[bw.length - 1].weight! - bw[0].weight!, 1)} kg seit ${fmtShortDay(bw[0].date)}` : undefined} />
            <div className="h-14 w-40">{bw.length > 1 && <Spark data={bw.map((b) => ({ v: b.weight! }))} color="rgb(var(--rec-green))" />}</div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:gap-4">
        <Card>
          <SectionTitle>
            <span className="flex items-center gap-2">
              <Trophy size={16} className="text-rec-yellow" /> Persönliche Rekorde
            </span>
          </SectionTitle>
          {prs.length ? (
            <ul className="flex flex-col divide-y divide-line/[0.06]">
              {prs.map((p) => (
                <li key={p.exerciseId} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="min-w-0 truncate">{s.exercises.find((e) => e.id === p.exerciseId)?.name}</span>
                  <span className="tnum shrink-0 text-muted">
                    {fmtNum(p.weight)} kg × {p.reps} · e1RM {fmtNum(p.value, 0)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Noch keine Rekorde.</p>
          )}
        </Card>
        <Card>
          <SectionTitle action={<button className="text-[13px] text-muted hover:text-fg" onClick={() => go('kalender')}>Alle</button>}>Trainingshistorie</SectionTitle>
          {done.length ? (
            <ul className="flex flex-col divide-y divide-line/[0.06]">
              {[...done]
                .reverse()
                .slice(0, 5)
                .map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{x.title}</div>
                      <div className="text-[12px] text-muted">{fmtShortDay(x.date)}</div>
                    </div>
                    <span className="tnum shrink-0 text-muted">
                      {sessionSets(x)} Sätze{x.endedAt ? ` · ${fmtMin((x.endedAt - x.startedAt) / 60000)}` : ''}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <EmptyHistory />
          )}
        </Card>
      </div>

    </div>
  );
}

function EmptyHistory() {
  const go = useRouter((r) => r.go);
  return (
    <div className="flex flex-col gap-2 text-[13px] text-muted">
      <p>Noch keine Trainings gespeichert. Starte dein erstes Training – oder lade Beispieldaten im Profil, um alle Funktionen auszuprobieren.</p>
      <div>
        <Button size="sm" variant="outline" onClick={() => go('profil')}>
          <Moon size={14} /> Zu den Daten-Einstellungen
        </Button>
      </div>
    </div>
  );
}

export function Spark({ data, color = 'rgb(var(--accent))' }: { data: { v: number }[]; color?: string }) {
  const id = useMemo(() => 'g' + Math.random().toString(36).slice(2, 8), []);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 2, left: 4 }}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} fill={`url(#${id})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export { TrendingUp };
