import { MUSCLE, MUSCLE_IDS, priorityWeight, weeklyTarget, GROUP_LABEL } from '../lib/muscles';
import type { AppData, Exercise, MuscleId, ProgressionAdvice } from '../lib/types';
import { DAY, HOUR, addDays, clamp, dateKey, diffDays, endOfWeek, fmtNum, parseKey, relDayLabel, startOfWeek, weekdayOf } from '../lib/utils';
import { computeAllStates, eventsFromSessions, F_GREEN, type MuscleState, type StimulusEvent } from './fatigue';
import { adviseExercise } from './progression';
import { readinessAdjust, readinessScore } from './readiness';

// ───────────────────────── Vorlagen (Masken) ─────────────────────────

export type TemplateId =
  | 'full'
  | 'fbA'
  | 'fbB'
  | 'fbC'
  | 'push'
  | 'pull'
  | 'legsPlus'
  | 'upper'
  | 'lowerPlus'
  | 'pushLegs'
  | 'pullLegs'
  | 'arms';

type Mask = Partial<Record<MuscleId, number>>;

const ALL: Mask = Object.fromEntries(MUSCLE_IDS.map((m) => [m, 1])) as Mask;

export const TEMPLATES: Record<TemplateId, { label: string; mask: Mask }> = {
  full: { label: 'Ganzkörper', mask: { ...ALL, frontDelts: 0.5, forearms: 0.3 } },
  fbA: {
    label: 'Ganzkörper A',
    mask: { chest: 1, triceps: 1, sideDelts: 1, quads: 1, calves: 0.8, biceps: 0.8, lats: 0.7, upperBack: 0.7, hamstrings: 0.7, rearDelts: 0.6, abs: 0.6, glutes: 0.6, frontDelts: 0.5 },
  },
  fbB: {
    label: 'Ganzkörper B',
    mask: { lats: 1, upperBack: 1, biceps: 1, rearDelts: 1, hamstrings: 1, glutes: 0.8, sideDelts: 0.9, abs: 0.8, triceps: 0.8, chest: 0.7, quads: 0.6, calves: 0.6 },
  },
  fbC: {
    label: 'Ganzkörper C (Arme & Schultern)',
    mask: { biceps: 1, triceps: 1, sideDelts: 1, rearDelts: 0.9, chest: 0.8, lats: 0.8, upperBack: 0.7, quads: 0.7, hamstrings: 0.7, calves: 0.8, abs: 0.8, glutes: 0.5 },
  },
  push: { label: 'Push', mask: { chest: 1, triceps: 1, sideDelts: 1, frontDelts: 0.5, abs: 0.6, calves: 0.5 } },
  pull: { label: 'Pull', mask: { lats: 1, upperBack: 1, biceps: 1, rearDelts: 1, forearms: 0.3, abs: 0.5 } },
  legsPlus: {
    label: 'Legs+ (Beine + Arme/Schulter)',
    mask: { quads: 1, hamstrings: 1, glutes: 1, calves: 1, abs: 1, sideDelts: 0.8, biceps: 0.6, triceps: 0.6 },
  },
  upper: { label: 'Oberkörper', mask: { chest: 1, lats: 1, upperBack: 1, sideDelts: 1, rearDelts: 0.9, biceps: 1, triceps: 1, frontDelts: 0.5 } },
  lowerPlus: {
    label: 'Unterkörper+ (mit Armen)',
    mask: { quads: 1, hamstrings: 1, glutes: 1, calves: 1, abs: 1, sideDelts: 0.7, biceps: 0.7, triceps: 0.7, rearDelts: 0.5 },
  },
  pushLegs: { label: 'Push + Beine', mask: { chest: 1, triceps: 1, sideDelts: 1, quads: 1, calves: 1, frontDelts: 0.5, abs: 0.5, glutes: 0.5 } },
  pullLegs: { label: 'Pull + Beinbeuger', mask: { lats: 1, upperBack: 1, biceps: 1, rearDelts: 1, hamstrings: 1, glutes: 1, abs: 0.8 } },
  arms: { label: 'Arme & Schultern', mask: { biceps: 1, triceps: 1, sideDelts: 1, rearDelts: 1, forearms: 0.3, abs: 0.4 } },
};

export interface Strategy {
  id: string;
  label: string;
  reason: string;
  templates: TemplateId[];
}

// ───────────────────────── Ergebnis-Typen ─────────────────────────

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  targetRir: number;
  restSec: number;
  recWeight: number | null;
  advice: ProgressionAdvice;
  reason: string;
  setsReason: string;
  /** kurze Begründung „Warum diese Übung?“ */
  why: string;
  superset?: string;
  minutes: number;
}

export interface MuscleDecision {
  muscle: MuscleId;
  status: 'focus' | 'included' | 'skipped';
  sets: number;
  score: number;
  recovery: number;
  vol7: number;
  target: number;
  reason: string;
}

export interface PlannedSession {
  date: string;
  at: number;
  templateId: TemplateId;
  label: string;
  minutes: number;
  estMinutes: number;
  exercises: PlannedExercise[];
  decisions: MuscleDecision[];
  reasons: string[];
  tentative: boolean;
  readiness: number | null;
  value: number;
  rest: boolean;
}

export interface Plan {
  strategy: Strategy;
  sessions: PlannedSession[];
  trainedToday: boolean;
  notes: string[];
  horizonDays: string[];
  /** Tage mit Zeit, an denen bewusst pausiert wird */
  restDays: { date: string; reason: string }[];
}

