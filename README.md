# Stimulus – adaptiver Hypertrophie-Coach

Eine React-/TypeScript-PWA, die anhand von Verfügbarkeit, Trainingshistorie, geschätzter Regeneration und Muskelprioritäten jeden Tag die Frage beantwortet: *Was trainiere ich heute?*

## Starten

```bash
npm install
npm run dev          # Entwicklung
npm run build        # PWA-Build in dist/ (offlinefähig, Service Worker)
npm run build:single # eine einzige HTML-Datei in dist-single/
npx tsx scripts/engine-test.ts   # Planer-Szenarien im Terminal prüfen
```

## Auf dem iPhone installieren

1. `dist/` auf einen HTTPS-Host legen (z. B. Netlify Drop, Vercel, Cloudflare Pages, GitHub Pages).
2. In Safari öffnen → Teilen → „Zum Home-Bildschirm“.
3. Danach läuft die App im Vollbild und offline. Mitteilungen für den Pausentimer funktionieren auf iOS nur in der installierten Version (iOS 16.4+).

## Architektur

| Pfad | Inhalt |
| --- | --- |
| `src/engine/fatigue.ts` | Reiz-Ereignisse, fraktionale Sätze, Ermüdungsmodell, Regenerationsfarben |
| `src/engine/planner.ts` | Tagesauswahl, Split-Strategie, Muskel-Scoring, Greedy-Einheitenbau, Mehrtagessimulation |
| `src/engine/progression.ts` | Doppelte Progression, Gewichtsstufen, Stagnation/Deload |
| `src/engine/readiness.ts` | Bereitschaft aus täglichem Check-in |
| `src/engine/stats.ts` | Rekorde, e1RM-Verläufe, Serien, Gewichtstrend & Kalorienempfehlung |
| `src/lib/store.ts` | Zustand (zustand + immer), Persistenz in IndexedDB (Fallback LocalStorage) |
| `src/lib/sync.ts` | Optionale Supabase-Synchronisation (SQL im Profil sichtbar) |
| `src/data/science.ts` | Studienlage mit Evidenzgrad + offengelegte Algorithmusregeln |

Alle Heuristiken (Zeitkonstanten, Schwellen, Boni) stehen in der App unter **Wissenschaft & Regeln**.

## Supabase (optional)

Eigenes Projekt anlegen, im SQL-Editor das SQL aus *Profil → Cloud-Synchronisation → Benötigtes SQL* ausführen, URL + anon key eintragen, registrieren/anmelden, Auto-Sync aktivieren. Strategie: ein JSON-Dokument pro Nutzer, neuerer Stand gewinnt.
