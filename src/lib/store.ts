import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { produce } from 'immer';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { Activity, AppData, Availability, BodyEntry, CheckIn, Exercise, FoodEntry, Session, SessionExercise, SetLog } from './types';
import { DEFAULT_EXERCISES } from '../data/exercises';
import { DEFAULT_PRIORITIES } from './muscles';
import { addDays, dateKey, endOfWeek, uid } from './utils';
import { optimalSetsFor, type PlannedSession } from '../engine/planner';
import { calibrateTime, computeVolumeAdjust } from '../engine/adapt';
import { adviseExercise } from '../engine/progression';

const DATA_VERSION = 3;
/** Pausenzeiten vor Version 2 – werden nur ersetzt, wenn sie unverändert vom Standard sind */
/** Standard-Pausenzeiten früherer Versionen – nur unveränderte Werte werden auf den neuen Standard gesetzt */
const REST_V1: Record<string, number> = {"preacher-curl": 90, "hammer-curl": 90, "bayesian-curl": 90, "db-curl": 90, "overhead-ext": 90, "pushdown": 75, "dip-machine": 120, "incline-press": 150, "chest-press": 150, "butterfly": 90, "lat-pulldown": 120, "chest-supported-row": 120, "cable-row": 120, "cable-lateral": 75, "db-lateral": 75, "reverse-cable-fly": 75, "shoulder-press": 150, "leg-press": 180, "seated-leg-curl": 90, "leg-extension": 90, "rdl": 180, "calf-raise": 60, "cable-crunch": 60, "ab-machine": 60, "reverse-butterfly": 75};
const REST_V2: Record<string, number> = {"preacher-curl": 90, "hammer-curl": 90, "bayesian-curl": 90, "db-curl": 90, "overhead-ext": 90, "pushdown": 90, "dip-machine": 150, "incline-press": 180, "chest-press": 180, "butterfly": 120, "lat-pulldown": 150, "chest-supported-row": 150, "cable-row": 150, "cable-lateral": 90, "db-lateral": 90, "reverse-cable-fly": 90, "shoulder-press": 150, "leg-press": 180, "seated-leg-curl": 120, "leg-extension": 120, "rdl": 180, "calf-raise": 90, "cable-crunch": 75, "ab-machine": 75, "reverse-butterfly": 90};

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
      maxSessionsPerWeek: 4,
      maxConsecutive: 3,
      defaultMinutes: 90,
      orderMode: 'priority',
      autoSuperset: true,
      homeDumbbell: 7.5,
      homeDumbbellSet: true,
      homeBottle: 1,
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
    activities: [],
    awayDays: [],
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
    activities: raw.activities ?? [],
    awayDays: raw.awayDays ?? [],
    version: DATA_VERSION,
  };
  if (!d.profile.name) d.profile.name = 'Dominic';
  // Migration v3: studienbasierte Pausenzeiten (Mehrgelenk 3 min, Isolation 2 min, kleine Muskeln 90 s)
  // für alle Standardübungen, deren Pause noch dem alten Standard entspricht (selbst geänderte bleiben)
  const fromVersion = raw.version ?? 1;
  if (fromVersion < 3 && raw.settings?.defaultMinutes === 75) d.settings.defaultMinutes = 90;
  if (fromVersion < 3) {
    d.exercises = d.exercises.map((x) => {
      const def = DEFAULT_EXERCISES.find((e) => e.id === x.id);
      if (!def || x.custom) return x;
      const untouched = (fromVersion < 2 && REST_V1[x.id] === x.restSec) || REST_V2[x.id] === x.restSec;
      return untouched ? { ...x, restSec: def.restSec } : x;
    });
  }
  // Heim-Hantel: deine Hantel wiegt 7,5 kg (Angabe vom 27.11.) – alter Standard 10 kg einmalig korrigiert, eigene Werte bleiben
  if (!raw.settings?.homeDumbbellSet) {
    if ((raw.settings?.homeDumbbell ?? 10) === 10) d.settings.homeDumbbell = 7.5;
    d.settings.homeDumbbellSet = true;
  }
  // Bestehende Nutzer nicht erneut durch das Onboarding schicken
  if (raw.settings && raw.settings.onboarded === undefined && (raw.sessions?.length ?? 0) > 0) d.settings.onboarded = true;
  // Latzug: Gerät statt Griff im Namen (dein Studio: Selection 900 mit breitem Griff); eigene Umbenennungen bleiben
  d.exercises = d.exercises.map((x) => {
    if (x.id !== 'lat-pulldown' || x.custom || x.name !== 'Latzug mit neutralem Griff') return x;
    const def = DEFAULT_EXERCISES.find((e) => e.id === x.id)!;
    return { ...x, name: def.name, cues: def.cues };
  });
  // Gerätestufen aus den Standardübungen übernehmen, solange keine eigenen eingetragen sind
  d.exercises = d.exercises.map((x) => {
    const def = DEFAULT_EXERCISES.find((e) => e.id === x.id);
    return def?.weights && !x.weights?.length && !x.custom ? { ...x, weights: [...def.weights] } : x;
  });
  // neue Standardübungen ergänzen, falls sie fehlen
  for (const e of DEFAULT_EXERCISES) {
    const ex = d.exercises.find((x) => x.id === e.id);
    if (!ex) d.exercises.push({ ...e });
    else if (e.benefit && ex.benefit !== e.benefit && !ex.custom) d.exercises = d.exercises.map((x) => (x.id === e.id ? { ...x, benefit: e.benefit } : x));
  }
  // Seitheben: Arme einzeln erfassen (einmalig, eigene Einstellung bleibt danach erhalten)
  d.exercises = d.exercises.map((x) => {
    const def = DEFAULT_EXERCISES.find((e) => e.id === x.id);
    let y = def?.unilateral && x.unilateral === undefined ? { ...x, unilateral: true } : x;
    if (def && !x.custom && y.region !== def.region) y = { ...y, region: def.region };
    // Übungen ohne Gym immer auf aktuellen Stand bringen (z. B. Rucksack → Hantel/Flaschen), Favorit/Sperre bleiben
    if (def?.location === 'home' && !x.custom) y = { ...def, favorite: x.favorite, locked: x.locked, linkSides: x.linkSides, weights: x.weights };
    return y;
  });
  return d;
}

