import { MUSCLE, MUSCLE_IDS, type RecoveryColor } from '../lib/muscles';
import type { CheckIn, Exercise, MuscleId, Session } from '../lib/types';
import { DAY, HOUR, clamp, dateKey } from '../lib/utils';

/** Ein Trainingsreiz für einen Muskel (aus einem oder mehreren Sätzen) */
export interface StimulusEvent {
  t: number;
  muscle: MuscleId;
  /** fraktionale effektive Sätze */
  sets: number;
  /** Ermüdungsgewicht (Versagen/RIR 0 = höher) */
  fatigue: number;
  direct: boolean;
  /** Volumenlast kg × Wdh. × Beitrag */
  load: number;
  virtual?: boolean;
}

/** Effektivität eines Satzes in Abhängigkeit vom Abstand zum Versagen (praktische Heuristik) */
export function setEffectiveness(rir: number | null): number {
  if (rir == null) return 1;
  if (rir <= 4) return 1;
  if (rir <= 6) return 0.5;
  return 0.25;
}

export function setFatigueWeight(rir: number | null, failure: boolean): number {
  if (failure) return 1.25;
  if (rir === 0) return 1.15;
  return 1;
}

export const DIRECT_THRESHOLD = 0.75;

export function sessionTime(s: Session): number {
  return s.endedAt ?? s.startedAt;
}

export function eventsFromSessions(sessions: Session[], exercises: Exercise[]): StimulusEvent[] {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const out: StimulusEvent[] = [];
  for (const s of sessions) {
    const t = sessionTime(s);
    for (const se of s.exercises) {
      if (se.skipped) continue;
      const ex = exMap.get(se.exerciseId);
      if (!ex) continue;
      for (const set of se.sets) {
        if (!set.done) continue;
        const eff = setEffectiveness(set.rir);
        const fw = setFatigueWeight(set.rir, set.failure);
        for (const [m, c] of Object.entries(ex.muscles) as [MuscleId, number][]) {
          if (!c) continue;
          out.push({
            t,
            muscle: m,
            sets: c * eff,
            fatigue: c * eff * fw,
            direct: c >= DIRECT_THRESHOLD,
            load: (set.weight ?? 0) * (set.reps ?? 0) * c,
          });
        }
      }
    }
  }
  return out;
}

export interface MuscleState {
  muscle: MuscleId;
  /** geschätzte akute Ermüdung (abklingende Satzsumme) */
  fatigue: number;
  /** inkl. Muskelkater-Aufschlag */
  fatigueEff: number;
  vol7: number;
  vol14: number;
  direct7: number;
  indirect7: number;
  direct14: number;
  indirect14: number;
  load7: number;
  lastDirect: number | null;
  lastAny: number | null;
  lastSets: number;
  recovery: number; // 0–100 (Schätzung)
  color: RecoveryColor;
  readyAt: number; // Zeitpunkt, ab dem voraussichtlich grün
  soreness: number;
}

export const F_GREEN = 1.5;
export const F_RED = 5;

export function sorenessFor(m: MuscleId, at: number, checkIns: Record<string, CheckIn>): number {
  // Muskelkater der letzten 2 Tage, abnehmend gewichtet
  let best = 0;
  for (let d = 0; d <= 1; d++) {
    const key = dateKey(at - d * DAY);
    const s = checkIns[key]?.soreness?.[m] ?? 0;
    best = Math.max(best, s * (d === 0 ? 1 : 0.5));
  }
  return best;
}

function decayed(events: StimulusEvent[], m: MuscleId, at: number): number {
  const tau = MUSCLE[m].tau * HOUR;
  let f = 0;
  for (const e of events) {
    if (e.muscle !== m || e.t > at) continue;
    f += e.fatigue * Math.exp(-(at - e.t) / tau);
  }
  return f;
}

