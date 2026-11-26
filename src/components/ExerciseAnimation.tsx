import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import type { AnimPattern, MuscleId } from '../lib/types';
import { DEFAULT_EXERCISES } from '../data/exercises';
import { exerciseImage, IMAGE_BG } from '../data/exerciseImages';

/**
 * Schematische, animierte Bewegungsanleitung. Zwei Posen (Start/Ende) werden sinusförmig interpoliert.
 * Seitenansicht: Gelenkwinkel in Grad. Frontansicht: Abduktion der Arme.
 */
interface SidePose {
  view: 'side';
  hip: [number, number];
  t: number; // Rumpfneigung (+ = nach vorne)
  s: number; // Oberarm (0 = hängend, 90 = nach vorne, 180 = über Kopf)
  e: number; // Ellbogenbeugung
  h: number; // Oberschenkel (0 = senkrecht, 90 = sitzend)
  k: number; // Kniebeugung
  lift?: number; // Fersenhub 0–1
}
interface FrontPose {
  view: 'front';
  a: number; // Abduktion (0 = Arm unten, 90 = waagrecht, 180 = oben)
  b: number; // Ellbogenbeugung
  depth?: number; // 1 = Arm in Bildebene, <1 = Arm zeigt nach vorne
  seated?: boolean;
}
type Pose = SidePose | FrontPose;

interface Spec {
  a: Pose;
  b: Pose;
  tool?: 'db' | 'cable' | 'bar' | 'machine';
  cable?: [number, number];
  seat?: boolean;
  back?: boolean;
  pad?: boolean;
  platform?: boolean;
  relArm?: boolean;
  kneel?: boolean;
  hl: 'arm' | 'forearm' | 'leg' | 'shin' | 'torso' | 'calf' | 'shoulder';
}

const st = (p: Partial<SidePose>): SidePose => ({ view: 'side', hip: [56, 60], t: 0, s: 0, e: 5, h: 0, k: 0, ...p });
const fr = (p: Partial<FrontPose>): FrontPose => ({ view: 'front', a: 10, b: 5, ...p });
const seated = { hip: [50, 64] as [number, number], h: 90, k: 90 };

