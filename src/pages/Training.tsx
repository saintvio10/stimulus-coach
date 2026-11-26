import { useEffect, useMemo, useState } from 'react';
import { ExerciseVisual } from '../components/ExerciseVisual';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Dumbbell,
  ExternalLink,
  MessageSquare,
  Plus,
  Repeat,
  SkipForward,
  Trash2,
  Trophy,
  Undo2,
  Zap,
  Maximize2,
  Minus,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { useNow, useRouter, useToast } from '../lib/hooks';
import type { AppData, Exercise, Session, SessionExercise } from '../lib/types';
import { buildPlan, planToday } from '../engine/planner';
import { adviseExercise, exposures } from '../engine/progression';
import { detectPRs, sessionSets, sessionVolume } from '../engine/stats';
import { Badge, Button, Card, Confirm, Input, PageHeader, Sheet } from '../components/ui';
import { PlanReasons, QuickAvailability, SessionPreview } from '../components/Coach';
import { ExerciseAnimation, ExerciseIcon } from '../components/ExerciseAnimation';
import { FocusPlayer } from '../components/FocusPlayer';
import { BodyMap, targetFills } from '../components/BodyMap';
import { MUSCLE, MUSCLES } from '../lib/muscles';
import { cn, dateKey, fmtClock, fmtNum, fmtShortDay, nextWeight, prevWeight } from '../lib/utils';
import { unlockAudio } from '../components/RestTimer';

export default function Training() {
  const active = useStore((s) => s.sessions.find((x) => x.status === 'active'));
  return active ? <Workout session={active} /> : <PlanView />;
}

// ───────────────────────── Vor dem Training ─────────────────────────

