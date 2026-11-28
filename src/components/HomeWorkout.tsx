import { useMemo, useState } from 'react';
import { AlertTriangle, Check, House, Minus } from 'lucide-react';
import { useStore } from '../lib/store';
import { useRouter } from '../lib/hooks';
import type { AppData, HomeFocusValue, HomeGroup, Settings } from '../lib/types';
import { planHome, planHomeWithNext, type HomeMode, type PlannedSession } from '../engine/planner';
import { HOME_GROUP_IDS, HOME_GROUPS, HOME_PRESETS, focusGroups, focusLabel, focusStatus, isAllGroups } from '../engine/homeFocus';
import { MUSCLE } from '../lib/muscles';
import { Button, Chip, Sheet } from './ui';
import { SessionPreview } from './Coach';
import { unlockAudio } from './RestTimer';
import { cn, dateKey, fmtMin, fmtNum, relDayLabel } from '../lib/utils';

/** Kurzbeschreibung deiner Ausrüstung, z. B. „1 Hantel 7,5 kg · 2 Flaschen à 1 l“ */
export function equipmentText(st: Settings): string {
  const nd = st.homeDumbbellCount ?? 1;
  const nb = st.homeBottleCount ?? 2;
  const parts = [
    nd ? `${nd} ${nd === 1 ? 'Hantel' : 'Hanteln'} ${fmtNum(st.homeDumbbell ?? 7.5)} kg` : '',
    nb ? `${nb} ${nb === 1 ? 'Flasche' : 'Flaschen'} à ${fmtNum(st.homeBottle ?? 1)} l` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'nichts eingetragen';
}

function Count({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-full bg-bg p-1" role="group" aria-label={label}>
      {[0, 1, 2].map((n) => (
        <button key={n} onClick={() => onChange(n)} aria-pressed={value === n} className={cn('h-8 rounded-full px-2.5 text-[12.5px] font-semibold transition', value === n ? 'bg-fg text-bg' : 'text-fg/70')}>
          {n === 0 ? 'keine' : n}
        </button>
      ))}
    </div>
  );
}

/** Ausrüstung unterwegs: Anzahl Hanteln + Gewicht, Anzahl Wasserflaschen + Liter (1 l ≈ 1 kg) */
export function HomeEquipment() {
  const s = useStore();
  const st = s.settings;
  const nd = st.homeDumbbellCount ?? 1;
  const nb = st.homeBottleCount ?? 2;
  const set = (patch: Partial<Settings>) => s.mutate((d) => void Object.assign(d.settings, patch));
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-raised p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium">Hanteln</span>
        <Count label="Anzahl Hanteln" value={nd} onChange={(n) => set({ homeDumbbellCount: n })} />
      </div>
      {nd > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-muted">Gewicht {nd === 2 ? 'je Hantel' : 'der Hantel'}</span>
          <div className="flex items-center gap-2">
            <button className="grid h-8 w-8 place-items-center rounded-full bg-bg text-[16px]" aria-label="Hantel leichter" onClick={() => set({ homeDumbbell: Math.max(0.5, (st.homeDumbbell ?? 7.5) - 0.5) })}>
              −
            </button>
            <span className="tnum w-14 text-center text-[15px] font-semibold">{fmtNum(st.homeDumbbell ?? 7.5)} kg</span>
            <button className="grid h-8 w-8 place-items-center rounded-full bg-bg text-[16px]" aria-label="Hantel schwerer" onClick={() => set({ homeDumbbell: (st.homeDumbbell ?? 7.5) + 0.5 })}>
              +
            </button>
          </div>
        </div>
      )}
      <div className="my-0.5 h-px bg-line/[0.07]" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium">Wasserflaschen</span>
        <Count label="Anzahl Wasserflaschen" value={nb} onChange={(n) => set({ homeBottleCount: n })} />
      </div>
      {nb > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-muted">Größe {nb === 2 ? 'je Flasche' : ''}</span>
          <div className="flex gap-1">
            {[0.5, 1, 1.5, 2].map((l) => (
              <Chip key={l} active={(st.homeBottle ?? 1) === l} onClick={() => set({ homeBottle: l })} className="h-8 px-2.5">
                {fmtNum(l)} l
              </Chip>
            ))}
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted">1 l Wasser ≈ 1 kg. Übungen, für die deine Ausrüstung nicht reicht (z. B. Seitheben mit 2 Gewichten bei nur einer Flasche), plant der Coach nicht ein.</p>
    </div>
  );
}

