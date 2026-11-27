import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Cloud, Copy, Download, Upload } from 'lucide-react';
import { defaultData, exportData, migrate, useStore } from '../lib/store';
import { useRouter, useToast } from '../lib/hooks';
import { Button, Card, Chip, Confirm, Field, Input, PageHeader, SectionTitle, Segmented, Select, Sheet, Switch } from '../components/ui';
import { GROUP_LABEL, weeklyTarget, MUSCLES } from '../lib/muscles';
import { WEEKDAYS_SHORT, dateKey, downloadFile, fmtNum, fmtMin } from '../lib/utils';
import { clearDemo, generateDemo, hasDemo } from '../lib/demo';
import { mergeData, parseExport } from '../lib/merge';
import type { AppData } from '../lib/types';
import { requestNotify } from '../components/RestTimer';
import { SUPABASE_SQL, currentUser, pullState, pushState, signIn, signOut } from '../lib/sync';

export default function ProfilePage() {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const go = useRouter((r) => r.go);
  const [reset, setReset] = useState(false);
  const p = s.profile;
  const st = s.settings;
  const setP = (patch: Partial<typeof p>) => s.mutate((d) => Object.assign(d.profile, patch));
  const setS = (patch: Partial<typeof st>) => s.mutate((d) => Object.assign(d.settings, patch));
  const numIn = (v: string) => Number(v.replace(',', '.')) || 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Profil" sub="Einstellungen" action={<Button variant="ghost" size="sm" onClick={() => go('wissenschaft')}><BookOpen size={15} /> Wissenschaft</Button>} />

      <Card>
        <SectionTitle>Persönliche Daten</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Name (optional)" className="col-span-2 sm:col-span-1">
            <Input id="p-name" value={p.name} onChange={(e) => setP({ name: e.target.value })} />
          </Field>
          <Field label="Alter">
            <Input id="p-age" inputMode="numeric" value={p.age} onChange={(e) => setP({ age: numIn(e.target.value) })} />
          </Field>
          <Field label="Gewicht (kg)" hint="wird durch Messungen aktualisiert">
            <Input id="p-w" inputMode="decimal" value={p.weight} onChange={(e) => setP({ weight: numIn(e.target.value) })} />
          </Field>
          <Field label="Größe (cm)">
            <Input id="p-h" inputMode="numeric" value={p.height} onChange={(e) => setP({ height: numIn(e.target.value) })} />
          </Field>
          <Field label="Erfahrung">
            <Select id="p-exp" value={p.experience} onChange={(e) => setP({ experience: e.target.value as typeof p.experience })}>
              <option value="beginner">Einsteiger</option>
              <option value="intermediate">Fortgeschritten (1–3 J.)</option>
              <option value="advanced">Fortgeschritten (3+ J.)</option>
            </Select>
          </Field>
          <Field label="Fitnessstudio">
            <Input id="p-gym" value={p.gym} onChange={(e) => setP({ gym: e.target.value })} />
          </Field>
          <Field label="Ziel" className="col-span-2">
            <Input id="p-goal" value={p.goal} onChange={(e) => setP({ goal: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>Training</SectionTitle>
        <div className="flex flex-col gap-4">
          <Field label="Standard-Trainingstage (werden als „möglich“ eingeplant)">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <Chip
                  key={d}
                  active={st.preferredDays.includes(d)}
                  onClick={() => setS({ preferredDays: st.preferredDays.includes(d) ? st.preferredDays.filter((x) => x !== d) : [...st.preferredDays, d] })}
                >
                  {WEEKDAYS_SHORT[d]}
                </Chip>
              ))}
            </div>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Erwartete Einheiten pro Woche">
              <Segmented value={String(st.sessionsPerWeek)} onChange={(v) => setS({ sessionsPerWeek: +v })} options={['1', '2', '3'].map((v) => ({ value: v, label: `${v}×` }))} />
            </Field>
            <Field label="Standarddauer">
              <Select id="s-min" value={st.defaultMinutes} onChange={(e) => setS({ defaultMinutes: +e.target.value })}>
                {[45, 60, 75, 90, 105, 120].map((m) => (
                  <option key={m} value={m}>
                    {fmtMin(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Übungsreihenfolge">
              <Select id="s-order" value={st.orderMode} onChange={(e) => setS({ orderMode: e.target.value as typeof st.orderMode })}>
                <option value="priority">Prioritätsmuskeln zuerst</option>
                <option value="compound">Mehrgelenksübungen zuerst</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Max. Einheiten pro 7 Tage" hint="Weitere Tage mit Zeit werden zu Ruhetagen">
              <Segmented value={String(st.maxSessionsPerWeek ?? 4)} onChange={(v) => setS({ maxSessionsPerWeek: +v })} options={['2', '3', '4', '5', '6'].map((v) => ({ value: v, label: `${v}×` }))} />
            </Field>
            <Field label="Max. Trainingstage am Stück" hint="Danach plant die App einen Ruhetag">
              <Segmented value={String(st.maxConsecutive ?? 3)} onChange={(v) => setS({ maxConsecutive: +v })} options={['2', '3', '4'].map((v) => ({ value: v, label: `${v} Tage` }))} />
            </Field>
          </div>
          <div className="rounded-xl bg-raised p-3">
            <div className="text-[13.5px] font-medium">Wochenziel bei wenigen Einheiten (Annahme)</div>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Startannahme der App, kein Studienwert: Bei 1 oder 2 Einheiten pro 7 Tagen wird das Wochenziel verkleinert, weil pro Einheit nur begrenzt sinnvolles Volumen möglich ist. Prüfe im
              Wochenrückblick, ob du das Ziel erreichst und trotzdem Fortschritt machst – und passe den Faktor dann an.
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  ['freqFactor1', '1 Einheit', 0.55],
                  ['freqFactor2', '2 Einheiten', 0.8],
                ] as const
              ).map(([k, l, def]) => {
                const v = (st[k] as number | undefined) ?? def;
                return (
                  <div key={k} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-2.5 py-2">
                    <span className="text-[12.5px]">{l}</span>
                    <span className="flex items-center gap-1.5">
                      <button className="grid h-7 w-7 place-items-center rounded-full bg-raised" aria-label={`${l} Faktor verringern`} onClick={() => setS({ [k]: Math.max(0.3, Math.round((v - 0.05) * 100) / 100) })}>
                        −
                      </button>
                      <span className="tnum w-11 text-center text-[13px] font-semibold">×{fmtNum(v, 2)}</span>
                      <button className="grid h-7 w-7 place-items-center rounded-full bg-raised" aria-label={`${l} Faktor erhöhen`} onClick={() => setS({ [k]: Math.min(1, Math.round((v + 0.05) * 100) / 100) })}>
                        +
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <Row label="Supersätze bei wenig Zeit (≤ 50 min)" hint="Bizeps/Trizeps und seitliche/hintere Schulter im Wechsel">
            <Switch id="s-ss" checked={st.autoSuperset} onChange={(v) => setS({ autoSuperset: v })} label="Supersätze" />
          </Row>
        </div>
      </Card>

      <Card>
        <SectionTitle>Muskelprioritäten</SectionTitle>
        <ol className="flex flex-col gap-1.5">
          {p.priorities.map((g, i) => {
            const ms = MUSCLES.filter((m) => m.group === g);
            return (
              <li key={g} className="flex items-center gap-3 rounded-xl bg-raised px-3 py-2">
                <span className="tnum w-5 text-[13px] font-semibold text-muted">{i + 1}</span>
                <span className="flex-1 text-[14px] font-medium">{GROUP_LABEL[g]}</span>
                <span className="tnum hidden text-[12px] text-muted sm:inline">
                  Ziel {ms.map((m) => fmtNum(weeklyTarget(m.id, p.priorities, st.sessionsPerWeek))).join(' / ')} Sätze/Woche
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={i === 0}
                  onClick={() =>
                    s.mutate((d) => {
                      const a = d.profile.priorities;
                      [a[i - 1], a[i]] = [a[i], a[i - 1]];
                    })
                  }
                  aria-label="Höher priorisieren"
                >
                  <ArrowUp size={15} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={i === p.priorities.length - 1}
                  onClick={() =>
                    s.mutate((d) => {
                      const a = d.profile.priorities;
                      [a[i + 1], a[i]] = [a[i], a[i + 1]];
                    })
                  }
                  aria-label="Niedriger priorisieren"
                >
                  <ArrowDown size={15} />
                </Button>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-[12px] text-muted">Höhere Priorität = höheres Wochenziel, früher in der Einheit und mehr Gewicht bei der Auswahl. Kein Muskel fällt dabei komplett heraus.</p>
      </Card>

      <Card>
        <SectionTitle>Gewichtsstufen der Geräte</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Kabelzug-Schritt (kg)">
            <Input id="g-cable" inputMode="decimal" value={st.cableStep} onChange={(e) => setS({ cableStep: numIn(e.target.value) || 2.5 })} />
          </Field>
          <Field label="Maschinen-Schritt (kg)">
            <Input id="g-mach" inputMode="decimal" value={st.machineStep} onChange={(e) => setS({ machineStep: numIn(e.target.value) || 5 })} />
          </Field>
          <Field label="Scheiben (Beinpresse)">
            <Input id="g-plate" inputMode="decimal" value={st.plateStep} onChange={(e) => setS({ plateStep: numIn(e.target.value) || 5 })} />
          </Field>
          <Field label="Langhantel/EZ (kg)">
            <Input id="g-bar" inputMode="decimal" value={st.barbellStep} onChange={(e) => setS({ barbellStep: numIn(e.target.value) || 2.5 })} />
          </Field>
        </div>
        <DumbbellList />
        <p className="mt-2 text-[12px] text-muted">Pro Übung lassen sich unter „Übungen“ eigene Stufen festlegen (z. B. Zusatzgewichte am Kabel).</p>
      </Card>

      <Card>
        <SectionTitle>Ernährungsziele</SectionTitle>
        <Row label="Ernährungstagebuch anzeigen">
          <Switch id="n-en" checked={st.nutritionEnabled} onChange={(v) => setS({ nutritionEnabled: v })} label="Ernährung" />
        </Row>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-6">
          {(
            [
              ['kcalMin', 'kcal min'],
              ['kcalMax', 'kcal max'],
              ['protein', 'Protein g'],
              ['creatine', 'Kreatin g'],
              ['sleepMin', 'Schlaf min h'],
              ['sleepMax', 'Schlaf max h'],
            ] as const
          ).map(([k, l]) => (
            <Field key={k} label={l}>
              <Input id={`t-${k}`} inputMode="decimal" value={st.targets[k]} onChange={(e) => s.mutate((d) => void (d.settings.targets[k] = numIn(e.target.value)))} />
            </Field>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Satzpausen-Timer</SectionTitle>
        <div className="flex flex-col gap-3">
          <Row label="Ton am Ende der Pause">
            <Switch id="t-sound" checked={st.sound} onChange={(v) => setS({ sound: v })} label="Ton" />
          </Row>
          <Row label="Vibration (Android)">
            <Switch id="t-vib" checked={st.vibrate} onChange={(v) => setS({ vibrate: v })} label="Vibration" />
          </Row>
          <Row label="Mitteilung" hint="Auf dem iPhone nur, wenn die App zum Home-Bildschirm hinzugefügt ist (iOS 16.4+).">
            <Switch
              id="t-notif"
              checked={st.notifications}
              onChange={async (v) => {
                if (v) {
                  const ok = await requestNotify();
                  if (!ok) return toast('Mitteilungen wurden nicht erlaubt');
                }
                setS({ notifications: v });
              }}
              label="Mitteilungen"
            />
          </Row>
        </div>
      </Card>

      <LearningCard />
      <DataCard onReset={() => setReset(true)} />
      <SyncCard />

      <Confirm
        open={reset}
        onClose={() => setReset(false)}
        onConfirm={() => {
          s.replaceAll(defaultData());
          toast('Alle Daten zurückgesetzt');
        }}
        title="Alle Daten löschen?"
        text="Trainings, Körperdaten, Ernährung und Einstellungen werden gelöscht. Exportiere vorher ein Backup."
        confirmLabel="Alles löschen"
        danger
      />
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-[14px]">{label}</div>
        {hint && <div className="text-[12px] text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function DumbbellList() {
  const s = useStore();
  const [txt, setTxt] = useState(s.settings.dumbbellWeights.join(', '));
  return (
    <Field label="Verfügbare Kurzhanteln (kg, kommagetrennt)" className="mt-3">
      <Input
        id="g-db"
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => {
          const list = txt
            .split(/[;,\s]+/)
            .map((x) => Number(x.replace(',', '.')))
            .filter((x) => x > 0)
            .sort((a, b) => a - b);
          if (list.length) s.mutate((d) => void (d.settings.dumbbellWeights = [...new Set(list)]));
        }}
      />
    </Field>
  );
}

function DataCard({ onReset }: { onReset: () => void }) {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showJson, setShowJson] = useState(false);
  const [paste, setPaste] = useState('');
  const [pending, setPending] = useState<AppData | null>(null);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const json = () => JSON.stringify({ app: 'stimulus', exportedAt: new Date().toISOString(), data: exportData() });
  const filename = () => `stimulus-backup-${dateKey()}.json`;

  const prepare = (t: string) => {
    try {
      setPending(parseExport(t));
    } catch (e) {
      toast(`Import fehlgeschlagen: ${(e as Error).message}`);
    }
  };
  const doMerge = () => {
    if (!pending) return;
    const local = exportData();
    const { data, report } = mergeData(local, migrate(pending));
    s.replaceAll(data);
    s.runAdaptation();
    setPending(null);
    setPaste('');
    setShowJson(false);
    toast(
      `Zusammengeführt: ${report.added} neue Trainings${report.updated ? `, ${report.updated} aktualisiert` : ''}${report.activeImported === 'active' ? ', laufendes Training übernommen' : report.activeImported === 'closed' ? ', importiertes Training abgeschlossen' : ''}`,
    );
  };
  const doReplace = () => {
    if (!pending) return;
    s.replaceAll(migrate(pending));
    s.runAdaptation();
    toast(`Ersetzt: ${pending.sessions.length} Trainings`);
    setPending(null);
    setPaste('');
  };
  const share = async () => {
    const text = json();
    try {
      const file = new File([text], filename(), { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Stimulus Backup' });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    try {
      downloadFile(filename(), text);
      toast('Backup gespeichert');
    } catch {
      setShowJson(true);
    }
  };
  const preview = pending
    ? (() => {
        const ids = new Set(s.sessions.map((x) => x.id));
        const newOnes = pending.sessions.filter((x) => !ids.has(x.id)).length;
        const act = pending.sessions.find((x) => x.status === 'active');
        return { total: pending.sessions.length, newOnes, act };
      })()
    : null;
  const demo = hasDemo(s as unknown as AppData);
  return (
    <Card>
      <SectionTitle>Daten & Backup</SectionTitle>
      <p className="mb-3 text-[13px] text-muted">
        Alle Daten liegen lokal auf diesem Gerät (IndexedDB) und überstehen Neuladen, Schließen und App-Updates unter derselben Adresse. Zum Umziehen (z. B. Safari → Home-Bildschirm,
        neues Gerät): hier sichern und in der anderen App „Importieren“ → „Zusammenführen“.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={share}>
          <Download size={15} /> Backup teilen / speichern
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(json());
              toast('Backup in Zwischenablage kopiert');
            } catch {
              setShowJson(true);
            }
          }}
        >
          <Copy size={15} /> Kopieren
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> Aus Datei importieren
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,text/plain"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) prepare(await f.text());
            e.target.value = '';
          }}
        />
        <Button variant="secondary" onClick={() => setShowJson(!showJson)}>
          Text einfügen
        </Button>
      </div>
      {showJson && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            id="paste-json"
            placeholder="Kopiertes Backup hier einfügen (lange tippen → Einsetzen)"
            className="h-28 w-full rounded-xl border border-line/10 bg-bg p-3 font-mono text-[11px]"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" disabled={!paste.trim()} onClick={() => prepare(paste)}>
              Prüfen & importieren
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  setPaste(await navigator.clipboard.readText());
                } catch {
                  toast('Bitte manuell einfügen (lange tippen → Einsetzen)');
                }
              }}
            >
              Aus Zwischenablage
            </Button>
          </div>
          <details className="text-[12px] text-muted">
            <summary className="cursor-pointer">Eigenes Backup als Text anzeigen</summary>
            <textarea readOnly className="mt-2 h-28 w-full rounded-xl border border-line/10 bg-bg p-3 font-mono text-[11px]" value={json()} onFocus={(e) => e.target.select()} />
          </details>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line/[0.06] pt-4">
        {demo ? (
          <Button
            variant="outline"
            onClick={() => {
              s.replaceAll(clearDemo(exportData()));
              toast('Beispieldaten entfernt');
            }}
          >
            Beispieldaten entfernen
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              s.replaceAll(generateDemo(exportData()));
              toast('6 Wochen Beispieldaten geladen');
            }}
          >
            Beispieldaten laden
          </Button>
        )}
        <Button variant="danger" onClick={onReset}>
          Alle Daten löschen
        </Button>
      </div>

      <Sheet
        open={!!pending}
        onClose={() => setPending(null)}
        title="Backup importieren"
        footer={
          <div className="flex flex-col gap-2">
            <Button variant="primary" size="lg" onClick={doMerge}>
              Zusammenführen (empfohlen)
            </Button>
            <Button variant="ghost" onClick={() => setReplaceConfirm(true)}>
              Alles ersetzen
            </Button>
          </div>
        }
      >
        {preview && (
          <div className="flex flex-col gap-3 text-[14px]">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-raised p-3">
                <div className="label">Trainings im Backup</div>
                <div className="tnum mt-1 text-[22px] font-semibold">{preview.total}</div>
              </div>
              <div className="rounded-2xl bg-raised p-3">
                <div className="label">Davon neu</div>
                <div className="tnum mt-1 text-[22px] font-semibold text-rec-green">{preview.newOnes}</div>
              </div>
            </div>
            {preview.act && (
              <p className="rounded-xl bg-accent/10 px-3 py-2 text-[13px]">
                Enthält ein laufendes Training „{preview.act.title}“ ({preview.act.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0)} Sätze erledigt). Es wird übernommen
                und du kannst direkt weitermachen{s.sessions.some((x) => x.status === 'active') ? ' – da hier schon eines läuft, wird es als abgeschlossen gespeichert' : ''}.
              </p>
            )}
            <p className="text-[13px] text-muted">
              <b className="text-fg">Zusammenführen</b> ergänzt Trainings, Körperdaten, Check-ins und Ernährung aus dem Backup. Nichts Vorhandenes wird gelöscht, Doppelte werden erkannt; Profil und
              Einstellungen dieser App bleiben. <b className="text-fg">Alles ersetzen</b> überschreibt alle Daten hier mit dem Backup.
            </p>
          </div>
        )}
      </Sheet>
      <Confirm
        open={replaceConfirm}
        onClose={() => setReplaceConfirm(false)}
        onConfirm={doReplace}
        title="Alle Daten ersetzen?"
        text="Alle Daten in dieser App werden durch das Backup überschrieben. Zusammenführen ist meist die bessere Wahl."
        confirmLabel="Ersetzen"
        danger
      />
    </Card>
  );
}

function SyncCard() {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const sb = s.settings.supabase;
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [user, setUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSql, setShowSql] = useState(false);
  useEffect(() => {
    if (!sb.url || !sb.anonKey) return setUser(null);
    currentUser()
      .then((u) => setUser(u?.email ?? null))
      .catch(() => setUser(null));
  }, [sb.url, sb.anonKey]);
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try {
      toast(await fn());
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const setSb = (p: Partial<typeof sb>) => s.mutate((d) => Object.assign(d.settings.supabase, p));
  return (
    <Card>
      <SectionTitle>
        <span className="flex items-center gap-2">
          <Cloud size={16} /> Cloud-Synchronisation (optional)
        </span>
      </SectionTitle>
      <p className="mb-3 text-[13px] text-muted">
        Für geräteübergreifende Daten: eigenes kostenloses Supabase-Projekt anlegen, die Tabelle per SQL erstellen und hier URL und „anon public“-Key eintragen.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Supabase-URL">
          <Input id="sb-url" placeholder="https://xyz.supabase.co" value={sb.url} onChange={(e) => setSb({ url: e.target.value.trim() })} />
        </Field>
        <Field label="Anon-Key">
          <Input id="sb-key" placeholder="eyJ…" value={sb.anonKey} onChange={(e) => setSb({ anonKey: e.target.value.trim() })} />
        </Field>
      </div>
      <button className="mt-2 text-[12px] text-accent" onClick={() => setShowSql(!showSql)}>
        {showSql ? 'SQL ausblenden' : 'Benötigtes SQL anzeigen'}
      </button>
      {showSql && <pre className="mt-2 overflow-x-auto rounded-xl bg-bg p-3 font-mono text-[11px] text-muted">{SUPABASE_SQL}</pre>}
      {sb.url && sb.anonKey && (
        <div className="mt-4 flex flex-col gap-3 border-t border-line/[0.06] pt-4">
          {user ? (
            <>
              <div className="text-[13px]">
                Angemeldet als <span className="font-medium">{user}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => run(async () => (await pushState(), 'Hochgeladen'))}>
                  Hochladen
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const r = await pullState();
                      return r === 'updated' ? 'Neuere Serverdaten übernommen' : r === 'empty' ? 'Noch keine Daten auf dem Server' : 'Lokale Daten sind aktuell';
                    })
                  }
                >
                  Herunterladen
                </Button>
                <Button size="sm" variant="ghost" onClick={() => run(async () => (await signOut(), setUser(null), 'Abgemeldet'))}>
                  Abmelden
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px]">Automatisch synchronisieren</span>
                <Switch id="sb-auto" checked={sb.autoSync} onChange={(v) => setSb({ autoSync: v })} label="Auto-Sync" />
              </div>
            </>
          ) : (
            <form
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const u = await signIn(email, pw);
                  setUser(u?.email ?? email);
                  return 'Angemeldet';
                });
              }}
            >
              <Input id="sb-email" type="email" autoComplete="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input id="sb-pw" type="password" autoComplete="current-password" placeholder="Passwort" value={pw} onChange={(e) => setPw(e.target.value)} />
              <Button type="submit" variant="primary" disabled={busy}>
                Anmelden
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await signIn(email, pw, true);
                    return 'Registriert – ggf. E-Mail bestätigen';
                  })
                }
              >
                Registrieren
              </Button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}