function PlanView() {
  const s = useStore();
  const data = s as unknown as AppData;
  const go = useRouter((r) => r.go);
  const today = dateKey();
  const minutes = s.planOptions.todayMinutes?.date === today ? s.planOptions.todayMinutes.minutes : s.settings.defaultMinutes;
  const plan = useMemo(() => planToday(data, minutes), [s.sessions, s.availability, s.planOptions, s.exercises, s.settings, s.profile, s.checkIns]); // eslint-disable-line react-hooks/exhaustive-deps
  const trainedToday = s.sessions.some((x) => x.status === 'done' && x.date === today);
  const restToday = useMemo(() => buildPlan(data).restDays.find((r) => r.date === today), [s.sessions, s.availability, s.settings, s.planOptions]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Dein Plan für heute" sub={s.profile.name ? `Hallo ${s.profile.name}` : 'Heute'} />
      {restToday && !trainedToday && (
        <Card className="border-[#3b4a6b]/60 bg-[linear-gradient(160deg,#1d2433,rgb(var(--surface)))] text-[13px]">
          <div className="mb-1 text-[15px] font-semibold">Heute ist ein Ruhetag empfohlen 🌙</div>
          <p className="text-muted">{restToday.reason} Wenn du dich fit fühlst, kannst du den Plan unten trotzdem starten.</p>
        </Card>
      )}
      {trainedToday && (
        <Card className="border-rec-yellow/20 text-[13px] text-muted">
          Du hast heute bereits trainiert. Eine zweite Einheit wird so geplant, dass sie die heute belasteten Muskeln möglichst schont.
        </Card>
      )}
      <Card className="p-5 sm:p-6">
        {plan && !plan.rest ? (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="label">Empfehlung für heute</div>
                <h2 className="mt-1 text-[24px] font-semibold leading-tight">{plan.label}</h2>
                <p className="tnum mt-0.5 text-[13px] text-muted">
                  {minutes} min verfügbar · geschätzt {plan.estMinutes} min · {plan.exercises.reduce((a, p) => a + p.sets, 0)} Arbeitssätze
                </p>
              </div>
            </div>
            <SessionPreview
              s={plan}
              onStart={() => {
                unlockAudio();
                s.startSession(plan);
              }}
            />
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="text-[20px] font-semibold">Ruhetag empfohlen</h2>
            <p className="text-[13px] text-muted">Alle Muskelgruppen sind laut Schätzung stark ermüdet. Du kannst trotzdem frei trainieren.</p>
            {plan && <PlanReasons s={plan} />}
          </div>
        )}
      </Card>
      <Card>
        <div className="mb-3 text-[14px] font-semibold">Zeit oder Verfügbarkeit ändern</div>
        <QuickAvailability />
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => s.startSession(null, 'Freies Training')}>
          <Plus size={15} /> Freies Training starten
        </Button>
        <Button variant="ghost" onClick={() => go('kalender')}>
          Woche planen
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── Laufendes Training ─────────────────────────

function Workout({ session }: { session: Session }) {
  const s = useStore();
  const go = useRouter((r) => r.go);
  const toast = useToast((t) => t.show);
  const now = useNow(1000);
  const exMap = useMemo(() => new Map(s.exercises.map((e) => [e.id, e])), [s.exercises]);
  const [openUid, setOpenUid] = useState<string | null>(() => session.exercises.find((e) => !e.skipped && e.sets.some((x) => !x.done))?.uid ?? null);
  const [picker, setPicker] = useState<{ mode: 'add' | 'swap'; uid?: string } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [summary, setSummary] = useState<{ session: Session; prs: string[] } | null>(null);
  const [focusUid, setFocusUid] = useState<string | null>(null);

  useEffect(() => {
    if (!openUid) return;
    const t = setTimeout(() => document.getElementById(`ex-${openUid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => clearTimeout(t);
  }, [openUid]);
  const total = session.exercises.filter((e) => !e.skipped).reduce((a, e) => a + e.sets.length, 0);
  const doneN = session.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);

  const finish = () => {
    const prs = detectPRs(session, s.sessions, s.exercises);
    const snapshot: Session = { ...session, endedAt: Date.now() };
    s.finishSession(session.id, prs);
    s.stopTimer();
    setSummary({ session: snapshot, prs });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-20 -mx-4 border-b border-line/[0.06] bg-bg/85 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+8px)] backdrop-blur-xl sm:-mx-0 sm:rounded-b-2xl sm:px-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[17px] font-semibold">{session.title}</div>
            <div className="tnum text-[12px] text-muted">
              {fmtClock((now - session.startedAt) / 1000)} · {doneN}/{total} Sätze
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFocusUid(openUid ?? session.exercises.find((e) => !e.skipped && e.sets.some((x) => !x.done))?.uid ?? session.exercises[0]?.uid ?? null)}
              disabled={!session.exercises.length}
            >
              <Maximize2 size={14} /> Fokus
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDiscard(true)} aria-label="Training verwerfen">
              <Trash2 size={17} />
            </Button>
            <Button variant="primary" size="sm" onClick={() => setFinishOpen(true)}>
              Beenden
            </Button>
          </div>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-raised">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${total ? (doneN / total) * 100 : 0}%` }} />
        </div>
      </div>

      {session.exercises.length === 0 && (
        <Card className="text-center text-[13px] text-muted">
          Noch keine Übungen. Füge unten deine erste Übung hinzu.
        </Card>
      )}

      {session.exercises.map((se, i) => {
        const ex = exMap.get(se.exerciseId);
        if (!ex) return null;
        return (
          <ExerciseCard
            key={se.uid}
            index={i}
            session={session}
            se={se}
            ex={ex}
            open={openUid === se.uid}
            onToggle={() => setOpenUid(openUid === se.uid ? null : se.uid)}
            onSwap={() => setPicker({ mode: 'swap', uid: se.uid })}
            onFocus={() => setFocusUid(se.uid)}
            onNext={() => {
              const nxt = session.exercises.slice(i + 1).find((e) => !e.skipped && e.sets.some((x) => !x.done));
              if (nxt) setOpenUid(nxt.uid);
            }}
          />
        );
      })}

      {focusUid && <FocusPlayer session={session} startUid={focusUid} onClose={() => setFocusUid(null)} />}
      <Button variant="outline" size="lg" onClick={() => setPicker({ mode: 'add' })}>
        <Plus size={16} /> Übung hinzufügen
      </Button>

      <ExercisePicker
        open={!!picker}
        mode={picker?.mode ?? 'add'}
        current={picker?.uid ? exMap.get(session.exercises.find((e) => e.uid === picker.uid)?.exerciseId ?? '') : undefined}
        onClose={() => setPicker(null)}
        onPick={(ex) => {
          if (picker?.mode === 'swap' && picker.uid) {
            s.swapExercise(session.id, picker.uid, ex);
            toast(`Ausgetauscht gegen ${ex.name}`);
          } else {
            s.addExerciseToSession(session.id, ex);
            toast(`${ex.name} hinzugefügt`);
          }
          setPicker(null);
        }}
      />

      <Confirm
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        onConfirm={finish}
        title="Training beenden?"
        text={`${doneN} von ${total} Sätzen erledigt. Nicht abgehakte Sätze werden nicht gespeichert. Der Plan für die nächsten Tage wird danach neu berechnet.`}
        confirmLabel="Speichern & beenden"
      />
      <Confirm
        open={discard}
        onClose={() => setDiscard(false)}
        onConfirm={() => {
          s.discardSession(session.id);
          toast('Training verworfen');
        }}
        title="Training verwerfen?"
        text="Alle Einträge dieser Einheit werden gelöscht."
        confirmLabel="Verwerfen"
        danger
      />
      <Sheet
        open={!!summary}
        onClose={() => {
          setSummary(null);
          go('uebersicht');
        }}
        title="Training gespeichert"
        footer={
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              setSummary(null);
              go('uebersicht');
            }}
          >
            Zur Übersicht
          </Button>
        }
      >
        {summary && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-raised p-3">
                <div className="label">Dauer</div>
                <div className="tnum mt-1 text-[20px] font-semibold">{Math.round((summary.session.endedAt! - summary.session.startedAt) / 60000)}′</div>
              </div>
              <div className="rounded-2xl bg-raised p-3">
                <div className="label">Sätze</div>
                <div className="tnum mt-1 text-[20px] font-semibold">{sessionSets(summary.session)}</div>
              </div>
              <div className="rounded-2xl bg-raised p-3">
                <div className="label">Volumen</div>
                <div className="tnum mt-1 text-[20px] font-semibold">{fmtNum(sessionVolume(summary.session) / 1000, 1)} t</div>
              </div>
            </div>
            {summary.prs.length > 0 ? (
              <div>
                <div className="label mb-2 flex items-center gap-1.5">
                  <Trophy size={13} className="text-rec-yellow" /> Neue Rekorde
                </div>
                <ul className="flex flex-col gap-1.5 text-[14px]">
                  {summary.prs.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[13px] text-muted">Keine neuen Rekorde diesmal – Konstanz zählt. Die Gewichtsempfehlungen für das nächste Mal sind bereits aktualisiert.</p>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function ExerciseCard({
  index,
  session,
  se,
  ex,
  open,
  onToggle,
  onSwap,
  onNext,
  onFocus,
}: {
  index: number;
  session: Session;
  se: SessionExercise;
  ex: Exercise;
  open: boolean;
  onToggle: () => void;
  onSwap: () => void;
  onNext: () => void;
  onFocus: () => void;
}) {
  const s = useStore();
  const [showCues, setShowCues] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const prior = useMemo(() => s.sessions.filter((x) => x.id !== session.id), [s.sessions, session.id]);
  const last = useMemo(() => exposures(ex.id, prior)[0], [prior, ex.id]);
  const advice = useMemo(
    () => adviseExercise(ex, prior, { settings: s.settings, checkIns: s.checkIns }, se.repMin, se.repMax, se.targetRir),
    [ex, prior, s.settings, s.checkIns, se.repMin, se.repMax, se.targetRir],
  );
  const rec = se.recWeight ?? advice.weight;
  const doneN = se.sets.filter((x) => x.done).length;
  const complete = doneN === se.sets.length && se.sets.length > 0;
  const muscles = Object.entries(ex.muscles).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  const partner = se.superset ? session.exercises.find((e) => e.superset === se.superset && e.uid !== se.uid) : undefined;

  const completeSet = (setId: string, idx: number) => {
    unlockAudio();
    const st = se.sets.find((x) => x.id === setId)!;
    if (st.done) {
      s.updateSet(session.id, se.uid, setId, { done: false });
      return;
    }
    s.updateSet(session.id, se.uid, setId, {
      done: true,
      weight: st.weight ?? rec ?? null,
      reps: st.reps ?? advice.repTarget,
      rir: st.rir ?? se.targetRir,
    });
    const isLast = idx === se.sets.length - 1;
    // Supersatz: kurzer Wechsel zur Partnerübung, sonst volle Pause
    if (partner && partner.sets.some((x) => !x.done)) {
      s.startTimer(20, `Wechsel: ${s.exercises.find((e) => e.id === partner.exerciseId)?.name ?? 'Partnerübung'}`);
    } else {
      s.startTimer(se.restSec, isLast ? 'nächste Übung' : `${ex.name} · Satz ${idx + 2}`);
    }
    if (isLast && !partner) setTimeout(onNext, 300);
  };

  return (
    <Card id={`ex-${se.uid}`} className={cn('scroll-mt-24 p-0 sm:p-0', se.skipped && 'opacity-50', open && 'ring-1 ring-line/10')}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <div className="relative shrink-0">
          <ExerciseIcon id={ex.id} pattern={ex.pattern} muscles={ex.muscles} size={48} />
          <span
            className={cn(
              'tnum absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ring-1',
              complete ? 'bg-rec-green text-bg ring-rec-green' : 'bg-bg text-muted ring-line/10',
            )}
          >
            {complete ? <Check size={11} /> : index + 1}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{ex.name}</span>
            {se.superset && <Badge tone="accent">{se.superset}</Badge>}
          </div>
          <div className="tnum text-[12px] text-muted">
            {se.skipped ? 'Übersprungen' : `${doneN}/${se.sets.length} Sätze · ${se.repMin}–${se.repMax} Wdh. · RIR ${se.targetRir}${rec != null ? ` · ${fmtNum(rec)} kg` : ''}`}
          </div>
        </div>
        <ChevronDown size={18} className={cn('shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="flex flex-col gap-4 px-3 pb-4 sm:px-4">
          {/* Große Übungskarte */}
          <div className="relative h-[36vh] max-h-[340px] min-h-[220px] overflow-hidden rounded-[24px] bg-[radial-gradient(90%_70%_at_50%_40%,rgb(var(--raised)),rgb(var(--bg)))]">
            <ExerciseVisual ex={ex} />
            <button
              onClick={onFocus}
              className="absolute left-3 top-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-bg/60 px-3 text-[12.5px] font-medium backdrop-blur"
              aria-label="Fokus-Modus öffnen"
            >
              <Maximize2 size={13} /> Fokus
            </button>
            <div className="absolute right-3 top-3 flex gap-1 rounded-2xl bg-bg/50 p-1.5 backdrop-blur">
              <BodyMap side="front" colors={{}} fills={targetFills(ex.muscles)} className="h-20 w-9" />
              <BodyMap side="back" colors={{}} fills={targetFills(ex.muscles)} className="h-20 w-9" />
            </div>
            <div className="absolute bottom-3 left-3 right-28 flex flex-wrap gap-1">
              {muscles.map(([m, c]) => (
                <span
                  key={m}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur',
                    (c ?? 0) >= 0.75 ? 'bg-[rgb(var(--hl)/0.2)] text-[rgb(var(--hl))]' : 'bg-bg/60 text-fg/70',
                  )}
                >
                  {MUSCLE[m as keyof typeof MUSCLE].short}
                  {(c ?? 0) < 0.75 && ' · indirekt'}
                </span>
              ))}
            </div>
          </div>

          {/* Vorgabe */}
          <div className="grid grid-cols-4 gap-2">
            <Big label="Sätze" value={String(se.sets.length)} />
            <Big label="Wdh." value={`${se.repMin}–${se.repMax}`} />
            <Big label="Gewicht" value={rec != null ? fmtNum(rec) : 'frei'} unit={rec != null ? 'kg' : undefined} accent />
            <Big label="Pause" value={fmtClock(se.restSec)} />
          </div>
          <div className="flex flex-col gap-1 text-[12.5px] text-muted">
            <span>
              Ziel-RIR {se.targetRir} · {last ? `Letztes Mal ${fmtNum(last.sets[0].weight)} kg × ${last.sets.map((x) => x.reps).join('/')} (${fmtShortDay(last.date)})` : 'Erstes Mal – Gewicht frei wählen'}
            </span>
            {se.setsReason && <span>{se.setsReason}</span>}
          </div>

          <div className={cn('rounded-xl px-3 py-2.5 text-[13px]', advice.type === 'increase' ? 'bg-rec-green/10 text-rec-green' : advice.type === 'deload' || advice.type === 'decrease' ? 'bg-rec-orange/10 text-rec-orange' : 'bg-raised text-fg/85')}>
            <span className="flex gap-2">
              <Zap size={14} className="mt-0.5 shrink-0" />
              <span>{se.adviceText ?? advice.text}</span>
            </span>
          </div>

          {/* Sätze – für iPhone: große Stepper */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1.75rem_1fr_1fr_3.25rem] gap-2 px-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted">
              <span>#</span>
              <span className="text-center">Gewicht (kg)</span>
              <span className="text-center">Wdh.</span>
              <span />
            </div>
            {se.sets.map((st, i) => {
              const activeSet = !st.done && se.sets.findIndex((x) => !x.done) === i;
              return (
                <div
                  key={st.id}
                  className={cn(
                    'flex flex-col gap-2 rounded-2xl p-1.5 transition',
                    st.done ? 'bg-rec-green/[0.08]' : activeSet ? 'bg-raised ring-1 ring-accent/30' : 'bg-raised/50',
                  )}
                >
                  <div className="grid grid-cols-[1.75rem_1fr_1fr_3.25rem] items-center gap-2">
                    <button className="tnum text-center text-[14px] font-semibold text-muted" onClick={() => setNoteFor(noteFor === st.id ? null : st.id)} aria-label={`Satz ${i + 1}: Notiz und Optionen`}>
                      {st.note ? <MessageSquare size={14} className="mx-auto text-accent" /> : i + 1}
                    </button>
                    <NumStepper
                      id={`w-${st.id}`}
                      value={st.weight}
                      placeholder={rec != null ? fmtNum(rec) : 'kg'}
                      decimal
                      disabled={st.done}
                      onChange={(v) => s.updateSet(session.id, se.uid, st.id, { weight: v })}
                      onStep={(d) => {
                        const base = st.weight ?? rec ?? 0;
                        s.updateSet(session.id, se.uid, st.id, { weight: d > 0 ? nextWeight(base, ex, s.settings) : prevWeight(base, ex, s.settings) });
                      }}
                      label="Gewicht"
                    />
                    <NumStepper
                      id={`r-${st.id}`}
                      value={st.reps}
                      placeholder={String(advice.repTarget)}
                      disabled={st.done}
                      onChange={(v) => s.updateSet(session.id, se.uid, st.id, { reps: v == null ? null : Math.round(v) })}
                      onStep={(d) => s.updateSet(session.id, se.uid, st.id, { reps: Math.max(0, (st.reps ?? advice.repTarget) + d) })}
                      label="Wiederholungen"
                    />
                    <button
                      aria-label={st.done ? 'Satz zurücksetzen' : 'Satz abschließen'}
                      onClick={() => completeSet(st.id, i)}
                      className={cn(
                        'grid h-12 place-items-center rounded-xl transition active:scale-95',
                        st.done ? 'bg-rec-green text-bg' : activeSet ? 'bg-fg text-bg' : 'bg-bg text-muted',
                      )}
                    >
                      {st.done ? <Undo2 size={18} /> : <Check size={22} />}
                    </button>
                  </div>
                  {(activeSet || noteFor === st.id) && !st.done && (
                    <div className="flex items-center gap-1.5 pl-[2.25rem]">
                      <span className="w-8 text-[10.5px] font-semibold uppercase tracking-wider text-muted">RIR</span>
                      {[0, 1, 2, 3, 4].map((r) => (
                        <button
                          key={r}
                          onClick={() => s.updateSet(session.id, se.uid, st.id, { rir: r, failure: r === 0 ? st.failure : false })}
                          className={cn('tnum h-9 min-w-9 flex-1 rounded-lg text-[14px] font-semibold', (st.rir ?? se.targetRir) === r ? 'bg-fg text-bg' : 'bg-bg text-muted')}
                        >
                          {r}
                        </button>
                      ))}
                      <button
                        aria-label="Muskelversagen"
                        aria-pressed={st.failure}
                        onClick={() => s.updateSet(session.id, se.uid, st.id, { failure: !st.failure, rir: !st.failure ? 0 : st.rir })}
                        className={cn('h-9 rounded-lg px-2.5 text-[12px] font-semibold', st.failure ? 'bg-rec-red/20 text-rec-red' : 'bg-bg text-muted')}
                      >
                        MV
                      </button>
                    </div>
                  )}
                  {st.done && (
                    <div className="tnum pl-[2.25rem] text-[11.5px] text-muted">
                      RIR {st.rir ?? '–'}
                      {st.failure && ' · Muskelversagen'}
                    </div>
                  )}
                  {noteFor === st.id && (
                    <div className="flex gap-1.5 pl-[2.25rem]">
                      <Input
                        id={`n-${st.id}`}
                        autoFocus
                        placeholder="Notiz (z. B. Sitzposition 4)"
                        value={st.note}
                        onChange={(e) => s.updateSet(session.id, se.uid, st.id, { note: e.target.value })}
                      />
                      <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => s.removeSet(session.id, se.uid, st.id)} aria-label="Satz löschen">
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            <p className="px-1 text-[11px] text-muted">Werte sind mit der Empfehlung vorausgefüllt. ± springt in den echten Gewichtsstufen des Geräts. Tippe auf die Satznummer für Notiz/Löschen.</p>
          </div>

          {complete && (
            <div className="flex items-center gap-2 rounded-xl bg-rec-green/10 px-3 py-2.5 text-[13px] text-rec-green">
              <Check size={15} className="shrink-0" /> Optimale Satzzahl erreicht ({se.sets.length}). Weitere Sätze bringen heute kaum Zusatznutzen – weiter zur nächsten Übung.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={complete ? 'ghost' : 'secondary'} onClick={() => s.addSet(session.id, se.uid)} title="Zusätzlicher Satz (über der Empfehlung)">
              <Plus size={14} /> {complete ? 'Extra-Satz' : 'Satz'}
            </Button>
            {se.sets.some((x) => !x.done) && se.sets.length > 1 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const last = [...se.sets].reverse().find((x) => !x.done);
                  if (last) s.removeSet(session.id, se.uid, last.id);
                }}
                aria-label="Letzten offenen Satz entfernen"
              >
                <Minus size={14} /> Satz
              </Button>
            )}
            {doneN > 0 && se.sets.some((x) => !x.done) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  se.sets.filter((x) => !x.done).forEach((x) => s.removeSet(session.id, se.uid, x.id));
                  setTimeout(onNext, 200);
                }}
              >
                <Check size={14} /> Übung fertig ({doneN} Sätze)
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={onSwap}>
              <Repeat size={14} /> Austauschen
            </Button>
            <Button size="sm" variant="secondary" onClick={() => s.patchExercise(session.id, se.uid, { skipped: !se.skipped })}>
              <SkipForward size={14} /> {se.skipped ? 'Wieder aufnehmen' : 'Überspringen'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCues(!showCues)}>
              Ausführung
            </Button>
            <div className="ml-auto flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => s.moveExercise(session.id, se.uid, -1)} aria-label="Nach oben">
                <ArrowUp size={15} />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => s.moveExercise(session.id, se.uid, 1)} aria-label="Nach unten">
                <ArrowDown size={15} />
              </Button>
            </div>
          </div>
          {showCues && (
            <div className="flex flex-col gap-2 rounded-xl bg-raised p-3 text-[13px]">
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {ex.cues.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              {se.reason && <p className="text-muted">Warum: {se.reason}</p>}
              <a
                className="inline-flex items-center gap-1.5 text-accent"
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' Ausführung')}`}
                target="_blank"
                rel="noreferrer"
              >
                Video-Anleitung suchen <ExternalLink size={13} />
              </a>
            </div>
          )}
          <Input
            id={`note-${se.uid}`}
            placeholder="Notiz zur Übung"
            value={se.note}
            onChange={(e) => s.patchExercise(session.id, se.uid, { note: e.target.value })}
          />
        </div>
      )}
    </Card>
  );
}

function Big({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl bg-raised px-2 py-2.5 text-center">
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className={cn('tnum mt-0.5 truncate text-[19px] font-semibold leading-tight', accent && 'text-accent')}>
        {value}
        {unit && <span className="ml-0.5 text-[12px] font-medium text-muted">{unit}</span>}
      </div>
    </div>
  );
}

function NumStepper({
  id,
  value,
  placeholder,
  decimal,
  disabled,
  onChange,
  onStep,
  label,
}: {
  id: string;
  value: number | null;
  placeholder: string;
  decimal?: boolean;
  disabled?: boolean;
  onChange: (v: number | null) => void;
  onStep: (d: 1 | -1) => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? '' : decimal ? String(value).replace('.', ',') : String(value));
  const tap = (d: 1 | -1) => {
    try {
      navigator.vibrate?.(8);
    } catch {
      /* ignore */
    }
    onStep(d);
  };
  return (
    <div className={cn('flex h-12 min-w-0 items-center overflow-hidden rounded-xl bg-bg', disabled && 'opacity-70')}>
      <button type="button" disabled={disabled} onClick={() => tap(-1)} className="grid h-full w-9 shrink-0 place-items-center text-muted active:bg-raised disabled:opacity-40" aria-label={`${label} verringern`}>
        <Minus size={16} />
      </button>
      <input
        id={id}
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        enterKeyHint="done"
        autoComplete="off"
        disabled={disabled}
        aria-label={label}
        className="tnum h-full min-w-0 flex-1 bg-transparent text-center text-[18px] font-semibold text-fg placeholder:text-muted/50 focus:outline-none"
        placeholder={placeholder}
        value={shown}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9.,]/g, ''))}
        onBlur={() => {
          if (draft != null) {
            const v = draft.replace(',', '.');
            onChange(v === '' ? null : Number(v));
          }
          setDraft(null);
        }}
      />
      <button type="button" disabled={disabled} onClick={() => tap(1)} className="grid h-full w-9 shrink-0 place-items-center text-muted active:bg-raised disabled:opacity-40" aria-label={`${label} erhöhen`}>
        <Plus size={16} />
      </button>
    </div>
  );
}

function Info({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl bg-raised px-2.5 py-2">
      <div className="truncate text-[10.5px] text-muted">{label}</div>
      <div className={cn('tnum truncate text-[14px] font-semibold', accent && 'text-accent')}>{value}</div>
      {sub && <div className="tnum truncate text-[10.5px] text-muted">{sub}</div>}
    </div>
  );
}

export function ExercisePicker({
  open,
  mode,
  current,
  onClose,
  onPick,
}: {
  open: boolean;
  mode: 'add' | 'swap';
  current?: Exercise;
  onClose: () => void;
  onPick: (e: Exercise) => void;
}) {
  const exercises = useStore((s) => s.exercises);
  const [q, setQ] = useState('');
  const list = exercises.filter((e) => !e.locked && e.id !== current?.id && e.name.toLowerCase().includes(q.toLowerCase()));
  const same = current ? list.filter((e) => e.primary === current.primary) : [];
  const rest = list.filter((e) => !same.includes(e));
  const groups = MUSCLES.map((m) => ({ m, items: rest.filter((e) => e.primary === m.id) })).filter((g) => g.items.length);
  const row = (e: Exercise) => (
    <button key={e.id} onClick={() => onPick(e)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-raised">
      <ExerciseIcon id={e.id} pattern={e.pattern} muscles={e.muscles} size={44} />
      <div className="min-w-0">
        <div className="truncate text-[14px] font-medium">{e.name}</div>
        <div className="truncate text-[12px] text-muted">
          {Object.keys(e.muscles)
            .map((m) => MUSCLE[m as keyof typeof MUSCLE].short)
            .join(', ')}
        </div>
      </div>
    </button>
  );
  return (
    <Sheet open={open} onClose={onClose} title={mode === 'swap' ? `${current?.name ?? 'Übung'} austauschen` : 'Übung hinzufügen'}>
      <Input id="picker-q" placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
      {same.length > 0 && (
        <div className="mb-3">
          <div className="label mb-1 px-2">Gleicher Zielmuskel</div>
          {same.map(row)}
        </div>
      )}
      {groups.map((g) => (
        <div key={g.m.id} className="mb-3">
          <div className="label mb-1 px-2">{g.m.label}</div>
          {g.items.map(row)}
        </div>
      ))}
      {!list.length && <p className="py-6 text-center text-[13px] text-muted">Keine passende Übung. Lege eigene Übungen unter „Übungen“ an.</p>}
      <div className="hidden">
        <Dumbbell />
      </div>
    </Sheet>
  );
}
