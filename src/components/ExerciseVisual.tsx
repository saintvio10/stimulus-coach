import { useState } from 'react';
import { Image as ImageIcon, PlayCircle } from 'lucide-react';
import type { Exercise } from '../lib/types';
import { exerciseImage, IMAGE_BG } from '../data/exerciseImages';
import { ExerciseAnimation } from './ExerciseAnimation';
import { cn } from '../lib/utils';

/**
 * Große Übungsdarstellung: 3D-Render, falls vorhanden; per Umschalter die animierte Bewegungsanleitung.
 * Eigene Übungen ohne Bild zeigen direkt die Animation.
 */
export function ExerciseVisual({ ex, className, dark }: { ex: Exercise; className?: string; dark?: boolean }) {
  const src = exerciseImage(ex.id);
  const [anim, setAnim] = useState(false);
  const showImg = src && !anim;
  return (
    <div className={cn('absolute inset-0', className)} style={showImg ? { background: IMAGE_BG } : undefined}>
      {showImg ? (
        <img src={src} alt={`${ex.name} – Ausführung`} className="h-full w-full object-contain" draggable={false} />
      ) : (
        <ExerciseAnimation pattern={ex.pattern} muscles={ex.muscles} className="h-full w-full p-5" />
      )}
      {src && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAnim(!anim);
          }}
          className={cn(
            'absolute bottom-3 right-3 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium backdrop-blur',
            dark ? 'bg-white/10 text-white' : 'bg-bg/60 text-fg',
          )}
          aria-label={anim ? 'Bild anzeigen' : 'Bewegung als Animation anzeigen'}
        >
          {anim ? <ImageIcon size={13} /> : <PlayCircle size={13} />}
          {anim ? 'Bild' : 'Bewegung'}
        </button>
      )}
    </div>
  );
}