/** Schwerpunkt beim Training ohne Gym: Muskelgruppen einzeln an-/abwählen, darüber Schnellauswahl */
export function HomeFocusPicker({ value, onChange }: { value: HomeFocusValue | undefined; onChange: (g: HomeGroup[]) => void }) {
  const groups = focusGroups(value);
  const all = isAllGroups(groups);
  const toggle = (g: HomeGroup) => {
    // aus „alles“ heraus: erster Tipp wählt genau diese Gruppe
    const next = all ? [g] : groups.includes(g) ? groups.filter((x) => x !== g) : [...groups, g];
    onChange(next.length ? next : HOME_GROUP_IDS);
  };
  return (
    <div data-noswipe className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {HOME_PRESETS.map((p) => {
          const on = p.groups.length === groups.length && p.groups.every((x) => groups.includes(x));
          return (
            <button key={p.label} onClick={() => onChange(p.groups)} className={cn('h-7 rounded-full px-2.5 text-[12px] font-medium transition', on ? 'bg-fg text-bg' : 'bg-fg/[0.07] text-fg/70')}>
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {HOME_GROUP_IDS.map((g) => (
          <Chip key={g} active={!all && groups.includes(g)} onClick={() => toggle(g)} className="h-9" aria-pressed={!all && groups.includes(g)}>
            {!all && groups.includes(g) && <Check size={13} className="-ml-0.5 mr-0.5" />}
            {HOME_GROUPS[g].label}
          </Chip>
        ))}
      </div>
      <div className="text-[11.5px] text-muted">{all ? 'Ganzkörper – der Coach wählt nach Erholung und Wochenbedarf.' : `Nur ${focusLabel(groups)} – antippen zum An-/Abwählen.`}</div>
    </div>
  );
}

export function FocusStatusList({ plan, groups }: { plan: PlannedSession; groups: HomeGroup[] }) {
  const exercises = useStore((x) => x.exercises);
  const st = focusStatus(plan, groups, exercises);
  return (
    <ul className="flex flex-col gap-1.5">
      {st.map((x) => (
        <li key={x.group} className={cn('flex gap-2 rounded-xl px-3 py-2 text-[12.5px] leading-snug', x.tone === 'warn' ? 'bg-rec-yellow/[0.09] text-fg' : x.tone === 'ok' ? 'bg-rec-green/[0.08] text-fg' : 'bg-raised text-muted')}>
          <span className={cn('mt-0.5 shrink-0', x.tone === 'warn' ? 'text-rec-yellow' : x.tone === 'ok' ? 'text-rec-green' : 'text-muted')}>{x.tone === 'warn' ? <AlertTriangle size={14} /> : x.tone === 'ok' ? <Check size={14} /> : <Minus size={14} />}</span>
          <span>
            <b>{HOME_GROUPS[x.group].label}:</b> {x.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Training ohne Gym: der Coach plant mit Körpergewicht (optional deine Hantel und Flaschen) passend zu Erholung und Wochenvolumen */
export function HomeWorkoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const go = useRouter((r) => r.go);
  const [minutes, setMinutes] = useState(45);
  const [mode, setMode] = useState<HomeMode>('weights');
  const today = dateKey();
  const focusRaw = s.planOptions.homeFocus?.[today];
  const groups = focusGroups(focusRaw);
  const all = isAllGroups(groups);
  const setFocus = (g: HomeGroup[]) => s.mutate((d) => void (d.planOptions.homeFocus = { ...(d.planOptions.homeFocus ?? {}), [today]: g }));
  const res = useMemo(
    () => (open ? planHomeWithNext(s as unknown as AppData, minutes, mode, Date.now(), groups) : null),
    [open, minutes, mode, groups.join(','), s.sessions, s.exercises, s.settings, s.checkIns, s.activities], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const plan = res?.session ?? null;
  // Leerer Plan mit Auswahl: was stattdessen sinnvoll wäre
  const alt = useMemo(
    () => (open && !plan && !all ? planHome(s as unknown as AppData, minutes, mode, Date.now(), HOME_GROUP_IDS) : null),
    [open, plan, all, minutes, mode, s.sessions], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const active = s.sessions.some((x) => x.status === 'active');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Training ohne Gym"
      footer={
        plan ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => {
              unlockAudio();
              s.startSession(plan, undefined, 'home');
              onClose();
              go('training');
            }}
          >
            {active ? 'Neu starten (ersetzt laufendes Training)' : 'Unterwegs-Training starten'}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-muted">
          Der Coach plant wie im Studio nach Erholung und Wochenvolumen – nur mit Übungen, die überall gehen. Liegestütze & Co. bis nah ans Versagen (1–2 Wdh. Reserve) bauen genauso Muskeln auf; die
          Sätze zählen ganz normal fürs Wochenvolumen.
        </p>
        <div>
          <div className="label mb-2">Was hast du dabei?</div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['bw', 'Nur Körpergewicht', 'Liegestütze, Dips, Split Squats …'],
                ['weights', 'Hantel & Flaschen', equipmentText(s.settings)],
              ] as const
            ).map(([v, t, sub]) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                className={cn('rounded-2xl border p-3 text-left transition', mode === v ? 'border-accent/60 bg-accent/12' : 'border-line/10 bg-raised')}
              >
                <div className="text-[14px] font-semibold">{t}</div>
                <div className="mt-0.5 text-[11.5px] text-muted">{sub}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-2">Was willst du heute trainieren?</div>
          <HomeFocusPicker value={focusRaw} onChange={setFocus} />
        </div>
        {plan && !all && <FocusStatusList plan={plan} groups={groups} />}
        {mode === 'weights' && <HomeEquipment />}
        <div className="flex flex-wrap gap-1.5">
          {[20, 30, 45, 60, 75].map((m) => (
            <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)} className="h-8">
              {fmtMin(m)}
            </Chip>
          ))}
        </div>
        {plan ? (
          <SessionPreview s={plan} />
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl bg-rec-yellow/[0.08] px-3.5 py-3 text-[13px]">
            <div className="font-semibold">{all ? 'Gerade kein sinnvolles Training möglich' : `Für ${focusLabel(groups)} ist heute nichts sinnvoll`}</div>
            <div className="text-muted">
              {all ? 'Deine Muskeln brauchen noch Erholung oder haben ihr Wochenziel schon erreicht.' : 'Diese Muskeln sind noch ermüdet oder haben diese Woche schon genug Sätze – mehr würde kaum zusätzlichen Reiz bringen.'}
            </div>
            {alt && (
              <div>
                Stattdessen sinnvoll:{' '}
                <b>
                  {[...new Set(alt.exercises.map((e) => s.exercises.find((x) => x.id === e.exerciseId)?.primary).filter(Boolean))]
                    .map((m) => HOME_GROUP_IDS.find((g) => HOME_GROUPS[g].muscles.includes(m!)))
                    .filter((g, i, a) => g && a.indexOf(g) === i)
                    .map((g) => HOME_GROUPS[g!].label)
                    .join(', ')}
                </b>
              </div>
            )}
          </div>
        )}
        {plan && res?.next && (
          <p className="rounded-xl bg-raised px-3 py-2 text-[12px] text-muted">
            Danach: <span className="text-fg">{relDayLabel(res.next.date).split(',')[0]} · {res.next.label}</span> – rechnet dieses Training schon ein (z. B. weniger Sätze für heute trainierte Muskeln).
          </p>
        )}
        <p className="text-[11.5px] text-muted">
          Gewichtsauswahl unterwegs: nur was du oben eingetragen hast (Flaschen, Hantel). Bei Körpergewicht-Übungen ist das Zusatzgewicht (leer = ohne). Tage ohne Gym kannst du auch vorab markieren:
          in der Tagesleiste zweimal antippen (🏠) – dann plant der Coach diese Tage automatisch so und der Studio-Plan läuft danach weiter.
        </p>
      </div>
    </Sheet>
  );
}

export function HomeWorkoutButton({ className, label = 'Ohne Gym trainieren' }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border border-line/10 px-3.5 text-[12.5px] font-medium text-muted hover:text-fg', className)}
      >
        <House size={13} /> {label}
      </button>
      <HomeWorkoutSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
