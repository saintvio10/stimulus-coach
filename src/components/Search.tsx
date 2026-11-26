import { useMemo, useState } from 'react';
import { ExerciseVisual } from './ExerciseVisual';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { useStore } from '../lib/store';
import { useRouter, useToast, type Route } from '../lib/hooks';
import type { Exercise, MuscleId } from '../lib/types';
import { MUSCLE } from '../lib/muscles';
import { exposures } from '../engine/progression';
import { personalRecords } from '../engine/stats';
import { fmtClock, fmtNum, fmtShortDay } from '../lib/utils';
import { Badge, Button, Input, Sheet } from './ui';
import { ExerciseAnimation, ExerciseIcon } from './ExerciseAnimation';
import { BodyMap, targetFills } from './BodyMap';

const PAGES: { id: Route; label: string; keys: string }[] = [
  { id: 'training', label: 'Training', keys: 'training starten heute' },
  { id: 'kalender', label: 'Kalender & Verfügbarkeit', keys: 'kalender zeit verfügbar tage woche' },
  { id: 'muskeln', label: 'Muskelanalyse', keys: 'muskel regeneration karte' },
  { id: 'fortschritt', label: 'Fortschritt', keys: 'fortschritt diagramm rekord gewicht umfang' },
  { id: 'ernaehrung', label: 'Ernährung', keys: 'ernährung kalorien protein kreatin schlaf' },
  { id: 'uebungen', label: 'Übungen verwalten', keys: 'übungen sperren tauschen' },
  { id: 'profil', label: 'Profil & Einstellungen', keys: 'profil prioritäten export import' },
  { id: 'wissenschaft', label: 'Wissenschaft & Regeln', keys: 'studien wissenschaft algorithmus regeln' },
];

export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const exercises = useStore((s) => s.exercises);
  const go = useRouter((r) => r.go);
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<Exercise | null>(null);
  const ql = q.toLowerCase();
  const ex = exercises.filter(
    (e) => !ql || e.name.toLowerCase().includes(ql) || Object.keys(e.muscles).some((m) => MUSCLE[m as MuscleId].label.toLowerCase().includes(ql)),
  );
  const pages = PAGES.filter((p) => ql && (p.label.toLowerCase().includes(ql) || p.keys.includes(ql)));
  return (
    <>
      <Sheet open={open} onClose={onClose} title="Suche">
        <Input id="search-q" autoFocus placeholder="Übung, Muskel oder Bereich…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
        {pages.length > 0 && (
          <div className="mb-3">
            <div className="label mb-1 px-1">Bereiche</div>
            {pages.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  go(p.id);
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-xl px-2 py-2.5 text-left text-[14px] hover:bg-raised"
              >
                {p.label} <ArrowRight size={15} className="text-muted" />
              </button>
            ))}
          </div>
        )}
        <div className="label mb-1 px-1">Übungen</div>
        {ex.map((e) => (
          <button key={e.id} onClick={() => setDetail(e)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-raised">
            <ExerciseIcon id={e.id} pattern={e.pattern} muscles={e.muscles} size={44} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium">
                {e.name} {e.locked && <Badge tone="orange">gesperrt</Badge>}
              </div>
              <div className="truncate text-[12px] text-muted">
                {Object.keys(e.muscles)
                  .map((m) => MUSCLE[m as MuscleId].short)
                  .join(', ')}
              </div>
            </div>
          </button>
        ))}
        {!ex.length && <p className="py-6 text-center text-[13px] text-muted">Nichts gefunden.</p>}
      </Sheet>
      {detail && (
        <ExerciseDetail
          ex={detail}
          onClose={() => setDetail(null)}
          onNavigate={() => {
            setDetail(null);
            onClose();
          }}
        />
      )}
    </>
  );
}

export function ExerciseDetail({ ex, onClose, onNavigate }: { ex: Exercise; onClose: () => void; onNavigate?: () => void }) {
  const s = useStore();
  const go = useRouter((r) => r.go);
  const toast = useToast((t) => t.show);
  const active = s.sessions.find((x) => x.status === 'active');
  const last = useMemo(() => exposures(ex.id, s.sessions)[0], [ex.id, s.sessions]);
  const pr = useMemo(() => personalRecords(s.sessions).get(ex.id), [ex.id, s.sessions]);
  const fills = targetFills(ex.muscles);
  return (
    <Sheet open onClose={onClose} title={ex.name} wide>
      <div className="flex flex-col gap-4">
        <div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(90%_70%_at_50%_40%,rgb(var(--raised)),rgb(var(--bg)))]">
          <div className="relative h-64 sm:h-72"><ExerciseVisual ex={ex} /></div>
          <div className="absolute right-3 top-3 flex gap-1 rounded-2xl bg-bg/50 p-1.5 backdrop-blur">
            <BodyMap side="front" colors={{}} fills={fills} className="h-20 w-9" />
            <BodyMap side="back" colors={{}} fills={fills} className="h-20 w-9" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(ex.muscles)
            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            .map(([m, c]) => (
              <Badge key={m} tone={(c ?? 0) >= 0.75 ? 'accent' : 'default'}>
                {MUSCLE[m as MuscleId].label}
                {(c ?? 0) < 0.75 && ' · indirekt'}
              </Badge>
            ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
          <Tile l="Wdh.-Bereich" v={`${ex.repMin}–${ex.repMax}`} />
          <Tile l="Ziel-RIR" v={String(ex.targetRir)} />
          <Tile l="Satzpause" v={fmtClock(ex.restSec)} />
          <Tile l="Dehnungsfokus" v={['gering', 'mittel', 'hoch'][ex.stretch]} />
          <Tile l="Letztes Mal" v={last ? `${fmtNum(last.sets[0].weight)} kg × ${last.sets.map((x) => x.reps).join('/')}` : '–'} />
          <Tile l="Datum" v={last ? fmtShortDay(last.date) : '–'} />
          <Tile l="Bestes e1RM" v={pr ? `${fmtNum(pr.e1rm.value, 1)} kg` : '–'} />
          <Tile l="Höchstgewicht" v={pr ? `${fmtNum(pr.weight.value)} kg × ${pr.weight.reps}` : '–'} />
        </div>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13.5px]">
          {ex.cues.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {active && !ex.locked && (
            <Button
              variant="primary"
              onClick={() => {
                s.addExerciseToSession(active.id, ex);
                toast(`${ex.name} zum Training hinzugefügt`);
                go('training');
                onNavigate?.();
              }}
            >
              Zum laufenden Training hinzufügen
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              go('uebungen');
              onNavigate?.();
            }}
          >
            In Übungen bearbeiten
          </Button>
          <a
            className="inline-flex h-10 items-center gap-1.5 px-2 text-[14px] text-accent"
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' Ausführung')}`}
            target="_blank"
            rel="noreferrer"
          >
            Video <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </Sheet>
  );
}

function Tile({ l, v }: { l: string; v: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-raised px-3 py-2">
      <div className="truncate text-[11px] text-muted">{l}</div>
      <div className="tnum truncate font-semibold">{v}</div>
    </div>
  );
}
