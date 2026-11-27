import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BarChart3, Check, Clock, Dumbbell, Flame, Hourglass, Layers, Minus, Repeat2, TrendingDown, TrendingUp, Trophy, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { useRouter } from '../lib/hooks';
import type { MuscleId, Session } from '../lib/types';
import { MUSCLE } from '../lib/muscles';
import { cn, fmtDate, fmtMin, fmtNum, fmtShortDay, relDayLabel } from '../lib/utils';
import { bodyWeightAt, estimateKcal, exerciseComparison, sessionStats, sessionsThisWeek, fmtMinSec, KCAL_MET, type ExerciseCompare } from '../engine/sessionStats';
import { weekStreak } from '../engine/stats';
import { MuscleFigure } from './MuscleFigure';
import { BackupButton } from './Backup';

/** Zahl hochzählen lassen (kurz, ~0,9 s) */
function useCountUp(target: number, ms = 900, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - t0) / ms));
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

function Count({ value, digits = 0, delay = 0 }: { value: number; digits?: number; delay?: number }) {
  const v = useCountUp(value, 900, delay);
  return <>{fmtNum(v, digits)}</>;
}

function Tile({ icon, label, children, sub, delay }: { icon: ReactNode; label: string; children: ReactNode; sub?: ReactNode; delay: number }) {
  return (
    <div className="animate-fade-up rounded-2xl bg-white/[0.05] p-3.5 ring-1 ring-white/[0.06]" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">
        {icon}
        {label}
      </div>
      <div className="tnum mt-1.5 text-[24px] font-semibold leading-none tracking-tight text-white">{children}</div>
      {sub && <div className="mt-1.5 text-[11.5px] text-white/50">{sub}</div>}
    </div>
  );
}

/** kleiner Verlauf (alt → heute), letzter Punkt hervorgehoben */
function Spark({ values, tone }: { values: number[]; tone: 'up' | 'down' | 'flat' }) {
  if (values.length < 2) return null;
  const W = 64,
    H = 26,
    P = 3;
  const lo = Math.min(...values),
    hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [P + (i * (W - 2 * P)) / (values.length - 1), H - P - ((v - lo) / span) * (H - 2 * P)] as const);
  const col = tone === 'up' ? 'rgb(var(--rec-green))' : tone === 'down' ? 'rgb(var(--rec-red))' : 'rgba(255,255,255,0.55)';
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden>
      <polyline points={pts.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={col} strokeOpacity={0.85} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.8} fill={col} />
    </svg>
  );
}

const setTxt = (c: ExerciseCompare, b: { weight: number; reps: number }) => (c.weighted ? `${fmtNum(b.weight)} kg × ${b.reps}` : `${b.reps} Wdh.`);

function CompareRow({ c, delay }: { c: ExerciseCompare; delay: number }) {
  const tone = c.trend === 'up' ? 'up' : c.trend === 'down' ? 'down' : 'flat';
  return (
    <li className="flex animate-fade-up items-center gap-3 py-2.5" style={{ animationDelay: `${delay}ms` }}>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium leading-tight text-white">{c.name}</div>
        <div className="tnum mt-1 text-[12px] leading-snug text-white/55">
          <span className="text-white/85">{setTxt(c, c.best)}</span>
          {c.prevBest ? (
            <>
              {' '}· zuletzt {setTxt(c, c.prevBest)} ({fmtShortDay(c.prevBest.date)})
            </>
          ) : (
            <> · erstes Mal – Startwert gesetzt</>
          )}
        </div>
        {c.first && Math.abs(c.first.pct) >= 1 && (
          <div className="tnum mt-0.5 text-[11.5px] text-white/40">
            seit {fmtDate(c.first.date)}: {c.first.pct > 0 ? '+' : ''}
            {fmtNum(c.first.pct, 0)} %
          </div>
        )}
      </div>
      <Spark values={c.history} tone={tone} />
      <div
        className={cn(
          'tnum flex w-[76px] shrink-0 flex-col items-end whitespace-nowrap text-[13px] font-semibold leading-tight',
          tone === 'up' ? 'text-rec-green' : tone === 'down' ? 'text-rec-red' : 'text-white/50',
        )}
      >
        {c.pct == null ? (
          <span className="text-[11.5px] font-medium text-white/40">neu</span>
        ) : c.weightUp ? (
          <>
            <span className="flex items-center gap-0.5">
              <TrendingUp size={13} />+{fmtNum(c.weightUp, 2)} kg
            </span>
            <span className="text-[10.5px] font-medium text-white/40">mehr Gewicht</span>
          </>
        ) : (
          <span className="flex items-center gap-0.5">
            {tone === 'up' ? <TrendingUp size={13} /> : tone === 'down' ? <TrendingDown size={13} /> : <Minus size={13} />}
            {c.pct > 0 ? '+' : ''}
            {fmtNum(c.pct, Math.abs(c.pct) < 10 ? 1 : 0)} %
          </span>
        )}
      </div>
    </li>
  );
}