export function computeMuscleState(
  m: MuscleId,
  events: StimulusEvent[],
  at: number,
  checkIns: Record<string, CheckIn> = {},
): MuscleState {
  let vol7 = 0,
    vol14 = 0,
    direct7 = 0,
    indirect7 = 0,
    direct14 = 0,
    indirect14 = 0,
    load7 = 0;
  let lastDirect: number | null = null;
  let lastAny: number | null = null;
  for (const e of events) {
    if (e.muscle !== m || e.t > at) continue;
    const age = at - e.t;
    if (age <= 7 * DAY) {
      vol7 += e.sets;
      load7 += e.load;
      if (e.direct) direct7 += e.sets;
      else indirect7 += e.sets;
    }
    if (age <= 14 * DAY) {
      vol14 += e.sets;
      if (e.direct) direct14 += e.sets;
      else indirect14 += e.sets;
    }
    if (e.direct && (lastDirect == null || e.t > lastDirect)) lastDirect = e.t;
    if (lastAny == null || e.t > lastAny) lastAny = e.t;
  }
  const lastSets = lastAny == null ? 0 : events.filter((e) => e.muscle === m && e.t === lastAny).reduce((a, e) => a + e.sets, 0);
  const fatigue = decayed(events, m, at);
  const soreness = sorenessFor(m, at, checkIns);
  const fatigueEff = fatigue + soreness * 1.2;
  const recovery = Math.round(100 * clamp((F_RED + 0.5 - fatigueEff) / (F_RED + 0.5 - 1.0), 0, 1));

  let color: RecoveryColor;
  const hoursSince = lastAny == null ? Infinity : (at - lastAny) / HOUR;
  if (lastAny == null || hoursSince > 10 * 24) color = 'gray';
  else if (fatigueEff >= F_RED) color = 'red';
  else if (fatigueEff >= 3) color = 'orange';
  else if (fatigueEff >= F_GREEN || (hoursSince < 24 && fatigueEff >= 0.8)) color = 'yellow';
  else color = 'green';

  // Projektion: wann fällt die Ermüdung unter die "grün"-Schwelle?
  let readyAt = at;
  if (fatigueEff >= F_GREEN) {
    const tau = MUSCLE[m].tau;
    for (let h = 1; h <= 24 * 8; h++) {
      const f = fatigue * Math.exp(-h / tau) + soreness * 1.2 * Math.exp(-h / 24);
      if (f < F_GREEN) {
        readyAt = at + h * HOUR;
        break;
      }
      readyAt = at + h * HOUR;
    }
  }

  return {
    muscle: m,
    fatigue,
    fatigueEff,
    vol7,
    vol14,
    direct7,
    indirect7,
    direct14,
    indirect14,
    load7,
    lastDirect,
    lastAny,
    lastSets,
    recovery,
    color,
    readyAt,
    soreness,
  };
}

export function computeAllStates(
  events: StimulusEvent[],
  at: number,
  checkIns: Record<string, CheckIn> = {},
): Record<MuscleId, MuscleState> {
  return Object.fromEntries(MUSCLE_IDS.map((m) => [m, computeMuscleState(m, events, at, checkIns)])) as Record<
    MuscleId,
    MuscleState
  >;
}

/** Wöchentliche Satzzahlen (fraktional) der letzten n Wochen für einen Muskel */
export function weeklySeries(events: StimulusEvent[], m: MuscleId, weeks: number, now = Date.now()) {
  const out: { label: string; direct: number; indirect: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = now - w * 7 * DAY;
    const start = end - 7 * DAY;
    let direct = 0,
      indirect = 0;
    for (const e of events) {
      if (e.muscle !== m || e.t <= start || e.t > end) continue;
      if (e.direct) direct += e.sets;
      else indirect += e.sets;
    }
    const d = new Date(start + DAY);
    out.push({ label: `${d.getDate()}.${d.getMonth() + 1}.`, direct: +direct.toFixed(1), indirect: +indirect.toFixed(1) });
  }
  return out;
}

