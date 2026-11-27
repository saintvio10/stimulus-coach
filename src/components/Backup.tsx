import { useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/hooks';
import { backupDue, backupNow } from '../lib/backup';
import { cn } from '../lib/utils';

const resultText = { shared: 'Gesichert', downloaded: 'Sicherung heruntergeladen', cancelled: '', failed: 'Sicherung fehlgeschlagen – Profil → Daten → Export' } as const;

/** Knopf „Sicherung speichern“ – z. B. nach dem Training */
export function BackupButton({ dark, className }: { dark?: boolean; className?: string }) {
  const toast = useToast((t) => t.show);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  return (
    <button
      disabled={state === 'busy'}
      onClick={async () => {
        setState('busy');
        const r = await backupNow();
        setState(r === 'shared' || r === 'downloaded' ? 'done' : 'idle');
        if (resultText[r]) toast(resultText[r]);
      }}
      className={cn(
        'flex h-12 items-center justify-center gap-2 rounded-full text-[14.5px] font-semibold transition active:scale-[0.99]',
        dark ? 'bg-white/10 text-white' : 'bg-fg text-bg',
        state === 'done' && (dark ? 'bg-rec-green/15 text-rec-green' : 'bg-rec-green/10 text-rec-green'),
        className,
      )}
    >
      {state === 'done' ? <Check size={17} /> : <ShieldCheck size={17} />}
      {state === 'done' ? 'Gesichert' : state === 'busy' ? 'Sichern …' : 'Sicherung speichern'}
    </button>
  );
}

/** Erinnerung auf der Übersicht: Trainings seit ≥ 7 Tagen nicht gesichert */
export function BackupReminder() {
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const mutate = useStore((s) => s.mutate);
  const { due, days, unsaved } = backupDue({ sessions, settings });
  if (!due) return null;
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-raised p-4 ring-1 ring-rec-yellow/25">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rec-yellow/15 text-rec-yellow">
          <ShieldCheck size={19} />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">Sicherung fällig</div>
          <div className="text-[12.5px] leading-snug text-muted">
            {days == null ? 'Noch nie gesichert' : `Letzte Sicherung vor ${days} Tagen`} · {unsaved} {unsaved === 1 ? 'Training' : 'Trainings'} nur auf diesem Gerät. iOS kann Daten von Web-Apps löschen – speichere die
            Datei in „Dateien“ bzw. iCloud Drive.
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <BackupButton className="flex-1" />
        <button
          onClick={() => mutate((d) => void (d.settings.backupSnoozeUntil = Date.now() + 2 * 86_400_000))}
          className="h-12 rounded-full px-4 text-[13.5px] font-medium text-muted hover:text-fg"
        >
          Nicht jetzt
        </button>
      </div>
    </div>
  );
}
