import type { AppData, MuscleId, Session } from '../lib/types';
import { MUSCLE, priorityWeight } from '../lib/muscles';
import { clamp, dateKey, diffDays, fmtMin, relDayLabel } from '../lib/utils';
import { computeAllStates } from './fatigue';
import { allEvents } from './activities';
import { buildPlan, personalTarget } from './planner';

export interface TrimItem {
  uid: string;
  exerciseId: string;
  name: string;
  done: number;
  open: number;
  keep: number;
  /** Erklärung, warum gekürzt/verschoben */
  note: string;
}

export interface TrimPlan {
  minutes: number;
  estMin: number;
  items: TrimItem[];
  dropped: number;
  /** Bewegungsgruppen, die sonst in diesem Zeitraum komplett ausfallen würden (Vorschau-Hinweis) */
  warnings: string[];
  /** Gruppen, die wegen einer Versorgungslücke bevorzugt behalten wurden */
  protected: string[];
}

/** Grundbewegungen, die über ~7 Tage nicht komplett ausfallen sollen (Modellregel) */
const BASIC: { label: string; muscles: MuscleId[] }[] = [
  { label: 'Ziehen', muscles: ['lats', 'upperBack'] },
  { label: 'Drücken', muscles: ['chest'] },
  { label: 'Quadrizeps', muscles: ['quads'] },
  { label: 'Beinbeuger', muscles: ['hamstrings'] },
];

/**
 * „Zeit übrig“: verbleibende Sätze so auswählen, dass in die angegebene Zeit der größte Nutzen passt.
 * Zeit je Satz = Arbeitszeit (× 2 bei einseitigen Übungen) + Pause; nicht begonnene Übungen kosten zusätzlich Gerätewechsel.
 * Nutzen = Priorität × noch offener Wochenbedarf (inkl. heute Erledigtem) × abnehmender Zusatznutzen; Muskeln, die in den
 * nächsten 2 Tagen ohnehin geplant sind, werden etwas niedriger gewichtet (sie werden dort abgedeckt). Modellregel.
 */