export const SPECS: Record<AnimPattern, Spec> = {
  curl: { a: st({ s: 0, e: 8 }), b: st({ s: 6, e: 135 }), tool: 'db', hl: 'forearm' },
  preacher: { a: st({ ...seated, t: 15, s: 48, e: 6 }), b: st({ ...seated, t: 15, s: 48, e: 125 }), tool: 'bar', seat: true, pad: true, hl: 'forearm' },
  bayesian: { a: st({ t: 6, s: -35, e: 6 }), b: st({ t: 6, s: -30, e: 130 }), tool: 'cable', cable: [6, 80], hl: 'forearm' },
  overheadExt: { a: st({ t: 12, s: 165, e: 150 }), b: st({ t: 12, s: 165, e: 8 }), tool: 'cable', cable: [8, 84], hl: 'forearm' },
  pushdown: { a: st({ t: 10, s: 4, e: 100 }), b: st({ t: 10, s: 0, e: 4 }), tool: 'cable', cable: [82, 4], hl: 'forearm' },
  dip: { a: st({ ...seated, t: 0, s: -50, e: 105 }), b: st({ ...seated, t: 0, s: -12, e: 8 }), tool: 'machine', seat: true, hl: 'forearm' },
  chestPress: { a: st({ ...seated, t: -12, s: -70, e: 150 }), b: st({ ...seated, t: -12, s: 84, e: 5 }), tool: 'machine', seat: true, back: true, hl: 'arm' },
  inclinePress: { a: st({ ...seated, t: -32, s: -55, e: 150 }), b: st({ ...seated, t: -32, s: 118, e: 5 }), tool: 'machine', seat: true, back: true, hl: 'arm' },
  fly: { a: fr({ a: 88, b: 18, depth: 1, seated: true }), b: fr({ a: 88, b: 18, depth: 0.22, seated: true }), tool: 'machine', hl: 'shoulder' },
  pulldown: { a: fr({ a: 165, b: 8, seated: true }), b: fr({ a: 62, b: 112, seated: true }), tool: 'bar', hl: 'arm' },
  row: { a: st({ ...seated, t: 40, s: 80, e: 6 }), b: st({ ...seated, t: 40, s: -45, e: 115 }), tool: 'machine', seat: true, hl: 'arm' },
  cableRow: { a: st({ hip: [46, 66], h: 84, k: 22, t: 16, s: 86, e: 5 }), b: st({ hip: [46, 66], h: 84, k: 22, t: -6, s: -38, e: 118 }), tool: 'cable', cable: [114, 66], seat: true, hl: 'arm' },
  lateralRaise: { a: fr({ a: 12, b: 12 }), b: fr({ a: 86, b: 12 }), tool: 'db', hl: 'shoulder' },
  reverseFly: { a: fr({ a: 86, b: 10, depth: 0.25 }), b: fr({ a: 86, b: 10, depth: 1 }), tool: 'cable', hl: 'shoulder' },
  shoulderPress: { a: fr({ a: 80, b: 95, seated: true }), b: fr({ a: 158, b: 15, seated: true }), tool: 'machine', hl: 'shoulder' },
  legPress: { a: st({ hip: [44, 66], t: -58, h: 150, k: 118, s: 40, e: 30 }), b: st({ hip: [44, 66], t: -58, h: 80, k: 8, s: 40, e: 30 }), seat: true, back: true, platform: true, hl: 'leg' },
  legCurl: { a: st({ ...seated, t: -10, h: 90, k: 8, s: 30, e: 50 }), b: st({ ...seated, t: -10, h: 90, k: 112, s: 30, e: 50 }), seat: true, back: true, hl: 'shin' },
  legExtension: { a: st({ ...seated, t: -10, h: 90, k: 96, s: 20, e: 40 }), b: st({ ...seated, t: -10, h: 90, k: 4, s: 20, e: 40 }), seat: true, back: true, hl: 'shin' },
  rdl: { a: st({ hip: [56, 58], t: 0, h: 0, k: 5 }), b: st({ hip: [48, 60], t: 80, h: -4, k: 16 }), tool: 'bar', hl: 'leg' },
  calfRaise: { a: st({ t: 0, lift: 0 }), b: st({ t: 0, lift: 1 }), tool: 'machine', hl: 'calf' },
  cableCrunch: { a: st({ hip: [52, 66], h: 0, k: 90, t: 12, s: 150, e: 140 }), b: st({ hip: [52, 66], h: 0, k: 90, t: 85, s: 150, e: 140 }), tool: 'cable', cable: [92, 4], relArm: true, kneel: true, hl: 'torso' },
  abMachine: { a: st({ ...seated, t: -5, s: 150, e: 120 }), b: st({ ...seated, t: 45, s: 150, e: 120 }), seat: true, relArm: true, hl: 'torso' },
};

const rad = (d: number) => (d * Math.PI) / 180;
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

function mix<T extends Pose>(a: T, b: T, p: number): T {
  const out: Record<string, unknown> = { ...a };
  for (const k of Object.keys(a) as (keyof T)[]) {
    const va = a[k] as unknown;
    const vb = b[k] as unknown;
    if (typeof va === 'number' && typeof vb === 'number') out[k as string] = lerp(va, vb, p);
    else if (Array.isArray(va) && Array.isArray(vb)) out[k as string] = [lerp(va[0], vb[0], p), lerp(va[1], vb[1], p)];
  }
  return out as T;
}

const HL = 'rgb(var(--hl))';
const BODY = 'rgb(var(--fg) / 0.86)';
const BODY2 = 'rgb(var(--fg) / 0.62)'; // abgewandte Körperseite
const EDGE = 'rgb(var(--bg) / 0.55)';
const EQ = 'rgb(var(--muted) / 0.55)';

