import type { AnimPattern, Exercise, Joint } from '../lib/types';

export const JOINT_LABEL: Record<Joint, string> = {
  shoulder: 'Schulter',
  elbow: 'Ellbogen',
  wrist: 'Handgelenk',
  knee: 'Knie',
  lowerBack: 'Unterer Rücken',
};

/** Welche Gelenke eine Bewegung typischerweise stark belastet (praktische Zuordnung, keine Messung) */
const BY_PATTERN: Partial<Record<AnimPattern, Joint[]>> = {
  curl: ['elbow', 'wrist'],
  preacher: ['elbow', 'wrist'],
  bayesian: ['elbow', 'shoulder'],
  overheadExt: ['elbow', 'shoulder'],
  pushdown: ['elbow'],
  dip: ['shoulder', 'elbow', 'wrist'],
  chestPress: ['shoulder', 'wrist'],
  inclinePress: ['shoulder', 'wrist'],
  fly: ['shoulder'],
  shoulderPress: ['shoulder', 'elbow'],
  lateralRaise: ['shoulder'],
  pulldown: ['shoulder', 'elbow'],
  row: ['elbow'],
  cableRow: ['elbow', 'lowerBack'],
  legPress: ['knee', 'lowerBack'],
  legExtension: ['knee'],
  legCurl: ['knee'],
  rdl: ['lowerBack'],
};

export function exerciseJoints(ex: Pick<Exercise, 'pattern'>): Joint[] {
  return BY_PATTERN[ex.pattern] ?? [];
}

export function painConflict(ex: Pick<Exercise, 'pattern'>, pain: Joint[] | undefined): Joint[] {
  if (!pain?.length) return [];
  return exerciseJoints(ex).filter((j) => pain.includes(j));
}