// ───────────────────────── Konstanten der Heuristik ─────────────────────────

/** Planungsfenster in Tagen (rollierende Woche) */
export const PLAN_DAYS = 7;
const WARMUP_MIN = 7;
const MAX_EXERCISES = 9;
const MAX_SETS_PER_EXERCISE = 4;
/** Bewegungsfamilien: zwei Übungen derselben Familie für denselben Muskel in einer Einheit sind redundant */
const FAMILY: Partial<Record<string, string>> = { row: 'row', cableRow: 'row', chestPress: 'press', inclinePress: 'press', lateralRaise: 'lateral' };
const familyOf = (ex: Exercise) => FAMILY[ex.pattern] ?? ex.pattern;
const MIN_SET_VALUE = 0.06;

function setMinutes(ex: Exercise, short: boolean): number {
  const unilateral = ex.pattern === 'bayesian';
  const work = (ex.compound ? 50 : 40) * (unilateral ? 2 : 1);
  let m = (work + ex.restSec) / 60;
  if (short && !ex.compound && ['biceps', 'triceps', 'sideDelts', 'rearDelts'].includes(ex.primary)) m *= 0.65;
  return m;
}
function setupMinutes(ex: Exercise): number {
  return ex.compound ? (ex.fatigue >= 3 ? 4 : 3) : 1;
}

// ───────────────────────── Muskel-Scoring ─────────────────────────

interface MuscleScore {
  score: number;
  rec: number;
  need: number;
  neglect: number;
  target: number;
  prio: number;
  daysSince: number | null;
}

function scoreMuscles(
  states: Record<MuscleId, MuscleState>,
  mask: Mask,
  data: AppData,
  at: number,
  sessionsPerWeek: number,
): Record<MuscleId, MuscleScore> {
  const out = {} as Record<MuscleId, MuscleScore>;
  for (const m of MUSCLE_IDS) {
    const st = states[m];
    const target = personalTarget(data, m, sessionsPerWeek);
    const prio = priorityWeight(m, data.profile.priorities);
    const need7 = clamp(1 - st.vol7 / target, 0, 1);
    const need14 = clamp(1 - st.vol14 / (2 * target), 0, 1);
    const need = 0.6 * need7 + 0.4 * need14;
    const daysSince = st.lastDirect == null ? null : (at - st.lastDirect) / DAY;
    let neglect = 0;
    if (!MUSCLE[m].indirectOnly) {
      if (daysSince == null) neglect = 0.4;
      else if (daysSince > 5) neglect = Math.min(0.6, (daysSince - 5) * 0.1);
    }
    const rec = clamp((5 - st.fatigueEff) / (5 - F_GREEN), 0, 1);
    const base = prio * Math.max(0.1, need + neglect);
    out[m] = { score: (mask[m] ?? 0) * base * rec, rec, need, neglect, target, prio, daysSince };
  }
  return out;
}

// ───────────────────────── Einheit bauen ─────────────────────────

interface BuildOpts {
  date: string;
  at: number;
  minutes: number;
  templateId: TemplateId;
  events: StimulusEvent[];
  data: AppData;
  sessionsPerWeek: number;
  tentative: boolean;
  nextDates: string[];
}

