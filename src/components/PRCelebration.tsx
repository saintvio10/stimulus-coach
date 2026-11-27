import { useEffect, useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { usePRCelebration } from '../lib/hooks';

const COLORS = ['#ffd166', '#3ddc97', '#7c8cff', '#ff8fab', '#ffffff', '#ffb347'];

/** Konfetti + Pokal, sobald ein Satz ein Rekord ist (≈ 2,8 s, antippen schließt) */
export function PRCelebration() {
  const { pr, hide } = usePRCelebration();
  useEffect(() => {
    if (!pr) return;
    try {
      navigator.vibrate?.([30, 40, 30, 40, 80]);
    } catch {
      /* ignore */
    }
    const t = setTimeout(hide, 2800);
    return () => clearTimeout(t);
  }, [pr, hide]);
  const pieces = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        dur: 1.6 + Math.random() * 1.1,
        rot: Math.random() * 720 - 360,
        drift: Math.random() * 120 - 60,
        size: 6 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        round: Math.random() < 0.35,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pr?.key],
  );
  if (!pr) return null;
  return (
    <div className="fixed inset-0 z-[80] overflow-hidden" onClick={hide} role="alert" aria-live="assertive">
      <style>{`
        @keyframes pr-fall { 0% { transform: translate3d(0,-20px,0) rotate(0deg); opacity: 1 } 100% { transform: translate3d(var(--dx),105vh,0) rotate(var(--rot)); opacity: .9 } }
        @keyframes pr-pop { 0% { transform: scale(.4); opacity: 0 } 55% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes pr-glow { 0%,100% { box-shadow: 0 0 30px rgba(255,209,102,.45) } 50% { box-shadow: 0 0 60px rgba(255,209,102,.8) } }
      `}</style>
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            background: p.color,
            borderRadius: p.round ? 999 : 2,
            animation: `pr-fall ${p.dur}s cubic-bezier(.25,.6,.4,1) ${p.delay}s both`,
            ['--dx' as string]: `${p.drift}px`,
            ['--rot' as string]: `${p.rot}deg`,
          }}
        />
      ))}
      <div className="absolute inset-x-0 top-[22%] flex justify-center px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-[28px] bg-[#1c1a12]/95 px-6 py-6 text-center text-white ring-1 ring-[#ffd166]/40" style={{ animation: 'pr-pop .45s cubic-bezier(.2,.9,.3,1.2) both, pr-glow 1.4s ease-in-out .4s infinite' }}>
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[#ffd166] text-black shadow-[0_0_34px_rgba(255,209,102,.8)]">
            <Trophy size={32} strokeWidth={2.4} />
          </div>
          <div className="text-[26px] font-bold leading-tight">{pr.title}</div>
          <div className="text-[14px] font-semibold text-[#ffd166]">{pr.exercise}</div>
          <div className="text-[14px] text-white/75">{pr.sub}</div>
        </div>
      </div>
    </div>
  );
}
