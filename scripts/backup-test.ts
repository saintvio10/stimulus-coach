// Sicherung fällig? (Erinnerung auf der Übersicht)
import { backupDue } from '../src/lib/backup';
const D = 86_400_000, now = Date.parse('2026-11-27T12:00:00+01:00');
let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fails++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const ses = (daysAgo: number) => ({ status: 'done', startedAt: now - daysAgo * D, endedAt: now - daysAgo * D + 3_600_000 });
ok(!backupDue({ sessions: [], settings: {} }, now).due, 'keine Trainings → keine Erinnerung');
ok(backupDue({ sessions: [ses(1)], settings: {} }, now).due, 'Trainings, noch nie gesichert → Erinnerung');
ok(!backupDue({ sessions: [ses(1)], settings: { lastBackupAt: now - 3 * D } }, now).due, 'Sicherung vor 3 Tagen → noch keine Erinnerung');
ok(backupDue({ sessions: [ses(1)], settings: { lastBackupAt: now - 8 * D } }, now).due, 'Sicherung vor 8 Tagen + neues Training → Erinnerung');
ok(!backupDue({ sessions: [ses(10)], settings: { lastBackupAt: now - 8 * D } }, now).due, 'Sicherung vor 8 Tagen, aber kein neues Training seitdem → keine Erinnerung');
ok(!backupDue({ sessions: [ses(1)], settings: { lastBackupAt: now - 8 * D, backupSnoozeUntil: now + D } }, now).due, '„Später“ blendet 2 Tage aus');
ok(backupDue({ sessions: [ses(1), ses(2)], settings: { lastBackupAt: now - 8 * D } }, now).unsaved === 2, 'zählt ungesicherte Trainings');
console.log(fails ? `${fails} FEHLER` : 'Alle Prüfungen bestanden');
if (fails) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