type P = number[];
const Look3D = createContext(false);
type MMap = Partial<Record<MuscleId, number>>;

/** Verjüngtes Körpersegment (Kapsel) von a nach b */
function Seg({ a, b, w1, w2, fill = BODY }: { a: P; b: P; w1: number; w2: number; fill?: string }) {
  const is3d = useContext(Look3D);
  const gid = 'sg' + useId().replace(/:/g, '');
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  let nx = -dy / L,
    ny = dx / L;
  if (is3d) {
    // Licht von oben links: Normale zur Lichtseite drehen
    if (ny > 0 || (ny === 0 && nx > 0)) (nx = -nx), (ny = -ny);
    const back = fill === BODY2;
    const w = Math.max(w1, w2) / 2;
    const mx = (a[0] + b[0]) / 2,
      my = (a[1] + b[1]) / 2;
    const d3 = `M${a[0] + (nx * w1) / 2} ${a[1] + (ny * w1) / 2} L${b[0] + (nx * w2) / 2} ${b[1] + (ny * w2) / 2} L${b[0] - (nx * w2) / 2} ${b[1] - (ny * w2) / 2} L${a[0] - (nx * w1) / 2} ${a[1] - (ny * w1) / 2} Z`;
    return (
      <g>
        <defs>
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={mx + nx * w} y1={my + ny * w} x2={mx - nx * w} y2={my - ny * w}>
            <stop offset="0" stopColor={back ? '#8a8b94' : '#c9cad2'} />
            <stop offset="0.28" stopColor={back ? '#a3a4ad' : '#f4f4f7'} />
            <stop offset="0.62" stopColor={back ? '#73747d' : '#aeafb8'} />
            <stop offset="1" stopColor={back ? '#4a4b53' : '#6c6d77'} />
          </linearGradient>
        </defs>
        <g fill={`url(#${gid})`}>
          <circle cx={a[0]} cy={a[1]} r={w1 / 2} />
          <circle cx={b[0]} cy={b[1]} r={w2 / 2} />
          <path d={d3} />
        </g>
      </g>
    );
  }
  const d = `M${a[0] + (nx * w1) / 2} ${a[1] + (ny * w1) / 2} L${b[0] + (nx * w2) / 2} ${b[1] + (ny * w2) / 2} L${b[0] - (nx * w2) / 2} ${b[1] - (ny * w2) / 2} L${a[0] - (nx * w1) / 2} ${a[1] - (ny * w1) / 2} Z`;
  return (
    <g fill={fill} stroke={EDGE} strokeWidth={0.5}>
      <circle cx={a[0]} cy={a[1]} r={w1 / 2} />
      <circle cx={b[0]} cy={b[1]} r={w2 / 2} />
      <path d={d} stroke="none" />
    </g>
  );
}

function alpha(c: number) {
  return c >= 0.75 ? 0.95 : c >= 0.5 ? 0.6 : 0.38;
}

/** Muskelbauch als leuchtende Ellipse entlang eines Segments */
function Belly({ a, b, t, off, len, w, c, glow, side = 1 }: { a: P; b: P; t: number; off: number; len: number; w: number; c?: number; glow: string; side?: 1 | -1 }) {
  if (!c) return null;
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L,
    uy = dy / L;
  // Normale (für hängende Gliedmaßen = nach vorne)
  const fx = uy * side,
    fy = -ux * side;
  const cx = a[0] + dx * t + fx * off,
    cy = a[1] + dy * t + fy * off;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return <MuscleE cx={cx} cy={cy} rx={(L * len) / 2} ry={w / 2} rot={ang} c={c} glow={glow} />;
}

