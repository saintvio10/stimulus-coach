import { recoveryInfo, RECOVERY_MODEL_NOTE } from '../engine/fatigue';
import { useMemo, useState } from 'react';
import { Bar as RBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../lib/store';
import { useMuscleStates, usePlan } from '../lib/hooks';
import { Badge, Bar, Card, PageHeader, SectionTitle, Segmented } from '../components/ui';
import { FigureFrame, MuscleFigure } from '../components/MuscleFigure';
import { RecoveryBars } from '../components/RecoveryBars';
import { MUSCLE, MUSCLES, RECOVERY_COLORS, RECOVERY_LABEL, minDose14, priorityWeight, weeklyTarget, type RecoveryColor } from '../lib/muscles';
import type { AppData, MuscleId } from '../lib/types';
import { personalTarget } from '../engine/planner';
import { weeklySeries } from '../engine/fatigue';
import { HOUR, cn, dateKey, fmtNum, relDayLabel } from '../lib/utils';
import { ChartTooltip, axisProps } from './Progress';

export default function MusclesPage() {
  const s = useStore();
  const { states, events } = useMuscleStates();
  const plan = usePlan();
  const [sel, setSel] = useState<MuscleId>('biceps');
  const [side, setSide] = useState<'both' | 'front' | 'back'>('both');
  const colors = Object.fromEntries(MUSCLES.map((m) => [m.id, states[m.id].color])) as Record<MuscleId, RecoveryColor>;
  const st = states[sel];
  const meta = MUSCLE[sel];
  const spw = plan.spw; // gemeinsames Wochenziel für alle Ansichten
  const target = personalTarget(s as unknown as AppData, sel, spw);
  const adj = s.volumeAdjust?.[sel];
  const hist = useMemo(() => weeklySeries(events, sel, 8), [events, sel]);
  const nextPlanned = plan.sessions.find((p) => p.decisions.some((d) => d.muscle === sel && d.sets >= 1) || p.exercises.some((e) => (s.exercises.find((x) => x.id === e.exerciseId)?.muscles[sel] ?? 0) > 0));
  const now = Date.now();
  const lastTxt = st.lastAny ? `${relDayLabel(dateKey(st.lastAny))} (vor ${Math.round((now - st.lastAny) / HOUR)} h)` : 'noch nie';
  const readyTxt = st.readyAt <= now ? 'jetzt' : `${relDayLabel(dateKey(st.readyAt))}, ~${new Date(st.readyAt).getHours()} Uhr`;
  const rank = meta.group ? s.profile.priorities.indexOf(meta.group) + 1 : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Muskelanalyse" sub="Regeneration & Volumen" action={<Segmented value={side} onChange={setSide} options={[{ value: 'both', label: 'Beide' }, { value: 'front', label: 'Vorne' }, { value: 'back', label: 'Hinten' }]} />} />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="flex flex-col gap-3">
          <FigureFrame>
            <MuscleFigure
              view={side}
              fills={Object.fromEntries(MUSCLES.filter((m) => states[m.id].color !== 'gray').map((m) => [m.id, RECOVERY_COLORS[states[m.id].color]]))}
              selected={sel}
              onSelect={setSel}
              className={cn('mx-auto w-full', side === 'both' ? 'max-w-[640px]' : 'max-w-[340px]')}
            />
          </FigureFrame>
          <p className="-mt-1 text-center text-[12px] text-muted">
            Muskel antippen · ausgewählt: <span className="font-medium text-fg">{meta.label}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[11px] text-muted">
            {(Object.keys(RECOVERY_LABEL) as RecoveryColor[]).map((c) => (
              <span key={c} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: RECOVERY_COLORS[c] }} />
                {RECOVERY_LABEL[c]}
              </span>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="label">{rank ? `Priorität ${rank}` : 'Nur indirekt trainiert'}</div>
              <h2 className="mt-1 text-[22px] font-semibold">{meta.label}</h2>
            </div>
            <Badge tone={st.color}>{RECOVERY_LABEL[st.color]}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Letztes Training" value={lastTxt} />
            <Tile label="Erholung (Schätzung)" value={recoveryInfo(st).label} />
            <Tile label="Direkte Sätze 7 / 14 T" value={`${fmtNum(st.direct7)} / ${fmtNum(st.direct14)}`} />
            <Tile label="Indirekte Sätze (geschätzt)" value={`${fmtNum(st.indirect7)} / ${fmtNum(st.indirect14)}`} />
            <Tile label="Volumenlast 7 T" value={`${fmtNum(st.load7 / 1000, 1)} t`} />
            <Tile label="Wieder bereit (Schätzung)" value={readyTxt} />
          </div>
          <div className="rounded-xl bg-raised p-3 text-[12.5px]">
            <div className="font-medium">{recoveryInfo(st).advice}</div>
            <div className="mt-0.5 text-muted">Grundlage: {recoveryInfo(st).basis}.</div>
            <div className="mt-1.5 text-[11.5px] text-muted">{RECOVERY_MODEL_NOTE} Muskelkater & Bereitschaft trägst du oben rechts im Check-in ein – die Empfehlung vor dem Training passt sich daran an.</div>
          </div>
          {!meta.indirectOnly && (
            <div className="rounded-xl bg-raised p-3 text-[13px]">
              <div className="label mb-1">Persönliche Volumen-Anpassung</div>
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn('tnum text-[17px] font-semibold', (adj?.factor ?? 1) > 1 ? 'text-rec-green' : (adj?.factor ?? 1) < 1 ? 'text-rec-yellow' : '')}>
                  {(adj?.factor ?? 1) === 1 ? '±0 %' : `${(adj!.factor > 1 ? '+' : '−') + Math.round(Math.abs(adj!.factor - 1) * 100)} %`}
                </span>
                <span className="text-[12px] text-muted">{adj?.updatedOn ? `geprüft ${relDayLabel(adj.updatedOn)}` : 'wird wöchentlich geprüft'}</span>
              </div>
              <p className="mt-1 text-muted">{adj?.reason ?? 'Noch zu wenig Daten (mind. 3 Einheiten über 3 Wochen).'}</p>
            </div>
          )}
          <div>
            <div className="mb-1.5 flex justify-between text-[12px]">
              <span className="text-muted">7-Tage-Volumen vs. Ziel</span>
              <span className="tnum">
                {fmtNum(st.vol7)} / {fmtNum(target)} Sätze
              </span>
            </div>
            <Bar value={st.vol7 / target} marker={minDose14(sel, s.profile.priorities, spw, s.settings) / 2 / target} />
          </div>
          <div className="rounded-xl bg-raised p-3 text-[13px]">
            <div className="label mb-1">Empfohlener nächster Reiz</div>
            {meta.indirectOnly ? (
              <p className="text-muted">Wird über Mehrgelenksübungen ausreichend mittrainiert – kein direktes Training nötig.</p>
            ) : nextPlanned ? (
              <p>
                {relDayLabel(nextPlanned.date)} im Rahmen von „{nextPlanned.label}“
                {nextPlanned.decisions.find((d) => d.muscle === sel)?.sets ? ` mit ca. ${fmtNum(nextPlanned.decisions.find((d) => d.muscle === sel)!.sets)} Sätzen` : ''}.
                <span className="text-muted"> Frühestens sinnvoll: {readyTxt}.</span>
              </p>
            ) : (
              <p className="text-muted">Frühestens sinnvoll: {readyTxt}. Aktuell keine Einheit geplant – markiere verfügbare Tage im Kalender.</p>
            )}
            {st.soreness > 0 && <p className="mt-1 text-rec-orange">Muskelkater gemeldet – fließt in die Schätzung ein.</p>}
          </div>
          <div>
            <SectionTitle className="mb-2">Historische Entwicklung (Sätze/Woche)</SectionTitle>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hist} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <CartesianGrid vertical={false} stroke="rgb(var(--line) / 0.06)" />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip unit=" Sätze" />} cursor={{ fill: 'rgb(var(--line) / 0.04)' }} />
                  <RBar dataKey="direct" name="Direkt" stackId="a" fill="rgb(var(--accent))" radius={[0, 0, 0, 0]} />
                  <RBar dataKey="indirect" name="Indirekt" stackId="a" fill="rgb(var(--accent) / 0.35)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="text-[11px] text-muted">
            Alle Regenerationswerte sind Schätzungen eines vereinfachten Modells (abklingende Ermüdung je Satz, muskelspezifische Zeitkonstante von {meta.tau} h, plus
            gemeldeter Muskelkater) – keine medizinisch exakten Messwerte.
          </p>
        </Card>
      </div>

      <Card>
        <SectionTitle>Muskelregeneration</SectionTitle>
        <p className="-mt-1 mb-3 text-[12px] text-muted">Muskeln, die noch Erholung brauchen, stehen oben.</p>
        <RecoveryBars states={states} sortByNeed />
      </Card>

      <Card>
        <SectionTitle>Alle Muskelgruppen</SectionTitle>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {MUSCLES.map((m) => {
            const x = states[m.id];
            return (
              <button
                key={m.id}
                onClick={() => {
                  setSel(m.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={cn('flex items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-raised', sel === m.id && 'bg-raised')}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RECOVERY_COLORS[x.color] }} />
                <span className="w-32 shrink-0 truncate text-[13px]">{m.label}</span>
                <span className="tnum flex-1 text-[12px] text-muted">
                  {fmtNum(x.vol7)} Sätze · {recoveryInfo(x).short}
                </span>
                <span className="tnum text-[11px] text-muted">P {fmtNum(priorityWeight(m.id, s.profile.priorities), 2)}</span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-raised px-3 py-2.5">
      <div className="truncate text-[11px] text-muted">{label}</div>
      <div className="tnum mt-0.5 text-[14px] font-semibold">{value}</div>
    </div>
  );
}
