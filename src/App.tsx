import { useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarCheck,
  BookOpen,
  CalendarDays,
  Dumbbell,
  Gauge,
  LayoutGrid,
  LineChart,
  MoreHorizontal,
  PersonStanding,
  Salad,
  UserRound,
} from 'lucide-react';
import { useStore } from './lib/store';
import { useCompletion, useFocusNav, useRouter, useSearch, useToast, type Route } from './lib/hooks';
import { cn } from './lib/utils';
import { Sheet, Toast } from './components/ui';
import { RestTimer } from './components/RestTimer';
import Dashboard from './pages/Dashboard';
import Training from './pages/Training';
import CalendarPage from './pages/Calendar';
import ExercisesPage from './pages/Exercises';
import MusclesPage from './pages/Muscles';
import ProgressPage from './pages/Progress';
import NutritionPage from './pages/Nutrition';
import ProfilePage from './pages/Profile';
import SciencePage from './pages/Science';
import { useSupabaseAutoSync } from './lib/sync';
import { Logo } from './components/Logo';
import { StartScreen, shouldAutoOpen, useStartScreen } from './components/StartScreen';
import { SearchSheet } from './components/Search';
import type { AppData } from './lib/types';
import { useEffect } from 'react';
import { SessionComplete } from './components/SessionComplete';
import { PRCelebration } from './components/PRCelebration';
import { SetPopup } from './components/SetPopup';
import StatsPage from './pages/Stats';
import WeekReviewPage from './pages/WeekReview';

