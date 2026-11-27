import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { useStore } from './store';
import type { AppData, MuscleId } from './types';
import { buildPlan, personalTarget } from '../engine/planner';
import { computeAllStates } from '../engine/fatigue';
import { allEvents } from '../engine/activities';

export function useData(): AppData {
  const s = useStore();
  return s as unknown as AppData;
}

/** Aktuelle Zeit, aktualisiert jede Minute (für Regenerationsschätzungen) */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function bucket(now: number) {
  return Math.floor(now / 300_000); // 5-Minuten-Raster für stabile Memoisierung
}

export function usePlan() {
  const s = useStore();
  const now = useNow();
  const b = bucket(now);
  return useMemo(
    () => buildPlan(s as unknown as AppData, Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.sessions, s.availability, s.planOptions, s.exercises, s.settings, s.profile, s.checkIns, s.activities, s.awayDays, b],
  );
}

export function useMuscleStates() {
  const s = useStore();
  const now = useNow();
  const b = bucket(now);
  return useMemo(() => {
    const events = allEvents(s as unknown as AppData);
    return { events, states: computeAllStates(events, Date.now(), s.checkIns) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.sessions, s.exercises, s.checkIns, s.activities, b]);
}

// ───── Toast ─────
export const useToast = create<{ msg: string | null; show: (m: string) => void }>((set) => ({
  msg: null,
  show: (m) => {
    set({ msg: m });
    setTimeout(() => set((s) => (s.msg === m ? { msg: null } : s)), 2400);
  },
}));

/** Pop-up nach jedem Satz (blendet nach 3 s aus) */
export interface SetPopupData {
  tone: 'great' | 'good' | 'ok' | 'low' | 'light';
  title: string;
  line: string;
  hint?: string;
  exercise: string;
  set: number;
}
export const useSetPopup = create<{ data: SetPopupData | null; id: number; show: (d: SetPopupData) => void; hide: () => void }>((set, get) => ({
  data: null,
  id: 0,
  show: (d) => {
    const id = get().id + 1;
    set({ data: d, id });
    setTimeout(() => get().id === id && set({ data: null }), 3000);
  },
  hide: () => set({ data: null }),
}));

// ───── Routing über einfachen Hash ─────
export type Route =
  | 'uebersicht'
  | 'training'
  | 'kalender'
  | 'uebungen'
  | 'muskeln'
  | 'fortschritt'
  | 'ernaehrung'
  | 'profil'
  | 'wissenschaft'
  | 'statistik'
  | 'rueckblick';

const ROUTES: Route[] = ['uebersicht', 'training', 'kalender', 'uebungen', 'muskeln', 'fortschritt', 'ernaehrung', 'profil', 'wissenschaft', 'statistik', 'rueckblick'];

function readHash(): Route {
  const h = (typeof location !== 'undefined' ? location.hash.replace('#', '') : '') as Route;
  return ROUTES.includes(h) ? h : 'uebersicht';
}

export const useRouter = create<{ route: Route; go: (r: Route) => void }>((set) => ({
  route: readHash(),
  go: (r) => {
    try {
      if (location.hash !== '#' + r) location.hash = r;
    } catch {
      /* ignore */
    }
    set({ route: r });
    try {
      window.scrollTo({ top: 0 });
    } catch {
      /* ignore */
    }
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => useRouter.setState({ route: readHash() }));
}

// ───── Globale Suche ─────
export const useSearch = create<{ open: boolean; set: (v: boolean) => void }>((set) => ({ open: false, set: (v) => set({ open: v }) }));

// ───── Fokus-Modus anfordern (z. B. durch Tippen auf den Pausen-Timer) ─────
export const useFocusRequest = create<{ pending: boolean; request: () => void; consume: () => void }>((set) => ({
  pending: false,
  request: () => set({ pending: true }),
  consume: () => set({ pending: false }),
}));

// ───── Abschluss-Screen eines Trainings (global, überlebt das Beenden der Einheit) ─────
export const useCompletion = create<{ sessionId: string | null; prs: string[]; open: (id: string, prs?: string[]) => void; close: () => void }>((set) => ({
  sessionId: null,
  prs: [],
  open: (id, prs = []) => set({ sessionId: id, prs }),
  close: () => set({ sessionId: null, prs: [] }),
}));

// ───── Rekord-Feier direkt im Satz ─────
export const usePRCelebration = create<{ pr: { title: string; sub: string; exercise: string; key: number } | null; show: (p: { title: string; sub: string; exercise: string }) => void; hide: () => void }>((set) => ({
  pr: null,
  show: (p) => set({ pr: { ...p, key: Date.now() } }),
  hide: () => set({ pr: null }),
}));

/** Gemeinsames Wochenziel für alle Ansichten (Übersicht, Muskelanalyse, Wochenbilanz, Rückblick, Planbegründung) */
export function useGoals() {
  const plan = usePlan();
  const s = useStore();
  return useMemo(
    () => ({ spw: plan.spw, note: plan.goalNote, target: (m: MuscleId) => personalTarget(s as unknown as AppData, m, plan.spw) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan.spw, plan.goalNote, s.volumeAdjust, s.profile],
  );
}
