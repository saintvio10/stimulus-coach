import type { CheckIn, Exercise, ProgressionAdvice, Session, SetLog, Settings } from '../lib/types';
import { e1rm, fmtNum, nextWeight, prevWeight } from '../lib/utils';

export interface Exposure {
  date: string;
  t: number;
  sets: SetLog[];
  repMin: number;
  repMax: number;
  targetRir: number;
  feedback?: 'easy' | 'ok' | 'hard';
  decision?: 'accepted' | 'declined';
}

/** Vergangene Durchgänge einer Übung, neueste zuerst */
export function exposures(exerciseId: string, sessions: Session[]): Exposure[] {
  const out: Exposure[] = [];
  for (const s of sessions) {
    if (s.status !== 'done') continue;
    for (const se of s.exercises) {
      if (se.exerciseId !== exerciseId || se.skipped) continue;
      // Sätze ohne Gewicht zählen nur bei Körpergewicht (Gewicht = 0); sonst kann ohne Gewicht gar nicht gespeichert werden
      const sets = se.sets.filter((x) => x.done && x.reps != null && x.reps > 0).map((x) => (x.weight == null ? { ...x, weight: 0 } : x));
      if (!sets.length) continue;
      out.push({ date: s.date, t: s.endedAt ?? s.startedAt, sets, repMin: se.repMin, repMax: se.repMax, targetRir: se.targetRir, feedback: se.feedback, decision: se.decision });
    }
  }
  return out.sort((a, b) => b.t - a.t);
}

export function bestE1rm(sets: SetLog[]): number {
  return sets.reduce((b, s) => Math.max(b, e1rm(s.weight ?? 0, s.reps ?? 0, s.rir)), 0);
}

/** Arbeitsgewicht = häufigstes (bei Gleichstand höchstes) Gewicht der erledigten Sätze */
export function workingWeight(sets: SetLog[]): number {
  const counts = new Map<number, number>();
  for (const s of sets) counts.set(s.weight ?? 0, (counts.get(s.weight ?? 0) ?? 0) + 1);
  let best = 0,
    bestN = -1;
  for (const [w, n] of counts) if (n > bestN || (n === bestN && w > best)) (best = w), (bestN = n);
  return best;
}

interface AdviceCtx {
  settings: Settings;
  checkIns: Record<string, CheckIn>;
  /** aktuelles 7-Tage-Volumen / Ziel des Primärmuskels */
  volumeRatio?: number;
  today?: string;
}

