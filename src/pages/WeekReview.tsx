import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Clock, Dumbbell, Flame, Layers, Scale, Target, TrendingUp, Trophy, Footprints } from 'lucide-react';
import { useStore } from '../lib/store';
import { usePlan } from '../lib/hooks';
import type { AppData } from '../lib/types';
import { MUSCLE } from '../lib/muscles';
import { addDays, cn, dateKey, fmtMin, fmtNum, parseKey, startOfWeek, MONTHS } from '../lib/utils';
import { Card, SectionTitle } from '../components/ui';
import { weekReview } from '../engine/sessionStats';
import { personalTarget } from '../engine/planner';

/** Kalenderwoche nach ISO 8601 */
export function isoWeek(key: string): number {
  const d = parseKey(key);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86_400_000 + 1) / 7);
}

const rangeTxt = (a: string, b: string) => {
  const A = parseKey(a);
  const B = parseKey(b);
  return A.getMonth() === B.getMonth() ? `${A.getDate()}.–${B.getDate()}. ${MONTHS[B.getMonth()]}` : `${A.getDate()}. ${MONTHS[A.getMonth()]} – ${B.getDate()}. ${MONTHS[B.getMonth()]}`;
};

function Delta({ cur, prev, unit = '', pct }: { cur: number; prev: number; unit?: string; pct?: boolean }) {
  if (!prev) return <span className="text-muted">Vorwoche –</span>;
  const d = pct ? (cur / prev - 1) * 100 : cur - prev;
  if (Math.abs(d) < (pct ? 1 : 0.5)) return <span className="text-muted">wie Vorwoche</span>;
  return (
    <span className={d > 0 ? 'text-rec-green' : 'text-rec-orange'}>
      {d > 0 ? '▲' : '▼'} {d > 0 ? '+' : ''}
      {fmtNum(d, pct ? 0 : 1)}
      {pct ? ' %' : unit} ggü. Vorwoche
    </span>
  );
}

function Tile({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-4 sm:p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {icon}
        {label}
      </div>
      <div className="tnum mt-1.5 text-[24px] font-semibold leading-none tracking-tight">{value}</div>
      {sub && <div className="mt-1.5 text-[11.5px]">{sub}</div>}
    </Card>
  );
}