/** Muskel-Ellipse: flach (Standard) oder plastisch mit Verlauf und hellem Rand (3D-Look) */
function MuscleE({ cx, cy, rx, ry, rot, c, glow }: { cx: number; cy: number; rx: number; ry: number; rot: number; c: number; glow: string }) {
  const is3d = useContext(Look3D);
  const gid = 'mg' + useId().replace(/:/g, '');
  if (!is3d) return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} fill={HL} fillOpacity={alpha(c)} filter={`url(#${glow})`} />;
  return (
    <g transform={`rotate(${rot} ${cx} ${cy})`} opacity={c >= 0.75 ? 1 : c >= 0.5 ? 0.7 : 0.45}>
      <defs>
        <radialGradient id={gid} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#ffc2a1" />
          <stop offset="0.45" stopColor="#ff6a3a" />
          <stop offset="1" stopColor="#d23d1c" />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={rx + 0.6} ry={ry + 0.6} fill="none" stroke="#cfe0ff" strokeOpacity={0.9} strokeWidth={0.7} filter={`url(#${glow})`} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${gid})`} />
    </g>
  );
}

function Head({ x, y, r }: { x: number; y: number; r: number }) {
  const is3d = useContext(Look3D);
  const gid = 'hg' + useId().replace(/:/g, '');
  if (!is3d) return <circle cx={x} cy={y} r={r} fill={BODY} stroke={EDGE} strokeWidth={0.5} />;
  return (
    <g>
      <defs>
        <radialGradient id={gid} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fbfbfd" />
          <stop offset="0.55" stopColor="#b4b5be" />
          <stop offset="1" stopColor="#5f606a" />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r} fill={`url(#${gid})`} />
    </g>
  );
}

