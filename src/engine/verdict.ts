import type { CheckIn, Exercise, Session, SessionExercise, Settings } from '../lib/types';
import { adviseExercise, exposures } from './progression';
import { e1rm, fmtNum } from '../lib/utils';

export type VerdictTone = 'good' | 'light' | 'heavy' | 'mixed';

export interface Verdict {
  tone: VerdictTone;
  title: string;
  /** kurze Begründungen aus deinen Werten */
  points: string[];
  /** Empfehlung fürs nächste Mal (aus der normalen Progressionslogik, inkl. heutiger Einheit) */
  next: string;
}

const repsOf = (x: { reps: number | null; repsL?: number | null; repsR?: number | null }) => (x.repsL != null && x.repsR != null ? Math.min(x.repsL, x.repsR) : x.reps ?? 0);

/**
 * Automatische Bewertung einer abgeschlossenen Übung anhand deiner Werte – du musst nichts einschätzen.
 * Grundlage: Wiederholungen im Verhältnis zum Zielbereich, Abstand zum Versagen (RIR), Vergleich mit dem letzten Mal.
 * Die Empfehlung fürs nächste Mal kommt aus derselben Progressionslogik wie der Plan (heutige Sätze mitgerechnet).
 */
export function exerciseVerdict(
  ex: Exercise,
  se: SessionExercise,
  session: Session,
  sessions: Session[],
  ctx: { settings: Settings; checkIns: Record<string, CheckIn> },
): Verdict | null {
  const done = se.sets.filter((x) => x.done && repsOf(x) > 0);
  if (!done.length) return null;
  const reps = done.map(repsOf);
  const rirs = done.map((x) => (x.failure ? 0 : x.rir)).filter((x): x is number => x != null);
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  const above = reps.filter((r) => r > se.repMax).length;
  const below = reps.filter((r) => r < se.repMin).length;
  const n = reps.length;
  const points: string[] = [];

  let tone: VerdictTone;
  let title: string;
  if (above > n / 2 || (avgRir != null && avgRir >= 3 && reps[0] >= se.repMin)) {
    tone = 'light';
    title = 'Gewicht war zu leicht';
    if (above) points.push(`${above} von ${n} Sätzen über dem Zielbereich (${se.repMin}–${se.repMax} Wdh.)`);
    if (avgRir != null && avgRir >= 3) points.push(`Ø ${fmtNum(avgRir, 1)} Wdh. Reserve – für starken Reiz näher ans Versagen (0–2)`);
  } else if (below > n / 2) {
    tone = 'heavy';
    title = 'Gewicht war zu schwer';
    points.push(`${below} von ${n} Sätzen unter ${se.repMin} Wdh.`);
  } else if (below || above) {
    tone = 'mixed';
    title = 'Gewicht passt weitgehend';
    if (below) points.push(`${below === 1 ? '1 Satz' : `${below} Sätze`} unter ${se.repMin} Wdh. – Ermüdung am Ende ist normal`);
    if (above) points.push(`${above === 1 ? '1 Satz' : `${above} Sätze`} über ${se.repMax} Wdh.`);
  } else {
    tone = 'good';
    title = 'Gewicht passt';
    points.push(`Alle Sätze im Zielbereich (${reps.join(' / ')} Wdh.)`);
  }
  if (avgRir != null && avgRir < 3 && tone !== 'light') points.push(`Ø ${fmtNum(avgRir, 1)} Wdh. Reserve – nah genug am Versagen`);

  // Vergleich mit dem letzten Mal
  const prior = sessions.filter((s) => s.id !== session.id);
  const last = exposures(ex.id, prior)[0];
  if (last) {
    const lw = last.sets.map((x) => x.weight ?? 0);
    const tw = done.map((x) => x.weight ?? 0);
    const sameW = lw.length && tw.every((w) => w === tw[0]) && lw.every((w) => w === tw[0]);
    if (sameW) {
      const k = Math.min(last.sets.length, n);
      const diff = reps.slice(0, k).reduce((a, r) => a + r, 0) - last.sets.slice(0, k).reduce((a, x) => a + repsOf(x), 0);
      points.push(diff > 0 ? `+${diff} Wdh. ggü. letztem Mal bei gleichem Gewicht – Fortschritt` : diff < 0 ? `${diff} Wdh. ggü. letztem Mal bei gleichem Gewicht` : 'Gleiche Wiederholungen wie letztes Mal');
    } else {
      const best = (sets: { weight: number | null; reps: number | null; rir: number | null; repsL?: number | null; repsR?: number | null }[]) =>
        Math.max(...sets.map((x) => e1rm(x.weight ?? 0, repsOf(x), x.rir)));
      const a = best(last.sets);
      const b = best(done);
      if (a > 0 && b > 0) {
        const pct = ((b - a) / a) * 100;
        points.push(`Kraft (e1RM) ${pct >= 0 ? '+' : ''}${fmtNum(pct, 1)} % ggü. letztem Mal (anderes Gewicht)`);
      }
    }
  }

  // Empfehlung fürs nächste Mal: heutige Übung als abgeschlossen mitrechnen
  const tmp: Session = { ...session, status: 'done', endedAt: session.endedAt ?? Date.now(), exercises: [se] };
  const adv = adviseExercise(ex, [...prior, tmp], ctx, se.repMin, se.repMax, se.targetRir);
  const curW = done[done.length - 1].weight ?? 0;
  const next =
    adv.weight == null
      ? adv.text
      : adv.weight > curW
        ? `Nächstes Mal ${fmtNum(adv.weight)} kg, Ziel ${adv.repTarget}+ Wdh.`
        : adv.weight < curW
          ? `Nächstes Mal ${fmtNum(adv.weight)} kg – damit landest du wieder im Zielbereich`
          : `Nächstes Mal bei ${fmtNum(adv.weight)} kg bleiben und ${adv.repTarget} Wdh. anpeilen${tone === 'heavy' ? ' – klappt es wieder nicht, eine Stufe leichter' : ''}`;
  return { tone, title, points: points.slice(0, 4), next };
}