/** anschauliche Vergleiche fürs bewegte Gewicht */
function tonnageFact(kg: number): string | null {
  if (kg < 300) return null;
  if (kg >= 2400) return `so viel wie ${fmtNum(kg / 1200, 1)} Kleinwagen (à ~1,2 t)`;
  return `so viel wie ${fmtNum(kg / 480, 1)} Konzertflügel (à ~480 kg)`;
}

/** Großer Abschluss-Screen nach dem Training (auch später aus der Übersicht aufrufbar) */
export function SessionComplete({ session, prs, onClose, review }: { session: Session; prs?: string[]; onClose: () => void; /** Rückblick auf ein vergangenes Training (aus „Letzte Trainings“) */ review?: boolean }) {
  const s = useStore();
  const go = useRouter((r) => r.go);
  const st = useMemo(() => sessionStats(session, s.sessions, s.exercises), [session, s.sessions, s.exercises]);
  const records = prs ?? session.prs ?? [];
  const planned = st.plannedSets && st.plannedSets > 0 ? st.plannedSets : st.sets;
  const ratio = planned ? Math.min(1, st.sets / planned) : 1;
  const ringV = useCountUp(ratio, 1100, 150);
  const cmp = useMemo(() => exerciseComparison(session, s.sessions, s.exercises), [session, s.sessions, s.exercises]);
  const withPrev = cmp.filter((c) => c.pct != null);
  const stronger = withPrev.filter((c) => c.trend === 'up').length;
  const avgPct = withPrev.length ? withPrev.reduce((a, c) => a + c.pct!, 0) / withPrev.length : null;
  const bw = bodyWeightAt(s.body, session.date);
  const kcal = estimateKcal(st.durationMin, bw.kg);
  const tut = Math.round((st.reps * 3) / 60);
  const fact = tonnageFact(st.volume);
  const week = sessionsThisWeek(s.sessions, session.date);
  const streak = weekStreak(s.sessions, session.date);
  const fills = useMemo(() => {
    const max = Math.max(1, ...st.muscles.map((m) => m.sets));
    const out: Partial<Record<MuscleId, string>> = {};
    for (const m of st.muscles) out[m.muscle] = `rgb(var(--rec-green) / ${(0.5 + 0.5 * (m.sets / max)).toFixed(2)})`;
    return out;
  }, [st.muscles]);

  const highlights: { icon: ReactNode; text: ReactNode; tone?: 'gold' | 'green' }[] = [];
  for (const p of records) highlights.push({ icon: <Trophy size={16} />, text: p, tone: 'gold' });
  if (st.bestGain) highlights.push({ icon: <TrendingUp size={16} />, text: <><b>{st.bestGain.name}</b> {fmtNum(st.bestGain.pct, 1)} % stärker als letztes Mal (e1RM)</>, tone: 'green' });
  if (st.prev?.volumePct != null && Math.abs(st.prev.volumePct) >= 3)
    highlights.push({
      icon: <BarChart3 size={16} />,
      text: <>{st.prev.volumePct > 0 ? '+' : ''}{fmtNum(st.prev.volumePct, 0)} % Volumen ggü. dem letzten „{session.title.split(' (')[0]}“ ({relDayLabel(st.prev.date).split(',')[0]})</>,
      tone: st.prev.volumePct > 0 ? 'green' : undefined,
    });
  if (st.avgRir != null)
    highlights.push({
      icon: <Flame size={16} />,
      text:
        st.avgRir <= 2.2 ? (
          <>Ø {fmtNum(st.avgRir, 1)} RIR – nah genug am Versagen, genau der Bereich für maximalen Reiz</>
        ) : (
          <>Ø {fmtNum(st.avgRir, 1)} RIR – nächstes Mal 1–2 Wdh. näher ans Versagen gehen bringt mehr Reiz</>
        ),
    });

  const title = review ? session.title.split(' (')[0] : records.length ? 'Neue Rekorde!' : ratio >= 0.999 ? 'Training geschafft!' : 'Gut gemacht!';

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black text-white" role="dialog" aria-modal="true" aria-label="Trainingsabschluss">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_55%_at_50%_20%,rgba(61,220,151,0.28),transparent_70%)]" />
      <div className="relative mx-auto flex min-h-full max-w-md flex-col gap-5 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-[calc(env(safe-area-inset-top,0px)+16px)]">
        <div className="flex justify-end">
          <button onClick={onClose} aria-label="Schließen" className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Ring + Titel */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative grid h-40 w-40 place-items-center">
            <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90 drop-shadow-[0_0_18px_rgba(61,220,151,0.55)]">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="url(#done-grad)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 52}
                strokeDashoffset={2 * Math.PI * 52 * (1 - ringV)}
              />
              <defs>
                <linearGradient id="done-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0b8f5a" />
                  <stop offset="55%" stopColor="#3ddc97" />
                  <stop offset="100%" stopColor="#ecfff4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="flex flex-col items-center">
              <div className="grid h-14 w-14 animate-fade-up place-items-center rounded-full bg-rec-green text-black shadow-[0_0_30px_rgba(61,220,151,0.7)]" style={{ animationDelay: '700ms' }}>
                <Check size={30} strokeWidth={3} />
              </div>
              <div className="tnum mt-2 text-[13px] font-semibold text-white/70">
                {st.sets}/{planned} Sätze
              </div>
            </div>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
            <h1 className="text-[32px] font-bold leading-tight tracking-tight">{title}</h1>
            <p className="mt-1 text-[14px] text-white/60">
              {review ? relDayLabel(session.date) : `${session.title.split(' (')[0]} · ${relDayLabel(session.date).split(',')[0]}`} · {st.exercises} {st.exercises === 1 ? 'Übung' : 'Übungen'}
            </p>
          </div>
        </div>

        {/* Kennzahlen */}
        <div className="grid grid-cols-2 gap-2.5">
          <Tile icon={<Clock size={12} />} label="Dauer" delay={250} sub={session.estMinutes ? `geplant ~${fmtMin(session.estMinutes)}` : undefined}>
            {st.durationMin >= 60 ? (
              <>
                {Math.floor(st.durationMin / 60)} <span className="text-[15px] text-white/60">h</span> {st.durationMin % 60 ? <>{st.durationMin % 60} <span className="text-[15px] text-white/60">min</span></> : null}
              </>
            ) : (
              <>
                <Count value={st.durationMin} /> <span className="text-[15px] text-white/60">min</span>
              </>
            )}
          </Tile>
          <Tile icon={<Flame size={12} />} label="Kalorien" delay={275} sub={`geschätzt · ${fmtNum(bw.kg)} kg${bw.measured ? '' : ' (angen.)'}`}>
            ~<Count value={kcal} /> <span className="text-[15px] text-white/60">kcal</span>
          </Tile>
          <Tile icon={<Dumbbell size={12} />} label={st.volume > 0 ? 'Volumen' : 'Wiederholungen'} delay={300} sub={st.volume > 0 ? 'Gewicht × Wdh.' : 'mit Körpergewicht'}>
            {st.volume <= 0 ? (
              <Count value={st.reps} />
            ) : st.volume >= 1000 ? (
              <>
                <Count value={st.volume / 1000} digits={1} /> <span className="text-[15px] text-white/60">t</span>
              </>
            ) : (
              <>
                <Count value={st.volume} /> <span className="text-[15px] text-white/60">kg</span>
              </>
            )}
          </Tile>
          <Tile icon={<Layers size={12} />} label="Sätze" delay={350} sub={`${st.reps} Wiederholungen`}>
            <Count value={st.sets} />
          </Tile>
          <Tile icon={<Hourglass size={12} />} label="Pausen" delay={400} sub={st.avgGapSec != null ? `Ø ${fmtMinSec(st.avgGapSec)} von Satz zu Satz` : 'Wird ab jetzt pro Satz gemessen'}>
            {st.restMin != null ? (
              <>
                <Count value={st.restMin} /> <span className="text-[15px] text-white/60">min</span>
              </>
            ) : (
              '–'
            )}
          </Tile>
          <Tile icon={<TrendingUp size={12} />} label="Stärker" delay={450} sub={avgPct != null ? `Ø ${avgPct > 0 ? '+' : ''}${fmtNum(avgPct, 1)} % ggü. letztem Mal` : 'Vergleich ab dem 2. Mal'}>
            {withPrev.length ? (
              <>
                <Count value={stronger} /> <span className="text-[15px] text-white/60">/ {withPrev.length}</span>
              </>
            ) : (
              '–'
            )}
          </Tile>
        </div>

        {/* Highlights */}
        {highlights.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-white/45">Highlights</div>
            {highlights.slice(0, 5).map((h, i) => (
              <div
                key={i}
                className={cn(
                  'flex animate-fade-up items-start gap-3 rounded-2xl px-3.5 py-3 text-[14px] leading-snug ring-1',
                  h.tone === 'gold' ? 'bg-rec-yellow/10 text-rec-yellow ring-rec-yellow/25' : h.tone === 'green' ? 'bg-rec-green/10 text-white ring-rec-green/25' : 'bg-white/[0.05] text-white/85 ring-white/[0.06]',
                )}
                style={{ animationDelay: `${500 + i * 80}ms` }}
              >
                <span className={cn('mt-0.5 shrink-0', h.tone === 'green' ? 'text-rec-green' : h.tone === 'gold' ? '' : 'text-white/60')}>{h.icon}</span>
                <span>{h.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Vergleich je Übung */}
        {cmp.length > 0 && (
          <div className="animate-fade-up rounded-[24px] bg-white/[0.05] px-4 pb-2 pt-4 ring-1 ring-white/[0.06]" style={{ animationDelay: '600ms' }}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-white/45">Vergleich zum letzten Mal</div>
              <div className="text-[11px] text-white/35">bester Satz</div>
            </div>
            <ul className="mt-1 divide-y divide-white/[0.06]">
              {cmp.map((c, i) => (
                <CompareRow key={c.id} c={c} delay={650 + i * 60} />
              ))}
            </ul>
            <p className="pb-2 pt-1 text-[11px] leading-snug text-white/35">% = geschätztes 1-Wdh.-Maximum aus Gewicht, Wdh. und RIR – so zählen auch mehr Wdh. bei gleichem Gewicht. Mehr Gewicht mit etwas weniger Wdh. ist normale Steigerung. Linie: letzte Einheiten.</p>
          </div>
        )}

        {/* Fakten */}
        {(fact || st.reps > 0) && (
          <div className="flex animate-fade-up flex-col gap-1.5 rounded-2xl bg-white/[0.05] px-4 py-3 text-[13px] text-white/75 ring-1 ring-white/[0.06]" style={{ animationDelay: '680ms' }}>
            {fact && (
              <div>
                <b className="text-white">{st.volume >= 1000 ? `${fmtNum(st.volume / 1000, 1)} t` : `${fmtNum(st.volume, 0)} kg`}</b> bewegt – {fact}
              </div>
            )}
            {st.reps > 0 && (
              <div>
                <b className="text-white">~{tut} min</b> unter Spannung ({st.reps} Wdh. × ~3 s)
              </div>
            )}
            <div className="text-[11px] text-white/35">
              Kalorien: MET {KCAL_MET} × {fmtNum(bw.kg)} kg × {fmtMin(st.durationMin)} – grobe Schätzung, keine Messung.
            </div>
          </div>
        )}

        {/* Trainierte Muskeln */}
        {st.muscles.length > 0 && (
          <div className="animate-fade-up rounded-[24px] bg-white/[0.05] p-4 ring-1 ring-white/[0.06]" style={{ animationDelay: '700ms' }}>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-white/45">Trainiert</div>
            <div className="mt-3 overflow-hidden rounded-2xl" style={{ background: '#262628' }}>
              <MuscleFigure fills={fills} className="w-full" />
            </div>
            <div className="mt-3">
              <ul className="flex min-w-0 flex-col gap-1.5">
                {st.muscles.slice(0, 7).map((m) => (
                  <li key={m.muscle} className="flex items-center gap-2 text-[12.5px]">
                    <span className="w-[88px] shrink-0 truncate text-white/80">{MUSCLE[m.muscle].short}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-rec-green" style={{ width: `${Math.min(100, (m.sets / Math.max(...st.muscles.map((x) => x.sets))) * 100)}%` }} />
                    </span>
                    <span className="tnum w-7 text-right text-white/60">{fmtNum(m.sets)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Woche */}
        <div className="flex animate-fade-up items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3 text-[13.5px] ring-1 ring-white/[0.06]" style={{ animationDelay: '800ms' }}>
          <Repeat2 size={18} className="shrink-0 text-white/60" />
          <span>
            <b>{week}.</b> Einheit diese Woche{streak >= 2 && <> · <b>{streak} Wochen</b> in Folge trainiert 🔥</>}
          </span>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          {!review && (
            <>
              <BackupButton dark />
              <p className="-mt-0.5 mb-1 text-center text-[11.5px] text-white/45">Speichert alle Daten als Datei, z. B. in „Dateien“ oder iCloud Drive.</p>
            </>
          )}
          <button onClick={onClose} className="h-14 rounded-full bg-white text-[16px] font-semibold text-black active:scale-[0.99]">
            {review ? 'Schließen' : 'Fertig'}
          </button>
          <button
            onClick={() => {
              onClose();
              go('statistik');
            }}
            className="h-12 rounded-full text-[14px] font-medium text-white/70"
          >
            Alle Statistiken ansehen
          </button>
        </div>
      </div>
    </div>
  );
}
