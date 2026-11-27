import { useSetPopup } from '../lib/hooks';
import { cn } from '../lib/utils';

const STYLE = {
  great: { ring: 'ring-rec-green/50', dot: 'bg-rec-green', title: 'text-rec-green', icon: '🔥' },
  good: { ring: 'ring-rec-green/40', dot: 'bg-rec-green', title: 'text-rec-green', icon: '✓' },
  ok: { ring: 'ring-rec-yellow/40', dot: 'bg-rec-yellow', title: 'text-rec-yellow', icon: '•' },
  low: { ring: 'ring-rec-orange/45', dot: 'bg-rec-orange', title: 'text-rec-orange', icon: '↓' },
  light: { ring: 'ring-accent/45', dot: 'bg-accent', title: 'text-accent', icon: '↑' },
} as const;

/** Feedback-Pop-up nach jedem Satz – oben, über allem, verschwindet nach 3 s (antippen schließt sofort) */
export function SetPopup() {
  const { data, id, hide } = useSetPopup();
  if (!data) return null;
  const st = STYLE[data.tone];
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
      <button
        key={id}
        onClick={hide}
        className={cn('pointer-events-auto w-full max-w-md animate-fade-up overflow-hidden rounded-[22px] bg-[#1c1c1f]/95 text-left text-white shadow-2xl ring-1 backdrop-blur', st.ring)}
        role="status"
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] font-bold text-black', st.dot)}>{st.icon}</span>
          <div className="min-w-0">
            <div className={cn('text-[15px] font-bold leading-snug', st.title)}>{data.title}</div>
            <div className="tnum mt-0.5 text-[13px] text-white/80">{data.line}</div>
            {data.hint && <div className="mt-0.5 text-[12px] text-white/50">{data.hint}</div>}
            <div className="mt-0.5 truncate text-[11px] text-white/35">
              {data.exercise} · Satz {data.set}
            </div>
          </div>
        </div>
        <div className="h-0.5 w-full bg-white/10">
          <div className={cn('h-full origin-left animate-shrink', st.dot)} />
        </div>
      </button>
    </div>
  );
}
