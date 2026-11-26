import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { produce } from 'immer';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { AppData, Availability, BodyEntry, CheckIn, Exercise, FoodEntry, Session, SessionExercise, SetLog } from './types';
import { DEFAULT_EXERCISES } from '../data/exercises';
import { DEFAULT_PRIORITIES } from './muscles';
import { addDays, dateKey, endOfWeek, uid } from './utils';
import { optimalSetsFor, type PlannedSession } from '../engine/planner';
import { calibrateTime, computeVolumeAdjust } from '../engine/adapt';

const DATA_VERSION = 1;

export function defaultData(): AppData {
  return {
    version: DATA_VERSION,
    profile: {
      name: 'Dominic',
      age: 29,
      weight: 74,
      height: 176,
      experience: 'advanced',
      gym: 'Clever Fit',
      goal: 'Maximaler Muskelaufbau',
      priorities: [...DEFAULT_PRIORITIES],
    },
    settings: {
      preferredDays: [3, 4, 5, 6, 0],
      sessionsPerWeek: 2,
      defaultMinutes: 75,
      orderMode: 'priority',
      autoSuperset: true,
      dumbbellWeights: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42.5, 45, 47.5, 50],
      cableStep: 2.5,
      machineStep: 5,
      plateStep: 5,
      barbellStep: 2.5,
      sound: true,
      vibrate: true,
      notifications: false,
      nutritionEnabled: true,
      onboarded: false,
      timeFactor: 1,
      timeSamples: 0,
      targets: { kcalMin: 2800, kcalMax: 3000, protein: 150, creatine: 5, sleepMin: 7, sleepMax: 9 },
      supabase: { url: '', anonKey: '', autoSync: false },
    },
    exercises: DEFAULT_EXERCISES.map((e) => ({ ...e })),
    sessions: [],
    availability: {},
    planOptions: { uncertain: false, weekCap: null, todayMinutes: null },
    checkIns: {},
    body: [{ id: uid(), date: dateKey(), weight: 74 }],
    nutrition: {},
    timer: null,
    volumeAdjust: {},
    updatedAt: Date.now(),
  };
}