export function buildSession(o: BuildOpts): PlannedSession {
  const { data, at, templateId } = o;
  const tpl = TEMPLATES[templateId];
  const isToday = o.date === dateKey();
  const states = computeAllStates(o.events, at, isToday ? data.checkIns : {});
  const scores = scoreMuscles(states, tpl.mask, data, at, o.sessionsPerWeek);
  const readiness = isToday ? readinessScore(data.checkIns[o.date]) : null;
  const radj = readinessAdjust(readiness);
  const short = o.minutes <= 50 && data.settings.autoSuperset;
  const budget = Math.max(15, (o.minutes - WARMUP_MIN) * radj.volume);

  const candidates = data.exercises.filter((e) => !e.locked);
  const history = new Set<string>();
  const recent = new Set<string>();
  for (const s of data.sessions) {
    if (s.status !== 'done') continue;
    for (const se of s.exercises) {
      if (se.skipped || !se.sets.some((x) => x.done)) continue;
      history.add(se.exerciseId);
      if (at - (s.endedAt ?? s.startedAt) < 36 * HOUR) recent.add(se.exerciseId);
    }
  }

  const sSets: Record<MuscleId, number> = Object.fromEntries(MUSCLE_IDS.map((m) => [m, 0])) as Record<MuscleId, number>;

  const isFull = templateId === 'full';
  const maxSets = isFull && o.minutes <= 60 ? 3 : MAX_SETS_PER_EXERCISE;
  const muscleValue = (m: MuscleId, s: number) => {
    const sc = scores[m];
    if (s >= MUSCLE[m].sessionCap) return 0;
    const overWeek = states[m].vol7 + s >= sc.target * 1.3 ? 0.3 : 1;
    // Breiten-Bonus: der erste Satz eines Muskels ist am wertvollsten (v. a. im Ganzkörpertraining)
    const breadth = s < 1 ? (isFull ? 0.8 : 0.2) : 0;
    return sc.score * (1 / (1 + s / (isFull ? 2 : 3))) * overWeek * (1 + breadth);
  };

  const exMult = (ex: Exercise) =>
    (1 + 0.06 * ex.stretch) * (ex.favorite ? 1.08 : 1) * (history.has(ex.id) ? 1.04 : 1) * (recent.has(ex.id) ? 0.85 : 1);

  const valueOfSets = (ex: Exercise, k: number) => {
    const local = { ...sSets };
    let v = 0;
    for (let i = 0; i < k; i++) {
      for (const [m, c] of Object.entries(ex.muscles) as [MuscleId, number][]) {
        v += c * muscleValue(m, local[m]);
        v -= c * 0.25 * (1 - scores[m].rec);
        local[m] += c;
      }
    }
    return v * exMult(ex);
  };

  interface Item {
    ex: Exercise;
    sets: number;
  }
  const items: Item[] = [];
  let used = 0;
  // Optimale Satzzahl: neue Übungen starten mit 3 Arbeitssätzen (2 nur im Zeitmodus),
  // weitere Sätze werden nur ergänzt, solange der Grenznutzen hoch genug ist.
  const startSets = short || o.minutes < 50 ? 2 : 3;
  // persönliches Tempo (gelernt aus abgeschlossenen Einheiten)
  const tf = data.settings.timeFactor || 1;

  for (let iter = 0; iter < 60; iter++) {
    let best: { ratio: number; apply: () => void } | null = null;
    for (const it of items) {
      // Prioritätsmuskeln (Rang 1–3) dürfen bei Isolationsübungen 5 Sätze bekommen, statt eine fast gleiche 2. Variante zu nehmen
      const top = !it.ex.compound && !short && MUSCLE[it.ex.primary].group != null && data.profile.priorities.indexOf(MUSCLE[it.ex.primary].group!) < 3;
      if (it.sets >= (top && !isFull ? maxSets + 1 : maxSets)) continue;
      const t = setMinutes(it.ex, short) * tf;
      if (used + t > budget) continue;
      const v = valueOfSets(it.ex, 1);
      if (v < MIN_SET_VALUE) continue;
      const ratio = v / t;
      if (!best || ratio > best.ratio)
        best = {
          ratio,
          apply: () => {
            it.sets += 1;
            used += t;
            for (const [m, c] of Object.entries(it.ex.muscles) as [MuscleId, number][]) sSets[m] += c;
          },
        };
    }
    if (items.length < MAX_EXERCISES) {
      for (const ex of candidates) {
        if (items.some((i) => i.ex.id === ex.id)) continue;
        const samePrimary = items.filter((i) => i.ex.primary === ex.primary);
        if (samePrimary.length >= 2) continue;
        if (samePrimary.length === 1 && samePrimary[0].sets < 3) continue;
        // keine fast identische Variante (z. B. Seitheben Kabel + Kurzhantel, zwei Ruder-Varianten)
        if (samePrimary.some((i) => familyOf(i.ex) === familyOf(ex))) continue;
        const t = (startSets * setMinutes(ex, short) + setupMinutes(ex)) * tf;
        if (used + t > budget) continue;
        const v = valueOfSets(ex, startSets);
        if (v / startSets < MIN_SET_VALUE) continue;
        // Bevorzugt Abwechslung bei zweiter Übung für denselben Muskel (andere Dehnungsposition)
        const varietyBonus = samePrimary.length === 1 && (samePrimary[0].ex.stretch !== ex.stretch || samePrimary[0].ex.compound !== ex.compound) ? 1.08 : 1;
        const ratio = (v / t) * varietyBonus;
        if (!best || ratio > best.ratio)
          best = {
            ratio,
            apply: () => {
              items.push({ ex, sets: startSets });
              used += t;
              for (const [m, c] of Object.entries(ex.muscles) as [MuscleId, number][]) sSets[m] += startSets * c;
            },
          };
      }
    }
    if (!best) break;
    best.apply();
  }

  // Progression & Feinjustierung
  const planned: PlannedExercise[] = items.map((it) => {
    const st = states[it.ex.primary];
    const tgt = scores[it.ex.primary].target;
    const advice = adviseExercise(it.ex, data.sessions, {
      settings: data.settings,
      checkIns: data.checkIns,
      volumeRatio: tgt ? st.vol7 / tgt : undefined,
    });
    const sets = Math.max(2, it.sets + advice.setDelta);
    const pm = it.ex.primary;
    const capTxt = MUSCLE[pm].sessionCap;
    const setsReason = MUSCLE[pm].indirectOnly
      ? `${sets} Arbeitssätze: Mehrgelenksübung, deckt ${Object.keys(it.ex.muscles).length} Muskeln ab.`
      : `${sets} Arbeitssätze optimal: ${MUSCLE[pm].label} steht bei ${fmtNum(st.vol7)}/${fmtNum(tgt)} Wochensätzen, heute insgesamt ${fmtNum(sSets[pm])} Sätze (sinnvolle Obergrenze pro Einheit ~${capTxt}). Mehr Sätze brächten heute kaum Zusatznutzen.${advice.setDelta < 0 ? ' −1 Satz wegen Stagnation/Ermüdung.' : ''}`;
    const targetRir = it.ex.targetRir + radj.rir + advice.rirDelta;
    const sc = scores[it.ex.primary];
    const parts: string[] = [];
    if (!MUSCLE[it.ex.primary].indirectOnly) {
      const rank = data.profile.priorities.indexOf(MUSCLE[it.ex.primary].group!) + 1;
      parts.push(`${MUSCLE[it.ex.primary].label}: Priorität ${rank}, 7 Tage ${fmtNum(st.vol7)}/${fmtNum(sc.target)} Sätze, Erholung ~${st.recovery} %`);
    } else {
      parts.push(`Mehrgelenkig: trainiert ${Object.keys(it.ex.muscles).map((m) => MUSCLE[m as MuscleId].short).join(', ')}`);
    }
    if (it.ex.stretch === 2) parts.push('hohe Belastung in gedehnter Position');
    if (it.ex.compound && !MUSCLE[it.ex.primary].indirectOnly) parts.push('deckt mehrere Muskeln effizient ab');
    if (sc.neglect > 0.2) parts.push(`seit ${sc.daysSince == null ? 'langem' : Math.round(sc.daysSince) + ' Tagen'} kein direkter Reiz`);
    // Kurze, verständliche Begründung „Warum genau diese Übung?“
    const mates = items.filter((x) => x.ex.primary === it.ex.primary);
    const pos = mates.indexOf(it);
    const rankTxt = MUSCLE[pm].group ? `Priorität ${data.profile.priorities.indexOf(MUSCLE[pm].group!) + 1}` : '';
    const whyParts: string[] = [];
    if (MUSCLE[pm].indirectOnly) whyParts.push('Mehrgelenksübung, die mehrere Muskeln gleichzeitig trifft.');
    else if (pos === 1) {
      const other = mates[0].ex;
      const diff = other.compound !== it.ex.compound ? (it.ex.compound ? 'schwere Grundübung' : 'Isolation nach der Grundübung') : it.ex.stretch !== other.stretch ? (it.ex.stretch > other.stretch ? 'mehr Dehnung' : 'anderer Kraftverlauf') : 'anderer Winkel';
      whyParts.push(`2. Übung für ${MUSCLE[pm].label} (${rankTxt}): ergänzt ${other.name} – ${diff}. So kommt der Muskel heute auf ~${fmtNum(sSets[pm])} Sätze, ohne eine Übung zu überladen.`);
    } else if (it.ex.compound) {
      const sec = Object.entries(it.ex.muscles).filter(([m, c]) => m !== pm && (c ?? 0) >= 0.5).map(([m]) => MUSCLE[m as MuscleId].short);
      whyParts.push(`${MUSCLE[pm].label} (${rankTxt})${sec.length ? ` + nebenbei ${sec.join(', ')}` : ''} – viel Reiz pro Minute.`);
    } else whyParts.push(`Gezielt für ${MUSCLE[pm].label} (${rankTxt}, diese Woche ${fmtNum(st.vol7)}/${fmtNum(tgt)} Sätze).`);
    if (it.ex.benefit) whyParts.push(it.ex.benefit);
    if (sc.neglect > 0.2) whyParts.push(`Seit ${sc.daysSince == null ? 'langem' : Math.round(sc.daysSince) + ' Tagen'} kein direkter Reiz – wird nachgeholt.`);
    else if (history.has(it.ex.id)) whyParts.push('Bekannte Übung – dein Fortschritt bleibt direkt vergleichbar.');
    return {
      why: whyParts.join(' '),
      exerciseId: it.ex.id,
      sets,
      repMin: it.ex.repMin,
      repMax: it.ex.repMax,
      targetRir,
      restSec: it.ex.restSec,
      recWeight: advice.weight,
      advice,
      reason: parts.join(' · '),
      setsReason,
      minutes: (sets * setMinutes(it.ex, short) + setupMinutes(it.ex)) * tf,
    };
  });

  // Reihenfolge
  const exById = new Map(data.exercises.map((e) => [e.id, e]));
  const orderKey = (p: PlannedExercise) => {
    const ex = exById.get(p.exerciseId)!;
    const pw = priorityWeight(ex.primary, data.profile.priorities);
    const last = ex.primary === 'abs' || ex.primary === 'calves' ? -2 : 0;
    if (data.settings.orderMode === 'compound') return (ex.compound ? 2 : 0) + pw + last;
    // Prioritäts-Modus: Prioritätsmuskeln zuerst; schwere Mehrgelenksübungen für Beine trotzdem früh,
    // um sie nicht im ermüdeten Zustand auszuführen.
    return pw + (ex.compound ? 0.12 : 0) + (ex.fatigue >= 3 ? 0.35 : 0) + last;
  };
  planned.sort((a, b) => orderKey(b) - orderKey(a));

  // Supersätze im Zeitmodus
  if (short) {
    const pairs: [MuscleId, MuscleId, string][] = [
      ['biceps', 'triceps', 'A'],
      ['sideDelts', 'rearDelts', 'B'],
    ];
    for (const [a, b, label] of pairs) {
      const pa = planned.find((p) => !p.superset && exById.get(p.exerciseId)!.primary === a && !exById.get(p.exerciseId)!.compound);
      const pb = planned.find((p) => !p.superset && exById.get(p.exerciseId)!.primary === b && !exById.get(p.exerciseId)!.compound);
      if (pa && pb) {
        pa.superset = label;
        pb.superset = label;
        // nebeneinander anordnen
        planned.splice(planned.indexOf(pb), 1);
        planned.splice(planned.indexOf(pa) + 1, 0, pb);
      }
    }
  }

  // Entscheidungen je Muskel
  const decisions: MuscleDecision[] = [];
  const nextLabel = o.nextDates.length ? relDayLabel(o.nextDates[0]) : null;
  for (const m of MUSCLE_IDS) {
    if (MUSCLE[m].indirectOnly) continue;
    const st = states[m];
    const sc = scores[m];
    const sets = +sSets[m].toFixed(1);
    let status: MuscleDecision['status'] = 'skipped';
    let reason = '';
    if (sets >= 1) {
      status = sets >= 4 ? 'focus' : 'included';
      const bits = [`${fmtNum(sets)} Sätze geplant`, `7 Tage: ${fmtNum(st.vol7)}/${fmtNum(sc.target)}`, `Erholung ~${st.recovery} %`];
      if (sc.neglect > 0.2) bits.push('Ausgleich: länger kein direkter Reiz');
      reason = bits.join(' · ');
    } else if (sc.rec < 0.35) {
      reason = `Noch ermüdet (Erholung ~${st.recovery} %${st.lastAny ? `, letzter Reiz vor ${Math.round((at - st.lastAny) / HOUR)} h` : ''}) – voraussichtlich bereit ${relDayLabel(dateKey(st.readyAt))}.`;
    } else if ((tpl.mask[m] ?? 0) === 0) {
      reason = `Nicht Teil von „${tpl.label}“${nextLabel ? ` – nächste Gelegenheit: ${nextLabel}` : ''}.`;
    } else if (st.vol7 >= sc.target) {
      reason = `7-Tage-Ziel bereits erreicht (${fmtNum(st.vol7)}/${fmtNum(sc.target)}).`;
    } else {
      reason = 'Aus Zeitgründen nachrangig (geringerer Nutzen pro Minute).';
    }
    decisions.push({ muscle: m, status, sets, score: sc.score, recovery: st.recovery, vol7: st.vol7, target: sc.target, reason });
  }

  const estMinutes = Math.round(WARMUP_MIN + planned.reduce((a, p) => a + p.minutes, 0));
  const reasons: string[] = [];
  if (radj.note) reasons.push(radj.note);
  if (short) reasons.push('Zeitmodus: Arm- und Schulterisolation als Supersätze (Agonist/Antagonist), um Zeit zu sparen.');
  const value = Object.entries(sSets).reduce((a, [m, s]) => a + scores[m as MuscleId].score * Math.log1p(s / 2), 0);

  return {
    date: o.date,
    at,
    templateId,
    label: tpl.label,
    minutes: o.minutes,
    estMinutes,
    exercises: planned,
    decisions,
    reasons,
    tentative: o.tentative,
    readiness,
    value,
    rest: planned.length === 0,
  };
}