export function adviseExercise(
  ex: Exercise,
  sessions: Session[],
  ctx: AdviceCtx,
  repMin = ex.repMin,
  repMax = ex.repMax,
  targetRir = ex.targetRir,
): ProgressionAdvice {
  const hist = exposures(ex.id, sessions);
  const base: ProgressionAdvice = {
    type: 'new',
    weight: null,
    repTarget: Math.round((repMin + repMax) / 2),
    text:
      ex.equipment === 'bodyweight'
        ? `Erstes Mal: so viele saubere Wdh. wie möglich, ca. ${targetRir} Wdh. vor dem Versagen aufhören (Bereich ${repMin}–${repMax}). Zu leicht? Schwerere Variante oder Rucksack als Zusatzgewicht.`
        : `Erstes Training: wähle ein Gewicht, mit dem du ca. ${Math.round((repMin + repMax) / 2)} Wdh. bei ${targetRir} RIR schaffst. Die App lernt ab dann mit.`,
    causes: [],
    setDelta: 0,
    rirDelta: 0,
    lastWeight: null,
    lastReps: [],
    lastDate: null,
    stalled: false,
  };
  if (!hist.length) return base;

  const last = hist[0];
  const w = workingWeight(last.sets);
  const atW = last.sets.filter((s) => s.weight === w);
  const reps = atW.map((s) => s.reps ?? 0);
  const rirs = atW.map((s) => s.rir).filter((r): r is number => r != null);
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  const res: ProgressionAdvice = { ...base, lastWeight: w, lastReps: last.sets.map((s) => s.reps ?? 0), lastDate: last.date, weight: w };

  // Körpergewicht ohne Zusatzlast: über Wiederholungen steigern, dann schwerere Variante/Zusatzgewicht
  if (ex.equipment === 'bodyweight' && w <= 0) {
    res.weight = null;
    res.lastWeight = null;
    const target = Math.min(repMax, Math.min(...reps) + 1);
    if (reps.every((r) => r >= repMax)) {
      res.type = 'extend';
      res.repTarget = repMax;
      res.text = `Alle Sätze am oberen Ende (${reps.join('/')} Wdh.). Nächster Schritt: schwerere Variante (z. B. Füße erhöht, langsamer ablassen) oder Zusatzgewicht – Rucksack, Wasserflaschen – und als Gewicht eintragen.`;
    } else {
      res.type = 'hold';
      res.repTarget = target;
      res.text = `Körpergewicht: Wiederholungen steigern (letztes Mal ${reps.join('/')}). Ziel ${target}+ pro Satz, ca. ${targetRir} Wdh. vor dem Versagen aufhören – bis ${repMax} Wdh. wirkt das genauso aufs Muskelwachstum wie schweres Training.`;
    }
    return res;
  }
  const next = nextWeight(w, ex, ctx.settings);
  const jump = w > 0 ? (next - w) / w : 0;
  const bigJump = jump > 0.12;
  // Lernen aus deinem Feedback:
  // „zu schwer“ → erst Wiederholungen festigen (+1 Wdh. über dem oberen Ende), „zu leicht“ → 1 Wdh. früher steigern,
  // zweimal Steigerung abgelehnt → die App wartet eine Wiederholung länger.
  const fb = last.feedback;
  const declined = hist.slice(0, 3).filter((h) => h.decision === 'declined').length;
  let adj = 0;
  const learn: string[] = [];
  if (fb === 'hard') {
    adj += 1;
    learn.push('du es zuletzt als zu schwer bewertet hast');
  }
  if (fb === 'easy') {
    adj -= 1;
    learn.push('du es zuletzt als zu leicht bewertet hast');
  }
  if (declined >= 2) {
    adj += 1;
    learn.push(`du die Steigerung ${declined}× abgelehnt hast`);
  }
  const topReps = (bigJump ? repMax + 2 : repMax) + adj;
  const rirOk = avgRir == null || avgRir <= targetRir + 1 || fb === 'easy';
  const tooEasy = fb !== 'hard' && ((avgRir != null && avgRir >= targetRir + 3) || (fb === 'easy' && reps.every((r) => r >= repMin)));
  const learnTxt = learn.length ? ` (Angepasst, weil ${learn.join(' und ')}.)` : '';

  if (fb === 'hard' && reps.some((r) => r < repMin) && w > 0) {
    const lower = prevWeight(w, ex, ctx.settings);
    res.type = 'decrease';
    res.weight = lower;
    res.repTarget = repMin + 2;
    res.text = `Letztes Mal zu schwer und unter ${repMin} Wdh. → heute ${fmtNum(lower)} kg und sauber im Bereich aufbauen.`;
  } else if (atW.length >= 1 && reps.every((r) => r >= topReps) && rirOk && next > w) {
    res.type = 'increase';
    res.weight = next;
    res.repTarget = repMin + (bigJump ? 0 : 1);
    res.text = `Alle Sätze bei ${fmtNum(w)} kg am oberen Ende (${reps.join('/')} Wdh.)${avgRir != null ? ` mit Ø ${fmtNum(avgRir)} RIR` : ''} → nächste Stufe ${fmtNum(next)} kg, Ziel ${res.repTarget}+ Wdh.${learnTxt}`;
  } else if (reps.every((r) => r >= repMax) && rirOk && bigJump) {
    res.type = 'extend';
    res.repTarget = Math.min(topReps, Math.max(...reps) + 1);
    res.text = `Oberes Ende erreicht, aber die nächste Stufe (${fmtNum(next)} kg) wäre +${Math.round(jump * 100)} %. Erst auf ${topReps} Wdh. steigern (Wiederholungs-Erweiterung), dann Gewicht erhöhen.`;
  } else if (tooEasy && next > w) {
    res.type = 'increase';
    res.weight = next;
    res.repTarget = repMin + 1;
    res.text = fb === 'easy' ? `Du hast ${fmtNum(w)} kg zuletzt als zu leicht bewertet → heute ${fmtNum(next)} kg.` : `Letztes Mal Ø ${fmtNum(avgRir!)} RIR – deutlich leichter als Ziel-RIR ${targetRir}. Gewicht auf ${fmtNum(next)} kg erhöhen.`;
  } else if (reps.some((r) => r < repMin)) {
    const prevBelow = hist[1] && workingWeight(hist[1].sets) === w && hist[1].sets.some((s) => (s.reps ?? 0) < repMin);
    if (prevBelow) {
      const lower = prevWeight(w, ex, ctx.settings);
      res.type = 'decrease';
      res.weight = lower;
      res.repTarget = repMin + 2;
      res.text = `Zweimal in Folge unter ${repMin} Wdh. bei ${fmtNum(w)} kg → auf ${fmtNum(lower)} kg reduzieren und wieder sauber im Bereich aufbauen.`;
    } else {
      res.type = 'hold';
      res.repTarget = repMin;
      res.text = `Gewicht halten (${fmtNum(w)} kg). Ziel: in jedem Satz mindestens ${repMin} Wdh.`;
    }
  } else {
    res.type = 'hold';
    const target = Math.min(repMax, Math.min(...reps) + 1);
    res.repTarget = target;
    res.text = `Doppelte Progression: ${fmtNum(w)} kg halten und Wdh. steigern (letztes Mal ${reps.join('/')}). Ziel: ${target}+ pro Satz, bis alle Sätze ${topReps} erreichen.${learnTxt}`;
  }

  // Stagnations- und Leistungsabfall-Erkennung über e1RM
  const series = hist.slice(0, 4).map((h) => bestE1rm(h.sets));
  if (series.length >= 3) {
    const [a, b, c] = series;
    const stalled = a <= c * 1.01 && b <= c * 1.01;
    const prevBest = Math.max(...series.slice(1));
    const older = Math.max(...series.slice(2));
    // Leistungsabfall nur werten, wenn das Arbeitsgewicht nicht bewusst reduziert wurde
    const olderW = Math.max(...hist.slice(2, 4).map((h) => workingWeight(h.sets)));
    const declining = a < older * 0.95 && b < older * 0.98 && w >= olderW;
    if (stalled || declining) {
      res.stalled = true;
      const causes: string[] = [];
      const sleepVals = Object.entries(ctx.checkIns)
        .sort(([x], [y]) => (x < y ? 1 : -1))
        .slice(0, 7)
        .map(([, c]) => c.sleepHours);
      const avgSleep = sleepVals.length ? sleepVals.reduce((x, y) => x + y, 0) / sleepVals.length : null;
      if (avgSleep != null && avgSleep < 6.5) causes.push(`wenig Schlaf (Ø ${fmtNum(avgSleep)} h)`);
      if (ctx.volumeRatio != null && ctx.volumeRatio > 1.25) causes.push('hohes Wochenvolumen für diesen Muskel');
      const gaps = hist.slice(0, 3).map((h, i, arr) => (i < arr.length - 1 ? (h.t - arr[i + 1].t) / 86_400_000 : 0));
      if (gaps.some((g) => g > 10)) causes.push('lange Pausen zwischen den Einheiten');
      if (avgRir != null && avgRir > targetRir + 1.5) causes.push('Sätze weit vom Muskelversagen entfernt');
      if (!causes.length) causes.push('mögliche akkumulierte Ermüdung');
      res.causes = causes;
      if (declining) {
        res.type = 'deload';
        res.weight = prevWeight(w, ex, ctx.settings);
        res.setDelta = -1;
        res.rirDelta = 1;
        res.repTarget = repMin + 1;
        res.text = `Leistung gesunken (e1RM −${Math.round((1 - a / prevBest) * 100)} %). Leichte Entlastung: ${fmtNum(res.weight)} kg, 1 Satz weniger, +1 RIR. Mögliche Ursachen: ${causes.join(', ')}.`;
      } else {
        if (ctx.volumeRatio != null && ctx.volumeRatio > 1.25) res.setDelta = -1;
        res.text += ` Stagnation über 3 Einheiten erkannt – mögliche Ursachen: ${causes.join(', ')}.${res.setDelta < 0 ? ' Volumen wird um 1 Satz reduziert.' : ' Bleibt sie bestehen, Übungsvariante tauschen.'}`;
      }
    }
  }
  return res;
}