function Side({ p, spec, glow, m }: { p: SidePose; spec: Spec; glow: string; m: MMap }) {
  const [hx, hy0] = p.hip;
  const lift = (p.lift ?? 0) * 4;
  const hy = hy0 - lift;
  const T = 30,
    UA = 16,
    FA = 15,
    TH = 21,
    SH = 20;
  const hip: P = [hx, hy];
  const sh: P = [hx + T * Math.sin(rad(p.t)), hy - T * Math.cos(rad(p.t))];
  const neck: P = [sh[0] + 4 * Math.sin(rad(p.t)), sh[1] - 4 * Math.cos(rad(p.t))];
  const head: P = [sh[0] + 10.5 * Math.sin(rad(p.t)), sh[1] - 10.5 * Math.cos(rad(p.t))];
  const sAbs = spec.relArm ? p.s + p.t : p.s;
  const el: P = [sh[0] + UA * Math.sin(rad(sAbs)), sh[1] + UA * Math.cos(rad(sAbs))];
  const wr: P = [el[0] + FA * Math.sin(rad(sAbs + p.e)), el[1] + FA * Math.cos(rad(sAbs + p.e))];
  const kn: P = [hx + TH * Math.sin(rad(p.h)), hy + TH * Math.cos(rad(p.h))];
  const shinA = p.h - p.k;
  const an: P = [kn[0] + SH * Math.sin(rad(shinA)), kn[1] + SH * Math.cos(rad(shinA))];
  const toe: P = spec.kneel
    ? [an[0] - 3, an[1] + 1.5]
    : [an[0] + 7 * Math.cos(rad(-(p.lift ?? 0) * 30)), an[1] - 7 * Math.sin(rad(-(p.lift ?? 0) * 30)) + lift * 0.2];
  // zweites (hinteres) Bein leicht versetzt für Tiefe
  const off = 2.2;
  const kn2: P = [kn[0] - off, kn[1]],
    an2: P = [an[0] - off, an[1]],
    toe2: P = [toe[0] - off, toe[1]];
  // Gesicht zeigt in Rumpfrichtung nach vorne
  const nose: P = [head[0] + 5.6 * Math.cos(rad(p.t)), head[1] + 5.6 * Math.sin(rad(p.t))];
  return (
    <>
      {spec.seat && <rect x={hx - 13} y={hy0 + 3.5} width={24} height={3.5} rx={1.75} fill={EQ} />}
      {spec.seat && <line x1={hx - 1} y1={hy0 + 7} x2={hx - 1} y2={94} stroke={EQ} strokeWidth={2} />}
      {spec.back && (
        <line x1={hx - 6 * Math.cos(rad(p.t))} y1={hy + 2} x2={hx - 6 * Math.cos(rad(p.t)) + 32 * Math.sin(rad(p.t))} y2={hy + 2 - 32 * Math.cos(rad(p.t))} stroke={EQ} strokeWidth={3} strokeLinecap="round" />
      )}
      {spec.pad && <line x1={sh[0] + 3} y1={sh[1] + 6} x2={sh[0] + 3 + 17 * Math.sin(rad(p.s))} y2={sh[1] + 6 + 17 * Math.cos(rad(p.s))} stroke={EQ} strokeWidth={5} strokeLinecap="round" />}
      {spec.platform && (
        <line
          x1={an[0] - 10 * Math.cos(rad(shinA))}
          y1={an[1] + 10 * Math.sin(rad(shinA))}
          x2={an[0] + 10 * Math.cos(rad(shinA))}
          y2={an[1] - 10 * Math.sin(rad(shinA))}
          stroke={EQ}
          strokeWidth={3}
          strokeLinecap="round"
          transform={`translate(${3.5 * Math.sin(rad(shinA))} ${3.5 * Math.cos(rad(shinA))})`}
        />
      )}
      {spec.tool === 'cable' && spec.cable && (
        <>
          <circle cx={spec.cable[0]} cy={spec.cable[1]} r={2.5} fill={EQ} />
          <line x1={spec.cable[0]} y1={spec.cable[1]} x2={wr[0]} y2={wr[1]} stroke={EQ} strokeWidth={1} strokeDasharray="2 2" />
        </>
      )}
      {!spec.seat && !spec.kneel && <line x1={10} y1={95.5} x2={110} y2={95.5} stroke="rgb(var(--line) / 0.12)" strokeWidth={1} />}
      {/* hinteres Bein */}
      <Seg a={hip} b={kn2} w1={7.6} w2={5.4} fill={BODY2} />
      <Seg a={kn2} b={an2} w1={5.2} w2={3.4} fill={BODY2} />
      <Seg a={an2} b={toe2} w1={3.2} w2={2.2} fill={BODY2} />
      {/* vorderes Bein */}
      <Seg a={hip} b={kn} w1={8.4} w2={5.8} />
      <Belly a={hip} b={kn} t={0.5} off={2.1} len={0.72} w={5} c={m.quads} glow={glow} />
      <Belly a={hip} b={kn} t={0.55} off={-2.1} len={0.66} w={4.6} c={m.hamstrings} glow={glow} />
      <Seg a={kn} b={an} w1={5.6} w2={3.6} />
      <Belly a={kn} b={an} t={0.32} off={-1.6} len={0.5} w={4} c={m.calves} glow={glow} />
      <Seg a={an} b={toe} w1={3.4} w2={2.4} />
      {/* Rumpf */}
      <Seg a={hip} b={sh} w1={10} w2={12.5} />
      <Belly a={hip} b={sh} t={0.04} off={-3.6} len={0.3} w={7} c={m.glutes} glow={glow} side={-1} />
      <Belly a={hip} b={sh} t={0.78} off={3.4} len={0.36} w={5.2} c={m.chest} glow={glow} side={-1} />
      <Belly a={hip} b={sh} t={0.42} off={3.6} len={0.42} w={3.6} c={m.abs} glow={glow} side={-1} />
      <Belly a={hip} b={sh} t={0.6} off={-3.6} len={0.46} w={4.6} c={m.lats} glow={glow} side={-1} />
      <Belly a={hip} b={sh} t={0.9} off={-3.2} len={0.28} w={5} c={m.upperBack} glow={glow} side={-1} />
      <Seg a={sh} b={neck} w1={4.6} w2={4} />
      <Head x={head[0]} y={head[1]} r={6} />
      <circle cx={nose[0]} cy={nose[1]} r={1.3} fill={BODY} />
      {/* Arm */}
      <Seg a={sh} b={el} w1={5.8} w2={4.4} />
      {[m.frontDelts, m.sideDelts, m.rearDelts].some(Boolean) && (
        <circle
          cx={sh[0] + (m.frontDelts && !m.rearDelts ? 1.4 : m.rearDelts && !m.frontDelts ? -1.4 : 0)}
          cy={sh[1] + 1.2}
          r={3.6}
          fill={HL}
          fillOpacity={alpha(Math.max(m.frontDelts ?? 0, m.sideDelts ?? 0, m.rearDelts ?? 0))}
          filter={`url(#${glow})`}
        />
      )}
      <Belly a={sh} b={el} t={0.55} off={1.5} len={0.6} w={3.9} c={m.biceps} glow={glow} />
      <Belly a={sh} b={el} t={0.5} off={-1.5} len={0.66} w={3.9} c={m.triceps} glow={glow} />
      <Seg a={el} b={wr} w1={4.4} w2={3.2} />
      <Belly a={el} b={wr} t={0.33} off={0} len={0.55} w={3.4} c={m.forearms} glow={glow} />
      <circle cx={wr[0]} cy={wr[1]} r={2.1} fill={BODY} />
      {spec.tool === 'db' && (
        <g fill={EQ}>
          <rect x={wr[0] - 4.5} y={wr[1] - 1.2} width={9} height={2.4} rx={1} />
          <rect x={wr[0] - 6} y={wr[1] - 3} width={2.6} height={6} rx={1} />
          <rect x={wr[0] + 3.4} y={wr[1] - 3} width={2.6} height={6} rx={1} />
        </g>
      )}
      {spec.tool === 'bar' && <circle cx={wr[0]} cy={wr[1]} r={3.4} fill="none" stroke={EQ} strokeWidth={2} />}
      {spec.tool === 'machine' && spec.hl !== 'calf' && <rect x={wr[0] - 1.5} y={wr[1] - 4} width={3} height={8} rx={1.5} fill={EQ} />}
      {spec.hl === 'calf' && <rect x={hx - 16} y={sh[1] - 5} width={32} height={3} rx={1.5} fill={EQ} />}
    </>
  );
}