// ───────────────────────── Strategie ─────────────────────────

export function chooseStrategy(dates: string[], uncertain: boolean): Strategy {
  const n = dates.length;
  if (uncertain)
    return {
      id: 'full',
      label: 'Ganzkörper',
      reason: 'Nächster Termin unbekannt → heute möglichst viele wichtige Muskelgruppen abdecken.',
      templates: ['full'],
    };
  if (n <= 1)
    return {
      id: 'full',
      label: 'Ganzkörper',
      reason: n === 1 ? 'Nur eine Einheit in den nächsten Tagen → Ganzkörper, damit jeder Muskel einen Reiz erhält.' : 'Keine Einheit geplant.',
      templates: ['full'],
    };
  const gaps = dates.slice(1).map((d, i) => diffDays(d, dates[i]));
  const consecutive = gaps.filter((g) => g === 1).length;
  if (n === 2) {
    if (consecutive === 1)
      return {
        id: 'hybrid2',
        label: 'Hybrid: Push+Beine / Pull+Beinbeuger',
        reason: 'Zwei Tage hintereinander → Muskelgruppen so aufteilen, dass am zweiten Tag keine ermüdeten Muskeln erneut belastet werden.',
        templates: ['pushLegs', 'pullLegs', 'upper', 'lowerPlus'],
      };
    return {
      id: 'fbAB',
      label: 'Ganzkörper A/B',
      reason: 'Zwei Einheiten mit Pause dazwischen → zweimal Ganzkörper mit wechselnden Schwerpunkten (Frequenz 2× pro Muskel).',
      templates: ['fbA', 'fbB'],
    };
  }
  if (n === 3) {
    if (consecutive === 2)
      return {
        id: 'ppl',
        label: 'Push / Pull / Legs+',
        reason: 'Drei Tage am Stück → PPL+ minimiert Überschneidungen ermüdeter Muskeln; „+“ ergänzt Arme und seitliche Schulter.',
        templates: ['push', 'pull', 'legsPlus'],
      };
    if (consecutive === 1)
      return {
        id: 'ulHybrid',
        label: 'Oberkörper/Unterkörper-Hybrid',
        reason: 'Drei Einheiten, zwei davon direkt hintereinander → Ober-/Unterkörper an den Folgetagen, Ganzkörper am freien Tag.',
        templates: ['upper', 'lowerPlus', 'fbA', 'fbB'],
      };
    return {
      id: 'fbABC',
      label: 'Ganzkörper A/B/C',
      reason: 'Drei Einheiten mit Ruhetagen → Ganzkörper mit rotierenden Schwerpunkten, hohe Frequenz für Prioritätsmuskeln.',
      templates: ['fbA', 'fbB', 'fbC'],
    };
  }
  if (consecutive === 0)
    return {
      id: 'ulSpread',
      label: 'Oberkörper/Unterkörper im Wechsel',
      reason: `${n} Einheiten mit Ruhetagen dazwischen → Ober- und Unterkörper im Wechsel, ergänzt um Ganzkörper; jeder Muskel ~2× pro Woche.`,
      templates: ['upper', 'lowerPlus', 'fbA', 'fbB'],
    };
  return {
    id: 'flex',
    label: 'Flexibel (PPL+ / OK-UK)',
    reason: 'Viele verfügbare Tage → Auswahl der jeweils passendsten Einheit nach Erholung und Volumenbedarf.',
    templates: ['push', 'pull', 'legsPlus', 'upper', 'lowerPlus'],
  };
}

