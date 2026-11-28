import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useStore } from '../lib/store';
import type { AppData, MuscleId } from '../lib/types';
import { MUSCLE } from '../lib/muscles';
import { cn, fmtNum } from '../lib/utils';
import { GROWTH_COLOR, GROWTH_LABEL, muscleGrowth, type GrowthStatus } from '../engine/growth';
import { Card, SectionTitle } from './ui';
import { FigureFrame, MuscleFigure } from './MuscleFigure';

const ORDER: GrowthStatus[] = ['build', 'likely', 'maintain', 'stall', 'decline', 'low', 'none'];

/** „Baust du gerade auf – und wo?“ Schätzung je Muskel aus Volumen, Krafttrend und Körpergewicht */
export function GrowthCard() {
  const s = useStore();
  const g = useMemo(() => muscleGrowth(s as unknown as AppData), [s.sessions, s.body, s.exercises, s.profile, s.settings, s.volumeAdjust]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<MuscleId | null>(null);
  const fills = Object.fromEntries(g.muscles.filter((x) => x.status !== 'none').map((x) => [x.muscle, GROWTH_COLOR[x.status]])) as Partial<Record<MuscleId, string>>;
  const by = (st: GrowthStatus[]) => g.muscles.filter((x) => st.includes(x.status)).map((x) => MUSCLE[x.muscle].short);
  const building = by(['build', 'likely']);
  const keeping = by(['maintain', 'stall']);
  const losing = by(['decline', 'low']);
  const list = [...g.muscles].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const wt = g.weight;
  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle>Aufbau oder Erhalt?</SectionTitle>
      {g.weeks < 3 && (
        <p className="-mt-1 rounded-xl bg-raised px-3 py-2 text-[12px] text-muted">
          Noch wenig Verlauf – die Einschätzung wird nach ~3 Wochen Training deutlich zuverlässiger (Kraftverlauf braucht 3 vergleichbare Einheiten je Übung).
        </p>
      )}
      <div className="flex flex-col gap-1 text-[13px]">
        {building.length > 0 && (
          <div>
            <span className="font-semibold text-rec-green">Aufbau: </span>
            {building.join(', ')}
          </div>
        )}
        {keeping.length > 0 && (
          <div>
            <span className="font-semibold text-rec-yellow">Erhalt: </span>
            {keeping.join(', ')}
          </div>
        )}
        {losing.length > 0 && (
          <div>
            <span className="font-semibold text-rec-red">Zu wenig / Rückgang: </span>
            {losing.join(', ')}
          </div>
        )}
      </div>
      <FigureFrame>
        <MuscleFigure fills={fills} selected={open ?? undefined} onSelect={(m) => setOpen(open === m ? null : m)} className="w-full" />
      </FigureFrame>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[11px] text-muted">
        {(['build', 'likely', 'maintain', 'stall', 'decline', 'low'] as GrowthStatus[]).map((st) => (
          <span key={st} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: GROWTH_COLOR[st] }} />
            {GROWTH_LABEL[st]}
          </span>
        ))}
      </div>
      <ul className="flex flex-col divide-y divide-line/[0.06]">
        {list.map((x) => {
          const isOpen = open === x.muscle;
          return (
            <li key={x.muscle}>
              <button onClick={() => setOpen(isOpen ? null : x.muscle)} className="flex w-full items-center gap-2.5 py-2.5 text-left" aria-expanded={isOpen}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GROWTH_COLOR[x.status] }} />
                <span className="min-w-0 flex-1 truncate text-[14px]">{MUSCLE[x.muscle].label}</span>
                <span className="shrink-0 text-[12.5px] font-medium" style={{ color: x.status === 'likely' ? 'rgb(var(--rec-green))' : GROWTH_COLOR[x.status] }}>
                  {GROWTH_LABEL[x.status]}
                </span>
                <ChevronDown size={15} className={cn('shrink-0 text-muted transition', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="mb-2 ml-5 flex animate-fade-up flex-col gap-1.5 rounded-xl bg-raised px-3 py-2.5 text-[12.5px] leading-relaxed">
                  <div>{x.text}</div>
                  <div className="tnum text-muted">
                    Volumen Ø {fmtNum(x.weekly)}/Woche · Erhalt ab ~{fmtNum(Math.round(x.maintain))} · Aufbau ab ~{fmtNum(Math.round(x.grow))} · dein Ziel {fmtNum(x.target)}
                    {x.trend != null && ` · Kraft ${x.trend >= 0 ? '+' : ''}${fmtNum(x.trend)} %/4 Wo.${x.trendFrom.length ? ` (${x.trendFrom.slice(0, 2).join(', ')})` : ''}`}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="rounded-xl bg-raised px-3 py-2 text-[12px] text-muted">
        <span className="font-medium text-fg">Körpergewicht: </span>
        {wt
          ? `${wt.pctPerWeek >= 0 ? '+' : ''}${fmtNum(wt.pctPerWeek, 2)} % pro Woche – ${g.deficit ? 'im Defizit wird Aufbau gebremst, Kraft und Muskeln eher gehalten.' : wt.pctPerWeek < 0.05 ? 'etwa gleichbleibend: Aufbau ist möglich, aber langsamer als mit leichtem Überschuss.' : 'leichter Überschuss – gute Voraussetzung für Aufbau.'}`
          : 'Trag dein Gewicht regelmäßig ein (≥ 3 Messungen über 10 Tage) – dann fließt der Trend mit ein.'}
      </p>
      <p className="text-[11px] leading-relaxed text-muted">
        Schätzung, keine Messung: Muskelwachstum sieht man direkt nur per Ultraschall/MRT. Die App kombiniert Wochenvolumen (Erhalt braucht ~⅓ des Aufbauvolumens), deinen Kraftverlauf aus vergleichbaren Einheiten und den Gewichtstrend. Muskel antippen für Details.
      </p>
    </Card>
  );
}

/** Kompakt für die Startseite: wo gerade Aufbau, Erhalt oder zu wenig – Antippen öffnet die Muskelanalyse */
export function GrowthSummary({ onOpen }: { onOpen: () => void }) {
  const s = useStore();
  const g = useMemo(() => muscleGrowth(s as unknown as AppData), [s.sessions, s.body, s.exercises, s.profile, s.settings, s.volumeAdjust]); // eslint-disable-line react-hooks/exhaustive-deps
  if (g.muscles.every((x) => x.status === 'none')) return null;
  const rows: { label: string; color: string; st: GrowthStatus[] }[] = [
    { label: 'Aufbau', color: 'text-rec-green', st: ['build', 'likely'] },
    { label: 'Erhalt', color: 'text-rec-yellow', st: ['maintain', 'stall'] },
    { label: 'Zu wenig', color: 'text-rec-red', st: ['decline', 'low'] },
  ];
  return (
    <button onClick={onOpen} className="flex w-full flex-col gap-2 rounded-[24px] border border-line/[0.08] bg-surface p-4 text-left transition active:scale-[0.99]">
      <div className="flex items-baseline justify-between">
        <span className="text-[17px] font-semibold">Aufbau oder Erhalt?</span>
        <span className="text-[12px] text-muted">Details →</span>
      </div>
      {rows.map((r) => {
        const ms = g.muscles.filter((x) => r.st.includes(x.status));
        if (!ms.length) return null;
        return (
          <div key={r.label} className="flex gap-2 text-[13px]">
            <span className={cn('w-[72px] shrink-0 font-semibold', r.color)}>{r.label}</span>
            <span className="text-fg/80">{ms.map((x) => MUSCLE[x.muscle].short).join(', ')}</span>
          </div>
        );
      })}
      {g.weeks < 3 && <span className="text-[11.5px] text-muted">Noch wenig Verlauf – nach ~3 Wochen zuverlässiger.</span>}
    </button>
  );
}