// ───────────── IndexedDB-Speicher mit LocalStorage-Fallback ─────────────
const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const v = await idbGet<string>(name);
      if (v != null) return v;
    } catch {
      /* IndexedDB nicht verfügbar */
    }
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await idbSet(name, value);
      return;
    } catch {
      /* Fallback */
    }
    try {
      localStorage.setItem(name, value);
    } catch {
      /* Speicher voll oder blockiert */
    }
  },
  removeItem: async (name) => {
    try {
      await idbDel(name);
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

/** Migriert ältere oder importierte Daten auf das aktuelle Schema */
export function migrate(raw: Partial<AppData>): AppData {
  const def = defaultData();
  const d: AppData = {
    ...def,
    ...raw,
    profile: { ...def.profile, ...(raw.profile ?? {}) },
    settings: {
      ...def.settings,
      ...(raw.settings ?? {}),
      targets: { ...def.settings.targets, ...(raw.settings?.targets ?? {}) },
      supabase: { ...def.settings.supabase, ...(raw.settings?.supabase ?? {}) },
    },
    planOptions: { ...def.planOptions, ...(raw.planOptions ?? {}) },
    exercises: raw.exercises?.length ? raw.exercises : def.exercises,
    sessions: raw.sessions ?? [],
    availability: raw.availability ?? {},
    checkIns: raw.checkIns ?? {},
    body: raw.body ?? def.body,
    nutrition: raw.nutrition ?? {},
    volumeAdjust: raw.volumeAdjust ?? {},
    version: DATA_VERSION,
  };
  if (!d.profile.name) d.profile.name = 'Dominic';
  // Bestehende Nutzer nicht erneut durch das Onboarding schicken
  if (raw.settings && raw.settings.onboarded === undefined && (raw.sessions?.length ?? 0) > 0) d.settings.onboarded = true;
  // neue Standardübungen ergänzen, falls sie fehlen
  for (const e of DEFAULT_EXERCISES) if (!d.exercises.some((x) => x.id === e.id)) d.exercises.push({ ...e });
  return d;
}

type Mut = (d: AppData) => void;

interface Store extends AppData {
  hydrated: boolean;
  mutate: (fn: Mut) => void;
  replaceAll: (data: AppData) => void;
  // Verfügbarkeit
  setAvailability: (date: string, a: Availability | null) => void;
  // Training
  startSession: (plan: PlannedSession | null, title?: string) => string;
  updateSet: (sessionId: string, exUid: string, setId: string, patch: Partial<SetLog>) => void;
  addSet: (sessionId: string, exUid: string) => void;
  removeSet: (sessionId: string, exUid: string, setId: string) => void;
  patchExercise: (sessionId: string, exUid: string, patch: Partial<SessionExercise>) => void;
  addExerciseToSession: (sessionId: string, exercise: Exercise, afterUid?: string) => void;
  swapExercise: (sessionId: string, exUid: string, exercise: Exercise) => void;
  moveExercise: (sessionId: string, exUid: string, dir: -1 | 1) => void;
  finishSession: (sessionId: string, prs: string[]) => void;
  runAdaptation: () => void;
  discardSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  // Sonstiges
  saveCheckIn: (date: string, c: CheckIn) => void;
  addBody: (e: Omit<BodyEntry, 'id'>) => void;
  removeBody: (id: string) => void;
  addFood: (date: string, f: Omit<FoodEntry, 'id'>) => void;
  removeFood: (date: string, id: string) => void;
  setCreatine: (date: string, v: boolean) => void;
  setSleep: (date: string, h: number | undefined) => void;
  startTimer: (sec: number, label: string) => void;
  stopTimer: () => void;
  adjustTimer: (sec: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
}

function emptySets(n: number, weight: number | null, reps: number | null = null, rir: number | null = null): SetLog[] {
  return Array.from({ length: n }, () => ({ id: uid(), weight, reps, rir, failure: false, done: false, note: '' }));
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const mutate = (fn: Mut) =>
        set((s) =>
          produce(s, (draft) => {
            fn(draft as unknown as AppData);
            draft.updatedAt = Date.now();
          }),
        );
      const mutSession = (id: string, fn: (s: Session) => void) =>
        mutate((d) => {
          const s = d.sessions.find((x) => x.id === id);
          if (s) fn(s);
        });
      return {
        ...defaultData(),
        hydrated: false,
        mutate,
        replaceAll: (data) => set({ ...migrate(data), updatedAt: Date.now() }),
        setAvailability: (date, a) =>
          mutate((d) => {
            if (a == null) delete d.availability[date];
            else d.availability[date] = a;
          }),
        startSession: (plan, title) => {
          const id = uid();
          const ex = new Map(get().exercises.map((e) => [e.id, e]));
          const session: Session = {
            id,
            date: dateKey(),
            startedAt: Date.now(),
            status: 'active',
            title: title ?? plan?.label ?? 'Freies Training',
            split: plan?.templateId ?? 'custom',
            plannedMinutes: plan?.minutes ?? get().settings.defaultMinutes,
            estMinutes: plan?.estMinutes,
            plannedSets: plan ? plan.exercises.reduce((a, p) => a + p.sets, 0) : undefined,
            readiness: plan?.readiness ?? null,
            exercises: (plan?.exercises ?? [])
              .filter((p) => ex.has(p.exerciseId))
              .map((p) => ({
                uid: uid(),
                exerciseId: p.exerciseId,
                sets: emptySets(p.sets, p.recWeight, p.advice.repTarget, p.targetRir),
                repMin: p.repMin,
                repMax: p.repMax,
                targetRir: p.targetRir,
                restSec: p.restSec,
                recWeight: p.recWeight,
                skipped: false,
                note: '',
                superset: p.superset,
                reason: p.reason,
                adviceText: p.advice.text,
                setsReason: p.setsReason,
              })),
          };
          mutate((d) => {
            d.sessions = d.sessions.filter((s) => s.status !== 'active');
            d.sessions.push(session);
          });
          return id;
        },
        updateSet: (sid, xu, setId, patch) =>
          mutSession(sid, (s) => {
            const se = s.exercises.find((e) => e.uid === xu);
            const st = se?.sets.find((x) => x.id === setId);
            if (st) Object.assign(st, patch);
          }),
        addSet: (sid, xu) =>
          mutSession(sid, (s) => {
            const se = s.exercises.find((e) => e.uid === xu);
            if (!se) return;
            const last = se.sets[se.sets.length - 1];
            se.sets.push({ id: uid(), weight: last?.weight ?? se.recWeight, reps: last?.reps ?? null, rir: last?.rir ?? se.targetRir, failure: false, done: false, note: '' });
          }),
        removeSet: (sid, xu, setId) =>
          mutSession(sid, (s) => {
            const se = s.exercises.find((e) => e.uid === xu);
            if (se) se.sets = se.sets.filter((x) => x.id !== setId);
          }),
        patchExercise: (sid, xu, patch) =>
          mutSession(sid, (s) => {
            const se = s.exercises.find((e) => e.uid === xu);
            if (se) Object.assign(se, patch);
          }),
        addExerciseToSession: (sid, exercise, afterUid) =>
          {
            const opt = optimalSetsFor(get() as unknown as AppData, exercise, sid);
            mutSession(sid, (s) => {
            const se: SessionExercise = {
              uid: uid(),
              exerciseId: exercise.id,
              sets: emptySets(opt.sets, null, Math.round((exercise.repMin + exercise.repMax) / 2), exercise.targetRir),
              setsReason: opt.reason,
              repMin: exercise.repMin,
              repMax: exercise.repMax,
              targetRir: exercise.targetRir,
              restSec: exercise.restSec,
              recWeight: null,
              skipped: false,
              note: '',
              reason: 'Manuell hinzugefügt',
            };
            const i = afterUid ? s.exercises.findIndex((e) => e.uid === afterUid) : -1;
            if (i >= 0) s.exercises.splice(i + 1, 0, se);
            else s.exercises.push(se);
          });
          },
        swapExercise: (sid, xu, exercise) =>
          mutSession(sid, (s) => {
            const se = s.exercises.find((e) => e.uid === xu);
            if (!se) return;
            se.exerciseId = exercise.id;
            se.repMin = exercise.repMin;
            se.repMax = exercise.repMax;
            se.restSec = exercise.restSec;
            se.recWeight = null;
            se.adviceText = undefined;
            se.reason = 'Ausgetauscht';
            se.sets = se.sets.map((x) => (x.done ? x : { ...x, weight: null }));
          }),
        moveExercise: (sid, xu, dir) =>
          mutSession(sid, (s) => {
            const i = s.exercises.findIndex((e) => e.uid === xu);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= s.exercises.length) return;
            [s.exercises[i], s.exercises[j]] = [s.exercises[j], s.exercises[i]];
          }),
        finishSession: (sid, prs) => {
          const before = get().sessions.find((x) => x.id === sid);
          const now = Date.now();
          if (before) {
            const cal = calibrateTime(before, get().settings.timeFactor || 1, get().settings.timeSamples || 0, now);
            if (cal.ratio != null)
              mutate((d) => {
                d.settings.timeFactor = cal.factor;
                d.settings.timeSamples = cal.samples;
              });
          }
          mutSession(sid, (s) => {
            s.status = 'done';
            s.endedAt = Date.now();
            s.prs = prs;
            // leere Sätze entfernen
            s.exercises.forEach((e) => (e.sets = e.sets.filter((x) => x.done)));
            s.exercises = s.exercises.filter((e) => e.sets.length || e.skipped);
          });
          get().runAdaptation();
        },
        runAdaptation: () => {
          const { map } = computeVolumeAdjust(get() as unknown as AppData);
          mutate((d) => {
            d.volumeAdjust = map;
          });
        },
        discardSession: (sid) =>
          mutate((d) => {
            d.sessions = d.sessions.filter((s) => s.id !== sid);
            d.timer = null;
          }),
        deleteSession: (sid) =>
          mutate((d) => {
            d.sessions = d.sessions.filter((s) => s.id !== sid);
          }),
        saveCheckIn: (date, c) =>
          mutate((d) => {
            d.checkIns[date] = c;
          }),
        addBody: (e) =>
          mutate((d) => {
            const existing = d.body.find((b) => b.date === e.date);
            if (existing) Object.assign(existing, Object.fromEntries(Object.entries(e).filter(([, v]) => v != null && v !== '')));
            else d.body.push({ ...e, id: uid() });
            d.body.sort((a, b) => (a.date < b.date ? -1 : 1));
            const latest = [...d.body].reverse().find((b) => b.weight);
            if (latest?.weight) d.profile.weight = latest.weight;
          }),
        removeBody: (id) =>
          mutate((d) => {
            d.body = d.body.filter((b) => b.id !== id);
          }),
        addFood: (date, f) =>
          mutate((d) => {
            d.nutrition[date] ??= { entries: [], creatine: false };
            d.nutrition[date].entries.push({ ...f, id: uid() });
          }),
        removeFood: (date, id) =>
          mutate((d) => {
            const n = d.nutrition[date];
            if (n) n.entries = n.entries.filter((e) => e.id !== id);
          }),
        setCreatine: (date, v) =>
          mutate((d) => {
            d.nutrition[date] ??= { entries: [], creatine: false };
            d.nutrition[date].creatine = v;
          }),
        setSleep: (date, h) =>
          mutate((d) => {
            d.nutrition[date] ??= { entries: [], creatine: false };
            d.nutrition[date].sleep = h;
          }),
        startTimer: (sec, label) => set({ timer: { endsAt: Date.now() + sec * 1000, total: sec, label } }),
        stopTimer: () => set({ timer: null }),
        adjustTimer: (sec) =>
          set((s) =>
            s.timer
              ? {
                  timer: {
                    ...s.timer,
                    endsAt: s.timer.endsAt + sec * 1000,
                    total: Math.max(5, s.timer.total + sec),
                    pausedLeft: s.timer.pausedLeft != null ? Math.max(0, s.timer.pausedLeft + sec) : undefined,
                  },
                }
              : {},
          ),
        pauseTimer: () =>
          set((s) => (s.timer && s.timer.pausedLeft == null ? { timer: { ...s.timer, pausedLeft: Math.max(0, (s.timer.endsAt - Date.now()) / 1000) } } : {})),
        resumeTimer: () =>
          set((s) =>
            s.timer && s.timer.pausedLeft != null ? { timer: { ...s.timer, endsAt: Date.now() + s.timer.pausedLeft * 1000, pausedLeft: undefined } } : {},
          ),
      };
    },
    {
      name: 'stimulus-data',
      version: DATA_VERSION,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => {
        const { hydrated, ...rest } = s;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) if (typeof v !== 'function') out[k] = v;
        return out as unknown as Store;
      },
      merge: (persisted, current) => ({ ...current, ...migrate((persisted ?? {}) as Partial<AppData>) }),
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

export function exportData(): AppData {
  const s = useStore.getState();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (typeof v !== 'function' && k !== 'hydrated') out[k] = v;
  return out as unknown as AppData;
}

// ───────────── Schnellaktionen Verfügbarkeit ─────────────
export const quick = {
  today: () => useStore.getState().setAvailability(dateKey(), 'yes'),
  tomorrow: () => useStore.getState().setAvailability(addDays(dateKey(), 1), 'yes'),
  sunday: () => {
    const t = dateKey();
    useStore.getState().setAvailability(endOfWeek(t), 'yes');
  },
  onlyOnceThisWeek: () =>
    useStore.getState().mutate((d) => {
      d.planOptions.weekCap = { count: 1, until: endOfWeek(dateKey()) };
    }),
  twoInARow: () =>
    useStore.getState().mutate((d) => {
      const t = dateKey();
      // nächste zwei aufeinanderfolgende Tage, die nicht als "nein" markiert sind
      for (let i = 0; i < 7; i++) {
        const a = addDays(t, i);
        const b = addDays(t, i + 1);
        if (d.availability[a] !== 'no' && d.availability[b] !== 'no') {
          d.availability[a] = 'yes';
          d.availability[b] = 'yes';
          break;
        }
      }
    }),
  toggleUncertain: () =>
    useStore.getState().mutate((d) => {
      d.planOptions.uncertain = !d.planOptions.uncertain;
    }),
  minutesToday: (m: number | null) =>
    useStore.getState().mutate((d) => {
      d.planOptions.todayMinutes = m == null ? null : { date: dateKey(), minutes: m };
    }),
  clearWeekCap: () =>
    useStore.getState().mutate((d) => {
      d.planOptions.weekCap = null;
    }),
};