export default function WeekReviewPage() {
  const s = useStore();
  const data = s as unknown as AppData;
  const today = dateKey();
  const thisWeek = startOfWeek(today);
  // Standard: letzte abgeschlossene Woche
  const [start, setStart] = useState(addDays(thisWeek, -7));
  const plan = usePlan();
  const r = useMemo(
    () => weekReview(data, start, (m) => personalTarget(data, m, plan.spw)),
    [start, s.sessions, s.exercises, s.body, s.activities, s.settings, s.profile], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const ring = 2 * Math.PI * 44;
  const reached = r.muscles.filter((m) => m.sets >= m.target * 0.9).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Kopf mit Wochen-Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button aria-label="Vorherige Woche" onClick={() => setStart(addDays(start, -7))} className="grid h-10 w-10 place-items-center rounded-full bg-raised">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="label">Wochenrückblick · KW {isoWeek(start)}</div>
          <div className="text-[15px] font-semibold">
            {rangeTxt(start, r.end)}
            {!r.complete && <span className="ml-1.5 text-[12px] font-medium text-muted">(läuft noch)</span>}
          </div>
        </div>
        <button aria-label="Nächste Woche" disabled={start >= thisWeek} onClick={() => setStart(addDays(start, 7))} className="grid h-10 w-10 place-items-center rounded-full bg-raised disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Score */}
      <div className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(80%_70%_at_50%_0%,rgba(61,220,151,0.22),transparent_70%),rgb(var(--surface))] p-5 ring-1 ring-line/[0.06]">
        <div className="flex items-center gap-5">
          <div className="relative grid h-28 w-28 shrink-0 place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90 drop-shadow-[0_0_14px_rgba(61,220,151,0.45)]">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(var(--line) / 0.1)" strokeWidth="8" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(var(--rec-green))" strokeWidth="8" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - r.score / 100)} className="transition-[stroke-dashoffset] duration-700" />
            </svg>
            <div className="text-center">
              <div className="tnum text-[30px] font-bold leading-none">{r.score}</div>
              <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted">Score</div>
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold leading-tight tracking-tight">{r.headline}</h1>
            <p className="mt-1 text-[13px] text-muted">
              {reached}/{r.muscles.length} Muskeln im Wochenziel · {r.sessions} {r.sessions === 1 ? 'Einheit' : 'Einheiten'}
              {r.streak >= 2 && <> · {r.streak} Wochen in Folge 🔥</>}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted">Score: 60 % Volumen-Zielerreichung je Muskel, 25 % Einheiten, 15 % Intensität (Nähe zum Versagen).</p>
      </div>

      {r.sessions === 0 ? (
        <Card>
          <p className="text-[14px]">In dieser Woche wurde kein Training gespeichert.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tile icon={<Dumbbell size={12} />} label="Einheiten" value={r.sessions} sub={<Delta cur={r.sessions} prev={r.prevSessions} />} />
            <Tile icon={<Clock size={12} />} label="Trainingszeit" value={fmtMin(r.minutes)} sub={<span className="text-muted">{r.reps} Wiederholungen</span>} />
            <Tile icon={<Layers size={12} />} label="Sätze" value={r.sets} sub={<Delta cur={r.sets} prev={r.prevSets} />} />
            <Tile icon={<TrendingUp size={12} />} label="Volumen" value={`${fmtNum(r.volume / 1000, 1)} t`} sub={<Delta cur={r.volume} prev={r.prevVolume} pct />} />
          </div>

          {(r.prs.length > 0 || r.gains.length > 0) && (
            <Card>
              <SectionTitle>
                <span className="inline-flex items-center gap-1.5">
                  <Trophy size={15} className="text-rec-yellow" /> Highlights
                </span>
              </SectionTitle>
              <ul className="flex flex-col gap-2 text-[13.5px]">
                {r.prs.slice(0, 5).map((p) => (
                  <li key={p} className="flex gap-2">
                    <Trophy size={14} className="mt-0.5 shrink-0 text-rec-yellow" /> {p}
                  </li>
                ))}
                {r.gains.map((g) => (
                  <li key={g.name} className="flex gap-2">
                    <TrendingUp size={14} className="mt-0.5 shrink-0 text-rec-green" />
                    <span>
                      <b>{g.name}</b> {fmtNum(g.pct, 1)} % stärker (e1RM)
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <SectionTitle>Volumen je Muskel</SectionTitle>
            <p className="-mt-1 mb-3 text-[12px] text-muted">Sätze diese Woche · Strich = Wochenziel · grau = Vorwoche</p>
            <ul className="flex flex-col gap-2.5">
              {r.muscles.map((m) => {
                const max = Math.max(m.target * 1.25, m.sets, m.prev, 1);
                const ok = m.sets >= m.target * 0.9;
                return (
                  <li key={m.muscle} className="flex items-center gap-3 text-[13px]">
                    <span className="w-[92px] shrink-0 truncate">
                      {ok ? '✓ ' : ''}
                      {MUSCLE[m.muscle].short}
                    </span>
                    <span className="relative h-2.5 flex-1 rounded-full bg-raised">
                      <span className="absolute inset-y-0 left-0 rounded-full bg-fg/15" style={{ width: `${(m.prev / max) * 100}%` }} />
                      <span className={cn('absolute inset-y-0 left-0 rounded-full', ok ? 'bg-rec-green' : 'bg-accent')} style={{ width: `${(m.sets / max) * 100}%`, opacity: 0.95 }} />
                      <span className="absolute -top-1 h-[18px] w-0.5 rounded bg-fg/70" style={{ left: `${(m.target / max) * 100}%` }} />
                    </span>
                    <span className="tnum w-14 text-right text-muted">
                      {fmtNum(m.sets, 1)}/{fmtNum(m.target, 0)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Tile
              icon={<Flame size={12} />}
              label="Intensität"
              value={r.avgRir != null ? `Ø ${fmtNum(r.avgRir, 1)} RIR` : '–'}
              sub={<span className="text-muted">{r.avgRir == null ? '' : r.avgRir <= 2.2 ? 'nah genug am Versagen' : 'mehr Richtung Versagen'}</span>}
            />
            <Tile icon={<Clock size={12} />} label="Satzabstand" value={r.avgGapSec != null ? `${Math.floor(r.avgGapSec / 60)}:${String(Math.round(r.avgGapSec % 60)).padStart(2, '0')}` : '–'} sub={<span className="text-muted">Ø von Satz zu Satz</span>} />
            {r.weight && (
              <Tile
                icon={<Scale size={12} />}
                label="Körpergewicht"
                value={`${fmtNum(r.weight.avg, 1)} kg`}
                sub={
                  r.weight.prevAvg != null ? (
                    <span className="text-muted">
                      Ø · {r.weight.avg - r.weight.prevAvg >= 0 ? '+' : ''}
                      {fmtNum(r.weight.avg - r.weight.prevAvg, 2)} kg ggü. Vorwoche
                    </span>
                  ) : (
                    <span className="text-muted">Ø dieser Woche</span>
                  )
                }
              />
            )}
            {r.activities > 0 && <Tile icon={<Footprints size={12} />} label="Aktivitäten" value={r.activities} sub={<span className="text-muted">{fmtMin(r.activityMin)} außerhalb des Studios</span>} />}
          </div>
        </>
      )}

      <Card>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            <Target size={15} className="text-accent" /> Fokus für die nächste Woche
          </span>
        </SectionTitle>
        <ul className="flex flex-col gap-2 text-[13.5px]">
          {r.focus.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> {f}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Karte für die Übersicht: letzte Woche auf einen Blick */
export function WeekReviewCard({ onOpen }: { onOpen: () => void }) {
  const s = useStore();
  const data = s as unknown as AppData;
  const start = addDays(startOfWeek(dateKey()), -7);
  const plan = usePlan();
  const r = useMemo(() => weekReview(data, start, (m) => personalTarget(data, m, plan.spw)), [s.sessions, s.exercises, s.body, s.settings, plan.spw]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r.sessions && !r.prevSessions) return null;
  const ring = 2 * Math.PI * 20;
  return (
    <button onClick={onOpen} className="card flex items-center gap-4 p-4 text-left transition active:scale-[0.99]">
      <div className="relative grid h-14 w-14 shrink-0 place-items-center">
        <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
          <circle cx="24" cy="24" r="20" fill="none" stroke="rgb(var(--line) / 0.1)" strokeWidth="5" />
          <circle cx="24" cy="24" r="20" fill="none" stroke="rgb(var(--rec-green))" strokeWidth="5" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - r.score / 100)} />
        </svg>
        <span className="tnum text-[15px] font-bold">{r.score}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="label">Wochenrückblick · KW {isoWeek(start)}</div>
        <div className="text-[16px] font-semibold">{r.headline}</div>
        <div className="truncate text-[12.5px] text-muted">
          {r.sessions} {r.sessions === 1 ? "Einheit" : "Einheiten"} · {r.sets} Sätze · {r.muscles.filter((m) => m.sets >= m.target * 0.9).length}/{r.muscles.length} Muskeln im Ziel
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </button>
  );
}