const NAV: { id: Route; label: string; icon: typeof Gauge }[] = [
  { id: 'uebersicht', label: 'Übersicht', icon: LayoutGrid },
  { id: 'training', label: 'Training', icon: Dumbbell },
  { id: 'kalender', label: 'Kalender', icon: CalendarDays },
  { id: 'uebungen', label: 'Übungen', icon: Activity },
  { id: 'muskeln', label: 'Muskelanalyse', icon: PersonStanding },
  { id: 'fortschritt', label: 'Fortschritt', icon: LineChart },
  { id: 'statistik', label: 'Statistiken', icon: BarChart3 },
  { id: 'rueckblick', label: 'Wochenrückblick', icon: CalendarCheck },
  { id: 'ernaehrung', label: 'Ernährung', icon: Salad },
  { id: 'profil', label: 'Profil', icon: UserRound },
];
const MOBILE_MAIN: Route[] = ['uebersicht', 'training', 'kalender', 'muskeln'];

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const active = useStore((s) => s.sessions.some((x) => x.status === 'active'));
  const nutritionEnabled = useStore((s) => s.settings.nutritionEnabled);
  const { route, go } = useRouter();
  const focusNav = useFocusNav((x) => x.show);
  const toast = useToast((s) => s.msg);
  const [more, setMore] = useState(false);
  const searchOpen = useSearch((x) => x.open);
  const setSearchOpen = useSearch((x) => x.set);
  const start = useStartScreen();
  useSupabaseAutoSync();
  useEffect(() => {
    if (hydrated && start.open === null) start.set(shouldAutoOpen(useStore.getState() as unknown as AppData));
    if (!hydrated) return;
    useStore.getState().runAdaptation();
    // Speicher als dauerhaft markieren (verhindert automatisches Löschen durch den Browser, v. a. auf iOS)
    try {
      navigator.storage?.persist?.().catch(() => {});
    } catch {
      /* ignore */
    }
    // App wird aus dem Hintergrund geholt (z. B. am nächsten Tag): neuen Tag erkennen und Verfügbarkeit erneut abfragen
    const onWake = () => {
      if (document.visibilityState !== 'visible') return;
      const d = useStore.getState() as unknown as AppData;
      if (shouldAutoOpen(d)) useStartScreen.getState().set(true);
      useStore.setState({}); // Neuberechnung mit aktuellem Datum anstoßen
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated)
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-transparent" />
      </div>
    );

  const nav = NAV.filter((n) => n.id !== 'ernaehrung' || nutritionEnabled);
  const Page = {
    uebersicht: Dashboard,
    training: Training,
    kalender: CalendarPage,
    uebungen: ExercisesPage,
    muskeln: MusclesPage,
    fortschritt: ProgressPage,
    ernaehrung: NutritionPage,
    profil: ProfilePage,
    wissenschaft: SciencePage,
    statistik: StatsPage,
    rueckblick: WeekReviewPage,
  }[route];

  return (
    <div className="min-h-screen">
      {/* Desktop-Seitenleiste */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line/[0.06] bg-bg px-4 py-6 lg:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <Logo />
          <div>
            <div className="text-[15px] font-semibold tracking-tight">Stimulus</div>
            <div className="text-[11px] text-muted">Adaptiver Hypertrophie-Coach</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={cn(
                'flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition',
                route === n.id ? 'bg-raised text-fg' : 'text-muted hover:bg-surface hover:text-fg',
              )}
            >
              <n.icon size={18} strokeWidth={1.8} />
              {n.label}
              {n.id === 'training' && active && <span className="ml-auto h-2 w-2 rounded-full bg-rec-green" />}
            </button>
          ))}
        </nav>
        <button
          onClick={() => go('wissenschaft')}
          className={cn(
            'mt-auto flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] text-muted hover:bg-surface hover:text-fg',
            route === 'wissenschaft' && 'bg-raised text-fg',
          )}
        >
          <BookOpen size={17} strokeWidth={1.8} /> Wissenschaft & Regeln
        </button>
      </aside>

      <div className="lg:pl-64">
      <main className="safe-t mx-auto max-w-5xl pb-[calc(96px+env(safe-area-inset-bottom,0px))] pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))] pt-4 sm:pt-6 lg:px-10 lg:pb-16">
        <div key={route} className="animate-fade-up">
          <Page />
        </div>
      </main>
      </div>

      {/* Mobile: schwebende Navigationsleiste */}
      <nav className={cn('pointer-events-none fixed inset-x-0 bottom-0 flex justify-center pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))] lg:hidden', focusNav ? 'z-[75] animate-fade-up' : 'z-30')}>
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-line/10 bg-surface/80 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          {MOBILE_MAIN.map((id) => {
            const n = NAV.find((x) => x.id === id)!;
            const on = route === id;
            return (
              <button
                key={id}
                onClick={() => {
                  // aus dem Fokusmodus heraus: Fokus schließen (Training läuft weiter), dann Seite öffnen
                  if (focusNav) useFocusNav.getState().close?.();
                  go(id);
                }}
                aria-label={n.label}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'relative grid h-12 w-12 place-items-center rounded-full transition active:scale-95',
                  on ? 'bg-fg text-bg shadow-lg' : 'bg-raised/70 text-muted hover:text-fg',
                )}
              >
                <n.icon size={20} strokeWidth={on ? 2.1 : 1.8} />
                {id === 'training' && active && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rec-green ring-2 ring-surface" />}
              </button>
            );
          })}
          <button
            onClick={() => {
              if (focusNav) useFocusNav.getState().close?.();
              setMore(true);
            }}
            aria-label="Mehr"
            className={cn(
              'grid h-12 w-12 place-items-center rounded-full transition active:scale-95',
              !MOBILE_MAIN.includes(route) ? 'bg-fg text-bg' : 'bg-raised/70 text-muted hover:text-fg',
            )}
          >
            <MoreHorizontal size={20} strokeWidth={1.8} />
          </button>
        </div>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="Mehr">
        <div className="grid grid-cols-2 gap-2 pb-2">
          {[...nav.filter((n) => !MOBILE_MAIN.includes(n.id)), { id: 'wissenschaft' as Route, label: 'Wissenschaft & Regeln', icon: BookOpen }].map((n) => (
            <button
              key={n.id}
              onClick={() => {
                go(n.id);
                setMore(false);
              }}
              className={cn('flex items-center gap-3 rounded-2xl bg-raised px-4 py-4 text-left text-[14px] font-medium', route === n.id && 'ring-1 ring-accent/50')}
            >
              <n.icon size={19} strokeWidth={1.8} className="text-muted" />
              {n.label}
            </button>
          ))}
        </div>
      </Sheet>

      <RestTimer />
      <CompletionHost />
      <PRCelebration />
      <SetPopup />
      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
      {start.open && <StartScreen onClose={() => start.set(false)} />}
      <Toast message={toast} />
    </div>
  );
}

export { Logo };

function CompletionHost() {
  const { sessionId, prs, close } = useCompletion();
  const session = useStore((s) => s.sessions.find((x) => x.id === sessionId));
  if (!sessionId || !session) return null;
  return <SessionComplete session={session} prs={prs.length ? prs : undefined} onClose={close} />;
}
