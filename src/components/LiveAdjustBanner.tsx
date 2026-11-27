import { ArrowDown, ArrowUp } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/hooks';
import type { Exercise, SessionExercise } from '../lib/types';
import { liveAdjust } from '../engine/liveAdjust';
import { cn, fmtNum } from '../lib/utils';

/** Hinweis nach einem Satz: Gewicht für die restlichen Sätze anpassen? (übernehmen / ablehnen) */
export function LiveAdjustBanner({ sessionId, se, ex, dark, compact, onApplied }: { sessionId: string; se: SessionExercise; ex: Exercise; dark?: boolean; compact?: boolean; onApplied?: (w: number) => void }) {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const adj = liveAdjust(se, ex, s.settings);
  if (!adj) return null;
  const down = adj.dir === 'down';
  const apply = () => {
    s.setWeightFrom(sessionId, se.uid, adj.nextSetId, adj.to);
    s.patchExercise(sessionId, se.uid, { liveDismissed: adj.afterSetId });
    onApplied?.(adj.to);
    toast(`Restliche Sätze: ${fmtNum(adj.to)} kg`);
  };
  const dismiss = () => s.patchExercise(sessionId, se.uid, { liveDismissed: adj.afterSetId });
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl px-3.5 py-3 ring-1',
        down ? 'bg-rec-orange/10 ring-rec-orange/30' : 'bg-accent/10 ring-accent/30',
        dark && 'text-white',
      )}
      role="status"
    >
      <div className="flex items-start gap-2.5">
        <span className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full', down ? 'bg-rec-orange text-black' : 'bg-accent text-white')}>
          {down ? <ArrowDown size={14} strokeWidth={3} /> : <ArrowUp size={14} strokeWidth={3} />}
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold leading-snug">{adj.title}</div>
          {!compact && <div className={cn('mt-0.5 text-[12.5px] leading-snug', dark ? 'text-white/60' : 'text-muted')}>{adj.reason}</div>}
        </div>
      </div>
      <div className="flex gap-2 pl-8">
        <button onClick={apply} className={cn('h-9 rounded-full px-4 text-[13px] font-semibold', down ? 'bg-rec-orange text-black' : 'bg-accent text-white')}>
          {fmtNum(adj.to)} kg übernehmen
        </button>
        <button onClick={dismiss} className={cn('h-9 rounded-full px-3 text-[13px] font-medium', dark ? 'text-white/60' : 'text-muted')}>
          Bei {fmtNum(adj.from)} kg bleiben
        </button>
      </div>
    </div>
  );
}
