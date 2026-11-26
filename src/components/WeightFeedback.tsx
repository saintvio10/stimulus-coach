import { cn } from '../lib/utils';

/** Bewertung des Arbeitsgewichts nach einer Übung – fließt in die nächste Empfehlung ein */
export function WeightFeedback({ value, onChange, dark }: { value?: 'easy' | 'ok' | 'hard'; onChange: (v: 'easy' | 'ok' | 'hard') => void; dark?: boolean }) {
  const opts: { v: 'easy' | 'ok' | 'hard'; label: string; cls: string }[] = [
    { v: 'easy', label: 'Zu leicht', cls: 'bg-accent text-bg' },
    { v: 'ok', label: 'Passend', cls: 'bg-rec-green text-bg' },
    { v: 'hard', label: 'Zu schwer', cls: 'bg-rec-orange text-bg' },
  ];
  return (
    <div className={cn('flex flex-col gap-2 rounded-2xl p-3.5', dark ? 'bg-white/[0.06]' : 'bg-raised')}>
      <div className="text-[14px] font-semibold">Wie war das Gewicht?</div>
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={cn('h-10 rounded-xl text-[13.5px] font-semibold transition active:scale-95', value === o.v ? o.cls : dark ? 'bg-white/10 text-white/80' : 'bg-bg text-muted')}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className={cn('text-[12px]', dark ? 'text-white/55' : 'text-muted')}>
        {value === 'easy'
          ? 'Gemerkt: Nächstes Mal schlägt die App früher mehr Gewicht vor.'
          : value === 'hard'
            ? 'Gemerkt: Nächstes Mal bleibt das Gewicht, bis die Wiederholungen sicher sitzen – war es deutlich zu schwer, geht es eine Stufe runter.'
            : value === 'ok'
              ? 'Gemerkt: normale doppelte Progression.'
              : 'Deine Einschätzung fließt in die nächste Gewichtsempfehlung ein.'}
      </p>
    </div>
  );
}

