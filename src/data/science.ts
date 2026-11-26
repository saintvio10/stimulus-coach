export type Evidence = 'gut belegt' | 'moderat belegt' | 'praktische Empfehlung';

export interface Ref {
  label: string;
  url: string;
  note?: string;
}

export interface Topic {
  id: string;
  title: string;
  evidence: Evidence;
  finding: string;
  practice: string;
  app: string;
  refs: Ref[];
}

const pm = (q: string) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(q)}`;

export const TOPICS: Topic[] = [
  {
    id: 'volume',
    title: 'Trainingsvolumen & abnehmender Zusatznutzen',
    evidence: 'gut belegt',
    finding:
      'Mehr wöchentliche Sätze pro Muskel führen im Mittel zu mehr Hypertrophie. Die Dosis-Wirkungs-Kurve flacht mit steigendem Volumen ab: Jeder zusätzliche Satz bringt weniger als der vorherige. Bei Kraft flacht sie noch früher ab.',
    practice:
      'Für Fortgeschrittene sind ca. 10–20 (fraktionale) Sätze pro Muskel und Woche ein sinnvoller Korridor. Prioritätsmuskeln eher oben, Erhaltungsmuskeln unten. Eine „optimale“ Satzzahl lässt sich individuell nicht exakt bestimmen.',
    app: 'Wochenziele je Muskel ergeben sich aus Basisvolumen × Prioritätsfaktor × Frequenzfaktor (1×/2×/3× pro Woche). Jeder weitere Satz in einer Einheit wird mit 1/(1+n/3) abgewertet; über 130 % des Wochenziels nur noch mit 30 %.',
    refs: [
      { label: 'Pelland et al. (2025/26), Sports Medicine – Dose Response: Weekly Volume & Frequency', url: 'https://doi.org/10.1007/s40279-025-02344-w' },
      { label: 'Pelland et al. (2024), SportRxiv-Preprint (frei zugänglich)', url: 'https://sportrxiv.org/index.php/server/preprint/view/460' },
      { label: 'Schoenfeld, Ogborn & Krieger (2017), J Sports Sci – Volumen-Meta-Analyse', url: 'https://pubmed.ncbi.nlm.nih.gov/27433992/' },
    ],
  },
  {
    id: 'fractional',
    title: 'Direkte und indirekte Sätze',
    evidence: 'moderat belegt',
    finding:
      'Synergisten werden bei Mehrgelenksübungen mitbelastet (z. B. Trizeps beim Bankdrücken, Bizeps beim Rudern). In der Dosis-Wirkungs-Analyse von Pelland et al. wurde unter anderem eine fraktionale Zählweise (indirekter Satz = 0,5) verwendet, die Volumen-Effekte plausibel abbildet.',
    practice: 'Indirekte Sätze zählen, aber nicht voll. Die genaue Gewichtung ist eine Vereinfachung.',
    app: 'Jede Übung hat Muskelbeiträge (1 = direkt, 0,5 = indirekt, 0,25 = gering). Volumen, Ermüdung und Muskelkarte nutzen diese fraktionalen Werte; ab 0,75 gilt ein Satz als „direkt“.',
    refs: [{ label: 'Pelland et al. (2025/26), Sports Medicine', url: 'https://doi.org/10.1007/s40279-025-02344-w' }],
  },
  {
    id: 'frequency',
    title: 'Trainingsfrequenz & Volumen pro Einheit',
    evidence: 'moderat belegt',
    finding:
      'Bei gleichem Wochenvolumen hat die Frequenz nur einen kleinen, unsicheren Einfluss auf Hypertrophie (für Kraft ist er deutlicher). Frequenz ist vor allem ein Werkzeug, um Volumen sinnvoll zu verteilen. Pro Einheit flacht der Nutzen ab: Eine Meta-Regression (Preprint, noch nicht begutachtet) fand ab ca. 11 fraktionalen Sätzen pro Muskel und Einheit keinen sicher erkennbaren Zusatznutzen mehr – bei dünner Datenlage für sehr hohe Satzzahlen.',
    practice: 'Prioritätsmuskeln idealerweise 2× pro Woche reizen; pro Einheit und Muskel eher 6–10 fraktionale Sätze, nicht deutlich über ~11.',
    app: 'Obergrenzen pro Einheit (Prioritätsmuskeln 9, Rücken/Beine 6–7, Bauch/Waden 4). Bei 1 Einheit/Woche sinkt das Wochenziel automatisch auf ein realistisches Niveau (Faktor 0,55), bei 2 Einheiten auf 0,8.',
    refs: [
      { label: 'Pelland et al. (2025/26), Sports Medicine', url: 'https://doi.org/10.1007/s40279-025-02344-w' },
      { label: 'Remmert et al. (2025), SportRxiv-Preprint – Volumen pro Einheit, Plateau ~11 fraktionale Sätze (nicht begutachtet)', url: 'https://sportrxiv.org/index.php/server/preprint/view/537' },
      { label: 'Schoenfeld et al. (2019), J Sports Sci – Frequenz-Meta-Analyse (volumengleich kein Unterschied)', url: 'https://pubmed.ncbi.nlm.nih.gov/30558493/' },
    ],
  },
  {
    id: 'failure',
    title: 'Nähe zum Muskelversagen (RIR)',
    evidence: 'gut belegt',
    finding:
      'Hypertrophie nimmt tendenziell zu, je näher Sätze am Versagen beendet werden; Kraftzuwächse sind über einen weiten RIR-Bereich ähnlich. Training bis zum tatsächlichen Versagen ist gegenüber 1–2 RIR nicht klar überlegen, erzeugt aber mehr Ermüdung und Leistungsverlust in Folgesätzen.',
    practice: 'Arbeitssätze mit 0–2 RIR. Versagen gezielt und sparsam einsetzen, eher im letzten Satz von Isolationsübungen als bei schweren Mehrgelenksübungen.',
    app: 'Ziel-RIR 1 bei Isolationsübungen, 1–2 bei schweren Mehrgelenksübungen. Sätze mit > 4 RIR zählen nur halb, > 6 RIR zu 25 %. Versagen/RIR 0 erhöht die geschätzte Ermüdung (×1,25 bzw. ×1,15).',
    refs: [
      { label: 'Robinson et al. (2024), Sports Medicine – Proximity to Failure Meta-Regressions', url: 'https://rke.abertay.ac.uk/en/publications/exploring-the-dose-response-relationship-between-estimated-resist/' },
      { label: 'Refalo et al. (2023), Sports Medicine – Failure vs. Non-Failure Meta-Analyse', url: 'https://pubmed.ncbi.nlm.nih.gov/36334240/' },
      { label: 'Refalo et al. (2024), J Sports Sci – Versagen vs. 1–2 RIR bei Trainierten', url: 'https://pubmed.ncbi.nlm.nih.gov/38393985/' },
      { label: 'Refalo et al. (2025), Med Sci Sports Exerc – Einzelsätze bis Versagen vs. RIR (leichter Vorteil Versagen)', url: 'https://pubmed.ncbi.nlm.nih.gov/40249908/' },
    ],
  },
  {
    id: 'rest',
    title: 'Satzpausen',
    evidence: 'moderat belegt',
    finding:
      'Pausen über 60 Sekunden zeigen einen kleinen Vorteil für Hypertrophie, vermutlich weil mehr Wiederholungen möglich sind. Jenseits von ~90 Sekunden waren in der Bayes-Meta-Analyse keine nennenswerten Unterschiede mehr erkennbar – die Unsicherheit ist allerdings groß.',
    practice: 'Isolation ca. 90–120 s, schwere Mehrgelenksübungen 2–3 min. Lieber so lange pausieren, dass die Leistung im nächsten Satz nicht stark einbricht – zu kurze Pausen kosten Wiederholungen und damit Reiz.',
    app: 'Pausen je Übung: Isolation 90–120 s (Bauch 75 s), Mehrgelenksübungen 150–180 s – also überall über der 60–90-s-Schwelle. Autoreguliert: +30 s nach einem Satz bis Versagen und +30 s, wenn die Wiederholungen schon ≥ 3 unter dem ersten Satz liegen. Im Timer mit ±15 s anpassbar; die Zeitplanung rechnet mit diesen Pausen. Nur im Zeitmodus (≤ 50 min) werden Antagonisten als Supersatz gepaart.',
    refs: [{ label: 'Singer et al. (2024), Front Sports Act Living – „Give it a rest“', url: 'https://www.frontiersin.org/articles/10.3389/fspor.2024.1429789/full' }],
  },
  {
    id: 'stretch',
    title: 'Belastung in gedehnter Position',
    evidence: 'moderat belegt',
    finding:
      'Einzelne gut gemachte Studien zeigen Vorteile für Übungen mit Last in gedehnter Position: Überkopf-Trizepsstrecken > Pushdowns (Maeo 2023), sitzender > liegender Beinbeuger (+14 % vs. +9 % Volumen, Maeo 2021). Teilwiederholungen im gedehnten Bereich schlagen solche im verkürzten Bereich leicht (Meta-Analyse 2026). Im Vergleich zur vollen Bewegungsamplitude zeigen Meta-Analysen und Studien an Trainierten aber meist ähnliche Ergebnisse, und ein Effekt auf regionales Wachstum ist höchstens klein.',
    practice: 'Volle Bewegungsamplitude mit kontrollierter, tiefer Dehnung als Standard. Bei gleichwertigen Übungen die mit mehr Dehnungsbelastung wählen – das ist ein kleiner Vorteil, kein Muss.',
    app: 'Jede Übung hat einen Dehnungswert (0–2), der bis zu +12 % Auswahlbonus gibt – bewusst klein gehalten und kein Ausschlusskriterium.',
    refs: [
      { label: 'Maeo et al. (2023), Eur J Sport Sci – Trizeps überkopf vs. neutral', url: 'https://pubmed.ncbi.nlm.nih.gov/35819335/' },
      { label: 'Maeo et al. (2021), Med Sci Sports Exerc – Beinbeuger sitzend vs. liegend', url: 'https://pubmed.ncbi.nlm.nih.gov/33009197/' },
      { label: 'Wolf et al. (2023), Int J Strength Cond – Partial vs. Full ROM Meta-Analyse (23 RCTs, meist ähnlich)', url: 'https://doaj.org/article/99e86b317bec40f5abc2f0008358737e' },
      { label: 'Strey et al. (2026), Sport Sci Health – Teilwiederholungen lang vs. kurz, Meta-Analyse', url: 'https://link.springer.com/article/10.1007/s11332-025-01586-5' },
      { label: 'Varović et al. (2025), Meta-Analyse – Muskellänge & regionale Hypertrophie (Effekt höchstens klein)', url: 'https://sportrxiv.org/index.php/server/preprint/view/464' },
      { label: 'Wolf et al. (2025), Systematic Review – längere Muskellänge', url: 'https://journal.hep.com.cn/smhs/EN/1255452794816139817' },
      { label: 'PeerJ (2025) – Lengthened Partials vs. volle ROM bei Trainierten', url: 'https://peerj.com/articles/18904' },
    ],
  },
  {
    id: 'variation',
    title: 'Übungsauswahl & Variation',
    evidence: 'moderat belegt',
    finding:
      'Ein systematischer Review fand: Gezielte Variation – verschiedene Übungen für unterschiedliche Muskelanteile – kann regionales Wachstum und Kraft verbessern; zufälliges, ständiges Wechseln kann dagegen schaden. Neuere Einzelstudien zeigen bei konstanter vs. variierter Übungsauswahl oft ähnliche Ergebnisse.',
    practice: 'Wenige, gut gewählte Übungen konstant nutzen (für messbare Progression). Für Prioritätsmuskeln zwei sich ergänzende Übungen (z. B. Bizeps: Preacher + Hammer Curls; Trizeps: Überkopf + Pushdown), aber keine fast identischen Varianten in derselben Einheit.',
    app: 'Max. 4 Sätze pro Übung (5 nur bei Seitheben und Waden). Braucht ein Muskel mehr, kommt eine 2. Übung mit anderer Bewegung dazu; Übungen derselben Bewegungsfamilie (z. B. Seitheben Kabel + Kurzhantel, zwei Ruder-Varianten) werden nicht kombiniert. Bekannte Übungen bekommen einen kleinen Bonus, damit Fortschritt vergleichbar bleibt.',
    refs: [
      { label: 'Kassiano et al. (2022), J Strength Cond Res – Variation von Übungen, systematischer Review', url: 'https://pubmed.ncbi.nlm.nih.gov/35438660/' },
      { label: 'Remmert et al. (2025), Preprint – Volumen pro Einheit', url: 'https://sportrxiv.org/index.php/server/preprint/view/537' },
    ],
  },
  {
    id: 'order',
    title: 'Übungsreihenfolge',
    evidence: 'moderat belegt',
    finding:
      'Kraftzuwächse sind bei Übungen am Anfang der Einheit am größten. Für Hypertrophie fand die Meta-Analyse keinen signifikanten Effekt der Reihenfolge (Mehrgelenk → Eingelenk vs. umgekehrt).',
    practice: 'Was dir am wichtigsten ist, an den Anfang. Sehr ermüdende Beinübungen früh, um sie nicht erschöpft auszuführen.',
    app: 'Standard: Prioritätsmuskeln zuerst (Bizeps, Trizeps, seitliche Schulter …), schwere Beinübungen früh, Bauch/Waden zuletzt. Alternativ im Profil: „Mehrgelenksübungen zuerst“.',
    refs: [{ label: 'Nunes et al. (2021), Eur J Sport Sci – Exercise Order Review & Meta-Analyse', url: 'https://pubmed.ncbi.nlm.nih.gov/32077380/' }],
  },
  {
    id: 'progression',
    title: 'Progressive Overload & doppelte Progression',
    evidence: 'moderat belegt',
    finding:
      'Fortlaufende Steigerung von Last oder Wiederholungen ist Grundlage langfristiger Anpassung. Eine randomisierte Studie mit 43 Trainierten fand ähnliche Hypertrophie, egal ob die Last oder die Wiederholungen gesteigert wurden; Kraft profitierte minimal mehr von Laststeigerung.',
    practice:
      'Doppelte Progression: Gewicht halten, bis alle Sätze das obere Ende des Wiederholungsbereichs bei Ziel-RIR erreichen, dann zur nächsten verfügbaren Stufe wechseln.',
    app: 'Steigerung, sobald alle Arbeitssätze ≥ obere Grenze bei Ø RIR ≤ Ziel+1. Ist der nächste Sprung > 12 % (z. B. 8 → 10 kg Kurzhantel), wird erst bis obere Grenze +2 gesteigert. Zweimal unter der unteren Grenze → eine Stufe zurück. Gewichtsstufen je Gerät/Kurzhantel sind einstellbar.',
    refs: [{ label: 'Plotkin et al. (2022), PeerJ – Last- vs. Wiederholungs-Progression, 43 Trainierte: beide wirksam', url: 'https://peerj.com/articles/14142' }],
  },
  {
    id: 'stagnation',
    title: 'Stagnation & Leistungsabfall',
    evidence: 'praktische Empfehlung',
    finding: 'Stagnation kann viele Ursachen haben: unzureichende Erholung, zu hohes oder zu niedriges Volumen, wenig Schlaf, Energiedefizit oder zu großer Abstand zum Versagen.',
    practice: 'Ursachen prüfen statt sofort mehr Volumen zu addieren. Bei Leistungsabfall kurzzeitig entlasten.',
    app: 'Stagnation = e1RM über 3 Einheiten ohne Fortschritt (> 1 %). Leistungsabfall = letzte zwei Einheiten 5 % bzw. 2 % unter dem früheren Bestwert → 1 Stufe leichter, −1 Satz, +1 RIR. Die App nennt mögliche Ursachen (Schlaf aus Check-ins, Wochenvolumen, Trainingslücken, RIR).',
    refs: [],
  },
  {
    id: 'recovery',
    title: 'Regeneration, Ermüdung & Muskelkater',
    evidence: 'praktische Empfehlung',
    finding:
      'Die Erholungszeit hängt von Volumen, Nähe zum Versagen, Übungsauswahl, Muskelgruppe und individuellen Faktoren ab. Muskelkater ist nur ein schwacher Marker für Regeneration. Schon eine Nacht ohne Schlaf senkte in einer kleinen Studie die Muskelproteinsynthese um ~18 %.',
    practice: 'Ein Muskel ist meist nach 48–72 h wieder belastbar; große Muskeln und hohe Volumina eher länger.',
    app: 'Ermüdungsmodell: Summe der effektiven Sätze, exponentiell abklingend mit muskelspezifischer Zeitkonstante (z. B. Seitl. Schulter 30 h, Bizeps 34 h, Brust 40 h, Beine 46–50 h). Muskelkater aus dem Check-in addiert 1,2 Punkte pro Stufe. Grün < 1,5 · Gelb ≥ 1,5 · Orange ≥ 3 · Rot ≥ 5 · Grau = > 10 Tage kein Reiz. Alles Schätzungen, keine Messwerte.',
    refs: [{ label: 'Lamon et al. (2021), Physiol Rep – Schlafentzug & Muskelproteinsynthese', url: 'https://pubmed.ncbi.nlm.nih.gov/33400856/' }],
  },
  {
    id: 'superset',
    title: 'Supersätze bei wenig Zeit',
    evidence: 'moderat belegt',
    finding:
      'Supersätze verkürzen die Trainingszeit; langfristig wurden keine signifikanten Unterschiede bei Kraft und Hypertrophie gegenüber klassischen Sätzen gefunden. Agonist/Antagonist-Supersätze erhalten die Wiederholungsleistung am besten. Die innere Belastung und wahrgenommene Anstrengung können höher sein.',
    practice: 'Bei Zeitmangel Antagonisten paaren (Bizeps/Trizeps), keine Übungen für denselben Muskel.',
    app: 'Bei ≤ 50 Minuten werden Bizeps/Trizeps und seitliche/hintere Schulter automatisch gepaart; der Timer gibt zwischen den Partnerübungen 20 s Wechselzeit.',
    refs: [{ label: 'Zhang et al. (2025), Sports Medicine – Superset vs. traditionelle Sätze', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12011898/' }],
  },
  {
    id: 'nutrition',
    title: 'Ernährung: Protein, Kalorienüberschuss, Kreatin',
    evidence: 'gut belegt',
    finding:
      'Protein: Zuwächse an fettfreier Masse steigen bis etwa 1,6 g/kg/Tag (obere Konfidenzgrenze ~2,2 g/kg). Ein großer Kalorienüberschuss erhöht bei Trainierten vor allem den Fettzuwachs, nicht nennenswert den Muskelzuwachs. Kreatin (3–5 g/Tag) bewirkt einen kleinen zusätzlichen Hypertrophie-Effekt.',
    practice: 'Ca. 1,6–2,2 g Protein/kg, moderater Überschuss mit einer Zunahme von etwa 0,1–0,3 % Körpergewicht pro Woche für Fortgeschrittene, 5 g Kreatin täglich, 7–9 h Schlaf.',
    app: 'Ziele: 2.800–3.000 kcal, 150 g Protein (~2,0 g/kg), 5 g Kreatin, 7–9 h Schlaf. Kalorienempfehlung aus linearem Gewichtstrend (21 Tage): < 0,1 %/Woche → +175 kcal, > 0,35 %/Woche → −150 kcal.',
    refs: [
      { label: 'Morton et al. (2018), Br J Sports Med – Protein-Meta-Analyse', url: 'https://pubmed.ncbi.nlm.nih.gov/28698222/' },
      { label: 'Helms et al. (2023), Sports Med Open – kleiner vs. großer Kalorienüberschuss', url: 'https://pubmed.ncbi.nlm.nih.gov/37914977/' },
      { label: 'Burke et al. (2023), Nutrients – Kreatin & regionale Hypertrophie', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10180745/' },
      { label: 'Iraki et al. (2019), Sports – Ernährungsempfehlungen für Bodybuilder (Off-Season)', url: pm('Iraki 2019 nutrition recommendations bodybuilders off-season') },
    ],
  },
];

export const RULES: { title: string; body: string }[] = [
  {
    title: '1. Verfügbare Tage bestimmen (rollierend, 7 Tage)',
    body: 'Explizit als „Habe Zeit“ markierte Tage sind fest. Fehlen Tage bis zur erwarteten Wochenfrequenz, ergänzt die App „mögliche“ Standardtage (Mi–So) mit möglichst großem Abstand zueinander und zum letzten Training (vorläufig). „Diese Woche nur 1×“ begrenzt die Einheiten bis Sonntag. „Weiß nicht, wann wieder“ plant nur die nächste Einheit – als Ganzkörper.',
  },
  {
    title: '2. Split wählen',
    body: '1 Einheit → Ganzkörper · 2 mit Pause → Ganzkörper A/B · 2 hintereinander → Push+Beine / Pull+Beinbeuger (oder OK/UK) · 3 am Stück → Push/Pull/Legs+ · 3 mit einem Doppeltag → OK/UK-Hybrid + Ganzkörper · 3 verteilt → Ganzkörper A/B/C. Für jeden Tag werden alle passenden Vorlagen durchgerechnet; die mit dem höchsten erwarteten Nutzen gewinnt (Wiederholung derselben Vorlage −20 %).',
  },
  {
    title: '3. Muskelbedarf bewerten',
    body: 'Score = Vorlagengewicht × Priorität × (Bedarf + Vernachlässigungsbonus) × Erholungsfaktor. Bedarf = 60 % Lücke zum 7-Tage-Ziel + 40 % Lücke zum 14-Tage-Ziel. Vernachlässigungsbonus: ab Tag 6 ohne direkten Reiz +0,1 pro Tag (max. +0,6) – so werden ausgelassene Beine automatisch nachgezogen. Erholungsfaktor: 1 bei geschätzter Ermüdung < 1,5, 0 bei ≥ 5.',
  },
  {
    title: '4. Einheit füllen (Nutzen pro Minute)',
    body: 'Schrittweise wird die Option mit dem höchsten Nutzen pro Minute hinzugefügt: neue Übung (2 Sätze + Rüstzeit/Aufwärmen) oder ein weiterer Satz (max. 4). Der Nutzen eines Satzes ist die Summe der Muskelbeiträge × abnehmender Grenznutzen; Belastung ermüdeter Synergisten zieht Punkte ab. Bonus für Dehnungsbetonung, Favoriten und Übungen mit Historie, Malus für dieselbe Übung < 36 h. Max. 9 Übungen, max. 2 pro Zielmuskel.',
  },
  {
    title: '5. Simulation der Folgetage',
    body: 'Jede geplante Einheit wird als virtueller Reiz in das Ermüdungsmodell eingetragen, bevor der nächste Tag geplant wird. Deshalb überschneiden sich aufeinanderfolgende Tage kaum. Wird ein Tag verpasst, existiert dieser Reiz nie – der Plan wird beim nächsten Öffnen aus der echten Historie neu berechnet.',
  },
  {
    title: '6. Tagesform',
    body: 'Check-in-Bereitschaft < 45: Zeitbudget ×0,75 und +1 RIR; < 60: ×0,9. Ohne Check-in wird normal geplant.',
  },
  {
    title: '7. Lernt mit dir: Volumen & Tempo',
    body: 'Einmal pro Woche prüft die App je Muskel die Kraftentwicklung (e1RM) der letzten 4 Wochen: Fortschritt ≥ +1,5 % → Volumen bleibt; Stagnation bei guter Erholung → Wochenziel +10 %; Leistung ≤ −2 % oder häufig starker Muskelkater → −15 % (Grenzen ±30 %). Nach jedem Training wird die tatsächliche mit der geplanten Dauer verglichen (gleitender Mittelwert) – dadurch passen Pläne für eine bestimmte Zeit zu deinem echten Tempo.',
  },
];