function LearningCard() {
  const s = useStore();
  const toast = useToast((t) => t.show);
  const tf = s.settings.timeFactor || 1;
  const adj = MUSCLES.filter((m) => !m.indirectOnly).map((m) => ({ m, a: s.volumeAdjust?.[m.id] }));
  return (
    <Card>
      <SectionTitle>Lernt mit dir</SectionTitle>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-raised p-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] font-medium">Dein Trainingstempo</span>
            <span className="tnum text-[17px] font-semibold">
              {s.settings.timeSamples ? `${tf >= 1 ? '+' : '−'}${Math.round(Math.abs(tf - 1) * 100)} %` : '–'}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-muted">
            {s.settings.timeSamples
              ? `Aus ${s.settings.timeSamples} Einheit${s.settings.timeSamples === 1 ? '' : 'en'} gelernt: Deine Sätze inkl. Pausen dauern ${tf >= 1 ? 'länger' : 'kürzer'} als geschätzt. Pläne für „60 Minuten“ passen sich daran an.`
              : 'Nach deinem ersten vollständigen Training vergleicht die App geplante und tatsächliche Dauer und passt die Zeitplanung an.'}
          </p>
          {s.settings.timeSamples > 0 && (
            <button
              className="mt-2 text-[12px] text-accent"
              onClick={() => {
                s.mutate((d) => {
                  d.settings.timeFactor = 1;
                  d.settings.timeSamples = 0;
                });
                toast('Tempo zurückgesetzt');
              }}
            >
              Zurücksetzen
            </button>
          )}
        </div>
        <div>
          <div className="mb-2 text-[14px] font-medium">Volumen je Muskel</div>
          <ul className="flex flex-col divide-y divide-line/[0.06]">
            {adj.map(({ m, a }) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-2 text-[13px]">
                <span className="min-w-0">
                  <span className="font-medium">{m.label}</span>
                  <span className="block text-[12px] text-muted">{a?.reason ?? 'Noch zu wenig Daten'}</span>
                </span>
                <span className={'tnum shrink-0 font-semibold ' + ((a?.factor ?? 1) > 1 ? 'text-rec-green' : (a?.factor ?? 1) < 1 ? 'text-rec-yellow' : 'text-muted')}>
                  {(a?.factor ?? 1) === 1 ? '±0 %' : `${a!.factor > 1 ? '+' : '−'}${Math.round(Math.abs(a!.factor - 1) * 100)} %`}
                </span>
              </li>
            ))}
          </ul>
          <button
            className="mt-2 text-[12px] text-accent"
            onClick={() => {
              s.mutate((d) => {
                d.volumeAdjust = {};
              });
              toast('Volumen-Anpassungen zurückgesetzt');
            }}
          >
            Alle Anpassungen zurücksetzen
          </button>
          <p className="mt-2 text-[11.5px] text-muted">
            Wöchentliche Prüfung je Muskel anhand der Kraftentwicklung (e1RM) der letzten 4 Wochen, Muskelkater und Bereitschaft: Fortschritt → gleich lassen, Stagnation bei guter
            Erholung → +10 %, Leistungsabfall oder viel Muskelkater → −15 % (Grenzen −30 % bis +30 %). Diese Prozentwerte sind Modellregeln der App, keine Studienwerte – sie werden anhand deiner Ergebnisse überprüft und können angepasst werden.
          </p>
        </div>
      </div>
    </Card>
  );
}
