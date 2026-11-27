import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Exercise, Settings } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const DAY = 86_400_000;
export const HOUR = 3_600_000;

/** Lokales Datum als YYYY-MM-DD */
export function dateKey(d: Date | number = new Date()): string {
  const x = typeof d === 'number' ? new Date(d) : d;
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseKey(a).getTime() - parseKey(b).getTime()) / DAY);
}

export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function weekdayOf(key: string): number {
  return parseKey(key).getDay();
}

/** Sonntag der aktuellen (Mo–So) Woche */
export function endOfWeek(key: string): string {
  const wd = weekdayOf(key);
  return addDays(key, wd === 0 ? 0 : 7 - wd);
}

export function startOfWeek(key: string): string {
  const wd = weekdayOf(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

export function relDayLabel(key: string, today = dateKey()): string {
  const d = diffDays(key, today);
  if (d === 0) return 'Heute';
  if (d === 1) return 'Morgen';
  if (d === -1) return 'Gestern';
  if (d === 2) return 'Übermorgen';
  return `${WEEKDAYS_LONG[weekdayOf(key)]}, ${fmtDate(key)}`;
}

export function fmtDate(key: string, withYear = false): string {
  const d = parseKey(key);
  return `${d.getDate()}.${d.getMonth() + 1}.${withYear ? d.getFullYear() : ''}`;
}

export function fmtShortDay(key: string): string {
  return `${WEEKDAYS_SHORT[weekdayOf(key)]} ${fmtDate(key)}`;
}

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '–';
  return n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtKg(n: number | null | undefined): string {
  if (n == null) return '–';
  return `${fmtNum(n, 2)} kg`;
}

export function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

/** Epley-Formel, Wiederholungen inkl. RIR als Annäherung an Wiederholungen bis Versagen */
export function e1rm(weight: number, reps: number, rir: number | null = null): number {
  const r = reps + Math.min(rir ?? 0, 4);
  if (r <= 1) return weight;
  return weight * (1 + r / 30);
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Verfügbare Gewichtsstufen einer Übung */
export function weightSteps(ex: Exercise, s: Settings): { list?: number[]; step: number } {
  if (ex.weights && ex.weights.length) return { list: [...ex.weights].sort((a, b) => a - b), step: 0 };
  // Unterwegs: nur was du dabei hast – Flasche(n) und deine eine Hantel
  if (ex.location === 'home') {
    const b = s.homeBottle || 1;
    const h = s.homeDumbbell || 10;
    const base = ex.equipment === 'bodyweight' ? [0] : [];
    return { list: [...new Set([...base, b, 2 * b, h])].sort((x, y) => x - y), step: 0 };
  }
  if (ex.increment) return { step: ex.increment };
  switch (ex.equipment) {
    case 'dumbbell':
      return { list: [...s.dumbbellWeights].sort((a, b) => a - b), step: 0 };
    case 'cable':
      return { step: s.cableStep };
    case 'plate':
      return { step: s.plateStep };
    case 'barbell':
      return { step: s.barbellStep };
    case 'bodyweight':
      return { step: 2.5 };
    default:
      return { step: s.machineStep };
  }
}

export function nextWeight(current: number, ex: Exercise, s: Settings): number {
  const { list, step } = weightSteps(ex, s);
  if (list) {
    const n = list.find((w) => w > current + 1e-6);
    return n ?? current;
  }
  return r2(Math.floor(current / step + 1e-6) * step + step);
}

export function prevWeight(current: number, ex: Exercise, s: Settings): number {
  const { list, step } = weightSteps(ex, s);
  if (list) {
    const below = list.filter((w) => w < current - 1e-6);
    return below.length ? below[below.length - 1] : current;
  }
  const v = r2(Math.ceil(current / step - 1e-6) * step - step);
  return v > 0 ? v : current;
}

/** Rundet auf nächste verfügbare Stufe */
export function snapWeight(w: number, ex: Exercise, s: Settings): number {
  const { list, step } = weightSteps(ex, s);
  if (list) {
    return list.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best), list[0] ?? w);
  }
  return r2(Math.round(w / step) * step);
}

export function downloadFile(name: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

/** Geplante Trainingsdauer eines Tages: eigene Einstellung für den Tag, sonst Standarddauer */
export function minutesFor(data: { planOptions: { todayMinutes: { date: string; minutes: number } | null; dayMinutes?: Record<string, number> }; settings: { defaultMinutes: number } }, date: string): number {
  const po = data.planOptions;
  if (po.todayMinutes && po.todayMinutes.date === date) return po.todayMinutes.minutes;
  return po.dayMinutes?.[date] ?? data.settings.defaultMinutes;
}

/** Dauer lesbar: 45 min · 1 h · 1 h 26 min */
export function fmtMin(min: number | null | undefined): string {
  if (min == null || !isFinite(min)) return '–';
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
