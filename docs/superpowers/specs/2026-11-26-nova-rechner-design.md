# Import-Kostenrechner Österreich (nova-rechner) – Design

Stand: 2026-11-26 · Status: Entwurf zur Freigabe

## 1. Intention und Warum

Wer ein Fahrzeug nach Österreich importiert (aus der EU oder einem Drittland wie USA/Japan/UK), steht vor einem Dickicht aus NoVA, Zoll, Einfuhrumsatzsteuer, Fracht, Typisierung und Zulassung. Der Rechner beantwortet eine Frage: **„Was kostet mich dieses Fahrzeug am Ende wirklich in Österreich auf der Straße – und woraus setzt sich das zusammen?"**

Nutzer sind **Privatpersonen** (einfach, erklärend) und **gewerbliche Importeure/Händler** (netto, Vorsteuer, Marge, Kundenangebot, mehrere Fahrzeuge in einer Charge). Beide Modi sind Teil des Umfangs (vom Auftraggeber so festgelegt).

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Nachvollziehbare Gesamtkosten inkl. Aufschlüsselung je Posten mit Erklärung („warum diese Zahl?").
- Rechtsstand (NoVA-Formeln, Zölle, Sätze) als **versionierte Daten**, nicht im Code verstreut; jede Zahl trägt Quelle, Stand und Status `belegt` / `Schätzwert`.
- Live-Berechnung beim Tippen; Szenarienvergleich; teilbarer Link; PDF-Export / Kundenangebot.
- Läuft als **ein Docker-Image** (docker compose, Port 3000, Healthcheck, Non-Root).
- Ansprechendes, modernes Design (hell + Dark Mode), responsiv, barrierearm (WCAG 2.1 AA).

**Nicht-Ziele**
- Keine Rechtsberatung, kein Ersatz für Zollagent/Finanzamt (dauerhafter, sichtbarer Hinweis).
- Keine Live-Frachtpreise (Richtwerte + manuelle Überschreibung).
- Kein Benutzerkonto, keine Datenbank, kein Server-Speicher von Eingaben.
- Keine Bundesland-Differenzierung der Gebühren, nur Deutsch, nur EUR als Ausgabewährung (Aufbau so, dass i18n später möglich ist).
- Klein-Lkw (Güterbeförderung) und Oldtimer-Sonderregeln: nicht im Umfang.

**Anti-Ziele (Fehlschlag, auch wenn es technisch läuft)**
- Eine Zahl, die präziser aussieht, als sie belegt ist (Schätzwerte müssen als solche erkennbar sein).
- Ein veralteter Rechtsstand ohne Warnung (Regelwerk hat Gültigkeitsdatum; Berechnung nach Stichtag; Hinweis bei Ablauf).
- Eingaben, die serverseitig landen oder geloggt werden.

## 3. Rahmenbedingungen

- Plattform: Next.js (App Router, TypeScript), Docker (Standalone-Output), Container läuft auf eigenem Server/NAS mit docker compose; Reverse-Proxy wird vom Betreiber vorgelagert.
- Ausgehender Netzwerkzugriff nur für den EZB-Referenzkurs (`eurofxref-daily.xml`); Ausfall muss die App benutzbar lassen (manueller Kurs).
- Rechtsstand zum Zeitpunkt der Erstellung: siehe Abschnitt 5 und `docs/` Quellenliste im Regelwerk.

## 4. Ansätze (gewählt: C)

| | Beschreibung | Trade-off |
|---|---|---|
| A | Reine TS-Engine im Browser, PDF im Browser | schlankes Image, PDF-Layout browserabhängig |
| B | Berechnung nur serverseitig | Latenz, kein Mehrwert |
| **C (gewählt)** | **Engine wie A, PDF serverseitig per Headless Chromium** | **pixelgenaues PDF/Händlerangebot; Image +300–400 MB, zusätzlicher Prozess** |

Begründung: Das Händlerangebot mit Logo/Firmenfeld soll exakt wie die Webansicht aussehen und reproduzierbar sein. Die Engine ist identisch zu A, d. h. die Entscheidung betrifft nur den PDF-Pfad.

## 5. Rechenmodell (Soll-Verhalten)

Die Engine ist eine **reine Funktion** `berechne(eingabe, regelwerk, stichtag) → ergebnis` ohne I/O. Das Ergebnis ist eine Liste von Posten `{id, label, betrag, status, erklaerung, quelle}` plus Summen.

### 5.1 Fahrzeugarten
Pkw (Benzin/Diesel/Hybrid/PHEV), Elektro/Wasserstoff-Pkw, Motorrad, Leichte Nutzfahrzeuge (N1 pkw-artig, 4–9 Sitze, ≤ 3.500 kg), Wohnmobil. Kastenwagen/Pick-up/Pritsche: Hinweis „ggf. NoVA-frei" mit Bedingungen (kein Rechenpfad ohne Nutzerbestätigung).

### 5.2 NoVA (belegt, BMF „Rechtslage ab 1. Juli 2025", Seite Stand 2026)
**Pkw/N1/Wohnmobil:** `NoVA = BG × Satz + Malus − 350 €`, `Satz = round((CO2_WLTP − Abzugswert) / 5)` min. 0, max. 80 %. `Malus = 80 € × max(0, CO2 − 155)`.
Abzugswert: 2025 (ab 1.7.): 94 · 2026: 91 · 2027: 88 · 2028: 85 · 2029: 82. Ab 2030: nicht geregelt → Warnung.
**Motorrad (> 125 cm³):** `NoVA = BG × Satz + Malus`, `Satz = round((CO2_WMTC − Abzugswert) / 4)`, max. 30 %, Malus 20 €/g über 150. Abzugswert: 2025: 53 · 2026–2027: 51 · 2028–2029: 49. ≤ 125 cm³: keine NoVA.
**Wohnmobil:** Pkw-Formel, Mindestsatz 16 %; bei Aufbauart „SA" Wahlrecht tatsächlicher CO2-Wert oder 2 × kW.
**Befreiung:** CO2 = 0 g/km (Elektro/Wasserstoff). Hybride nicht befreit.
**Ersatzwerte ohne WLTP:** 1,27 × NEFZ (Wahlrecht) oder 2 × kW.
**Rechtslage-Stichtag:** Drittland-Import: Zeitpunkt der Zulassung/Lieferung (volles Malus/Abzugsposten, keine Wertminderung). EU-Import: Rechtslage der Erstzulassung im Ausland; Malus und 350-€-Abzug werden bei Kenntnis des Neuwagenwerts im Verhältnis aktueller BG / Neuwagenwert gekürzt, sonst um ein Achtel je vollem Jahr (Untergrenze ein Achtel).
**Übergangsregel:** Kaufvertrag vor 1. Dezember und Lieferung vor 1. April des Folgejahres → alte Rechtslage; optionales Eingabefeld „Vertragsdatum".

### 5.3 Zoll und Einfuhrumsatzsteuer (Drittland)
- Zoll: Pkw 10 %; Motorrad > 250 cm³ 6 % (belegt, ÖAMTC); übrige Sätze (Motorrad ≤ 250 cm³, Lieferwagen, Wohnmobil) = **Schätzwert**, editierbar. Präferenzzollfrei: Schweiz/Norwegen mit Nachweis. Der Zollsatz ist pro Fall überschreibbar (Hinweis: ob für US-Ursprungsfahrzeuge seit Juli 2026 Nullzoll gilt, ist **nicht belegt**; Standard bleibt 10 %).
- Zollwert (CIF) = Kaufpreis (in EUR) + Beförderung und Transportversicherung bis zur EU-Außengrenze/Einfuhrhafen. Quellen formulieren abweichend (ÖAMTC „bis EU-Außengrenze", oesterreich.gv.at „bis Bestimmungsort") → Modellannahme dokumentiert, im UI erklärt.
- **EUSt-Satz hängt vom Ort der Einfuhrabfertigung ab** (Eingabe „Verzollung in"): Österreich (T1-Versand, 20 %) oder Einfuhrhafen-Land (z. B. DE 19 %, NL 21 %, IT 22 %, SI 22 %). Standard: Österreich. Sätze sind Daten mit Stand und `Schätzwert`-Kennzeichnung, bis geprüft.
- EUSt-Bemessungsgrundlage = Zollwert + Zoll + Beförderung bis zum Bestimmungsort (Nachlauf).

### 5.4 EU-Import
- Neufahrzeug (≤ 6.000 km **oder** ≤ 6 Monate seit Erstinbetriebnahme): 20 % Erwerbsteuer in Österreich, auf Kaufpreis netto.
- Gebraucht, Privatperson: keine österreichische USt (ausländische USt im Kaufpreis; Eingabe brutto/netto).
- Gebraucht, Unternehmer: 20 % Erwerbsteuer auf Nettokaufpreis; als Vorsteuer abziehbar (Händlermodus: Anzeige netto).
- Differenzbesteuerung: Hinweis, dass auf Rechnung ausgewiesen sein muss, damit der Nettokaufpreis NoVA-Basis ist.

### 5.5 NoVA-Bemessungsgrundlage (BG)
Entgelt bzw. gemeiner Wert ohne USt. Drittland: Kaufpreis gilt, außer er liegt unter dem Mittelwert der Fahrzeugbewertungsliste → optionales Feld „Marktwert lt. Bewertungsliste"; BG = max(Anschaffungswert, Marktwert). Welche Kostenanteile (Fracht, Zoll) zum Anschaffungswert zählen, ist eine **Modellannahme** (Standard: Kaufpreis + Beförderung + Zoll) und im UI als solche markiert.

### 5.6 Transport & Verschiffung
Eingaben: Route (Ursprungsland/-hafen → Einfuhrhafen), Art (RoRo/Container), Fahrzeuggrößenklasse, Richtwert vorbefüllt, jedes Feld überschreibbar: Vorlauf im Ursprungsland, Seefracht, Hafen-/Terminalgebühren, Transportversicherung (% vom Warenwert), Zollagent/Spedition, Nachlauf bis Österreich, Überstellung (ausländisches Kennzeichen 100–150 €). Frachtwerte sind **Schätzwerte** mit Stand.

### 5.7 Typisierung & Zulassung (alles `Schätzwert`, editierbar)
Genehmigungsdatenbank-Eintragung über Generalimporteur (≤ 180 € belegt) oder Landesprüfstelle (~150 € belegt), Einzelgenehmigung/Typisierung, § 57a-Gutachten, CoC-Beschaffung, Zulassungsgebühr, Kennzeichen, Eintragungsgebühr. Nur Teile sind belegt; der Rest wird als Platzhalterwert mit Hinweis geführt. Der Nutzer kann Beträge überschreiben.

### 5.8 Händlermodus
- Netto-Darstellung, Vorsteuerabzug (EUSt/Erwerbsteuer), Kostenbasis ohne USt.
- Marge (% oder €) → Verkaufspreis netto/brutto inkl. NoVA und 20 % USt.
- **Charge:** mehrere Fahrzeuge je Container; Fracht/Container-Fixkosten werden anteilig verteilt (Standard: nach Fahrzeugwert, alternativ gleichmäßig); Ergebnis je Fahrzeug und gesamt.
- Kundenangebot als PDF mit Firmenfeld/Logo, **ohne** interne Einkaufskosten/Marge.

### 5.9 Währung
Eingabewährung EUR/USD/GBP/JPY/CHF (erweiterbar). EZB-Referenzkurs über `/api/fx` (serverseitig geholt und gecacht, TTL ~24 h, stale-while-error); manuell überschreibbar; Kurs und Datum stehen im Ergebnis.

## 6. Architektur

```
Browser ── Formular/Ergebnis (React, Live-Engine) ─┐
   │ URL-State (komprimiert, kein Server-Speicher)  │ engine/ (reines TS, geteilt)
   ├─ GET /api/fx ──────────► ECB-Cache (Memory)    │ regelwerk/ (versionierte Daten + Quellen)
   └─ POST /api/pdf ────────► Chromium (Playwright) ┘
                              rendert /print/[id]-Seite aus validierter Eingabe
```
- `engine/`: Berechnung, Typen, Zod-Schemas für Eingaben; keine UI-Abhängigkeit; Vitest-Tests.
- `regelwerk/`: je Rechtsstand eine Datei mit Gültigkeitszeitraum; Auswahl nach Stichtag (Zulassungsdatum/Erstzulassung/Vertragsdatum).
- `app/`: Seiten, Komponenten, Print-Layouts. `app/api/fx`, `app/api/pdf`.
- PDF: Server validiert Eingabe (Zod), rendert eine dedizierte Print-Route, die dieselbe Engine nutzt (kein doppelter Rechenweg), erzeugt PDF. **Chromium läuft ohne Netzwerkzugriff nach außen** (Request-Interception: nur die eigene Origin), mit Timeout, Größenlimit und Concurrency-Limit.
- Docker: Multi-Stage, Standalone-Output, System-Chromium, Non-Root, Healthcheck (`/api/health`), `docker-compose.yml`, `.dockerignore`.

## 7. UX und Design

- Lauf: Schritt-Flow in **einer Seite** (Fahrzeug → Herkunft & Preis → Transport → Zulassung) links, **sticky Ergebnis** rechts (große Gesamtsumme, Donut/Stacked-Bar der Aufteilung, Tabelle mit „Warum?"-Erklärungen, Schätzwerte gekennzeichnet).
- Modus-Umschalter Privat/Gewerbe; Szenario-Vergleich (A/B nebeneinander, Differenz hervorgehoben); „Link kopieren" und lokal speichern (localStorage); PDF/Angebot-Button.
- Visuell: modern/Fintech, hell + automatischer Dark Mode, Karten, weiche Schatten, große Typografie für die Summe. Umsetzung mit dem Skill `frontend-design`, Prüfung mit `design:accessibility-review`, `design:design-critique`, Responsive-/Playwright-Screenshots.

## 8. Qualitätssicherung

- Engine: Unit-/Golden-Tests je Regel (Formelwerte pro Jahr, Grenzfälle: CO2 91/155, 0 g/km, 125 cm³, Wertminderung 1/8 über 7 Jahre, Übergangsregel), Property-Tests (Monotonie: höherer CO2 → nie niedrigere NoVA; Summe = Σ Posten).
- Abgleich mit Rechenbeispielen und dem BMF-Rechner, wo zugänglich.
- E2E (Playwright): Pflichtpfade Pkw-EU-privat, Pkw-USA-Drittland, E-Pkw, Motorrad, Charge, PDF-Download.
- Security: Zod-Validierung aller Server-Eingaben, kein SSRF (feste FX-URL, Chromium ohne Egress), Security-Header, Rate-Limit für `/api/pdf`, `securitymaxxing`-Durchgang vor „fertig".
- Docker-Abnahme: Image baut, Container startet, Healthcheck grün, PDF funktioniert **im Container**.

## 9. Etappen

1a. Recherche NoVA-Rechtslage-Perioden 2008 bis heute (siehe 11a), Regelwerk-Datenmodell mit Perioden.
1. Repo-Gerüst, Regelwerk-Daten, Engine + Tests (Pkw/E-Pkw/Motorrad/N1/Wohnmobil, EU + Drittland).
2. UI + Ergebnis + Design (Privatmodus), FX-Endpunkt.
3. Vergleich, URL-Teilen, lokales Speichern.
4. Händlermodus (Netto, Marge), PDF/Angebot per Chromium, Charge.
5. Docker/Compose-Härtung, E2E, Security-/Accessibility-Review, README.

## 10. Entscheidungen des Auftraggebers

- Herkunft: EU + Drittländer · Fahrzeuge: Pkw, E-Pkw, Motorräder, N1/Wohnmobile · Modi: Privat und Gewerbe.
- Next.js-Fullstack · Docker mit compose auf eigenem Server/NAS.
- Kostenposten: NoVA, Zoll, EUSt, Transport/Verschiffung, Typisierung/Zulassung (laufende Kosten nicht).
- Frachtpreise: Richtwerte + überschreibbar · Gebühren: Schätzwerte mit Kennzeichnung.
- Ergebnis: Diagramm, PDF/Angebot, Szenarienvergleich, Teilen/Speichern.
- Design: modern hell + Dark Mode · Währung: EZB live + manuell.
- Händler: Netto/Vorsteuer, Marge/Verkaufspreis, PDF-Angebot, Charge · PDF-Weg: **C (serverseitig Chromium)**.

## 11. Meine Setzungen (zum Gegenprüfen)

- Nur Deutsch, nur EUR-Ausgabe; keine Bundesland-Logik; laufende Kosten ausgeklammert.
- EUSt-Verzollungsort als eigenes Eingabefeld (Standard Österreich/T1).
- Modellannahmen zu Zollwert/NoVA-BG sind sichtbar als „Annahme" markiert.
- Kein Server-Speicher von Eingaben; Teilen nur über URL-State.
- **Wertminderung EU-Gebrauchtimport:** Pro vollem abgelaufenem Jahr seit Erstzulassung werden Malus **und** 350-€-Abzugsposten um ein Achtel gekürzt (0 Jahre → keine Kürzung; ab 7 Jahren bleibt ein Achtel, d. h. Faktor = max(1/8, 1 − Jahre/8)). Ist der Neuwagenwert bekannt, gilt stattdessen das Verhältnis aktueller BG / Neuwagenwert. Wortlaut der BMF-Seite „Steuersatz" ist bei der Umsetzung gegenzulesen und die Golden-Tests sind daran auszurichten.
- **Händlermodus, NoVA:** NoVA wird beim Import/Erwerb entrichtet und ist Teil der Kostenbasis (keine Neuberechnung beim Weiterverkauf). Verkaufspreis netto = Netto-Gesamtkosten (inkl. NoVA, ohne abziehbare USt) × (1 + Marge) bzw. + Marge in €; Verkaufspreis brutto = netto + 20 % USt. Kein zirkulärer Bezug. Die Vereinfachung wird im UI und im PDF-Hinweis genannt.
- **EU-Einkauf, ausländische USt:** Eingabeart je Fahrzeug: `Netto`, `Brutto` (mit USt-Satz des Verkäuferlandes, Länder-Tabelle mit Stand als Vorbelegung, überschreibbar) oder `Privatverkauf ohne USt`.
- **Charge:** nur Drittland-Importe (Container/RoRo-Sammeltransport). Je Fahrzeug: Art, Preis/Währung, CO2/Hubraum, Datum, Zollsatz. Gemeinsam: Route, Wechselkurs-Stand, Container-Fixkosten. Gemischte Fahrzeugarten sind erlaubt. Verteilung der Fixkosten nach Wert (Standard) oder gleichmäßig.
- **Betrieb:** Image für amd64 und arm64 baubar (Debian-Chromium); Betrieb unter Domain-Root, optional `BASE_PATH` als Build-Argument; Client-IP für das Rate-Limit nur aus `X-Forwarded-For`, wenn `TRUST_PROXY=true`; gleichzeitige PDF-Renderings per `PDF_CONCURRENCY` (Standard 1).
- **Währung bei Nebenkosten:** Jedes Kostenfeld hat EUR als Standard und eine wählbare Währung (derselbe Kurs). Der EZB-Tageskurs ist eine **Modellannahme** (die Zollbehörde verwendet eigene Monatskurse); im Ergebnis als „Annahme" markiert.

## 11a. Entscheidung des Auftraggebers: Erstzulassungsjahre

**Der EU-Gebrauchtimport deckt alle Erstzulassungsjahre ab 2008 mit der jeweils gültigen NoVA-Rechtslage ab** (Auftraggeber-Entscheidung; Empfehlung war „ab 7/2021"). Folgen für den Plan:

- Das Regelwerk wird in **Rechtslage-Perioden** geführt (mind.: ab 7/2025, 7/2021–6/2025, NEFZ-Zeit mit CO2-Formel/Malus/Bonus, Zeit davor mit Verbrauchsformel). Jede Periode hat eigene Formel, Abzugswerte, Malus, Höchstsätze und **CO2-Messverfahren (NEFZ/WLTP)**; bei NEFZ-Fahrzeugen gilt der NEFZ-Eingabepfad.
- **Etappe 1a (vor Engine-Bau): Recherche und Belegung der Perioden** anhand BMF-Seiten (u. a. „Rechtslage von 1. Juli 2021 bis 30. Juni 2025") und NoVAG-Fassungen im RIS. Jede Periode bekommt Quelle und Status `belegt` / `nicht verifiziert`; nicht belegbare Perioden werden **nicht stillschweigend gerechnet**, sondern im UI als „nicht verifiziert" gekennzeichnet.
- Erstzulassung **vor 2008**: Warnung und keine verbindliche Berechnung (nur Hinweis auf Finanzamt/Importeur).
- Golden-Tests je Periode und Periodengrenze (Stichtage), jeweils mit belegten Beispielwerten.
- Risiko: Für ältere Perioden sind belastbare Online-Quellen schwerer zu finden; der Aufwand ist hoch und das Ergebnis kann einzelne Perioden als „nicht verifiziert" lassen. Das ist ein bewusst akzeptiertes Risiko.

## 12. Dem Builder überlassen

UI-Komponentenbibliothek (z. B. shadcn/Radix + Tailwind), Chart-Bibliothek, URL-State-Format, Chromium-Anbindung (Playwright vs. Puppeteer), konkrete Richtwerte der Frachttabelle (mit Quellen/Stand), Teststrategie im Detail, Verzeichnisstruktur.

## 13. Quellen (Stand der Recherche 2026-11-26)

BMF „NoVA – Rechtslage ab 1. Juli 2025", „NoVA-Steuersatz", „Steuergegenstand", „Befreiung", „Erhebung der NoVA", „Fahrzeugimport aus Drittstaaten", „Fahrzeugerwerb aus EU-Mitgliedstaaten"; oesterreich.gv.at „Kfz-Import aus Drittländern"; ÖAMTC „Eigenimport". Nicht verifiziert: Zollsätze für Lieferwagen/kleine Motorräder, EUSt-Sätze anderer EU-Länder, Behördengebühren, Frachtpreise.
