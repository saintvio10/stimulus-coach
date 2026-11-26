import type { AppData, Session } from './types';

export interface MergeReport {
  totalSessions: number;
  added: number;
  updated: number;
  skipped: number;
  activeImported: 'none' | 'active' | 'closed';
  body: number;
  checkIns: number;
  nutritionDays: number;
  exercises: number;
}

const doneSets = (s: Session) => s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);

/**
 * Führt einen Export (auch aus älteren App-Versionen) mit den lokalen Daten zusammen.
 * Lokale Einstellungen, Profil und gelernte Werte bleiben erhalten; Trainings, Körperdaten,
 * Check-ins, Ernährung und eigene Übungen werden ergänzt – nichts wird gelöscht.
 */
export function mergeData(local: AppData, incoming: AppData): { data: AppData; report: MergeReport } {
  const d: AppData = structuredClone(local);
  const report: MergeReport = {
    totalSessions: incoming.sessions?.length ?? 0,
    added: 0,
    updated: 0,
    skipped: 0,
    activeImported: 'none',
    body: 0,
    checkIns: 0,
    nutritionDays: 0,
    exercises: 0,
  };

  // Eigene Übungen ergänzen, damit importierte Trainings zuordenbar bleiben
  for (const ex of incoming.exercises ?? []) {
    if (!d.exercises.some((x) => x.id === ex.id)) {
      d.exercises.push(ex);
      report.exercises++;
    }
  }

  const localActive = d.sessions.find((s) => s.status === 'active');
  for (const inc of incoming.sessions ?? []) {
    const sameId = d.sessions.findIndex((s) => s.id === inc.id);
    const sameTime = d.sessions.findIndex((s) => s.id !== inc.id && s.date === inc.date && Math.abs(s.startedAt - inc.startedAt) < 60_000);
    let s: Session = structuredClone(inc);

    // Laufendes Training aus dem Import
    if (s.status === 'active') {
      if ((!localActive || localActive.id === s.id) && sameId < 0) report.activeImported = 'active';
      else if (localActive && localActive.id !== s.id) {
        if (!doneSets(s)) {
          report.skipped++;
          continue;
        }
        // lokal läuft schon ein Training → importiertes als abgeschlossen übernehmen (nur erledigte Sätze)
        s = { ...s, status: 'done', endedAt: s.endedAt ?? s.startedAt + 60 * 60_000 };
        s.exercises = s.exercises.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })).filter((e) => e.sets.length || e.skipped);
        report.activeImported = 'closed';
      }
    }

    if (sameId >= 0) {
      const cur = d.sessions[sameId];
      const better = (cur.status === 'active' && s.status === 'done') || doneSets(s) > doneSets(cur);
      if (better) {
        d.sessions[sameId] = s;
        report.updated++;
      } else report.skipped++;
    } else if (sameTime >= 0) {
      report.skipped++;
    } else {
      d.sessions.push(s);
      report.added++;
    }
  }
  d.sessions.sort((a, b) => a.startedAt - b.startedAt);

  for (const b of incoming.body ?? []) {
    if (!d.body.some((x) => x.id === b.id || x.date === b.date)) {
      d.body.push(b);
      report.body++;
    }
  }
  d.body.sort((a, b) => (a.date < b.date ? -1 : 1));

  for (const [k, v] of Object.entries(incoming.checkIns ?? {}))
    if (!d.checkIns[k]) {
      d.checkIns[k] = v;
      report.checkIns++;
    }
  for (const [k, v] of Object.entries(incoming.nutrition ?? {}))
    if (!d.nutrition[k]) {
      d.nutrition[k] = v;
      report.nutritionDays++;
    }
  for (const [k, v] of Object.entries(incoming.availability ?? {})) if (!d.availability[k]) d.availability[k] = v;
  d.activities ??= [];
  for (const a of incoming.activities ?? []) if (!d.activities.some((x) => x.id === a.id)) d.activities.push(a);

  d.updatedAt = Date.now();
  return { data: d, report };
}

/** Liest einen Export-Text (aktuelles oder älteres Format) */
export function parseExport(text: string): AppData {
  const parsed = JSON.parse(text.trim());
  const d = (parsed?.data ?? parsed?.state ?? parsed) as AppData;
  if (!d || typeof d !== 'object' || !Array.isArray(d.sessions)) throw new Error('Kein gültiger Stimulus-Export');
  return d;
}
