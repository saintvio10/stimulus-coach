import { useEffect, useMemo, useRef, useState } from 'react';
import { ExerciseVisual } from './ExerciseVisual';
import { Check, Minus, Pause, Play, Plus, SkipBack, SkipForward, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useStore } from '../lib/store';
import type { Session } from '../lib/types';
import { adviseExercise } from '../engine/progression';
import { ExerciseAnimation } from './ExerciseAnimation';
import { BodyMap, targetFills } from './BodyMap';
import { MUSCLE } from '../lib/muscles';
import { cn, fmtMin, fmtNum, nextWeight, prevWeight } from '../lib/utils';
import { timeEstimator } from '../engine/timing';
import { exerciseVerdict, setFeedback } from '../engine/verdict';
import { unlockAudio } from './RestTimer';
import { restAfterSet, transitionRest } from '../engine/rest';
import { LiveAdjustBanner } from './LiveAdjustBanner';
import { setPR } from '../engine/prs';
import { usePRCelebration, useSetPopup } from '../lib/hooks';
import { GlowProgress } from './ui';
import { FocusProgress } from './FocusProgress';
import { BusySheet } from './BusySheet';

/** Vollbild-Fokusmodus: eine Übung, großer Timer, Satz erfassen, vor/zurück. */
export function FocusPlayer({ session, startUid, onClose }: { session: Session; startUid?: string; onClose: () => void }) {
  const s = useStore();
  const list = session.exercises.filter((e) => !e.skipped);
  const [idx, setIdx] = useState(() => Math.max(0, list.findIndex((e) => e.uid === startUid)));
  const se = list[Math.min(idx, list.length - 1)];
  const ex = s.exercises.find((e) => e.id === se?.exerciseId);
  const prior = useMemo(() => s.sessions.filter((x) => x.id !== session.id), [s.sessions, session.id]);
  const advice = useMemo(
    () => (ex && se ? adviseExercise(ex, prior, { settings: s.settings, checkIns: s.checkIns }, se.repMin, se.repMax, se.targetRir) : null),
    [ex, se, prior, s.settings, s.checkIns],
  );
  const setIndex = se ? se.sets.findIndex((x) => !x.done) : -1;
  const cur = se && setIndex >= 0 ? se.sets[setIndex] : null;
  const rec = se?.recWeight ?? advice?.weight ?? null;
  const lastW = se?.lastWeight ?? advice?.lastWeight ?? null;

  const [busy, setBusy] = useState(false);
  const [fbUid, setFbUid] = useState<string | null>(null);
  const [hideStart, setHideStart] = useState(false);
  // Eingabe für den aktuellen Satz
  const [w, setW] = useState<number | null>(null);
  const [noWeight, setNoWeight] = useState(false);
  const [reps, setReps] = useState<number>(10);
  const [repsR, setRepsR] = useState<number>(10);
  const [rir, setRir] = useState<number>(1);
  useEffect(() => {
    if (!se) return;
    const lastDone = [...se.sets].reverse().find((x) => x.done);
    setW(cur?.weight ?? lastDone?.weight ?? rec ?? null);
    setReps(cur?.repsL ?? cur?.reps ?? advice?.repTarget ?? se.repMin);
    setRepsR(cur?.repsR ?? cur?.reps ?? advice?.repTarget ?? se.repMin);
    setRir(cur?.rir ?? se.targetRir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [se?.uid, setIndex]);

  // Satz-Stoppuhr (pausierbar)
  const [now, setNow] = useState(Date.now());
  // Satzzeit läuft erst, wenn du „Satz starten“ tippst – eine etwas längere Pause zählt so nicht als Satzzeit
  const [watch, setWatch] = useState<{ start: number; acc: number; running: boolean }>({ start: Date.now(), acc: 0, running: false });
  const [restEndedAt, setRestEndedAt] = useState<number | null>(null);
  const wasResting = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setWatch({ start: Date.now(), acc: 0, running: false });
    setHideStart(false);
  }, [se?.uid, setIndex]);
  const timerNow = s.timer;
  const restingNow = !!timerNow && (timerNow.pausedLeft ?? (timerNow.endsAt - now) / 1000) > 0;
  useEffect(() => {
    // Ende der Satzpause merken (der Pausen-Timer selbst verschwindet kurz danach)
    if (wasResting.current && !restingNow) setRestEndedAt(timerNow?.endsAt ?? Date.now());
    if (restingNow) setRestEndedAt(null);
    wasResting.current = restingNow;
  }, [restingNow]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!se || !ex) return null;
  const timer = s.timer;
  const resting = !!timer && (timer.pausedLeft ?? (timer.endsAt - now) / 1000) > 0;
  const restLeft = timer ? (timer.pausedLeft ?? (timer.endsAt - now) / 1000) : 0;
  const elapsed = (watch.acc + (watch.running ? now - watch.start : 0)) / 1000;
  const shown = resting ? restLeft : elapsed;
  const awaiting = !resting && !watch.running && watch.acc === 0 && !!cur;
  const startSet = () => {
    unlockAudio();
    setRestEndedAt(null);
    setWatch({ start: Date.now(), acc: 0, running: true });
  };
  const over = restEndedAt ? Math.max(0, (now - restEndedAt) / 1000) : 0;
  const paused = resting ? timer?.pausedLeft != null : !watch.running;
  const mm = String(Math.floor(Math.max(0, shown) / 60)).padStart(2, '0');
  const ss = String(Math.floor(Math.max(0, shown) % 60)).padStart(2, '0');
  const totalSets = list.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = list.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const progress = totalSets ? doneSets / totalSets : 0;
  // Restzeit wie in der Planung (gelernte Satz-/Wechselzeiten), daraus voraussichtliches Ende
  const TE = timeEstimator(s);
  const remainingMin = Math.round(
    list.reduce((a, e) => {
      const x = s.exercises.find((y) => y.id === e.exerciseId);
      const open = e.sets.filter((z) => !z.done).length;
      if (!open || !x) return a;
      return a + open * TE.perSet(x, { repMin: e.repMin, repMax: e.repMax, restSec: e.restSec }) + (e.sets.some((z) => z.done) ? 0 : TE.setup(x));
    }, 0),
  );
  const endD = new Date(now + remainingMin * 60_000);
  const endTxt = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;

  const togglePause = () => {
    unlockAudio();
    if (resting) {
      if (timer?.pausedLeft != null) s.resumeTimer();
      else s.pauseTimer();
      return;
    }
    if (awaiting) return startSet();
    setWatch((x) => (x.running ? { ...x, acc: x.acc + (Date.now() - x.start), running: false } : { start: Date.now(), acc: x.acc, running: true }));
  };
  const completeSet = () => {
    if (!cur) return;
    if (ex.equipment !== 'bodyweight' && (w == null || !(w > 0))) {
      setNoWeight(true);
      return;
    }
    const uni = !!ex.unilateral;
    if (!(reps > 0) || (uni && !(repsR > 0))) return;
    const effReps = uni ? Math.min(reps, repsR) : reps;
    setNoWeight(false);
    unlockAudio();
    const pr = setPR(s.sessions, session, ex, { id: cur.id, w: w ?? 0, reps: effReps, rir });
    if (pr) setTimeout(() => usePRCelebration.getState().show({ title: pr.title, sub: pr.sub, exercise: ex.name }), 150);
    else {
      const fb = setFeedback(ex, se, setIndex, { w: w ?? 0, reps: effReps, rir }, prior, advice?.repTarget ?? se.repMin);
      useSetPopup.getState().show({ ...fb, exercise: ex.name, set: setIndex + 1 });
    }
    s.setWeightFrom(session.id, se.uid, cur.id, w);
    s.updateSet(session.id, se.uid, cur.id, { done: true, weight: w, reps: effReps, ...(uni ? { repsL: reps, repsR } : {}), rir, failure: rir === 0 ? cur.failure : false });
    const last = setIndex === se.sets.length - 1;
    const rest = restAfterSet(se, effReps, rir, rir === 0);
    if (last) {
      const nextSe = list[idx + 1];
      const nextEx = nextSe ? s.exercises.find((e) => e.id === nextSe.exerciseId) : undefined;
      if (nextSe && nextEx) s.startTimer(Math.max(rest.sec, transitionRest(se.restSec, nextSe.restSec)), `Wechsel zu ${nextEx.name}`);
    } else s.startTimer(rest.sec, `${ex.name} · Satz ${setIndex + 2}${rest.note ? ` · ${rest.note}` : ''}`);
    // Nach der letzten Übung-Satz: erst Feedback zum Gewicht, dann weiter zur nächsten Übung
    if (last) setTimeout(() => setFbUid(se.uid), 350);
  };
  const stepW = (dir: 1 | -1) => {
    const base = w ?? rec ?? 0;
    setW(dir > 0 ? nextWeight(base, ex, s.settings) : prevWeight(base, ex, s.settings));
  };
  const muscles = Object.entries(ex.muscles).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  const fills = targetFills(ex.muscles);

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black text-white" role="dialog" aria-modal="true" aria-label="Fokusmodus">
      <div className="mx-auto flex min-h-full max-w-lg flex-col gap-4 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-[calc(env(safe-area-inset-top,0px)+12px)]">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="Fokusmodus schließen">
            <X size={18} />
          </button>
          <div className="mx-3 flex-1">
            <GlowProgress
              value={progress}
              height={30}
              label={
                <span className="text-[12px]">
                  {fmtMin(Math.max(0, Math.round((now - session.startedAt) / 60_000)))} · noch ~{fmtMin(remainingMin)} · bis {endTxt}
                </span>
              }
            />
          </div>
        </div>

        {/* Medienfläche */}
        <div className="relative h-[34vh] max-h-[360px] min-h-[200px] w-full shrink-0 overflow-hidden rounded-[28px] bg-[radial-gradient(90%_70%_at_50%_40%,#3a3a40,#161618)]">
          <ExerciseVisual ex={ex} dark />
          <div className="absolute right-3 top-3 flex gap-1 rounded-2xl bg-black/35 p-1.5 backdrop-blur">
            <BodyMap side="front" colors={{}} fills={fills} className="h-20 w-9" />
            <BodyMap side="back" colors={{}} fills={fills} className="h-20 w-9" />
          </div>
          <div className="absolute bottom-3 left-3 right-28 flex flex-wrap gap-1">
            {muscles.map(([m, c]) => (
              <span key={m} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur', (c ?? 0) >= 0.75 ? 'bg-[rgb(var(--hl)/0.25)] text-[rgb(var(--hl))]' : 'bg-white/10 text-white/70')}>
                {MUSCLE[m as keyof typeof MUSCLE].short}
              </span>
            ))}
          </div>
        </div>

        <div>
          {awaiting ? (
            <div className="flex items-baseline gap-3">
              <div className="tnum text-[44px] font-bold leading-none tracking-tight text-white/35">00:00</div>
              <button onClick={startSet} className="text-[12px] font-semibold uppercase tracking-[0.12em] text-rec-green">
                {restEndedAt ? `Pause vorbei · +${Math.floor(over / 60)}:${String(Math.floor(over % 60)).padStart(2, '0')}` : 'Bereit'} · Starten
              </button>
            </div>
          ) : (
            <div className="flex items-baseline gap-3">
              <div className="tnum text-[44px] font-bold leading-none tracking-tight">
                {mm}:{ss}
              </div>
              <span className={cn('text-[12px] font-semibold uppercase tracking-[0.12em]', resting ? 'text-accent' : 'text-white/45')}>
                {resting ? (paused ? 'Pause angehalten' : 'Satzpause') : paused ? 'angehalten' : 'Satzzeit'}
              </span>
              <button onClick={togglePause} className="ml-auto grid h-10 w-10 shrink-0 place-items-center self-center rounded-full bg-white/10" aria-label={paused ? 'Fortsetzen' : 'Anhalten'}>
                {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
              </button>
            </div>
          )}
          <div className="mt-2 text-[22px] font-semibold leading-tight">{ex.name}</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">
              <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white disabled:opacity-25" aria-label="Vorherige Übung">
                <SkipBack size={12} fill="currentColor" />
              </button>
              Übung {idx + 1}/{list.length}
              <button disabled={idx >= list.length - 1} onClick={() => setIdx(idx + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white disabled:opacity-25" aria-label="Nächste Übung">
                <SkipForward size={12} fill="currentColor" />
              </button>
              <span className="ml-1">· {cur ? `Satz ${setIndex + 1}/${se.sets.length}` : 'fertig'}</span>
            </span>
            {cur && (
              <button onClick={() => setBusy(true)} className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white/80">
                Gerät besetzt
              </button>
            )}
          </div>
        </div>

        {/* Ziel je Satz & Vergleich mit dem letzten Mal */}
        <FocusProgress part="goal" ex={ex} se={se} sessionId={session.id} sessions={s.sessions} advice={advice} />
        {advice?.increaseRule && <div className="-mt-2 px-1 text-[12px] text-white/45">Erhöhen: {advice.increaseRule}</div>}
        {(se.adviceType ?? advice?.type) === 'increase' && lastW != null && rec != null && rec > lastW && !se.decision && setIndex === 0 && (
          <div className="flex flex-col gap-2.5 rounded-[20px] border border-rec-green/30 bg-rec-green/10 p-3.5">
            <div className="tnum text-[15px] font-semibold">
              ↑ Zeit für mehr Gewicht: {fmtNum(lastW)} → {fmtNum(rec)} kg
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="h-10 rounded-full bg-white text-[13.5px] font-semibold text-black" onClick={() => s.patchExercise(session.id, se.uid, { decision: 'accepted' })}>
                Übernehmen
              </button>
              <button
                className="h-10 rounded-full bg-white/10 text-[13.5px] font-semibold"
                onClick={() => {
                  if (cur) s.setWeightFrom(session.id, se.uid, cur.id, lastW);
                  setW(lastW);
                  s.patchExercise(session.id, se.uid, { decision: 'declined' });
                }}
              >
                Bei {fmtNum(lastW)} kg bleiben
              </button>
            </div>
          </div>
        )}

        {/* Satz erfassen */}
        {cur ? (
          <div className="flex flex-col gap-3 rounded-[24px] bg-white/[0.06] p-4">
            {ex.unilateral ? (
              <>
                <Stepper label={ex.equipment === 'bodyweight' ? 'Zusatzgewicht' : 'Gewicht'} value={w == null || (ex.equipment === 'bodyweight' && !w) ? (ex.equipment === 'bodyweight' ? 'ohne' : '–') : `${fmtNum(w)} kg`} onMinus={() => stepW(-1)} onPlus={() => stepW(1)} />
                <div className="grid grid-cols-2 gap-3">
                  <Stepper label="Links · Wdh." value={String(reps)} onMinus={() => setReps(Math.max(0, reps - 1))} onPlus={() => setReps(reps + 1)} />
                  <Stepper label="Rechts · Wdh." value={String(repsR)} onMinus={() => setRepsR(Math.max(0, repsR - 1))} onPlus={() => setRepsR(repsR + 1)} />
                </div>
                <p className="-mt-1 text-center text-[11.5px] text-white/45">Erst der schwächere Arm, dann der andere mit gleich vielen Wdh.</p>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Stepper label={ex.equipment === 'bodyweight' ? 'Zusatzgewicht' : 'Gewicht'} value={w == null || (ex.equipment === 'bodyweight' && !w) ? (ex.equipment === 'bodyweight' ? 'ohne' : '–') : `${fmtNum(w)} kg`} onMinus={() => stepW(-1)} onPlus={() => stepW(1)} />
                <Stepper label="Wiederholungen" value={String(reps)} onMinus={() => setReps(Math.max(0, reps - 1))} onPlus={() => setReps(reps + 1)} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="w-10 text-[11px] font-semibold uppercase tracking-wider text-white/45">RIR</span>
              <div className="grid flex-1 grid-cols-5 gap-1">
                {[0, 1, 2, 3, 4].map((r) => (
                  <button key={r} onClick={() => setRir(r)} className={cn('h-9 rounded-xl text-[14px] font-semibold', rir === r ? 'bg-white text-black' : 'bg-white/[0.07] text-white/70')}>
                    {r === 0 ? 'MV' : r}
                  </button>
                ))}
              </div>
            </div>
            <LiveAdjustBanner sessionId={session.id} se={se} ex={ex} dark onApplied={(nw) => setW(nw)} />
            {noWeight && <p className="text-center text-[13px] font-medium text-rec-red">Bitte zuerst ein Gewicht einstellen (mit + oder −).</p>}
            <button onClick={completeSet} className="flex h-14 items-center justify-center gap-2 rounded-full bg-white text-[16px] font-semibold text-black active:scale-[0.98]">
              <Check size={18} /> Satz {setIndex + 1} erledigt
            </button>
            <div className="flex justify-center gap-5 text-[13px] font-medium text-white/60">
              {se.sets.length > 1 && (
                <button
                  onClick={() => {
                    const last = [...se.sets].reverse().find((x) => !x.done);
                    if (last) s.removeSet(session.id, se.uid, last.id);
                  }}
                >
                  − Satz entfernen
                </button>
              )}
              {setIndex > 0 && (
                <button
                  onClick={() => {
                    se.sets.filter((x) => !x.done).forEach((x) => s.removeSet(session.id, se.uid, x.id));
                    if (idx < list.length - 1) setIdx(idx + 1);
                  }}
                >
                  Übung hier beenden
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-[24px] bg-rec-green/10 p-4 text-[14px] text-rec-green">
              Übung abgeschlossen.{idx < list.length - 1 ? ' Weiter zur nächsten Übung.' : ' Letzte Übung – beende das Training in der Übersicht.'}
            </div>
            {(() => {
              const v = exerciseVerdict(ex, se, session, s.sessions, { settings: s.settings, checkIns: s.checkIns });
              return v ? (
                <div className="rounded-[24px] bg-white/[0.06] p-4 text-[13.5px]">
                  <div className="text-[15px] font-semibold">{v.title}</div>
                  <ul className="mt-1.5 flex flex-col gap-1 text-white/75">
                    {v.points.map((pt) => (
                      <li key={pt}>· {pt}</li>
                    ))}
                  </ul>
                  <div className="mt-2 font-semibold">{v.next}</div>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* Verlauf: Volumen & Sätze, heute vs. frühere Einheiten */}
        <FocusProgress part="history" ex={ex} se={se} sessionId={session.id} sessions={s.sessions} advice={advice} />

        {busy && <BusySheet open session={session} se={se} onClose={() => setBusy(false)} />}

        {/* Schwebender Start-Knopf: groß, mittig über allem */}
        {awaiting && !hideStart && !fbUid && !busy && (
          <div className="fixed inset-0 z-[65] flex flex-col items-center justify-center gap-4 bg-black/55 backdrop-blur-[3px]" onClick={() => setHideStart(true)}>
            <div className="relative grid place-items-center">
              {restEndedAt && <span className="absolute h-44 w-44 animate-ping rounded-full bg-rec-green/40" />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startSet();
                }}
                className="relative flex h-44 w-44 flex-col items-center justify-center gap-1.5 rounded-full bg-rec-green text-black shadow-[0_0_60px_rgba(61,220,151,0.6)] active:scale-95"
                aria-label="Satz starten"
              >
                <Play size={44} fill="currentColor" />
                <span className="text-[18px] font-bold">{restEndedAt ? 'Los!' : 'Satz starten'}</span>
                <span className="text-[12.5px] font-semibold opacity-70">
                  {ex.name.length > 18 ? `Satz ${setIndex + 1}/${se.sets.length}` : `${ex.name.split(' ')[0]} · ${setIndex + 1}/${se.sets.length}`}
                </span>
              </button>
            </div>
            {restEndedAt ? (
              <div className="tnum rounded-full bg-white/10 px-3.5 py-1.5 text-[14px] font-semibold text-white/85">
                Pause vorbei · +{Math.floor(over / 60)}:{String(Math.floor(over % 60)).padStart(2, '0')}
              </div>
            ) : (
              <div className="max-w-[260px] text-center text-[13px] text-white/60">{ex.name}</div>
            )}
            <span className="text-[12px] text-white/40">Daneben tippen zum Ausblenden</span>
          </div>
        )}

        {/* Feedback nach jeder Übung */}
        {fbUid && (() => {
          const fse = session.exercises.find((x) => x.uid === fbUid);
          const fex = fse && s.exercises.find((x) => x.id === fse.exerciseId);
          if (!fse || !fex) return null;
          const doneS = fse.sets.filter((x) => x.done);
          const close = (v?: 'easy' | 'ok' | 'hard') => {
            if (v) s.patchExercise(session.id, fse.uid, { feedback: v });
            setFbUid(null);
            const pos = list.findIndex((x) => x.uid === fse.uid);
            if (pos >= 0 && pos < list.length - 1) setIdx(pos + 1);
          };
          const v = exerciseVerdict(fex, fse, session, s.sessions, { settings: s.settings, checkIns: s.checkIns });
          const toneCls = { good: 'text-rec-green', mixed: 'text-rec-yellow', light: 'text-accent', heavy: 'text-rec-orange' };
          return (
            <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] backdrop-blur-sm" role="dialog" aria-label="Feedback zur Übung">
              <div className="w-full max-w-lg animate-fade-up rounded-[28px] bg-[#1c1c1f] p-5 ring-1 ring-white/10">
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-rec-green">Übung geschafft</div>
                <div className="mt-1 text-[20px] font-semibold leading-tight">{fex.name}</div>
                <div className="tnum mt-1 text-[13px] text-white/55">
                  {doneS.map((x) => `${fmtNum(x.weight ?? 0)}×${x.repsL != null && x.repsR != null ? Math.min(x.repsL, x.repsR) : x.reps}`).join(' · ')} · Ziel {fse.repMin}–{fse.repMax} Wdh.
                </div>
                {v && (
                  <>
                    <div className={cn('mt-4 text-[18px] font-bold', toneCls[v.tone])}>{v.title}</div>
                    <ul className="mt-2 flex flex-col gap-1.5 text-[13.5px] text-white/80">
                      {v.points.map((pt) => (
                        <li key={pt} className="flex gap-2">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 rounded-2xl bg-white/[0.06] px-3.5 py-3 text-[14px] font-semibold">{v.next}</div>
                  </>
                )}
                <button onClick={() => close()} className="mt-4 h-12 w-full rounded-full bg-white text-[15px] font-semibold text-black active:scale-[0.99]">
                  {list.findIndex((x) => x.uid === fse.uid) < list.length - 1 ? 'Weiter zur nächsten Übung' : 'Fertig'}
                </button>
                <div className="mt-3 flex items-center justify-center gap-2 text-[12px] text-white/45">
                  Gefühlt anders?
                  {(['easy', 'hard'] as const).map((fv) => (
                    <button key={fv} onClick={() => close(fv)} className={cn('rounded-full px-2.5 py-1 font-medium', fse.feedback === fv ? 'bg-white text-black' : 'bg-white/10 text-white/70')}>
                      {fv === 'easy' ? 'war leichter' : 'war schwerer'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>,
    document.body,
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-2">
      <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-white/45">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <button onClick={onMinus} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label={`${label} verringern`}>
          <Minus size={16} />
        </button>
        <span className="tnum whitespace-nowrap text-[17px] font-semibold">{value}</span>
        <button onClick={onPlus} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label={`${label} erhöhen`}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