// ───────────────────────── Tage wählen ─────────────────────────

function pickSpread(cands: string[], fixed: string[], k: number): string[] {
  if (k <= 0 || !cands.length) return [];
  const combos: string[][] = [];
  const rec = (start: number, acc: string[]) => {
    if (acc.length === k) return void combos.push([...acc]);
    for (let i = start; i < cands.length; i++) rec(i + 1, [...acc, cands[i]]);
  };
  rec(0, []);
  if (!combos.length) return cands.slice(0, k);
  let best = combos[0],
    bestScore = -Infinity;
  for (const c of combos) {
    const all = [...fixed, ...c].sort();
    const gaps = all.slice(1).map((d, i) => diffDays(d, all[i]));
    const minGap = gaps.length ? Math.min(...gaps) : 7;
    // größter Mindestabstand, dann frühere Tage bevorzugen
    const score = minGap * 10 - diffDays(c[0], cands[0]) * 0.5;
    if (score > bestScore) (bestScore = score), (best = c);
  }
  return best;
}

export interface PlanOpts {
  forceToday?: boolean;
  minutesToday?: number;
}

export function buildPlan(data: AppData, now = Date.now(), opts: PlanOpts = {}): Plan {
  const today = dateKey(now);
  const doneSessions = data.sessions.filter((s) => s.status === 'done');
  const trainedToday = doneSessions.some((s) => s.date === today);
  const start = trainedToday && !opts.forceToday ? addDays(today, 1) : today;
  // Planungsfenster: die nächsten PLAN_DAYS Tage – kurz genug, um verlässlich zu sein; danach rollierend neu
  const horizon = Array.from({ length: PLAN_DAYS }, (_, i) => addDays(start, i));
  const horizon2: string[] = [];
  const notes: string[] = [];

  const availOf = (d: string) =>
    data.availability[d] ?? (data.settings.preferredDays.includes(weekdayOf(d)) ? 'maybe' : 'no');

  let dates: string[] = [];
  let dates2: string[] = [];
  const tentativeSet = new Set<string>();
  const { uncertain, weekCap } = data.planOptions;
  const lastDone = doneSessions.map((s) => s.date).sort().pop();

  const pickWindow = (win: string[], prevFixed: string[]) => {
    let ds = win.filter((d) => data.availability[d] === 'yes');
    const explicitMaybe = win.filter((d) => data.availability[d] === 'maybe');
    // „Vielleicht“-Tage füllen bis zur erwarteten Frequenz auf (vorläufig).
    // Ist gar nichts markiert, schlägt die App Standardtage vor.
    const target = Math.max(1, Math.round((data.settings.sessionsPerWeek * win.length) / 7));
    const nothingMarked = !ds.length && !explicitMaybe.length;
    if (ds.length < target && (explicitMaybe.length || nothingMarked)) {
      const cands = explicitMaybe.length ? explicitMaybe.filter((d) => !ds.includes(d)) : win.filter((d) => !ds.includes(d) && availOf(d) === 'maybe');
      const extra = pickSpread(cands, [...ds, ...prevFixed], target - ds.length);
      extra.forEach((d) => tentativeSet.add(d));
      ds = [...ds, ...extra].sort();
    }
    return ds;
  };

  if (opts.forceToday) {
    dates = [today];
  } else if (uncertain) {
    const first = horizon.find((d) => availOf(d) !== 'no');
    if (first) dates = [first];
  } else {
    dates = pickWindow(horizon, lastDone ? [lastDone] : []);
    dates2 = [];
  }

  // ───── Sinnvolle Ruhetage ─────
  // Regeln: max. maxConsecutive Trainingstage am Stück (inkl. bereits absolvierter Tage davor),
  // max. maxSessionsPerWeek Einheiten in den 7 Tagen (inkl. Trainings der letzten Tage im rollierenden Fenster).
  const restDays: { date: string; reason: string }[] = [];
  if (!opts.forceToday && !uncertain && dates.length > 1) {
    const maxCons = Math.max(2, data.settings.maxConsecutive || 3);
    const doneDates = new Set(doneSessions.map((s) => s.date));
    // bereits trainierte Tage im rollierenden Fenster (letzte 6 Tage vor start)
    const recentDone = Array.from({ length: 6 }, (_, i) => addDays(start, -(i + 1))).filter((d) => doneDates.has(d));
    const cap = Math.max(1, (data.settings.maxSessionsPerWeek || 4) - Math.max(0, recentDone.length - 2));
    const fixedTentative = new Set(dates.filter((d) => tentativeSet.has(d)));
    const n = dates.length;
    let best: string[] = dates;
    let bestScore = -Infinity;
    for (let mask = 1; mask < 1 << n; mask++) {
      const pick = dates.filter((_, i) => mask & (1 << i));
      if (pick.length > cap) continue;
      // längste Kette prüfen (inkl. Historie)
      const all = new Set([...pick, ...doneDates]);
      let ok = true;
      for (const d of pick) {
        let run = 1;
        for (let k = 1; k <= maxCons; k++) {
          if (all.has(addDays(d, -k))) run++;
          else break;
        }
        if (run > maxCons) ok = false;
      }
      if (!ok) continue;
      const seq = [...(recentDone.length ? [recentDone[0]] : []), ...pick].sort();
      const gaps = seq.slice(1).map((d, i) => diffDays(d, seq[i]));
      const minGap = gaps.length ? Math.min(...gaps) : 7;
      const consecutive = gaps.filter((g) => g === 1).length;
      const score = pick.length * 100 + minGap * 8 - consecutive * 3 + (pick.includes(today) ? 2 : 0) - pick.filter((d) => fixedTentative.has(d)).length * 5;
      if (score > bestScore) (bestScore = score), (best = pick);
    }
    for (const d of dates) {
      if (best.includes(d) || tentativeSet.has(d)) continue;
      const set = new Set([...best, ...doneDates, d]);
      let run = 1;
      for (let k = 1; set.has(addDays(d, -k)); k++) run++;
      for (let k = 1; set.has(addDays(d, k)); k++) run++;
      restDays.push({
        date: d,
        reason:
          run > maxCons
            ? `Ruhetag: Sonst wären es ${run} Trainingstage am Stück. Eine Pause dazwischen gibt Muskeln, Sehnen und Nervensystem Zeit – die folgenden Einheiten werden dadurch leistungsfähiger.`
            : best.length >= cap
              ? `Ruhetag: Mit ${best.length} Einheiten in 7 Tagen ist dein Volumen gut verteilt (Obergrenze ${cap}×). Eine weitere Einheit brächte kaum Zusatznutzen, verkürzt aber die Erholung.`
              : 'Ruhetag: Mit Pause dazwischen verteilen sich die Einheiten gleichmäßiger – jeder Muskel ist beim nächsten Reiz besser erholt.',
      });
    }
    dates = best;
  }

  // Wochenlimit ("Diese Woche nur 1×")
  if (!opts.forceToday && weekCap && weekCap.until >= start) {
    const from = startOfWeek(today);
    const done = doneSessions.filter((s) => s.date >= from && s.date <= weekCap.until).length;
    let remaining = Math.max(0, weekCap.count - done);
    const inWeek = dates.filter((d) => d <= weekCap.until);
    const prefer = [...inWeek].sort((a, b) => (tentativeSet.has(a) ? 1 : 0) - (tentativeSet.has(b) ? 1 : 0) || (a < b ? -1 : 1));
    const keep = new Set(prefer.slice(0, remaining));
    dates = dates.filter((d) => d > weekCap.until || keep.has(d));
    notes.push(`Wochenlimit aktiv: ${weekCap.count}× bis ${relDayLabel(weekCap.until, today)} (${done} bereits absolviert).`);
  }

  const strategy = chooseStrategy(dates, uncertain);
  const strategy2 = chooseStrategy(dates2, false);
  const allDates = [...dates, ...dates2];
  // Ziele an realistische Frequenz koppeln
  const spw = clamp(opts.forceToday ? data.settings.sessionsPerWeek : dates.length || data.settings.sessionsPerWeek, 1, 3);

  let events = eventsFromSessions(doneSessions.concat(data.sessions.filter((s) => s.status === 'active')), data.exercises);
  const exById = new Map(data.exercises.map((e) => [e.id, e]));
  const sessions: PlannedSession[] = [];
  // Letztes echtes Training (≤ 3 Tage) zählt für die Split-Rotation mit, damit nicht dauernd derselbe Split kommt
  const lastReal = doneSessions[doneSessions.length - 1];
  const usedTemplates: TemplateId[] =
    lastReal && lastReal.split in TEMPLATES && diffDays(today, lastReal.date) <= 3 ? [lastReal.split as TemplateId] : [];

  for (let i = 0; i < allDates.length; i++) {
    const d = allDates[i];
    const strat = i < dates.length ? strategy : strategy2;
    const at = d === today ? now : parseKey(d).getTime() + 17 * HOUR;
    const minutes =
      d === today
        ? opts.minutesToday ?? (data.planOptions.todayMinutes?.date === today ? data.planOptions.todayMinutes.minutes : data.settings.defaultMinutes)
        : data.settings.defaultMinutes;
    let best: PlannedSession | null = null;
    let bestScore = -Infinity;
    for (const tid of strat.templates) {
      const s = buildSession({
        date: d,
        at,
        minutes,
        templateId: tid,
        events,
        data,
        sessionsPerWeek: spw,
        tentative: tentativeSet.has(d),
        nextDates: allDates.slice(i + 1),
      });
      let sc = s.value;
      if (usedTemplates[usedTemplates.length - 1] === tid) sc *= 0.7;
      else if (usedTemplates.includes(tid)) sc *= 0.85;
      if (sc > bestScore) (bestScore = sc), (best = s);
    }
    if (!best) continue;
    // Begründung auf Einheitsebene
    const focus = best.decisions.filter((x) => x.status === 'focus').map((x) => MUSCLE[x.muscle].short);
    const skippedTired = best.decisions.filter((x) => x.status === 'skipped' && x.reason.startsWith('Noch ermüdet')).map((x) => MUSCLE[x.muscle].short);
    if (strat.templates.length > 1) best.reasons.unshift(`„${best.label}“ gewählt: höchster erwarteter Nutzen unter den Optionen ${strat.templates.map((t) => TEMPLATES[t].label).join(', ')}.`);
    if (i >= dates.length) best.reasons.unshift(`Woche 2 (${strategy2.label}): wird bei jedem Training neu berechnet.`);
    if (focus.length) best.reasons.push(`Schwerpunkt: ${focus.join(', ')}.`);
    if (skippedTired.length) best.reasons.push(`Ausgelassen wegen Ermüdung: ${skippedTired.join(', ')}.`);
    if (allDates.length === 1 && !uncertain && minutes < 90)
      best.reasons.push(`Nur 1 Einheit in den nächsten 7 Tagen: Mit ${minutes} min sind pro Muskel nur wenige Sätze möglich. Wenn es geht, plane 90–120 min ein (Profil → Standarddauer oder „Zeit heute“) – das bringt deutlich mehr Wochenvolumen.`);
    if (best.tentative) best.reasons.push('Vorläufig: Tag ist als „möglich“ markiert. Bestätige ihn im Kalender oder er wird automatisch neu verteilt.');
    sessions.push(best);
    usedTemplates.push(best.templateId);
    // virtuelle Reize für die Simulation der folgenden Tage
    const vt = at + HOUR;
    for (const p of best.exercises) {
      const ex = exById.get(p.exerciseId);
      if (!ex) continue;
      for (const [m, c] of Object.entries(ex.muscles) as [MuscleId, number][]) {
        events = events.concat({ t: vt, muscle: m, sets: c * p.sets, fatigue: c * p.sets, direct: c >= 0.75, load: 0, virtual: true });
      }
    }
  }

  if (!dates.length) notes.push(`Keine Trainingstage in den nächsten ${PLAN_DAYS} Tagen. Tippe oben an, wann du Zeit hast.`);

  return { strategy, sessions, trainedToday, notes, horizonDays: [...horizon, ...horizon2], restDays };
}

