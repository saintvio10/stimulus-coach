import type { CSSProperties, MouseEvent } from 'react';
import type { MuscleId } from '../lib/types';
import { MUSCLE } from '../lib/muscles';
import { cn } from '../lib/utils';
import bodyImg from '../assets/body/body.webp';
import hit from '../assets/body/hit.json';

/**
 * 3D-Körperfigur im Stil der Übungsbilder (Vorder- und Rückansicht nebeneinander, 1024 × 688).
 * Jeder Muskel hat eine eigene Maske; eingefärbt wird mit „color“-Mischung, damit die Schattierung
 * der Figur erhalten bleibt (wie die markierten Muskeln in den Übungsbildern).
 */
const maskFiles = import.meta.glob('../assets/body/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const MASK: Partial<Record<MuscleId, string>> = {};
for (const [p, url] of Object.entries(maskFiles)) MASK[p.split('/').pop()!.replace('.png', '') as MuscleId] = url;

const W = 1024;
const H = 688;
const grid = hit as { w: number; h: number; names: string[]; rows: string[] };

/** Muskel an einer Position (0–1 relativ zum Gesamtbild) */
function muscleAt(fx: number, fy: number): MuscleId | null {
  const x = Math.floor(fx * grid.w);
  const y = Math.floor(fy * grid.h);
  // kleine Umgebung absuchen, damit dünne Bereiche (Unterarme, Schultern) leichter zu treffen sind
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
    const ch = grid.rows[y + dy]?.[x + dx];
    if (ch && ch !== '.') return grid.names[ch.charCodeAt(0) - 97] as MuscleId;
  }
  return null;
}

export function MuscleFigure({
  fills,
  selected,
  onSelect,
  view = 'both',
  className,
}: {
  /** Farbe je Muskel (CSS-Farbe, z. B. rgb(var(--rec-green))); fehlende Muskeln bleiben grau */
  fills: Partial<Record<MuscleId, string>>;
  selected?: MuscleId;
  onSelect?: (m: MuscleId) => void;
  view?: 'both' | 'front' | 'back';
  className?: string;
}) {
  const half = view !== 'both';
  // Ausschnitt: bei „vorne“/„hinten“ nur die jeweilige Bildhälfte zeigen
  const inner: CSSProperties = half ? { width: '200%', transform: view === 'back' ? 'translateX(-50%)' : undefined } : { width: '100%' };
  const click = (e: MouseEvent<HTMLDivElement>) => {
    if (!onSelect) return;
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const m = muscleAt(fx, fy);
    if (m) onSelect(m);
  };
  const layer = (m: MuscleId, color: string, extra?: CSSProperties) => {
    const url = MASK[m];
    if (!url) return null;
    return (
      <div
        key={m + (extra ? '-sel' : '')}
        className="pointer-events-none absolute inset-0"
        style={{
          WebkitMaskImage: `url(${url})`,
          maskImage: `url(${url})`,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          background: color,
          mixBlendMode: 'color',
          opacity: 0.7,
          ...extra,
        }}
      />
    );
  };
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ aspectRatio: half ? `${W / 2} / ${H}` : `${W} / ${H}` }}>
      <div className="relative" style={{ ...inner, aspectRatio: `${W} / ${H}`, isolation: 'isolate' }} onClick={click} role={onSelect ? 'button' : 'img'} aria-label="Körperfigur – Muskel antippen">
        <img src={bodyImg} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
        {(Object.entries(fills) as [MuscleId, string][]).map(([m, c]) => layer(m, c))}
        {/* ausgewählter Muskel: zusätzlich aufhellen */}
        {selected && layer(selected, 'rgb(255 255 255 / 0.7)', { mixBlendMode: 'overlay', opacity: 1 })}
      </div>
      {selected && <span className="sr-only">Ausgewählt: {MUSCLE[selected].label}</span>}
    </div>
  );
}
