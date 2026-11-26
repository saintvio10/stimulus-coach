import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, TimerReset, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { fmtClock } from '../lib/utils';
import { useFocusRequest, useRouter } from '../lib/hooks';

let audioCtx: AudioContext | null = null;
export function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    /* kein Audio */
  }
}
function beep() {
  try {
    unlockAudio();
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    [0, 0.22, 0.44].forEach((d, i) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.type = 'sine';
      o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
      o.connect(g).connect(audioCtx!.destination);
      o.start(t0 + d);
      o.stop(t0 + d + 0.2);
    });
  } catch {
    /* ignore */
  }
}

export async function requestNotify(): Promise<boolean> {
  try {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const r = await Notification.requestPermission();
    return r === 'granted';
  } catch {
    return false;
  }
}

function notify(label: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const body = `Pause vorbei – nächster Satz: ${label}`;
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then((r) => r.showNotification('Stimulus', { body, tag: 'rest', icon: './icon-192.png' })).catch(() => {});
    } else new Notification('Stimulus', { body, tag: 'rest' });
  } catch {
    /* ignore */
  }
}

export function RestTimer() {
  const timer = useStore((s) => s.timer);
  const settings = useStore((s) => s.settings);
  const stop = useStore((s) => s.stopTimer);
  const adjust = useStore((s) => s.adjustTimer);
  const hasActive = useStore((s) => s.sessions.some((x) => x.status === 'active'));
  const go = useRouter((r) => r.go);
  const requestFocus = useFocusRequest((f) => f.request);
  const openFocus = () => {
    if (!hasActive) return;
    if (useRouter.getState().route !== 'training') go('training');
    requestFocus();
  };
  const [now, setNow] = useState(Date.now());
  const fired = useRef<number | null>(null);

  useEffect(() => {
    if (!timer) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [timer]);

  const left = timer ? (timer.pausedLeft != null ? timer.pausedLeft : (timer.endsAt - now) / 1000) : 0;
  useEffect(() => {
    if (!timer || left > 0 || fired.current === timer.endsAt) return;
    fired.current = timer.endsAt;
    if (settings.sound) beep();
    if (settings.vibrate) {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* ignore */
      }
    }
    if (settings.notifications && document.visibilityState !== 'visible') notify(timer.label);
    else if (settings.notifications) notify(timer.label);
    const t = setTimeout(() => stop(), 6000);
    return () => clearTimeout(t);
  }, [left, timer, settings, stop]);

  if (!timer) return null;
  const done = left <= 0;
  const frac = Math.max(0, Math.min(1, left / timer.total));
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom,0px))] z-40 flex justify-center px-4 lg:bottom-6 lg:left-64">
      <div
        className={`pointer-events-auto w-full max-w-md animate-fade-up overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl ${
          done ? 'border-rec-green/40 bg-rec-green/15' : 'border-line/10 bg-raised/90'
        }`}
      >
        <div className="h-1 bg-line/5">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${frac * 100}%` }} />
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={openFocus}
            aria-label="Fokus-Modus der aktuellen Übung öffnen"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
          <TimerReset size={18} className={done ? 'text-rec-green' : 'text-accent'} />
          <div className="min-w-0 flex-1">
            <div className="tnum text-[22px] font-semibold leading-none">{done ? 'Los geht’s' : fmtClock(left)}{timer.pausedLeft != null && <span className="ml-2 text-[12px] font-medium text-muted">pausiert</span>}</div>
            <div className="mt-1 truncate text-[12px] text-muted">{done ? `Nächster Satz: ${timer.label}` : `Satzpause · ${timer.label}`}</div>
          </div>
          {hasActive && <Maximize2 size={15} className="shrink-0 text-muted" />}
          </button>
          {!done && (
            <>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-bg/60 text-muted hover:text-fg" onClick={() => adjust(-15)} aria-label="15 Sekunden weniger">
                <Minus size={16} />
              </button>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-bg/60 text-muted hover:text-fg" onClick={() => adjust(15)} aria-label="15 Sekunden mehr">
                <Plus size={16} />
              </button>
            </>
          )}
          <button className="grid h-9 w-9 place-items-center rounded-full bg-bg/60 text-muted hover:text-fg" onClick={stop} aria-label="Timer beenden">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