function Front({ p, spec, glow, m }: { p: FrontPose; spec: Spec; glow: string; m: MMap }) {
  const cx = 60;
  const shL: P = [cx - 12, 31],
    shR: P = [cx + 12, 31];
  const hipY = 62;
  const UA = 16 * (p.depth ?? 1),
    FA = 15 * (p.depth ?? 1);
  const arm = (sh: P, dir: 1 | -1) => {
    const el: P = [sh[0] + dir * UA * Math.sin(rad(p.a)), sh[1] + UA * Math.cos(rad(p.a))];
    const ang = p.a + p.b;
    const wr: P = [el[0] + dir * FA * Math.sin(rad(ang)), el[1] + FA * Math.cos(rad(ang))];
    return { el, wr };
  };
  const L = arm(shL, -1),
    R = arm(shR, 1);
  const torso = `M${cx - 13} ${30} Q${cx} ${26} ${cx + 13} ${30} Q${cx + 11.5} ${44} ${cx + 8.5} ${52} Q${cx + 9.5} ${60} ${cx + 8.5} ${hipY + 2} L${cx - 8.5} ${hipY + 2} Q${cx - 9.5} ${60} ${cx - 8.5} ${52} Q${cx - 11.5} ${44} ${cx - 13} ${30} Z`;
  const legs = p.seated
    ? [
        [[cx - 5, hipY + 1], [cx - 8, 76], [cx - 9, 92]],
        [[cx + 5, hipY + 1], [cx + 8, 76], [cx + 9, 92]],
      ]
    : [
        [[cx - 5, hipY + 1], [cx - 6.5, 78], [cx - 7.5, 94]],
        [[cx + 5, hipY + 1], [cx + 6.5, 78], [cx + 7.5, 94]],
      ];
  const delt = Math.max(m.frontDelts ?? 0, m.sideDelts ?? 0, m.rearDelts ?? 0);
  const glowE = (x: number, y: number, rx: number, ry: number, c?: number, rot = 0) =>
    c ? <MuscleE cx={x} cy={y} rx={rx} ry={ry} rot={rot} c={c} glow={glow} /> : null;
  return (
    <>
      {p.seated && <rect x={cx - 16} y={hipY + 3} width={32} height={4} rx={2} fill={EQ} />}
      {!p.seated && <line x1={10} y1={95.5} x2={110} y2={95.5} stroke="rgb(var(--line) / 0.12)" strokeWidth={1} />}
      {legs.map((lg, i) => (
        <g key={i}>
          <Seg a={lg[0]} b={lg[1]} w1={8.6} w2={6} />
          <Belly a={lg[0]} b={lg[1]} t={0.5} off={0} len={0.7} w={5.4} c={m.quads ?? (m.hamstrings ? m.hamstrings * 0.5 : undefined)} glow={glow} />
          <Seg a={lg[1]} b={lg[2]} w1={5.6} w2={3.6} />
          <Belly a={lg[1]} b={lg[2]} t={0.3} off={0} len={0.5} w={4.2} c={m.calves} glow={glow} />
        </g>
      ))}
      <path d={torso} fill={BODY} stroke={EDGE} strokeWidth={0.5} />
      {glowE(cx - 5.6, 36, 5.2, 3.8, m.chest)}
      {glowE(cx + 5.6, 36, 5.2, 3.8, m.chest)}
      {glowE(cx, 50, 3.6, 7.5, m.abs)}
      {glowE(cx - 10, 45, 2.4, 7, m.lats, -10)}
      {glowE(cx + 10, 45, 2.4, 7, m.lats, 10)}
      {glowE(cx - 6, 28.5, 4.5, 1.8, m.upperBack, 15)}
      {glowE(cx + 6, 28.5, 4.5, 1.8, m.upperBack, -15)}
      <Seg a={[cx, 27]} b={[cx, 22]} w1={5} w2={4.4} />
      <Head x={cx} y={17.5} r={6.4} />
      {[
        { sh: shL, A: L },
        { sh: shR, A: R },
      ].map(({ sh, A }, i) => (
        <g key={i}>
          <Seg a={sh} b={A.el} w1={6} w2={4.4} />
          <Belly a={sh} b={A.el} t={0.55} off={0} len={0.6} w={4} c={m.biceps ?? m.triceps} glow={glow} />
          <Seg a={A.el} b={A.wr} w1={4.4} w2={3.2} />
          <Belly a={A.el} b={A.wr} t={0.33} off={0} len={0.5} w={3.4} c={m.forearms} glow={glow} />
          <circle cx={A.wr[0]} cy={A.wr[1]} r={2.2} fill={BODY} />
          <circle cx={sh[0]} cy={sh[1] + 0.5} r={4.4} fill={BODY} stroke={EDGE} strokeWidth={0.5} />
          {delt > 0 && <circle cx={sh[0]} cy={sh[1] + 0.5} r={4} fill={HL} fillOpacity={alpha(delt)} filter={`url(#${glow})`} />}
        </g>
      ))}
      {spec.tool === 'bar' && <line x1={L.wr[0] - 6} y1={L.wr[1]} x2={R.wr[0] + 6} y2={R.wr[1]} stroke={EQ} strokeWidth={2.5} strokeLinecap="round" />}
      {spec.tool === 'bar' && <line x1={cx} y1={2} x2={cx} y2={Math.min(L.wr[1], R.wr[1])} stroke={EQ} strokeWidth={1} strokeDasharray="2 2" />}
      {(spec.tool === 'db' || spec.tool === 'machine' || spec.tool === 'cable') &&
        [L.wr, R.wr].map((w, i) => <circle key={i} cx={w[0]} cy={w[1]} r={2.9} fill="none" stroke={EQ} strokeWidth={1.6} />)}
    </>
  );
}