/**
 * Verständliche Erholungs-Kategorie statt Scheingenauigkeit in Prozent.
 * Das Modell (exponentieller Abbau je Muskel + gemeldeter Muskelkater) ist eine Annahme der App –
 * Studien validieren keine konkrete Prozentberechnung. Daher: Kategorie + Begründung + Hinweis auf Unsicherheit.
 */
export type RecoveryLevel = 'idle' | 'recovered' | 'partial' | 'loaded' | 'fresh';

/** „ca. morgen 14 Uhr“ / „in ~5 h“ – grob gerundet, weil es eine Modellschätzung ist */
export function recoveryWhen(readyAt: number, at = Date.now()): string {
  const h = (readyAt - at) / HOUR;
  if (h <= 0.5) return 'jetzt';
  if (h < 10) return `in ~${Math.max(1, Math.round(h))} h`;
  const d = new Date(readyAt);
  const hour = d.getHours();
  const dayDiff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(new Date(at).getFullYear(), new Date(at).getMonth(), new Date(at).getDate()).getTime()) / (24 * HOUR));
  const day = dayDiff === 0 ? 'heute' : dayDiff === 1 ? 'morgen' : dayDiff === 2 ? 'übermorgen' : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()];
  const part = hour < 11 ? 'früh' : hour < 14 ? 'mittags' : hour < 18 ? 'nachmittags' : 'abends';
  return `${day} ${part}`;
}

export function recoveryInfo(st: MuscleState, at = Date.now()): { label: string; short: string; advice: string; basis: string; level: RecoveryLevel; readyAt: number } {
  const h = st.lastAny == null ? null : (at - st.lastAny) / HOUR;
  const when = h == null ? null : h < 48 ? `vor ${Math.max(1, Math.round(h))} h` : `vor ${Math.round(h / 24)} Tagen`;
  const parts: string[] = [];
  if (when) parts.push(`letzte Belastung ${when}`);
  if (st.lastSets > 0) parts.push(`${Math.round(st.lastSets * 10) / 10} Sätze`);
  if (st.soreness > 0) parts.push(`Muskelkater gemeldet (${st.soreness}/3)`);
  const basis = parts.length ? parts.join(' · ') : 'keine Belastung in den letzten Wochen';
  const readyAt = st.readyAt;
  const pending = readyAt - at > 0.5 * HOUR;
  const w = recoveryWhen(readyAt, at);
  // Angabe als geschätzter Zeitpunkt („erholt ca. morgen früh“) statt Kategorie
  if (st.color === 'gray') return { label: 'Erholt', short: 'erholt', advice: 'Länger nicht belastet – normal trainierbar.', basis, level: 'idle', readyAt };
  if (!pending) return { label: 'Erholt', short: 'erholt', advice: 'Normal trainierbar.', basis, level: 'recovered', readyAt };
  if (st.fatigueEff >= F_RED)
    return { label: `Erholt ca. ${w}`, short: `erholt ca. ${w}`, advice: 'Frisch belastet – heute eher pausieren oder nur wenig Volumen.', basis, level: 'fresh', readyAt };
  if (st.fatigueEff >= 3) return { label: `Erholt ca. ${w}`, short: `erholt ca. ${w}`, advice: 'Noch belastet – heute weniger Sätze.', basis, level: 'loaded', readyAt };
  return { label: `Erholt ca. ${w}`, short: `erholt ca. ${w}`, advice: 'Weitgehend erholt – normal trainierbar, auf Tagesform achten.', basis, level: 'partial', readyAt };
}

export const RECOVERY_MODEL_NOTE =
  'Zeitpunkt = Schätzung der App (bewusst grob: früh/mittags/nachmittags/abends): Ermüdung klingt pro Muskel exponentiell ab, gemeldeter Muskelkater und Bereitschaft verschieben sie. Die genauen Werte sind nicht durch Studien validiert – dein Gefühl und die ersten Sätze haben Vorrang.';
