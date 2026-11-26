import { useRef, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

const ACTION_W = 92;

/**
 * Apple-artiges „Wischen zum Löschen“: nach links wischen zeigt eine rote Aktion,
 * ganz durchwischen löst sie direkt aus. Vertikales Scrollen bleibt unberührt.
 */
export function SwipeRow({
  children,
  onAction,
  label = 'Entfernen',
  disabled,
  className,
}: {
  children: ReactNode;
  onAction: () => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [dx, setDx] = useState(0);
  const [anim, setAnim] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const st = useRef<{ x: number; y: number; base: number; lock: 'h' | 'v' | null; id: number; moved: boolean } | null>(null);
  const width = useRef(360);
  const root = useRef<HTMLDivElement>(null);
  const justSwiped = useRef(false);

  const fire = () => {
    setAnim(true);
    setLeaving(true);
    setDx(-width.current);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      onAction();
      setLeaving(false);
      setDx(0);
    }, 220);
  };

  return (
    <div
      ref={root}
      data-noswipe
      className={cn('relative', className)}
      style={{ touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        if (disabled || leaving) return;
        const t = e.target as HTMLElement;
        if (t.closest('input,textarea,select,[data-noswiperow]')) return;
        width.current = root.current?.offsetWidth ?? 360;
        st.current = { x: e.clientX, y: e.clientY, base: dx, lock: null, id: e.pointerId, moved: false };
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (!s || s.id !== e.pointerId) return;
        const mx = e.clientX - s.x;
        const my = e.clientY - s.y;
        if (!s.lock) {
          if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
          s.lock = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
          if (s.lock === 'h') {
            setAnim(false);
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }
        }
        if (s.lock !== 'h') return;
        s.moved = true;
        let v = s.base + mx;
        if (v > 0) v = v * 0.15; // leichter Gummiband-Effekt nach rechts
        setDx(Math.max(-width.current, v));
      }}
      onPointerUp={() => {
        const s = st.current;
        st.current = null;
        if (!s || s.lock !== 'h') return;
        setAnim(true);
        if (dx < -width.current * 0.55) fire();
        else if (dx < -ACTION_W / 2) setDx(-ACTION_W);
        else setDx(0);
        // den Klick, der direkt auf das Wischen folgt, unterdrücken
        if (s.moved) {
          justSwiped.current = true;
          setTimeout(() => (justSwiped.current = false), 80);
        }
      }}
      onPointerCancel={() => {
        st.current = null;
        setAnim(true);
        setDx(dx < -ACTION_W / 2 ? -ACTION_W : 0);
      }}
      onClickCapture={(e) => {
        if (justSwiped.current) {
          justSwiped.current = false;
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        // offene Aktion: Tippen auf die Karte schließt sie wieder
        if (dx !== 0 && !leaving && !(e.target as HTMLElement).closest('[data-swipe-action]')) {
          e.stopPropagation();
          e.preventDefault();
          setAnim(true);
          setDx(0);
        }
      }}
    >
      {dx < 0 && (
        <div className="absolute inset-0 flex items-stretch justify-end overflow-hidden rounded-[1.25rem] bg-rec-red">
          <button
            data-swipe-action
            onClick={fire}
            aria-label={label}
            className="flex flex-col items-center justify-center gap-1 text-[12px] font-semibold text-white"
            style={{ width: Math.max(ACTION_W, -dx) }}
          >
            <Trash2 size={20} />
            {label}
          </button>
        </div>
      )}
      <div
        className={cn('relative', anim && 'transition-transform duration-200 ease-out')}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