type Mut = (d: AppData) => void;

interface Store extends AppData {
  hydrated: boolean;
  mutate: (fn: Mut) => void;
  replaceAll: (data: AppData) => void;
  // Verfügbarkeit
  setAvailability: (date: string, a: Availability | null) => void;
  /** Tag ohne Gym an/aus */
  setAway: (date: string, away: boolean) => void;
  // Training
  startSession: (plan: PlannedSession | null, title?: string, location?: 'home') => string;
  updateSet: (sessionId: string, exUid: string, setId: string, patch: Partial<SetLog>) => void;
  /** Gewicht setzen und in alle folgenden, noch offenen Sätze übernehmen */
  setWeightFrom: (sessionId: string, exUid: string, setId: string, weight: number | null) => void;
  addSet: (sessionId: string, exUid: string) => void;
  removeSet: (sessionId: string, exUid: string, setId: string) => void;
  patchExercise: (sessionId: string, exUid: string, patch: Partial<SessionExercise>) => void;
  /** Übung im Training entfernen (nicht geschafft) bzw. wiederherstellen */
  missExercise: (sessionId: string, exUid: string, undo?: boolean) => void;
  /** „Zeit übrig“: offene Sätze je Übung auf keep kürzen, Rest als ausgelassen dokumentieren */
  trimSession: (sessionId: string, keep: Record<string, number>) => void;
  addExerciseToSession: (sessionId: string, exercise: Exercise, afterUid?: string, sets?: number) => void;
  /**
   * Übung tauschen. Bereits erledigte Sätze bleiben bei der bisherigen Übung (eigene Historie/Empfehlung);
   * nur die offenen Sätze wandern in eine neue Zeile mit der neuen Übung. Gibt die uid der Zeile mit der neuen Übung zurück.
   */
  swapExercise: (sessionId: string, exUid: string, exercise: Exercise) => string;
  /** „Gerät besetzt – später“: Übung ans Ende der Einheit verschieben */
  deferExercise: (sessionId: string, exUid: string) => void;
  moveExercise: (sessionId: string, exUid: string, dir: -1 | 1) => void;
  finishSession: (sessionId: string, prs: string[]) => void;
  runAdaptation: () => void;
  discardSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  // Sonstiges
  saveCheckIn: (date: string, c: CheckIn) => void;
  addBody: (e: Omit<BodyEntry, 'id'>) => void;
  removeBody: (id: string) => void;
  addActivity: (a: Omit<Activity, 'id'>) => void;
  removeActivity: (id: string) => void;
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
            // ohne Zeit bzw. unklar → kein „ohne Gym“-Vermerk mehr
            if (a !== 'yes') d.awayDays = (d.awayDays ?? []).filter((x) => x !== date);
          }),
        setAway: (date, away) =>
          mutate((d) => {
            d.awayDays = (d.awayDays ?? []).filter((x) => x !== date);
            if (away) {
              d.awayDays.push(date);
              d.availability[date] = 'yes';
            }
          }),
        startSession: (plan, title, location) => {
          const id = uid();
          const ex = new Map(get().exercises.map((e) => [e.id, e]));
          const session: Session = {
            id,
            date: dateKey(),
            startedAt: Date.now(),
            status: 'active',
            title: title ?? plan?.label ?? 'Freies Training',
            location: location ?? (plan?.home ? 'home' : undefined),
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
                why: p.why,
                adviceType: p.advice.type,
                lastWeight: p.advice.lastWeight,
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
            if (!st) return;
            if (patch.done === true && !st.done) st.doneAt = Date.now();
            if (patch.done === false) st.doneAt = undefined;
            Object.assign(st, patch);
          }),
        setWeightFrom: (sid, xu, setId, weight) =>
          mutSession(sid, (s) => {
            const se = s.exercises.find((e) => e.uid === xu);
            if (!se) return;
            const i = se.sets.findIndex((x) => x.id === setId);
            if (i < 0) return;
            se.sets[i].weight = weight;
            for (let k = i + 1; k < se.sets.length; k++) if (!se.sets[k].done) se.sets[k].weight = weight;
          }),
        addSet: (sid, xu) =>
          mutSession(sid, (s) => {
            const se = s.exercises.find((e) => e.uid === xu);
            if (!se) return;
            const last = se.sets[se.sets.length - 1];
            se.sets.push({ id: uid(), weight: last?.weight ?? se.recWeight, reps: last?.reps ?? null, repsL: last?.repsL, repsR: last?.repsR, rir: last?.rir ?? se.targetRir, failure: false, done: false, note: '' });
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
        trimSession: (sid, keep) =>
          mutSession(sid, (s) => {
            for (const se of s.exercises) {
              if (!(se.uid in keep) || se.skipped) continue;
              const open = se.sets.filter((x) => !x.done);
              const cut = open.length - Math.max(0, keep[se.uid]);
              if (cut <= 0) continue;
              const drop = new Set(open.slice(open.length - cut).map((x) => x.id));
              se.sets = se.sets.filter((x) => !drop.has(x.id));
              se.missed = (se.missed ?? 0) + cut;
              if (!se.sets.some((x) => x.done) && !se.sets.length) se.skipped = true;
            }
          }),
        missExercise: (sid, xu, undo) =>
          mutSession(sid, (s) => {
            const se = s.exercises.find((e) => e.uid === xu);
            if (!se) return;
            if (undo) {
              const n = se.missed ?? 0;
              const last = se.sets[se.sets.length - 1];
              for (let i = 0; i < n; i++)
                se.sets.push({ id: uid(), weight: last?.weight ?? se.recWeight, reps: last?.reps ?? null, rir: last?.rir ?? se.targetRir, failure: false, done: false, note: '' });
              se.missed = undefined;
              se.skipped = false;
              return;
            }
            const open = se.sets.filter((x) => !x.done);
            if (!open.length) return;
            se.missed = open.length;
            if (se.sets.some((x) => x.done)) se.sets = se.sets.filter((x) => x.done);
            else se.skipped = true;
          }),
        addExerciseToSession: (sid, exercise, afterUid, setsOverride) =>
          {
            const opt0 = optimalSetsFor(get() as unknown as AppData, exercise, sid);
            const opt = setsOverride ? { ...opt0, sets: setsOverride, reason: 'Zusatzübung („Noch Zeit?“) – passend zu Plan und Erholung.' } : opt0;
            // Gewicht vom letzten Mal (bzw. empfohlene Steigerung) direkt eintragen
            const adv = adviseExercise(exercise, get().sessions.filter((x) => x.id !== sid), { settings: get().settings, checkIns: get().checkIns });
            mutSession(sid, (s) => {
            const se: SessionExercise = {
              uid: uid(),
              exerciseId: exercise.id,
              sets: emptySets(opt.sets, adv.weight, adv.repTarget, exercise.targetRir),
              setsReason: opt.reason,
              adviceText: adv.text,
              adviceType: adv.type,
              lastWeight: adv.lastWeight,
              repMin: exercise.repMin,
              repMax: adv.repMax ?? exercise.repMax,
              targetRir: exercise.targetRir,
              restSec: exercise.restSec,
              recWeight: adv.weight,
              skipped: false,
              note: '',
              reason: 'Manuell hinzugefügt',
            };
            const i = afterUid ? s.exercises.findIndex((e) => e.uid === afterUid) : -1;
            if (i >= 0) s.exercises.splice(i + 1, 0, se);
            else s.exercises.push(se);
          });
          },
        swapExercise: (sid, xu, exercise) => {
          const adv = adviseExercise(exercise, get().sessions.filter((x) => x.id !== sid), { settings: get().settings, checkIns: get().checkIns });
          let outUid = xu;
          mutSession(sid, (s) => {
            const i = s.exercises.findIndex((e) => e.uid === xu);
            const old = s.exercises[i];
            if (!old) return;
            const done = old.sets.filter((x) => x.done);
            const open = old.sets.filter((x) => !x.done);
            const oldName = get().exercises.find((e) => e.id === old.exerciseId)?.name;
            const fresh: SessionExercise = {
              uid: done.length ? uid() : old.uid,
              exerciseId: exercise.id,
              superset: done.length ? undefined : old.superset,
              repMin: exercise.repMin,
              repMax: adv.repMax ?? exercise.repMax,
              targetRir: exercise.targetRir,
              restSec: exercise.restSec,
              recWeight: adv.weight,
              adviceText: adv.text,
              adviceType: adv.type,
              lastWeight: adv.lastWeight,
              reason: oldName ? `Ausgetauscht (statt ${oldName})` : 'Ausgetauscht',
              // Satz-Begründung, Übungserklärung und Live-/Aufwärm-Status gehörten zur alten Übung
              skipped: false,
              note: '',
              // offene Sätze mit dem Gewicht vom letzten Mal (bzw. Empfehlung) und Ziel-Wiederholungen füllen
              sets: (open.length ? open : done.map(() => ({ id: uid(), weight: null, reps: null, rir: null, failure: false, done: false, note: '' }) as SetLog)).map((x) => ({
                ...x,
                weight: adv.weight,
                reps: adv.repTarget,
                rir: exercise.targetRir,
                repsL: undefined,
                repsR: undefined,
              })),
            };
            if (done.length) {
              // alte Übung behält ihre erledigten Sätze – als abgeschlossen
              old.sets = done;
              s.exercises.splice(i + 1, 0, fresh);
            } else s.exercises[i] = fresh;
            outUid = fresh.uid;
          });
          return outUid;
        },
        deferExercise: (sid, xu) =>
          mutSession(sid, (s) => {
            const i = s.exercises.findIndex((e) => e.uid === xu);
            if (i < 0) return;
            const [se] = s.exercises.splice(i, 1);
            s.exercises.push(se);
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
        addActivity: (a) =>
          mutate((d) => {
            d.activities.push({ ...a, id: uid() });
            d.activities.sort((x, y) => (x.date < y.date ? -1 : 1));
          }),
        removeActivity: (id) =>
          mutate((d) => {
            d.activities = d.activities.filter((x) => x.id !== id);
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
      // Ältere Speicherstände unverändert übernehmen – die eigentliche Migration passiert in merge()/migrate()
      migrate: (persisted) => persisted as Store,
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
  minutesToday: (m: number | null) => quick.dayMinutes(dateKey(), m),
  /** Tag bei Konflikt bevorzugen (z. B. lieber Mittwoch statt heute) */
  preferDay: (date: string, on = true) =>
    useStore.getState().mutate((d) => {
      const today = dateKey();
      const set = new Set((d.planOptions.preferDates ?? []).filter((x) => x >= today));
      if (on) set.add(date);
      else set.delete(date);
      d.planOptions.preferDates = [...set];
      d.availability[date] = 'yes';
    }),
  /** Trainingsdauer für einen Tag setzen (null = Standarddauer) */
  dayMinutes: (date: string, m: number | null) =>
    useStore.getState().mutate((d) => {
      const dm = { ...(d.planOptions.dayMinutes ?? {}) };
      if (m == null || m === d.settings.defaultMinutes) delete dm[date];
      else dm[date] = m;
      // alte Einträge aufräumen
      const today = dateKey();
      for (const k of Object.keys(dm)) if (k < today) delete dm[k];
      d.planOptions.dayMinutes = dm;
      if (date === today) d.planOptions.todayMinutes = m == null ? null : { date, minutes: m };
    }),
  clearWeekCap: () =>
    useStore.getState().mutate((d) => {
      d.planOptions.weekCap = null;
    }),
};