export interface SetFeedback {
  tone: 'great' | 'good' | 'ok' | 'low' | 'light';
  title: string;
  line: string;
  hint?: string;
}

/**
 * Kurzes Feedback direkt nach einem Satz: Wiederholungen vs. Satzziel (gleiches Gewicht wie letztes Mal → 1 Wdh. mehr
 * als damals im selben Satz, sonst Richtwert der Empfehlung minus ~1 je Folgesatz), Zielbereich, Reserve und Vergleich.
 */
export function setFeedback(
  ex: Exercise,
  se: SessionExercise,
  k: number,
  done: { w: number; reps: number; rir: number | null },
  prior: Session[],
  repTarget: number,
): SetFeedback {
  const last = exposures(ex.id, prior)[0];
  const l = last?.sets[k];
  const lr = l ? repsOf(l) : null;
  const sameW = !!l && (l.weight ?? 0) === done.w;
  const goal = sameW && lr != null ? Math.min(Math.max(lr + 1, se.repMin), Math.max(se.repMax, lr)) : Math.max(se.repMin, repTarget - k);
  const r = done.reps;
  const parts = [`${r} Wdh.`, `Ziel ${goal}`];
  if (sameW && lr != null) parts.push(`letztes Mal ${lr}${r !== lr ? ` (${r > lr ? '+' : ''}${r - lr})` : ''}`);
  else if (l) {
    const a = e1rm(l.weight ?? 0, lr ?? 0, l.rir);
    const b = e1rm(done.w, r, done.rir);
    if (a > 0) parts.push(`Kraft ${b >= a ? '+' : ''}${fmtNum(((b - a) / a) * 100, 1)} %`);
  }
  let tone: SetFeedback['tone'];
  let title: string;
  if (r > se.repMax) (tone = 'light'), (title = 'Zu leicht – über dem Zielbereich');
  else if (r >= goal + 1) (tone = 'great'), (title = 'Stark! Ziel übertroffen');
  else if (r >= goal) (tone = 'good'), (title = 'Ziel erreicht');
  else if (r >= se.repMin) (tone = 'ok'), (title = 'Im Zielbereich');
  else (tone = 'low'), (title = 'Unter dem Zielbereich');
  let hint: string | undefined;
  if (done.rir != null && done.rir >= 3 && tone !== 'low') hint = `Noch ${done.rir} Wdh. im Tank – nächster Satz näher ans Versagen`;
  else if (tone === 'low' && k > 0) hint = 'Ermüdung in späteren Sätzen ist normal';
  else if (tone === 'light') hint = 'Nächster Satz: Gewicht eine Stufe höher';
  return { tone, title, line: parts.join(' · '), hint };
}