export function planTrim(data: AppData, session: Session, minutes: number, now = Date.now()): TrimPlan {
  const tf = data.settings.timeFactor || 1;
  const exMap = new Map(data.exercises.map((e) => [e.id, e]));
  const states = computeAllStates(allEvents(data, now), now, data.checkIns);
  const plan = buildPlan(data, now);
  const spw = plan.spw;
  const today = dateKey(now);
  // Nur sichere Termine zählen als „wird bald abgedeckt“ – vorläufige können entfallen
  const soon = plan.sessions.filter((s) => !s.tentative && diffDays(s.date, today) <= 2);
  const soonFor = (m: MuscleId) => soon.find((s) => (s.decisions.find((x) => x.muscle === m)?.sets ?? 0) >= 2);
  const nextSureFor = (ms: MuscleId[]) =>
    plan.sessions.find((s) => !s.tentative && ms.some((m) => (s.decisions.find((x) => x.muscle === m)?.sets ?? 0) >= 2));

  const doneToday: Partial<Record<MuscleId, number>> = {};
  for (const se of session.exercises) {
    const ex = exMap.get(se.exerciseId);
    const n = se.sets.filter((x) => x.done).length;
    if (ex) for (const [m, c] of Object.entries(ex.muscles) as [MuscleId, number][]) doneToday[m] = (doneToday[m] ?? 0) + c * n;
  }
  const items: (TrimItem & { cost: number; setup: number; started: boolean; primary: MuscleId })[] = [];
  for (const se of session.exercises) {
    const ex = exMap.get(se.exerciseId);
    if (!ex || se.skipped) continue;
    const done = se.sets.filter((x) => x.done).length;
    const open = se.sets.length - done;
    if (!open) continue;
    const uni = ex.unilateral || ex.pattern === 'bayesian';
    const cost = ((Math.max(ex.compound ? 50 : 40, ((se.repMin + se.repMax) / 2) * 3) * (uni ? 2 : 1) + se.restSec) / 60) * tf;
    items.push({ uid: se.uid, exerciseId: ex.id, name: ex.name, done, open, keep: 0, note: '', cost, setup: done ? 0 : ex.compound ? 2 : 1, started: done > 0, primary: ex.primary });
  }
  // Versorgungslücken: Grundbewegung in den letzten 7 Tagen (inkl. heute Erledigtem) praktisch nicht trainiert UND
  // kein sicherer Termin in den nächsten 3 Tagen, der sie abdeckt → sonst fällt sie für diese Woche komplett aus.
  // Solche Gruppen bekommen beim Kürzen zuerst je eine Übung mit 2 Sätzen (wenn es zeitlich passt).
  const gapInfo = BASIC.map((g) => {
    const have = g.muscles.reduce((a, m) => a + states[m].vol7 + (doneToday[m] ?? 0), 0);
    const last14 = g.muscles.reduce((a, m) => a + states[m].vol14, 0);
    const next = nextSureFor(g.muscles);
    const nextIn = next ? diffDays(next.date, today) : null;
    return { ...g, have, last14, next, gap: have < 1 && (nextIn == null || nextIn > 3) };
  });
  const hits = (exId: string, ms: MuscleId[]) => ms.some((m) => (exMap.get(exId)?.muscles[m] ?? 0) >= 0.75);
  const added: Partial<Record<MuscleId, number>> = {};
  const currentUid = session.exercises.find((e) => !e.skipped && e.sets.some((x) => !x.done))?.uid;
  const value = (it: (typeof items)[number]) => {
    const ex = exMap.get(it.exerciseId)!;
    let v = 0;
    for (const [m, c] of Object.entries(ex.muscles) as [MuscleId, number][]) {
      if (MUSCLE[m].indirectOnly) continue;
      const target = personalTarget(data, m, spw) || 1;
      const have = states[m].vol7 + (added[m] ?? 0);
      const need = clamp(1 - have / target, 0.15, 1);
      const today = (doneToday[m] ?? 0) + (added[m] ?? 0);
      // Priorität quadratisch: deine Top-Muskeln setzen sich bei knapper Zeit klar durch (Modellregel)
      v += c * priorityWeight(m, data.profile.priorities) ** 2 * need * (1 / (1 + today / 3)) * (soonFor(m) ? 0.8 : 1);
    }
    // laufende bzw. aktuelle Übung bevorzugt abschließen (du stehst schon am Gerät)
    return v * (it.uid === currentUid ? 1.5 : it.started && it.keep === 0 ? 1.15 : 1);
  };
  let used = 0;
  const protectedG: string[] = [];
  const addKeep = (it: (typeof items)[number], n: number) => {
    used += it.cost * n + (it.keep === 0 ? it.setup : 0);
    it.keep += n;
    for (const [m, c] of Object.entries(exMap.get(it.exerciseId)!.muscles) as [MuscleId, number][]) added[m] = (added[m] ?? 0) + c * n;
  };
  // Phase 1: Versorgungslücken schließen (wichtigste Gruppe zuerst, nach Priorität × Bedarf)
  const gaps = gapInfo
    .filter((g) => g.gap)
    // länger vernachlässigte Gruppen (auch in 14 Tagen kaum trainiert) zuerst, sonst nach Priorität
    .map((g) => ({ g, k: Math.max(...g.muscles.map((m) => priorityWeight(m, data.profile.priorities))) * (g.last14 < 2 ? 1.5 : 1) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.g);
  for (const g of gaps) {
    if (items.some((it) => it.keep > 0 && hits(it.exerciseId, g.muscles))) {
      protectedG.push(g.label);
      continue;
    }
    let best: (typeof items)[number] | null = null;
    let bestR = 0;
    for (const it of items) {
      if (!hits(it.exerciseId, g.muscles)) continue;
      const n = Math.min(it.open, it.started ? 1 : 2);
      const c = it.cost * n + it.setup;
      if (used + c > minutes) continue;
      const r = (value(it) * n) / c;
      if (r > bestR) (bestR = r), (best = it);
    }
    if (best) {
      addKeep(best, Math.min(best.open, best.started ? 1 : 2));
      protectedG.push(g.label);
    }
  }
  // Phase 2: restliche Zeit nach Nutzen pro Minute
  for (let guard = 0; guard < 60; guard++) {
    let best: (typeof items)[number] | null = null;
    let bestR = 0;
    let bestN = 1;
    for (const it of items) {
      if (it.keep >= it.open) continue;
      // Eine noch nicht begonnene Übung nur mit mindestens 2 Sätzen aufnehmen – 1 Satz nach dem Geräte-Einstellen lohnt kaum
      const n = it.keep === 0 && !it.started && it.open >= 2 ? 2 : 1;
      const c = it.cost * n + (it.keep === 0 ? it.setup : 0);
      if (used + c > minutes) continue;
      const r = (value(it) * n) / c;
      if (r > bestR) (bestR = r), (best = it), (bestN = n);
    }
    if (!best) break;
    addKeep(best, bestN);
  }
  // Hinweise: Gruppen, die trotz Lücke nicht hineinpassen → konkret anzeigen, was es bräuchte
  const warnings: string[] = [];
  for (const g of gaps) {
    if (items.some((it) => it.keep > 0 && hits(it.exerciseId, g.muscles))) continue;
    const opts = items.filter((it) => hits(it.exerciseId, g.muscles));
    const when = g.next ? `nächster sicherer Termin mit ${g.label}: ${relDayLabel(g.next.date, today).split(',')[0]}` : 'kein sicherer Termin mit dieser Gruppe in Sicht';
    if (!opts.length) {
      warnings.push(`${g.label}: in den letzten 7 Tagen nicht trainiert und heute nicht dabei (${when}).`);
      continue;
    }
    const o = opts.sort((a, b) => a.cost * 2 + a.setup - (b.cost * 2 + b.setup))[0];
    const need = Math.ceil(o.cost * Math.min(2, o.open) + o.setup);
    warnings.push(`${g.label} fällt sonst komplett aus: in den letzten 7 Tagen nicht trainiert, ${when}. ${o.name} mit ${Math.min(2, o.open)} Sätzen bräuchte ~${fmtMin(need)} – mit ${fmtMin(Math.ceil(minutes + need - Math.max(0, minutes - used)))} Restzeit passt es.`);
  }
  let dropped = 0;
  for (const it of items) {
    const cut = it.open - it.keep;
    dropped += cut;
    if (!cut) continue;
    const s = soonFor(it.primary);
    const g = gapInfo.find((x) => x.muscles.includes(it.primary));
    const where = s
      ? `${MUSCLE[it.primary].short} ist ${relDayLabel(s.date, today).split(',')[0]} wieder geplant`
      : g?.gap && !protectedG.includes(g.label)
        ? `${g.label} fehlt damit diese Woche (siehe Hinweis oben)`
        : 'wird in den nächsten Einheiten berücksichtigt, ohne alles nachzuholen';
    it.note =
      it.keep === 0
        ? `entfällt heute – ${where}.`
        : `${it.keep} statt ${it.open} offene Sätze – ${(doneToday[it.primary] ?? 0) >= 1 ? `${MUSCLE[it.primary].short} hat heute schon ${Math.round((doneToday[it.primary] ?? 0) * 10) / 10} Sätze` : 'weitere Sätze bringen pro Minute weniger als die übrigen Übungen'}${s ? `; ${where}` : ''}.`;
  }
  for (const it of items) {
    const g = gapInfo.find((x) => x.gap && protectedG.includes(x.label) && hits(it.exerciseId, x.muscles));
    if (g && it.keep > 0 && !it.note) it.note = `bleibt: ${g.label} wäre sonst diese Woche ganz ausgefallen (letzte 7 Tage ~${Math.round(g.have * 10) / 10} Sätze).`;
    else if (g && it.keep > 0) it.note += ` Behalten, weil ${g.label} sonst diese Woche ganz ausfiele.`;
  }
  return { minutes, estMin: Math.round(used), items: items.map(({ cost: _c, setup: _s, started: _st, primary: _p, ...r }) => r), dropped, warnings, protected: protectedG };
}