const PATTERN_MUSCLES: Partial<Record<AnimPattern, MMap>> = {};
for (const e of DEFAULT_EXERCISES) if (!PATTERN_MUSCLES[e.pattern]) PATTERN_MUSCLES[e.pattern] = e.muscles;

export function ExerciseAnimation({
  pattern,
  className,
  playing = true,
  still,
  muscles,
  look = 'flat',
}: {
  look?: 'flat' | '3d';
  pattern: AnimPattern;
  className?: string;
  playing?: boolean;
  /** Muskelbeteiligung zum Hervorheben; Standard aus der Übungsdatenbank */
  muscles?: MMap;
  /** feste Pose 0 (Start) … 1 (Endposition), z. B. für Icons */
  still?: number;
}) {
  const spec = SPECS[pattern] ?? SPECS.curl;
  const [p, setP] = useState(still ?? 0.5);
  const ref = useRef<SVGSVGElement>(null);
  const glow = 'glow' + useId().replace(/:/g, '');
  useEffect(() => {
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!playing || reduce || still != null) {
      setP(still ?? 0.5);
      return;
    }
    let raf = 0;
    let visible = true;
    let last = 0;
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null;
    if (ref.current && io) io.observe(ref.current);
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || t - last < 33) return;
      last = t;
      const period = 2600;
      const x = (t % period) / period;
      // Konzentrisch schneller, exzentrisch langsamer
      const ph = x < 0.4 ? 0.5 - 0.5 * Math.cos((x / 0.4) * Math.PI) : 0.5 + 0.5 * Math.cos(((x - 0.4) / 0.6) * Math.PI);
      setP(ph);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [playing, pattern, still]);
  const pose = mix(spec.a as Pose, spec.b as Pose, p);
  const mm = muscles ?? PATTERN_MUSCLES[pattern] ?? {};
  return (
    <svg ref={ref} viewBox="0 0 120 100" className={className} role="img" aria-label="Animierte Ausführung">
      <defs>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <Look3D.Provider value={look === '3d'}>
        {look === '3d' && (
          <>
            <defs>
              <radialGradient id={glow + 'fl'} cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#000" stopOpacity="0.55" />
                <stop offset="1" stopColor="#000" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx={60} cy={95} rx={38} ry={4.5} fill={`url(#${glow}fl)`} />
          </>
        )}
        {pose.view === 'side' ? (
          <Side p={pose as SidePose} spec={spec} glow={glow} m={mm} />
        ) : (
          <Front p={pose as FrontPose} spec={spec} glow={glow} m={mm} />
        )}
      </Look3D.Provider>
    </svg>
  );
}

/** Kompaktes Übungs-Icon: 3D-Render, falls vorhanden, sonst statische Figur mit hervorgehobenem Zielmuskel */
export function ExerciseIcon({ pattern, size = 44, className, muscles, id }: { pattern: AnimPattern; size?: number; className?: string; muscles?: MMap; id?: string }) {
  const src = exerciseImage(id);
  return (
    <div
      className={'relative shrink-0 overflow-hidden rounded-[14px] ring-1 ring-line/[0.07] ' + (src ? '' : 'bg-[radial-gradient(circle_at_50%_35%,rgb(var(--raised)),rgb(var(--bg)))] ') + (className ?? '')}
      style={{ width: size, height: size, background: src ? IMAGE_BG : undefined }}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" draggable={false} className="h-full w-full scale-[1.12] object-cover" />
      ) : (
        <ExerciseAnimation pattern={pattern} still={0.85} muscles={muscles} className="h-full w-full scale-[1.3]" />
      )}
    </div>
  );
}
