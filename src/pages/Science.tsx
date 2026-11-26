import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Badge, Card, PageHeader, SectionTitle, Segmented } from '../components/ui';
import { RULES, TOPICS, type Evidence } from '../data/science';

const TONE: Record<Evidence, 'green' | 'yellow' | 'gray'> = {
  'gut belegt': 'green',
  'moderat belegt': 'yellow',
  'praktische Empfehlung': 'gray',
};

export default function SciencePage() {
  const [tab, setTab] = useState<'science' | 'rules'>('science');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Wissenschaft & Regeln" sub="Transparenz" />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'science', label: 'Studienlage' }, { value: 'rules', label: 'So plant die App' }]} />
      {tab === 'science' ? (
        <>
          <Card className="text-[13px] text-muted">
            Jede Empfehlung ist gekennzeichnet: <Badge tone="green">gut belegt</Badge> = konsistente Meta-Analysen, <Badge tone="yellow">moderat belegt</Badge> = einzelne
            Studien oder unsichere Effekte, <Badge tone="gray">praktische Empfehlung</Badge> = plausible Praxisregel ohne direkte Studienbasis. Die App verspricht keinen
            „optimalen“ Plan, sondern wendet nachvollziehbare Regeln auf deine Daten an.
          </Card>
          {TOPICS.map((t) => (
            <Card key={t.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[17px] font-semibold">{t.title}</h2>
                <Badge tone={TONE[t.evidence]}>{t.evidence}</Badge>
              </div>
              <div className="grid gap-3 text-[13.5px] leading-relaxed md:grid-cols-3">
                <div>
                  <div className="label mb-1">Erkenntnis</div>
                  <p>{t.finding}</p>
                </div>
                <div>
                  <div className="label mb-1">Praxis</div>
                  <p className="text-fg/85">{t.practice}</p>
                </div>
                <div>
                  <div className="label mb-1">Umsetzung in der App</div>
                  <p className="text-muted">{t.app}</p>
                </div>
              </div>
              {t.refs.length > 0 && (
                <ul className="flex flex-col gap-1 border-t border-line/[0.06] pt-3">
                  {t.refs.map((r) => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1.5 text-[12.5px] text-accent hover:underline">
                        <ExternalLink size={12} className="mt-0.5 shrink-0" />
                        {r.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </>
      ) : (
        <>
          {RULES.map((r) => (
            <Card key={r.title}>
              <SectionTitle>{r.title}</SectionTitle>
              <p className="text-[13.5px] leading-relaxed text-fg/85">{r.body}</p>
            </Card>
          ))}
          <Card className="text-[12px] text-muted">
            Alle Zahlenwerte (Zeitkonstanten, Schwellen, Boni) sind bewusst einfache, offen gelegte Heuristiken auf Basis der Studienlage – keine aus Studien exakt
            abgeleiteten Konstanten. Sie lassen sich in künftigen Versionen anhand deiner Daten weiter kalibrieren.
          </Card>
        </>
      )}
    </div>
  );
}
