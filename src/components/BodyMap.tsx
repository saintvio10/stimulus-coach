import type { MuscleId } from '../lib/types';
import { RECOVERY_COLORS, type RecoveryColor, MUSCLE } from '../lib/muscles';

/**
 * Stilisierte anatomische Karte. Es wird jeweils die linke Körperhälfte gezeichnet und gespiegelt.
 * Koordinatensystem: 200 × 430, Körpermitte x = 100.
 */
type Shape = { m: MuscleId | null; d: string };

const SILHOUETTE =
  'M100 52 L91 54 L90 64 Q74 66 63 72 Q49 78 47 96 Q45 116 46 136 Q41 160 40 184 Q39 196 45 198 Q51 197 53 186 Q60 162 63 140 L68 116 Q69 140 71 168 Q65 222 66 266 Q64 300 66 334 Q66 362 69 384 L63 396 Q72 402 82 397 L81 382 Q86 344 84 304 Q88 272 92 244 Q96 214 100 204 Z';

const FRONT: Shape[] = [
  // Trapez (oben sichtbar)
  { m: 'upperBack', d: 'M91 60 Q80 64 70 70 Q82 70 92 68 Z' },
  // vordere Schulter
  { m: 'frontDelts', d: 'M70 72 Q63 80 61 96 Q67 99 72 92 Q76 82 77 73 Z' },
  // seitliche Schulter
  { m: 'sideDelts', d: 'M66 72 Q52 76 50 92 Q53 99 59 97 Q60 83 68 74 Z' },
  // Brust
  { m: 'chest', d: 'M79 72 Q90 70 98 73 L98 104 Q87 110 75 104 Q68 99 71 89 Q74 79 79 72 Z' },
  // Bizeps
  { m: 'biceps', d: 'M53 102 Q47 116 49 134 Q55 141 61 135 Q66 119 64 104 Q59 99 53 102 Z' },
  // Unterarm
  { m: 'forearms', d: 'M49 141 Q43 160 43 180 Q47 185 52 183 Q60 163 62 143 Q56 145 49 141 Z' },
  // Bauch (Rectus + Obliques)
  { m: 'abs', d: 'M88 110 L98 109 L98 125 L87 126 Z' },
  { m: 'abs', d: 'M87 129 L98 128 L98 144 L87 145 Z' },
  { m: 'abs', d: 'M87 148 L98 147 L98 164 L88 165 Z' },
  { m: 'abs', d: 'M88 168 L98 167 L98 190 Q92 186 89 178 Z' },
  { m: 'abs', d: 'M76 108 Q72 132 77 162 L85 170 L84 112 Z' },
  // Quadrizeps
  { m: 'quads', d: 'M73 186 Q63 222 67 262 Q75 272 85 266 Q93 238 97 200 Q88 190 73 186 Z' },
  // Waden (vorne sichtbar)
  { m: 'calves', d: 'M68 292 Q63 320 68 352 L75 354 Q80 322 79 294 Z' },
];

const BACK: Shape[] = [
  // Trapez / oberer Rücken
  { m: 'upperBack', d: 'M100 54 L90 58 Q76 63 68 72 L83 82 Q92 98 100 118 Z' },
  // hintere Schulter
  { m: 'rearDelts', d: 'M66 73 Q53 78 50 93 Q57 98 64 92 Q68 83 72 77 Z' },
  // Latissimus
  { m: 'lats', d: 'M72 88 Q66 106 74 136 Q84 150 98 156 L98 124 Q86 108 84 92 Z' },
  // Trizeps
  { m: 'triceps', d: 'M52 99 Q46 116 49 134 Q56 139 62 133 Q66 116 64 99 Q58 95 52 99 Z' },
  // Unterarm
  { m: 'forearms', d: 'M49 141 Q43 160 43 180 Q47 185 52 183 Q60 163 62 143 Q56 145 49 141 Z' },
  // Gesäß
  { m: 'glutes', d: 'M75 170 Q69 188 77 206 Q89 212 99 204 L99 172 Q88 164 75 170 Z' },
  // Beinbeuger
  { m: 'hamstrings', d: 'M72 212 Q66 242 72 268 Q80 274 86 268 Q94 242 96 214 Q85 208 72 212 Z' },
  // Waden
  { m: 'calves', d: 'M68 284 Q60 306 66 334 Q73 340 80 334 Q86 306 80 286 Z' },
];

export interface BodyMapProps {
  colors: Partial<Record<MuscleId, RecoveryColor>>;
  selected?: MuscleId | null;
  onSelect?: (m: MuscleId) => void;
  side: 'front' | 'back';
  className?: string;
  /** Überschreibt die Erholungsfarben, z. B. für Zielmuskel-Hervorhebung */
  fills?: Partial<Record<MuscleId, string>>;
}

function Half({ shapes, colors, selected, onSelect, fills }: { shapes: Shape[] } & Omit<BodyMapProps, 'side' | 'className'>) {
  return (
    <>
      <path d={SILHOUETTE} fill="rgb(var(--raised))" />
      {shapes.map((s, i) => {
        const c = s.m ? (fills ? fills[s.m] ?? 'rgb(var(--line) / 0.1)' : RECOVERY_COLORS[colors[s.m] ?? 'gray']) : 'rgb(var(--raised))';
        const sel = s.m && selected === s.m;
        return (
          <path
            key={i}
            d={s.d}
            fill={c}
            fillOpacity={sel ? 1 : 0.78}
            stroke={sel ? 'rgb(var(--fg))' : 'rgb(var(--bg))'}
            strokeWidth={sel ? 1.6 : 0.8}
            className={s.m && onSelect ? 'cursor-pointer transition-[fill-opacity] hover:fill-opacity-100' : undefined}
            onClick={s.m && onSelect ? () => onSelect(s.m!) : undefined}
          >
            {s.m && <title>{MUSCLE[s.m].label}</title>}
          </path>
        );
      })}
    </>
  );
}

export function BodyMap({ colors, selected, onSelect, side, className, fills }: BodyMapProps) {
  const shapes = side === 'front' ? FRONT : BACK;
  return (
    <svg viewBox="30 0 140 410" className={className} role="img" aria-label={side === 'front' ? 'Körper von vorne' : 'Körper von hinten'}>
      <ellipse cx={100} cy={30} rx={15} ry={19} fill="rgb(var(--raised))" />
      <g>
        <Half shapes={shapes} colors={colors} selected={selected} onSelect={onSelect} fills={fills} />
      </g>
      <g transform="translate(200 0) scale(-1 1)">
        <Half shapes={shapes} colors={colors} selected={selected} onSelect={onSelect} fills={fills} />
      </g>
    </svg>
  );
}

/** Zielmuskeln einer Übung als Füllfarben (direkt kräftig, indirekt gedämpft) */
export function targetFills(muscles: Partial<Record<MuscleId, number>>): Partial<Record<MuscleId, string>> {
  const out: Partial<Record<MuscleId, string>> = {};
  for (const [m, c] of Object.entries(muscles) as [MuscleId, number][]) {
    if (!c) continue;
    out[m] = c >= 0.75 ? 'rgb(var(--hl))' : `rgb(var(--hl) / ${c >= 0.5 ? 0.45 : 0.25})`;
  }
  return out;
}
