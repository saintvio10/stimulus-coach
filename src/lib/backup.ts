import { exportData, useStore } from './store';
import { dateKey, downloadFile } from './utils';

export type BackupResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

export const backupJson = () => JSON.stringify({ app: 'stimulus', exportedAt: new Date().toISOString(), data: exportData() });
export const backupFilename = () => `stimulus-backup-${dateKey()}.json`;

/**
 * Sicherung als Datei: auf dem iPhone über das Teilen-Menü (→ „In Dateien sichern“ / iCloud Drive),
 * sonst als Download. Die Datei enthält alles (Trainings, Übungen, Einstellungen) und lässt sich unter
 * Profil → Daten wieder importieren (zusammenführen oder ersetzen).
 */
export async function backupNow(): Promise<BackupResult> {
  const text = backupJson();
  const mark = () =>
    useStore.getState().mutate((d) => {
      d.settings.lastBackupAt = Date.now();
      d.settings.backupSnoozeUntil = undefined;
    });
  try {
    const file = new File([text], backupFilename(), { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Stimulus Sicherung' });
      mark();
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled';
  }
  try {
    downloadFile(backupFilename(), text);
    mark();
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/** Sicherung fällig? Es gibt Trainings, die noch in keiner Sicherung stecken, und die letzte ist ≥ 7 Tage her (oder nie). */
export function backupDue(s: { sessions: { status: string; endedAt?: number; startedAt: number }[]; settings: { lastBackupAt?: number; backupSnoozeUntil?: number } }, now = Date.now()): { due: boolean; days: number | null; unsaved: number } {
  const last = s.settings.lastBackupAt ?? 0;
  const unsaved = s.sessions.filter((x) => x.status === 'done' && (x.endedAt ?? x.startedAt) > last).length;
  const days = last ? Math.floor((now - last) / 86_400_000) : null;
  const snoozed = (s.settings.backupSnoozeUntil ?? 0) > now;
  return { due: unsaved > 0 && !snoozed && (days == null || days >= 7), days, unsaved };
}
