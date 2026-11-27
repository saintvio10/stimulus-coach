import { useMemo, useState, type ReactNode } from 'react';
import { CalendarClock, Clock, Dumbbell, Flame, Footprints, Hourglass, Layers, Star, TrendingUp, Trophy } from 'lucide-react';
import { useStore } from '../lib/store';
import { useRouter } from '../lib/hooks';
import type { AppData } from '../lib/types';
import { MUSCLE } from '../lib/muscles';
import { fmtNum } from '../lib/utils';
import { Card, Empty, PageHeader, SectionTitle, Segmented } from '../components/ui';
import { overallStats, fmtMinSec } from '../engine/sessionStats';
import { personalTarget } from '../engine/planner';

type Range = '30' | '90' | 'all';

function Big({ icon, label, value, unit, sub }: { icon: ReactNode; label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return (
    <Card className="p-4 sm:p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {icon}
        {label}
      </div>
      <div className="tnum mt-1.5 text-[26px] font-semibold leading-none tracking-tight">
        {value}
        {unit && <span className="ml-1 text-[15px] font-medium text-muted">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-muted">{sub}</div>}
    </Card>
  );
}

function Row({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[14px]">{label}</div>
        {hint && <div className="text-[11.5px] text-muted">{hint}</div>}
      </div>
      <div className="tnum shrink-0 text-right text-[15px] font-semibold">{value}</div>
    </div>
  );
}

export default function StatsPage() {
  const s = useStore();
  const [range, setRange] = useState<Range>('90');
  const go = useRouter((r) => r.go);
  const data = s as unknown as AppData;
  const st = useMemo(() => overallStats(data, range === 'all' ? null : Number(range)), [s.sessions, s.exercises, s.activities, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const rangeTxt = range === 'all' ? 'insgesamt' : `in ${range} Tagen`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Statistiken" sub="Dein Training in Zahlen" />
      <button onClick={() => go('rueckblick')} className="card flex items-center justify-between p-4 text-left text-[14px] font-medium">
        Wochenrückblick ansehen <span className="text-muted">→</span>
      </button>
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: '30', label: '30 Tage' },
          { value: '90', label: '90 Tage' },
          { value: 'all', label: 'Gesamt' },
        ]}
      />

      {st.sessions === 0 ? (
        <Card>
          <Empty title="Noch keine Trainings in diesem Zeitraum" text="Nach deiner ersten Einheit erscheinen hier deine Statistiken." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Big icon={<Dumbbell size={12} />} label="Trainings" value={st.sessions} sub={`Ø ${fmtNum(st.perWeek, 1)} pro Woche`} />
            <Big icon={<Clock size={12} />} label="Trainingszeit" value={fmtNum(st.hours, 1)} unit="h" sub={st.avgMin ? `Ø ${st.avgMin} min pro Einheit` : undefined} />
            <Big icon={<Layers size={12} />} label="Sätze" value={st.sets.toLocaleString('de-DE')} sub={`${st.reps.toLocaleString('de-DE')} Wiederholungen`} />
            <Big icon={<TrendingUp size={12} />} label="Volumen" value={fmtNum(st.volume / 1000, 1)} unit="t" sub="bewegtes Gewicht" />
          </div>

          <Card>
            <SectionTitle>Gewohnheiten</SectionTitle>
            <div className="divide-y divide-line/[0.06]">
              <Row label="Wochen-Serie" value={<><Flame size={14} className="mr-1 inline text-rec-orange" />{st.streak} {st.streak === 1 ? 'Woche' : 'Wochen'}</>} hint={`Rekord: ${st.longestStreak} Wochen am Stück`} />
              {st.favDay && <Row label="Häufigster Trainingstag" value={st.favDay} />}
              {st.avgStart && <Row label="Ø Startzeit" value={`${st.avgStart} Uhr`} />}
              {st.favExercise && <Row label="Lieblingsübung" value={st.favExercise.name} hint={`${st.favExercise.sets} Sätze ${rangeTxt}`} />}
            </div>
          </Card>

          <Card>
            <SectionTitle>
              <span className="inline-flex items-center gap-1.5">
                <Hourglass size={15} /> Pausen
              </span>
            </SectionTitle>
            {st.avgGapSec != null ? (
              <div className="divide-y divide-line/[0.06]">
                <Row label="Ø Abstand von Satz zu Satz" value={fmtMinSec(st.avgGapSec)} hint="inkl. Satz – Ziel: 2–3 min bei Grundübungen, 1,5–2 min bei Isolation" />
                {st.avgRestPerSession != null && <Row label="Ø Pausenzeit pro Training" value={`${Math.round(st.avgRestPerSession)} min`} hint="geschätzt: Satzabstand minus ~40 s Arbeit" />}
              </div>
            ) : (
              <p className="text-[13px] text-muted">Pausen werden ab jetzt pro Satz gemessen – nach dem nächsten Training siehst du hier deine Werte.</p>
            )}
          </Card>

          <Card>
            <SectionTitle>
              <span className="inline-flex items-center gap-1.5">
                <Trophy size={15} className="text-rec-yellow" /> Rekorde & Fortschritt
              </span>
            </SectionTitle>
            <div className="divide-y divide-line/[0.06]">
              <Row label="Neue Rekorde" value={st.prs} hint={rangeTxt} />
              {st.heaviest && <Row label="Schwerster Satz" value={`${fmtNum(st.heaviest.weight)} kg × ${st.heaviest.reps}`} hint={st.heaviest.name} />}
            </div>
            {st.topGains.length > 0 && (
              <div className="mt-3">
                <div className="label mb-2">Stärkste Steigerung (geschätztes 1RM)</div>
                <ul className="flex flex-col gap-2">
                  {st.topGains.map((g) => (
                    <li key={g.name} className="flex items-center gap-3 text-[13.5px]">
                      <span className="min-w-0 flex-1 truncate">{g.name}</span>
                      <span className="tnum text-[12px] text-muted">
                        {fmtNum(g.from, 1)} → {fmtNum(g.to, 1)} kg
                      </span>
                      <span className={g.pct >= 0 ? 'tnum w-14 text-right font-semibold text-rec-green' : 'tnum w-14 text-right font-semibold text-muted'}>
                        {g.pct >= 0 ? '+' : ''}
                        {fmtNum(g.pct, 0)} %
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>
              <span className="inline-flex items-center gap-1.5">
                <Star size={15} /> Sätze pro Woche je Muskel
              </span>
            </SectionTitle>
            <p className="-mt-1 mb-3 text-[12px] text-muted">Ø {rangeTxt}, Strich = dein Wochenziel</p>
            <ul className="flex flex-col gap-2.5">
              {st.muscles.map((m) => {
                const target = personalTarget(data, m.muscle, s.settings.sessionsPerWeek);
                const max = Math.max(target * 1.3, ...st.muscles.map((x) => x.perWeek));
                return (
                  <li key={m.muscle} className="flex items-center gap-3 text-[13px]">
                    <span className="w-[92px] shrink-0 truncate">{MUSCLE[m.muscle].short}</span>
                    <span className="relative h-2 flex-1 rounded-full bg-raised">
                      <span
                        className={m.perWeek >= target ? 'absolute inset-y-0 left-0 rounded-full bg-rec-green' : 'absolute inset-y-0 left-0 rounded-full bg-accent'}
                        style={{ width: `${Math.min(100, (m.perWeek / max) * 100)}%` }}
                      />
                      <span className="absolute -top-1 h-4 w-0.5 rounded bg-fg/60" style={{ left: `${Math.min(100, (target / max) * 100)}%` }} />
                    </span>
                    <span className="tnum w-14 text-right text-muted">
                      {fmtNum(m.perWeek, 1)}/{fmtNum(target, 0)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          {st.activities.count > 0 && (
            <Card>
              <SectionTitle>
                <span className="inline-flex items-center gap-1.5">
                  <Footprints size={15} /> Aktivitäten außerhalb des Studios
                </span>
              </SectionTitle>
              <div className="divide-y divide-line/[0.06]">
                <Row label="Aktivitäten" value={st.activities.count} />
                <Row label="Dauer" value={`${fmtNum(st.activities.minutes / 60, 1)} h`} />
                {st.activities.km > 0 && <Row label="Strecke" value={`${fmtNum(st.activities.km, 1)} km`} />}
                {st.activities.steps > 0 && <Row label="Schritte" value={st.activities.steps.toLocaleString('de-DE')} />}
              </div>
            </Card>
          )}
          <p className="flex items-center gap-1.5 px-1 text-[11.5px] text-muted">
            <CalendarClock size={12} /> Volumen = Gewicht × Wiederholungen aller erledigten Sätze.
          </p>
        </>
      )}
    </div>
  );
}
