import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { useStore } from './store';
import type { AppData } from './types';
import { buildPlan } from '../engine/planner';
import { computeAllStates, eventsFromSessions } from '../engine/fatigue';

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
    [s.sessions, s.availability, s.planOptions, s.exercises, s.settings, s.profile, s.checkIns, b],
  );
}

export function useMuscleStates() {
  const s = useStore();
  const now = useNow();
  const b = bucket(now);
  return useMemo(() => {
    const events = eventsFromSessions(
      s.sessions.filter((x) => x.status === 'done' || x.status === 'active'),
      s.exercises,
    );
    return { events, states: computeAllStates(events, Date.now(), s.checkIns) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.sessions, s.exercises, s.checkIns, b]);
}

// ───── Toast ─────
export const useToast = create<{ msg: string | null; show: (m: string) => void }>((set) => ({
  msg: null,
  show: (m) => {
    set({ msg: m });
    setTimeout(() => set((s) => (s.msg === m ? { msg: null } : s)), 2400);
  },
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
  | 'wissenschaft';

const ROUTES: Route[] = ['uebersicht', 'training', 'kalender', 'uebungen', 'muskeln', 'fortschritt', 'ernaehrung', 'profil', 'wissenschaft'];

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