/** Plan für ein spontanes Training heute (auch wenn nicht eingeplant) */
export function planToday(data: AppData, minutes?: number, now = Date.now()): PlannedSession | null {
  const plan = buildPlan(data, now);
  const today = dateKey(now);
  const m = minutes ?? (data.planOptions.todayMinutes?.date === today ? data.planOptions.todayMinutes.minutes : data.settings.defaultMinutes);
  if (plan.sessions[0]?.date === today && (minutes == null || plan.sessions[0].minutes === m)) return plan.sessions[0];
  // Heute einschieben: Strategie inkl. heute neu berechnen
  const withToday: AppData = { ...data, availability: { ...data.availability, [today]: 'yes' } };
  const p2 = buildPlan(withToday, now, { minutesToday: m });
  return p2.sessions.find((s) => s.date === today) ?? buildPlan(data, now, { forceToday: true, minutesToday: m }).sessions[0] ?? null;
}

export function muscleLabelList(ms: MuscleId[]): string {
  return ms.map((m) => MUSCLE[m].short).join(', ');
}

export { GROUP_LABEL };
export const _internal = { endOfWeek };

/** Plan für eine bestimmte Vorlage heute (Schnellstart) – nutzt dieselbe Bewertungslogik */
export function planTemplate(data: AppData, templateId: TemplateId, minutes: number, now = Date.now()): PlannedSession {
  const events = eventsFromSessions(data.sessions.filter((s) => s.status === 'done' || s.status === 'active'), data.exercises);
  const s = buildSession({
    date: dateKey(now),
    at: now,
    minutes,
    templateId,
    events,
    data,
    sessionsPerWeek: data.settings.sessionsPerWeek,
    tentative: false,
    nextDates: [],
  });
  s.reasons.unshift(`Schnellstart „${s.label}“: gewählte Muskelgruppen, gewichtet nach Bedarf, Erholung und Priorität.`);
  return s;
}

