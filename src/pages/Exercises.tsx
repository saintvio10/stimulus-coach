import { useState } from 'react';
import { Lock, LockOpen, Plus, Repeat, Star, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/hooks';
import type { AnimPattern, Equipment, Exercise, MuscleId } from '../lib/types';
import { MUSCLE, MUSCLES } from '../lib/muscles';
import { Badge, Button, Card, Chip, Confirm, Field, Input, PageHeader, Select, Sheet, Switch } from '../components/ui';
import { ExerciseAnimation, ExerciseIcon, SPECS } from '../components/ExerciseAnimation';
import { ExercisePicker } from './Training';
import { cn, uid, weightSteps, fmtNum } from '../lib/utils';
import { DEFAULT_EXERCISES } from '../data/exercises';

const EQUIP: Record<Equipment, string> = {
  dumbbell: 'Kurzhantel',
  cable: 'Kabelzug',
  machine: 'Maschine',
  barbell: 'Langhantel/EZ',
  plate: 'Scheiben (z. B. Beinpresse)',
  bodyweight: 'Körpergewicht',
};

const PATTERN_LABEL: Record<AnimPattern, string> = {
  curl: 'Curl',
  preacher: 'Preacher Curl',
  bayesian: 'Kabel-Curl hinter Körper',
  overheadExt: 'Überkopf-Strecken',
  pushdown: 'Trizepsdrücken',
  dip: 'Dip',
  chestPress: 'Brustpresse',
  inclinePress: 'Schrägbankdrücken',
  fly: 'Fly',
  pulldown: 'Latzug',
  row: 'Rudern (gestützt)',
  cableRow: 'Kabelrudern',
  lateralRaise: 'Seitheben',
  reverseFly: 'Reverse Fly',
  shoulderPress: 'Schulterpresse',
  legPress: 'Beinpresse',
  legCurl: 'Beinbeuger',
  legExtension: 'Beinstrecker',
  rdl: 'Hüftbeugen (RDL)',
  calfRaise: 'Wadenheben',
  cableCrunch: 'Kabel-Crunch',
  abMachine: 'Bauchmaschine',
};

export default function ExercisesPage() {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<MuscleId | 'all' | 'locked' | 'fav'>('all');
  const [edit, setEdit] = useState<Exercise | null>(null);
  const [replace, setReplace] = useState<Exercise | null>(null);

  const list = s.exercises.filter((e) => {
    if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'locked') return e.locked;
    if (filter === 'fav') return e.favorite;
    if (filter !== 'all') return (e.muscles[filter] ?? 0) > 0;
    return true;
  });
  const groups = MUSCLES.map((m) => ({ m, items: list.filter((e) => e.primary === m.id) })).filter((g) => g.items.length);

  const patch = (id: string, p: Partial<Exercise>) =>
    s.mutate((d) => {
      const e = d.exercises.find((x) => x.id === id);
      if (e) Object.assign(e, p);
    });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Übungen"
        sub={`${s.exercises.filter((e) => !e.locked).length} aktiv · ${s.exercises.filter((e) => e.locked).length} gesperrt`}
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              setEdit({
                id: 'custom-' + uid(),
                name: '',
                muscles: { biceps: 1 },
                primary: 'biceps',
                equipment: 'cable',
                pattern: 'curl',
                compound: false,
                repMin: 8,
                repMax: 12,
                restSec: 90,
                targetRir: 1,
                stretch: 1,
                fatigue: 1,
                cues: [],
                locked: false,
                favorite: false,
                custom: true,
              })
            }
          >
            <Plus size={15} /> Neu
          </Button>
        }
      />
      <Input id="ex-search" placeholder="Übung suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="scroll-x -mx-1 flex gap-1.5 px-1">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          Alle
        </Chip>
        <Chip active={filter === 'fav'} onClick={() => setFilter('fav')}>
          <Star size={13} /> Bevorzugt
        </Chip>
        <Chip active={filter === 'locked'} onClick={() => setFilter('locked')}>
          <Lock size={13} /> Gesperrt
        </Chip>
        {MUSCLES.filter((m) => !m.indirectOnly).map((m) => (
          <Chip key={m.id} active={filter === m.id} onClick={() => setFilter(m.id)}>
            {m.short}
          </Chip>
        ))}
      </div>

      {groups.map((g) => (
        <section key={g.m.id}>
          <div className="label mb-2 px-1">{g.m.label}</div>
          <Card className="p-1 sm:p-1">
            <ul className="divide-y divide-line/[0.06]">
              {g.items.map((e) => (
                <li key={e.id} className={cn('flex items-center gap-3 px-3 py-2.5', e.locked && 'opacity-55')}>
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEdit(e)}>
                    <ExerciseIcon id={e.id} pattern={e.pattern} muscles={e.muscles} size={52} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate text-[14px] font-medium">
                        {e.name}
                        {e.custom && <Badge>eigene</Badge>}
                      </div>
                      <div className="truncate text-[12px] text-muted">
                        {Object.entries(e.muscles)
                          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                          .map(([m, c]) => `${MUSCLE[m as MuscleId].short}${(c ?? 0) < 0.75 ? ' (ind.)' : ''}`)
                          .join(', ')}{' '}
                        · {e.repMin}–{e.repMax} Wdh.
                      </div>
                      {e.note && <div className="truncate text-[11px] text-rec-orange">{e.note}</div>}
                    </div>
                  </button>
                  <button
                    className={cn('grid h-9 w-9 place-items-center rounded-full', e.favorite ? 'text-rec-yellow' : 'text-muted hover:text-fg')}
                    onClick={() => patch(e.id, { favorite: !e.favorite })}
                    aria-label="Bevorzugen"
                  >
                    <Star size={16} fill={e.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className={cn('grid h-9 w-9 place-items-center rounded-full', e.locked ? 'text-rec-orange' : 'text-muted hover:text-fg')}
                    onClick={() => {
                      patch(e.id, { locked: !e.locked });
                      toast(e.locked ? `${e.name} wieder verfügbar` : `${e.name} gesperrt – wird nicht mehr eingeplant`);
                    }}
                    aria-label={e.locked ? 'Entsperren' : 'Sperren'}
                  >
                    {e.locked ? <Lock size={16} /> : <LockOpen size={16} />}
                  </button>
                  <button className="grid h-9 w-9 place-items-center rounded-full text-muted hover:text-fg" onClick={() => setReplace(e)} aria-label="Austauschen">
                    <Repeat size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}

      <p className="px-1 text-[12px] text-muted">
        Sperren = wird nie eingeplant. Bevorzugt = leichter Bonus bei der Auswahl. Austauschen = diese Übung sperren und eine Alternative bevorzugen.
      </p>

      {edit && <EditSheet ex={edit} onClose={() => setEdit(null)} />}
      <ExercisePicker
        open={!!replace}
        mode="swap"
        current={replace ?? undefined}
        onClose={() => setReplace(null)}
        onPick={(n) => {
          if (!replace) return;
          patch(replace.id, { locked: true });
          patch(n.id, { favorite: true, locked: false });
          toast(`${replace.name} → ${n.name}`);
          setReplace(null);
        }}
      />
    </div>
  );
}

const CONTRIB = [0, 0.25, 0.5, 0.75, 1];

function EditSheet({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const exists = s.exercises.some((e) => e.id === ex.id);
  const [e, setE] = useState<Exercise>(ex);
  const [weightsText, setWeightsText] = useState(ex.weights?.join(', ') ?? '');
  const [cuesText, setCuesText] = useState(ex.cues.join('\n'));
  const [confirmDel, setConfirmDel] = useState(false);
  const steps = weightSteps(e, s.settings);
  const save = () => {
    if (!e.name.trim()) return toast('Bitte einen Namen eingeben');
    const weights = weightsText
      .split(/[,;\s]+/)
      .map((x) => Number(x.replace(',', '.')))
      .filter((x) => x > 0);
    const muscles = Object.fromEntries(Object.entries(e.muscles).filter(([, v]) => (v ?? 0) > 0));
    const primary = (Object.keys(muscles).includes(e.primary) ? e.primary : (Object.keys(muscles)[0] as MuscleId)) ?? 'biceps';
    const out: Exercise = {
      ...e,
      name: e.name.trim(),
      muscles: { ...muscles, [primary]: Math.max(1, muscles[primary] ?? 1) },
      primary,
      weights: weights.length ? weights : undefined,
      cues: cuesText.split('\n').map((x) => x.trim()).filter(Boolean),
      repMax: Math.max(e.repMin, e.repMax),
    };
    s.mutate((d) => {
      const i = d.exercises.findIndex((x) => x.id === out.id);
      if (i >= 0) d.exercises[i] = out;
      else d.exercises.push(out);
    });
    toast('Übung gespeichert');
    onClose();
  };
  const def = DEFAULT_EXERCISES.find((d) => d.id === ex.id);
  return (
    <Sheet
      open
      onClose={onClose}
      wide
      title={exists ? 'Übung bearbeiten' : 'Neue Übung'}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {e.custom && exists && (
              <Button variant="danger" size="sm" onClick={() => setConfirmDel(true)}>
                <Trash2 size={14} /> Löschen
              </Button>
            )}
            {def && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setE({ ...def, favorite: e.favorite, locked: e.locked });
                  setCuesText(def.cues.join('\n'));
                  setWeightsText('');
                }}
              >
                Standard wiederherstellen
              </Button>
            )}
          </div>
          <Button variant="primary" onClick={save}>
            Speichern
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="overflow-hidden rounded-2xl bg-bg">
            <ExerciseAnimation pattern={e.pattern} muscles={e.muscles} className="h-32 w-full" />
          </div>
          <div className="flex flex-col gap-3">
            <Field label="Name">
              <Input id="ed-name" value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} placeholder="z. B. Spider Curls" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gerät">
                <Select id="ed-eq" value={e.equipment} onChange={(x) => setE({ ...e, equipment: x.target.value as Equipment })}>
                  {Object.entries(EQUIP).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Animation">
                <Select id="ed-pat" value={e.pattern} onChange={(x) => setE({ ...e, pattern: x.target.value as AnimPattern })}>
                  {Object.keys(SPECS).map((k) => (
                    <option key={k} value={k}>
                      {PATTERN_LABEL[k as AnimPattern]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[12px] font-medium text-muted">Muskelbeteiligung pro Satz (1 = direkt, 0,5 = indirekt)</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {MUSCLES.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-raised px-3 py-1.5">
                <button
                  className={cn('text-[13px]', e.primary === m.id ? 'font-semibold text-accent' : 'text-fg')}
                  onClick={() => setE({ ...e, primary: m.id, muscles: { ...e.muscles, [m.id]: 1 } })}
                  title="Als Zielmuskel festlegen"
                >
                  {m.short}
                  {e.primary === m.id && ' · Ziel'}
                </button>
                <div className="flex gap-0.5">
                  {CONTRIB.map((c) => (
                    <button
                      key={c}
                      onClick={() => setE({ ...e, muscles: { ...e.muscles, [m.id]: c } })}
                      className={cn('tnum h-7 w-8 rounded-md text-[11px]', (e.muscles[m.id] ?? 0) === c ? 'bg-fg text-bg' : 'text-muted hover:bg-bg')}
                    >
                      {c === 0 ? '–' : fmtNum(c, 2)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Wdh. min">
            <Input id="ed-rmin" type="number" inputMode="numeric" value={e.repMin} onChange={(x) => setE({ ...e, repMin: +x.target.value || 1 })} />
          </Field>
          <Field label="Wdh. max">
            <Input id="ed-rmax" type="number" inputMode="numeric" value={e.repMax} onChange={(x) => setE({ ...e, repMax: +x.target.value || 1 })} />
          </Field>
          <Field label="Pause (s)">
            <Input id="ed-rest" type="number" inputMode="numeric" value={e.restSec} onChange={(x) => setE({ ...e, restSec: +x.target.value || 30 })} />
          </Field>
          <Field label="Ziel-RIR">
            <Select id="ed-rir" value={e.targetRir} onChange={(x) => setE({ ...e, targetRir: +x.target.value })}>
              {[0, 1, 2, 3].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dehnungsbelastung">
            <Select id="ed-str" value={e.stretch} onChange={(x) => setE({ ...e, stretch: +x.target.value as 0 | 1 | 2 })}>
              <option value={0}>gering</option>
              <option value={1}>mittel</option>
              <option value={2}>hoch</option>
            </Select>
          </Field>
          <Field label="Systemische Ermüdung">
            <Select id="ed-fat" value={e.fatigue} onChange={(x) => setE({ ...e, fatigue: +x.target.value as 1 | 2 | 3 })}>
              <option value={1}>niedrig</option>
              <option value={2}>mittel</option>
              <option value={3}>hoch</option>
            </Select>
          </Field>
          <Field label="Steigerung (kg)" hint={steps.list ? 'nutzt Hantelliste' : `Standard: ${fmtNum(steps.step)} kg`}>
            <Input
              id="ed-inc"
              inputMode="decimal"
              placeholder="Standard"
              value={e.increment ?? ''}
              onChange={(x) => setE({ ...e, increment: x.target.value ? Number(x.target.value.replace(',', '.')) : undefined })}
            />
          </Field>
          <Field label="Mehrgelenkig">
            <div className="flex h-10 items-center">
              <Switch id="ed-comp" checked={e.compound} onChange={(v) => setE({ ...e, compound: v })} label="Mehrgelenkig" />
            </div>
          </Field>
        </div>
        <Field label="Eigene Gewichtsstufen (optional, kommagetrennt)" hint="z. B. 5, 7.5, 10, 12.5 – überschreibt die Steigerung">
          <Input id="ed-weights" value={weightsText} onChange={(x) => setWeightsText(x.target.value)} placeholder="leer = Gerätestandard" />
        </Field>
        <Field label="Ausführungshinweise (eine Zeile pro Hinweis)">
          <textarea
            id="ed-cues"
            className="min-h-[90px] w-full rounded-xl border border-line/10 bg-bg p-3 text-[15px] focus:border-accent/60 focus:outline-none"
            value={cuesText}
            onChange={(x) => setCuesText(x.target.value)}
          />
        </Field>
        <Field label="Notiz">
          <Input id="ed-note" value={e.note ?? ''} onChange={(x) => setE({ ...e, note: x.target.value || undefined })} />
        </Field>
        <div className="flex items-center justify-between rounded-xl bg-raised px-3 py-2.5">
          <span className="text-[13px]">Gesperrt (nie einplanen)</span>
          <Switch id="ed-lock" checked={e.locked} onChange={(v) => setE({ ...e, locked: v })} label="Gesperrt" />
        </div>
      </div>
      <Confirm
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() => {
          s.mutate((d) => {
            d.exercises = d.exercises.filter((x) => x.id !== e.id);
          });
          toast('Übung gelöscht');
          onClose();
        }}
        title="Übung löschen?"
        text="Vergangene Trainings mit dieser Übung bleiben gespeichert, werden aber nicht mehr zugeordnet."
        confirmLabel="Löschen"
        danger
      />
    </Sheet>
  );
}
