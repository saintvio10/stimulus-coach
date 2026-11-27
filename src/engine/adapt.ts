import { MUSCLE, MUSCLES } from '../lib/muscles';
import type { AppData, MuscleId, Session, VolumeAdjust } from '../lib/types';
import { addDays, clamp, dateKey, diffDays, e1rm, fmtNum } from '../lib/utils';
import { exposures, workingWeight } from './progression';
import { readinessScore } from './readiness';

/**
 * Persönliche Volumenanpassung je Muskel (max. 1× pro Woche):
 * Grundlage sind nur vergleichbare Einheiten (gleiche Übung, gleicher Wdh.-Bereich, gleiches Arbeitsgewicht-Niveau, keine schwachen Tage).
 * – Fortschritt (e1RM ≥ +1,5 % in 4 Wochen) → Volumen bleibt
 * – Stagnation bei guter Erholung → +10 % (max. +30 %)
 * – Leistungsabfall (≤ −2 %) oder häufig starker Muskelkater → −15 % (min. −30 %)
 * Grundlage: abnehmender, aber positiver Volumen-Effekt; individuelle Reaktion variiert.
 */
export function computeVolumeAdjust(data: AppData, now = Date.now()): { map: Partial<Record<MuscleId, VolumeAdjust>>; changes: string[] } {
  const today = dateKey(now);
  const from = addDays(today, -28);
  const done = data.sessions.filter((s) => s.status === 'done');
  const oldest = done.map((s) => s.date).sort()[0];
  const enoughHistory = !!oldest && diffDays(today, oldest) >= 21;
  const exById = new Map(data.exercises.map((e) => [e.id, e]));
  const recent = done.filter((s) => s.date >= from);
  const map: Partial<Record<MuscleId, VolumeAdjust>> = { ...data.volumeAdjust };
  const changes: string[] = [];

  // Muskelkater & Bereitschaft der letzten 14 Tage
  const ciDays = Object.entries(data.checkIns).filter(([d]) => d >= addDays(today, -14));
  const readiness = ciDays.map(([, c]) => readinessScore(c)).filter((x): x is number => x != null);
  const avgReady = readiness.length ? readiness.reduce((a, b) => a + b, 0) / readiness.length : null;

  for (const meta of MUSCLES) {
    if (meta.indirectOnly) continue;
    const m = meta.id;
    const prev = map[m] ?? { factor: 1, updatedOn: '', reason: 'Standard-Volumen', trend: null };
    if (prev.updatedOn && diffDays(today, prev.updatedOn) < 7) continue;

    // Trend der Übungen mit diesem Zielmuskel – nur aus VERGLEICHBAREN Einheiten (Modellregel):
    // • gleiche Übung, gleicher Wiederholungsbereich; Leistung = Mittel der e1RM-Schätzungen (inkl. RIR) der Sätze mit dem
    //   Arbeitsgewicht – ein einzelner Spitzen- oder Ausreißersatz (z. B. 12,5 kg × 5 nach 10 kg × 9) bestimmt nicht den Wert
    // • nach einer bewussten Gewichtskorrektur (Arbeitsgewicht > 5 % niedriger) oder einem anderen Wiederholungsbereich wird
    //   neu gesammelt: der Wechsel zu passenderen Gewichten ist kein Leistungsabfall
    // • schwache Tage (schweres Aufwärmen, Tagesform, Bereitschaft < 45) zählen nicht
    // • erst ab 3 vergleichbaren Einheiten über ≥ 10 Tage je Übung, Änderungen erst ab 4 Messpunkten je Muskel
    const exIds = new Set(
      recent.flatMap((s: Session) => s.exercises.filter((e) => !e.skipped && exById.get(e.exerciseId)?.primary === m).map((e) => e.exerciseId)),
    );
    let wsum = 0,
      tsum = 0,
      count = 0,
      resets = 0;
    for (const id of exIds) {
      const ex = exposures(id, recent).reverse(); // älteste zuerst
      count += ex.length;
      let seg: { x: number; y: number }[] = [];
      let prevW: number | null = null;
      let prevRange = '';
      for (const e of ex) {
        const weak = e.warmup === 'hard' || e.declineReason === 'dayform' || (readinessScore(data.checkIns[e.date]) ?? 100) < 45;
        if (weak) continue;
        const w = workingWeight(e.sets);
        const range = `${e.repMin}-${e.repMax}`;
        if (prevW != null && ((w > 0 && w < prevW * 0.95) || range !== prevRange)) {
          if (seg.length) resets++;
          seg = [];
        }
        prevW = w;
        prevRange = range;
        const atW = e.sets.filter((x) => (x.weight ?? 0) === w);
        const ys = atW.map((x) => e1rm(w, x.repsL != null && x.repsR != null ? Math.min(x.repsL, x.repsR) : x.reps ?? 0, x.rir)).filter((y) => y > 0);
        if (!ys.length) continue;
        seg.push({ x: e.t / 86_400_000, y: ys.reduce((a, b) => a + b, 0) / ys.length });
      }
      if (seg.length < 3 || seg[seg.length - 1].x - seg[0].x < 10) continue;
      // Lineare Regression e1RM ~ Tage, hochgerechnet auf 4 Wochen, relativ zum Mittelwert
      const pts = seg;
      const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
      if (!den || !my) continue;
      const slope = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / den;
      tsum += ((slope * 28) / my) * 100 * pts.length;
      wsum += pts.length;
    }
    if (!enoughHistory || count < 3 || !wsum) {
      map[m] = {
        ...prev,
        reason:
          prev.factor === 1
            ? resets && enoughHistory
              ? 'Nach Gewichts- oder Bereichswechsel werden erst vergleichbare Einheiten gesammelt (mind. 3 über 10 Tage) – Volumen bleibt'
              : 'Noch zu wenig Daten (mind. 3 vergleichbare Einheiten über 3 Wochen)'
            : prev.reason,
      };
      continue;
    }
    const trend = tsum / wsum;
    const sore = ciDays.map(([, c]) => c.soreness?.[m] ?? 0);
    const avgSore = sore.length ? sore.reduce((a, b) => a + b, 0) / sore.length : 0;
    let factor = prev.factor;
    let reason: string;
    if (wsum < 4 && avgSore < 2) {
      // Unsichere Datenlage: Trend anzeigen, aber nichts automatisch ändern
      reason = `Trend ${trend >= 0 ? '+' : ''}${fmtNum(trend)} % aus nur ${wsum} vergleichbaren Einheiten – noch unsicher, Volumen bleibt`;
    } else if (trend <= -2 || avgSore >= 2) {
      factor = clamp(+(prev.factor * 0.85).toFixed(2), 0.7, 1.3);
      reason = trend <= -2 ? `Leistung ${fmtNum(trend)} % in 4 Wochen → Volumen −15 % für bessere Erholung (Modellregel, Schwelle anpassbar)` : 'Häufig starker Muskelkater → Volumen −15 % (Modellregel)';
    } else if (trend < 1.5 && avgSore < 1.5 && (avgReady == null || avgReady >= 55)) {
      factor = clamp(+(prev.factor + 0.1).toFixed(2), 0.7, 1.3);
      reason = `Stagnation (${trend >= 0 ? '+' : ''}${fmtNum(trend)} % in 4 Wochen) bei guter Erholung → +10 % Volumen (Modellregel, Schwelle anpassbar)`;
    } else if (trend >= 1.5) {
      reason = `Fortschritt +${fmtNum(trend)} % in 4 Wochen → Volumen bleibt`;
    } else {
      reason = 'Stagnation, aber Erholung eingeschränkt → Volumen bleibt, Fokus auf Schlaf/Regeneration';
    }
    if (factor !== prev.factor) changes.push(`${MUSCLE[m].label}: ${factor > prev.factor ? '+' : '−'}${Math.round(Math.abs(factor - prev.factor) * 100)} % Volumen`);
    map[m] = { factor, updatedOn: today, reason, trend: +trend.toFixed(1) };
  }
  return { map, changes };
}

/** Lernt das persönliche Trainingstempo aus einer abgeschlossenen Einheit (gleitender Mittelwert) */
export function calibrateTime(session: Session, prev: number, samples: number, endedAt = Date.now()): { factor: number; samples: number; ratio: number | null } {
  const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const actual = (endedAt - session.startedAt) / 60000;
  if (!session.estMinutes || !session.plannedSets || doneSets < 6 || actual < 15 || actual > 200) return { factor: prev, samples, ratio: null };
  const expected = 7 + (session.estMinutes - 7) * (doneSets / session.plannedSets);
  const ratio = clamp(actual / expected, 0.6, 1.6);
  const alpha = samples < 3 ? 0.5 : 0.3;
  const factor = clamp(+(prev + alpha * (ratio - prev)).toFixed(3), 0.75, 1.4);
  return { factor, samples: samples + 1, ratio };
}