/**
 * Optimale Satzzahl für eine manuell hinzugefügte Übung: deckt den restlichen Wochenbedarf des Zielmuskels,
 * ohne die sinnvolle Obergrenze pro Einheit zu überschreiten (2–4 Sätze).
 */
export function optimalSetsFor(data: AppData, ex: Exercise, sessionId?: string): { sets: number; reason: string } {
  const now = Date.now();
  const events = eventsFromSessions(data.sessions.filter((s) => s.status === 'done' || s.status === 'active'), data.exercises);
  const st = computeAllStates(events, now, data.checkIns)[ex.primary];
  const target = personalTarget(data, ex.primary, data.settings.sessionsPerWeek);
  // bereits in dieser Einheit eingeplante (noch offene) Sätze für den Zielmuskel
  const exMap = new Map(data.exercises.map((e) => [e.id, e]));
  const session = data.sessions.find((s) => s.id === sessionId);
  let planned = 0;
  let today = 0;
  for (const se of session?.exercises ?? []) {
    if (se.skipped) continue;
    const c = exMap.get(se.exerciseId)?.muscles[ex.primary] ?? 0;
    planned += c * se.sets.filter((x) => !x.done).length;
    today += c * se.sets.length;
  }
  const need = target - st.vol7 - planned;
  const room = MUSCLE[ex.primary].sessionCap - today;
  const sets = clamp(Math.round(Math.min(need, room)), 2, 4);
  const reason =
    need <= 1
      ? `${sets} Sätze: ${MUSCLE[ex.primary].label} hat das Wochenziel (${fmtNum(target)}) fast erreicht – Minimum zum Erhalten des Reizes.`
      : `${sets} Sätze optimal: ${MUSCLE[ex.primary].label} braucht diese Woche noch ~${fmtNum(Math.max(0, need))} Sätze, heute sind bereits ${fmtNum(today)} eingeplant (Obergrenze ~${MUSCLE[ex.primary].sessionCap}).`;
  return { sets, reason };
}

/** Persönliches Wochenziel: Basisziel × gelernter Anpassungsfaktor */
export function personalTarget(data: AppData, m: MuscleId, sessionsPerWeek: number): number {
  const f = data.volumeAdjust?.[m]?.factor ?? 1;
  return Math.round(weeklyTarget(m, data.profile.priorities, sessionsPerWeek) * f * 2) / 2;
}
