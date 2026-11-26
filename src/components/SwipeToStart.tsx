import { useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '../lib/utils';

/** Schieberegler „Zum Starten wischen“ – verhindert versehentliches Starten. Tippen/Enter auf den Knopf startet ebenfalls. */
export function SwipeToStart({ label = 'Zum Starten wischen', onComplete, className }: { label?: string; onComplete: () => void; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState<{ startX: number; base: number } | null>(null);
  const [done, setDone] = useState(false);
  const THUMB = 48;
  const max = () => Math.max(0, (track.current?.clientWidth ?? 240) - THUMB - 8);

  const finish = () => {
    setDone(true);
    setX(max());
    try {
      navigator.vibrate?.(30);
    } catch {
      /* ignore */
    }
    setTimeout(onComplete, 220);
  };

  return (
    <div
      ref={track}
      className={cn('relative h-14 min-w-0 flex-1 select-none overflow-hidden rounded-full bg-fg/90 p-1 touch-pan-y', className)}
      onPointerMove={(e) => {
        if (!drag || done) return;
        setX(Math.min(max(), Math.max(0, drag.base + e.clientX - drag.startX)));
      }}
      onPointerUp={() => {
        if (!drag || done) return;
        setDrag(null);
        if (x > max() * 0.82) finish();
        else setX(0);
      }}
      onPointerCancel={() => {
        setDrag(null);
        setX(0);
      }}
    >
      <div className="absolute inset-y-1 left-1 rounded-full bg-accent/25" style={{ width: x + THUMB }} />
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center pl-12 text-[15px] font-medium text-bg transition-opacity"
        style={{ opacity: 1 - (x / (max() || 1)) * 0.9 }}
      >
        {label}
      </span>
      <button
        type="button"
        aria-label="Training starten"
        className={cn(
          'relative z-10 grid h-12 w-12 place-items-center rounded-full bg-bg text-fg shadow-lg',
          !drag && 'transition-transform duration-300 ease-out',
        )}
        style={{ transform: `translateX(${x}px)`, touchAction: 'none' }}
        onPointerDown={(e) => {
          (e.currentTarget.parentElement as HTMLElement).setPointerCapture?.(e.pointerId);
          setDrag({ startX: e.clientX, base: x });
        }}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && finish()}
        onClick={(e) => {
          // reiner Klick ohne Ziehen (z. B. Maus/Tastatur) startet ebenfalls
          if (e.detail === 0) finish();
        }}
      >
        {done ? <Check size={18} /> : <ArrowRight size={18} />}
      </button>
    </div>
  );
}
