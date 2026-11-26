# Import-Kostenrechner Österreich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine als Docker-Container laufende Next.js-Webapp, die die Gesamtkosten eines Fahrzeugimports nach Österreich (NoVA, Zoll, EUSt, Verschiffung, Typisierung/Zulassung) für Privat- und Händlernutzung berechnet, vergleicht und als PDF ausgibt.

**Architecture:** Eine reine TypeScript-Engine (`berechne(eingabe, ctx) → Ergebnis`) mit versioniertem Regelwerk (NoVA-Perioden, Zölle, Sätze, Richtwerte; jeder Wert mit Quelle/Stand/Status) wird von Browser (Live-Ergebnis), Server (PDF-Print-Route) und Tests gleichermaßen genutzt. Server-Aufgaben: `/api/fx` (EZB-Kurs mit Cache), `/api/pdf` (Headless Chromium rendert die Print-Route), `/api/health`. Kein Server-Speicher von Eingaben; URL-State + localStorage.

**Tech Stack:** Next.js (App Router, TypeScript, `output: 'standalone'`), Zod, Vitest (+ fast-check), Playwright (E2E und PDF), Tailwind CSS, Docker (Debian-slim + System-Chromium, amd64/arm64), docker compose. Versionen beim Scaffold per `npm view <pkg> version` prüfen, nicht aus dem Gedächtnis übernehmen.

**Spec:** `docs/superpowers/specs/2026-11-26-nova-rechner-design.md`

## Global Constraints

- Nur Deutsch; Ausgabewährung nur EUR; Beträge als `number` in EUR, auf Cent gerundet (kaufmännisch, half-up) über `runde2()`; Steuersätze in Prozent kaufmännisch auf ganze Prozent (`rundeProzent()`).
- Jeder Regelwert trägt `{ wert, quelle, stand, status: 'belegt' | 'schaetzwert' | 'nicht_verifiziert' }`; das UI kennzeichnet `schaetzwert` und `nicht_verifiziert` sichtbar; kein stilles Rechnen mit nicht belegten Perioden.
- NoVA 2026 Pkw/N1/Wohnmobil: `BG × round((CO2_WLTP − 91)/5) + 80 × max(0, CO2 − 155) − 350`, Satz max. 80 %; Abzugswert 2025(ab 1.7.): 94, 2026: 91, 2027: 88, 2028: 85, 2029: 82. Motorrad (>125 cm³): `BG × round((CO2_WMTC − Abzugswert)/4)`, max. 30 %, Malus 20 €/g über 150, Abzugswert 2025: 53, 2026–2027: 51, 2028–2029: 49. Wohnmobil Mindestsatz 16 %. CO2 = 0 → befreit. Ersatzwert ohne WLTP: 1,27 × NEFZ oder 2 × kW.
- Zoll Pkw 10 %, Motorrad >250 cm³ 6 %; EUSt Österreich 20 %; EU-Neufahrzeug: ≤ 6.000 km oder ≤ 6 Monate.
- Der Ergebnisstichtag und die Rechtslage-Perioden werden zentral über `selectNovaPeriode` gewählt; Erstzulassung vor 2008 → Warnung statt Berechnung.
- Keine Eingaben auf dem Server speichern oder loggen. Container: Non-Root, Healthcheck `/api/health`, Port 3000, `BASE_PATH` (Build-Arg, Standard leer), `TRUST_PROXY`, `PDF_CONCURRENCY` (Standard 1).
- Dauerhafter Hinweis im UI/PDF: „Keine Rechtsberatung; Werte Stand <Datum>".
- Commit je Task; Commit-Nachrichten enden mit den Attribution-Zeilen der Session.

## Review Focus

- **NoVA wird negativ:** Fahrzeug mit niedrigem BG oder CO2 ≤ 91 ergibt rechnerisch `< 0` durch den 350-€-Abzug → Ergebnis muss 0 sein, nie negativ (Test in Task 4).
- **Fehlender CO2-Wert bei Hybrid/Verbrenner:** darf nicht als 0 g/km (befreit) gelesen werden; leeres Feld → Ersatzwert (kW × 2) bzw. Eingabefehler (Test in Task 4/9).
- **Wechselkurs fehlt, 0 oder EZB-Feed down/kaputt:** kein NaN/Infinity im Ergebnis; manueller Kurs bleibt möglich; XML-Parser verwirft Müll (Test in Task 10).
- **Grenzdaten:** Erstzulassung vor 2008 / in der Zukunft / exakt am Periodenwechsel (30.6.→1.7.2025, 31.12.→1.1.), Übergangsregel Vertrag 30.11./Lieferung 31.3. (Test in Task 3 und 5).
- **PDF-Endpunkt:** übergroße oder manipulierte Eingabe, parallele Requests über `PDF_CONCURRENCY`, ausgehende Requests aus Chromium (Test in Task 17).

---

## Dateistruktur

```
package.json, tsconfig.json, next.config.ts, vitest.config.ts, playwright.config.ts
Dockerfile, docker-compose.yml, .dockerignore, README.md
src/engine/    types.ts schema.ts runde.ts nova.ts wertminderung.ts zoll.ts eu-import.ts
               transport.ts gebuehren.ts haendler.ts charge.ts berechne.ts
src/regelwerk/ types.ts nova-perioden.ts zoll.ts ust-saetze.ts fracht.ts gebuehren.ts index.ts
src/lib/       fx.ts url-state.ts format.ts
src/app/       layout.tsx page.tsx globals.css print/page.tsx
               api/fx/route.ts api/pdf/route.ts api/health/route.ts
src/components/ (Formular-Schritte, Ergebnis, Chart, Vergleich, Händler, Charge, ThemeToggle)
tests/engine/*.test.ts  tests/lib/*.test.ts  tests/e2e/*.spec.ts
docs/superpowers/research/nova-perioden.md
```

---

### Task 1: Projektgerüst und Health-Endpoint

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/api/health/route.ts`, `.gitignore`
- Test: `tests/lib/health.test.ts`

**Interfaces:**
- Produces: npm-Skripte `dev`, `build`, `start`, `test`, `test:e2e`, `lint`, `typecheck`; `GET /api/health → 200 { status: 'ok' }`.

- [ ] **Step 1:** Next.js (App Router, TypeScript, Tailwind) im Repo-Root anlegen, `output: 'standalone'` und `basePath: process.env.BASE_PATH ?? ''` in `next.config.ts`; Zod, Vitest, fast-check, Playwright-Test als Abhängigkeiten.
- [ ] **Step 2:** Failing test `GET returns { status: 'ok' }` in `tests/lib/health.test.ts` (importiert den Route-Handler `GET` und prüft `await res.json()` gleich `{ status: 'ok' }`).
- [ ] **Step 3:** Run `npx vitest run tests/lib/health.test.ts` → Expected: FAIL (Modul fehlt).
- [ ] **Step 4:** `GET` in `src/app/api/health/route.ts` implementieren. Run again → PASS; `npm run build` → Expected: Build erfolgreich, `.next/standalone` existiert.
- [ ] **Step 5:** Commit `chore: scaffold next app with health endpoint`.

---

### Task 2: Recherche der NoVA-Rechtslage-Perioden 2008 bis heute (Etappe 1a)

**Files:**
- Create: `docs/superpowers/research/nova-perioden.md`

**Interfaces:**
- Produces: Pro Periode und Fahrzeugart eine Tabellenzeile mit: Gültig von/bis, Formel, Abzugswert, Divisor, Höchststeuersatz, Malus-Schwelle/-Betrag, Abzugsposten, Messverfahren (NEFZ/WLTP/WMTC/Verbrauch), Sonderregeln, **Quelle (URL/Fundstelle NoVAG-Fassung im RIS)**, `status` (`belegt` / `nicht_verifiziert`). Dieses Dokument ist die einzige Datenquelle für Task 3.

- [ ] **Step 1:** BMF-Seiten „Rechtslage von 1. Juli 2021 bis 30. Juni 2025", „Rechtslage ab 1. Juli 2025" und die Seiten früherer Fassungen sowie NoVAG-Fassungen im RIS (ris.bka.gv.at, „Normverbrauchsabgabegesetz 1991", Fassungen je Stichtag) lesen. Zeitraum 2008 bis heute lückenlos auf Perioden aufteilen (Stichtage: 1.7.2021, 1.1.2020/1.10.2020 usw. sind aus den Quellen zu entnehmen, nicht zu raten).
- [ ] **Step 2:** Je Periode Werte mit Fundstelle eintragen. Was nicht aus einer Primärquelle belegbar ist: `nicht_verifiziert` und Begründung; keine geschätzten Werte als `belegt` ausgeben.
- [ ] **Step 3:** Aus dem Dokument mindestens ein Rechenbeispiel je Periode ableiten (BG, CO2 → erwartete NoVA) und **von Hand nachrechnen**; die Beispiele stehen im Dokument und werden in Task 4/5 zu Golden-Tests.
- [ ] **Step 4:** Verifizieren: Periodenlücken/-überlappungen prüfen (Ende einer Periode + 1 Tag = Beginn der nächsten); Ergebnis als Tabelle am Dokumentende.
- [ ] **Step 5:** Commit `docs: research NoVA law periods 2008-today`. Nicht verifizierte Perioden werden dem Auftraggeber im Abschlussbericht dieses Tasks gelistet.

---

### Task 3: Regelwerk-Datenmodell und Periodenauswahl

**Files:**
- Create: `src/regelwerk/types.ts`, `src/regelwerk/nova-perioden.ts`, `src/regelwerk/zoll.ts`, `src/regelwerk/ust-saetze.ts`, `src/regelwerk/index.ts`
- Test: `tests/engine/regelwerk.test.ts`

**Interfaces:**
- Produces:
  - `type Status = 'belegt' | 'schaetzwert' | 'nicht_verifiziert'`; `interface Beleg { quelle: string; stand: string; status: Status }`
  - `type Fahrzeugart = 'pkw' | 'e-pkw' | 'motorrad' | 'n1' | 'wohnmobil'`
  - `interface NovaPeriode extends Beleg { von: string; bis: string | null; art: 'pkw' | 'motorrad'; verfahren: 'WLTP' | 'NEFZ' | 'WMTC' | 'VERBRAUCH'; abzugswert: number; divisor: number; hoechstsatz: number; malusSchwelle: number; malusProGramm: number; abzugsposten: number; mindestsatzWohnmobil?: number }`
  - `selectNovaPeriode(art: 'pkw' | 'motorrad', stichtag: string /* ISO yyyy-mm-dd */): NovaPeriode` — wirft `RegelwerkLuecke`, wenn vor 2008 oder keine Periode.
  - `ZOLLSAETZE`, `EUST_SAETZE` (`Record<Laenderkuerzel, { satz: number } & Beleg>`).

- [ ] **Step 1:** Failing tests in `tests/engine/regelwerk.test.ts`: `selectNovaPeriode('pkw','2026-03-01').abzugswert === 91`; `…('2025-06-30')` und `…('2025-07-01')` liefern verschiedene Perioden; `…('2029-12-31').abzugswert === 82`; `…('2007-12-31')` wirft `RegelwerkLuecke`; `('motorrad','2026-06-01').abzugswert === 51`; alle Perioden lückenlos und überlappungsfrei (Schleife über `NOVA_PERIODEN`).
- [ ] **Step 2:** Run `npx vitest run tests/engine/regelwerk.test.ts` → Expected: FAIL.
- [ ] **Step 3:** Typen und Daten aus `docs/superpowers/research/nova-perioden.md` (Task 2) übernehmen; Perioden sortiert, Auswahl per Datumsvergleich. Zoll: Pkw 10 %, Motorrad >250 cm³ 6 % (`belegt`), übrige `schaetzwert`. EUSt: AT 20 % `belegt`; DE 19, NL 21, IT 22, SI 22 als `schaetzwert`.
- [ ] **Step 4:** Tests → PASS. Commit `feat: regelwerk data model and period selection`.

---

### Task 4: NoVA-Berechnung je Periode

**Files:**
- Create: `src/engine/runde.ts`, `src/engine/nova.ts`
- Test: `tests/engine/nova.test.ts`

**Interfaces:**
- Consumes: `NovaPeriode`, `selectNovaPeriode` (Task 3).
- Produces:
  - `runde2(n: number): number` (half-up auf Cent), `rundeProzent(n: number): number`.
  - `interface NovaEingabe { art: Fahrzeugart; bg: number; co2?: number; verfahren: 'WLTP'|'NEFZ'|'WMTC'; kw?: number; hubraum?: number; wohnmobilSA?: boolean }`
  - `interface NovaErgebnis { betrag: number; satzProzent: number; malus: number; abzugsposten: number; befreit: boolean; ersatzwertGenutzt: 'nefz127' | 'kw2' | null; hinweise: string[] }`
  - `berechneNova(e: NovaEingabe, p: NovaPeriode): NovaErgebnis`

- [ ] **Step 1:** Failing tests (Periode 2026): Pkw BG 30000, CO2 120 → `betrag 1450` (Satz 6 %); CO2 170 → `5650` (Satz 16 %, Malus 1200); CO2 91 → `0` (nicht negativ); CO2 500 → Satz 80 %; `art 'e-pkw'`/CO2 0 → `befreit true, betrag 0`; Motorrad BG 15000, WMTC 120 → `2550` (Satz 17 %), Hubraum 125 → `betrag 0` mit Hinweis; Wohnmobil mit rechnerischem Satz 10 % → Satz 16 %; CO2 fehlt + kW 100 → Ersatzwert 200 g/km und `ersatzwertGenutzt 'kw2'`; CO2 fehlt und kW fehlt bei Verbrenner → wirft `EingabeFehler` (nicht als 0 g/km gelesen). Je weitere Periode aus Task 2: ein Golden-Test mit dem dort von Hand verifizierten Beispiel.
- [ ] **Step 2:** Run `npx vitest run tests/engine/nova.test.ts` → FAIL.
- [ ] **Step 3:** Implementieren; `betrag = max(0, runde2(bg × satz/100 + malus − abzugsposten))`; Reihenfolge: Befreiung → Ersatzwert → Satz (gerundet, gedeckelt) → Malus → Abzugsposten.
- [ ] **Step 4:** Tests → PASS; Property-Test (fast-check): bei gleichem BG ist `betrag` in `co2` monoton nicht fallend. Commit `feat: NoVA calculation`.

---

### Task 5: Wertminderung, EU-Rechtslage der Erstzulassung, Übergangsregel

**Files:**
- Create: `src/engine/wertminderung.ts`
- Test: `tests/engine/wertminderung.test.ts`

**Interfaces:**
- Consumes: `berechneNova`, `selectNovaPeriode`.
- Produces:
  - `wertminderungsFaktor(vollJahre: number, bg?: number, neuwagenwert?: number): number` — `max(1/8, 1 − vollJahre/8)`; mit Neuwagenwert `bg/neuwagenwert` (gedeckelt auf 0..1).
  - `rechtslageStichtag(p: { herkunft: 'EU'|'DRITTLAND'; erstzulassung?: string; zulassung: string; vertrag?: string; lieferung?: string }): string` — EU: Erstzulassungsdatum; Drittland: Zulassung; Übergangsregel: Vertrag vor 1.12. und Lieferung vor 1.4. des Folgejahres → 31.12. des Vertragsjahres.
  - `berechneNovaGebraucht(e: NovaEingabe, ctx: { herkunft; erstzulassung; zulassung; vertrag?; lieferung?; neuwagenwert? }): NovaErgebnis` — kürzt Malus und Abzugsposten mit dem Faktor, nur bei EU-Herkunft.

- [ ] **Step 1:** Failing tests: Faktor `0 Jahre → 1`, `3 → 0.625`, `7 → 0.125`, `12 → 0.125`; mit BG 15000/Neuwagenwert 30000 → `0.5`; `rechtslageStichtag` Vertrag `2025-11-10`, Lieferung `2026-03-20` → `2025-12-31`; Vertrag `2025-12-02` → keine Übergangsregel; EU-Import Erstzulassung `2019-04-01` wählt die Periode dieses Datums; Drittland ignoriert Erstzulassung; Erstzulassung `2007-06-01` → `RegelwerkLuecke` mit Warntext.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementieren (Wortlaut der BMF-Seite „NoVA-Steuersatz" gegenlesen und in Kommentar mit URL festhalten). **Step 4:** Tests → PASS. **Step 5:** Commit `feat: used-vehicle NoVA reduction and law-date selection`.

---

### Task 6: Zoll, Zollwert, EUSt (Drittland)

**Files:**
- Create: `src/engine/zoll.ts`
- Test: `tests/engine/zoll.test.ts`

**Interfaces:**
- Produces:
  - `interface ZollEingabe { kaufpreisEur: number; fracht: number; versicherung: number; nachlauf: number; zollsatz: number; eustSatz: number; praeferenzfrei?: boolean }`
  - `interface ZollErgebnis { zollwert: number; zoll: number; eustBasis: number; eust: number }`
  - `berechneZollUndEust(e: ZollEingabe): ZollErgebnis` — `zollwert = kaufpreis + fracht + versicherung`; `zoll = zollwert × zollsatz` (0 bei `praeferenzfrei`); `eustBasis = zollwert + zoll + nachlauf`; `eust = eustBasis × eustSatz`.

- [ ] **Step 1:** Failing test: Kaufpreis 20000, Fracht 1500, Versicherung 200, Nachlauf 600, Zoll 10 %, EUSt 20 % → `{ zollwert: 21700, zoll: 2170, eustBasis: 24470, eust: 4894 }`; `praeferenzfrei` → `zoll 0`; EUSt DE 19 % ändert nur `eust`.
- [ ] **Step 2–4:** FAIL → implementieren → PASS. **Step 5:** Commit `feat: customs duty and import VAT`.

---

### Task 7: EU-Import (Erwerbsteuer, brutto/netto, Neufahrzeug)

**Files:**
- Create: `src/engine/eu-import.ts`
- Test: `tests/engine/eu-import.test.ts`

**Interfaces:**
- Produces:
  - `istNeufahrzeug(p: { km: number; erstinbetriebnahme: string; stichtag: string }): boolean` (≤ 6.000 km **oder** ≤ 6 Monate).
  - `nettoKaufpreis(preis: number, art: 'netto'|'brutto'|'privat_ohne_ust', ustSatzVerkaeufer: number): number`
  - `berechneEuUst(p: { kaeufer: 'privat'|'unternehmer'; neu: boolean; nettoKaufpreis: number }): { erwerbsteuer: number; vorsteuerAbziehbar: number }` — Neu: 20 % für alle; gebraucht: nur Unternehmer 20 % (abziehbar); gebraucht/Privat: 0.

- [ ] **Step 1:** Failing tests: 5.999 km → neu, 6.001 km und 7 Monate → gebraucht; brutto 11900 bei 19 % → netto 10000; `privat_ohne_ust` bleibt; Neu/Privat 20000 netto → 4000; gebraucht/Privat → 0; gebraucht/Unternehmer → 4000 und `vorsteuerAbziehbar 4000`.
- [ ] **Step 2–4:** FAIL → implementieren → PASS. **Step 5:** Commit `feat: EU import taxation`.

---

### Task 8: Transport- und Gebührenmodell mit Richtwerten

**Files:**
- Create: `src/engine/transport.ts`, `src/engine/gebuehren.ts`, `src/regelwerk/fracht.ts`, `src/regelwerk/gebuehren.ts`
- Test: `tests/engine/transport.test.ts`

**Interfaces:**
- Produces:
  - `richtwertFracht(route: RouteId, art: 'roro'|'container', klasse: 'klein'|'mittel'|'gross'): Wert` (Beleg: `schaetzwert`, Stand-Datum) und Routenliste `ROUTEN` (mindestens USA→Bremerhaven, USA→Koper, Japan→Koper, UK→Bremerhaven, Dubai→Koper).
  - `interface Posten { id: string; label: string; betrag: number; status: Status; erklaerung: string; quelle?: string }`
  - `transportPosten(e: TransportEingabe): Posten[]` — Vorlauf, Seefracht, Hafen/Terminal, Versicherung (% vom Warenwert), Spedition/Zollagent, Nachlauf, Überstellung; jedes Feld hat Vorgabewert **und** optional `ueberschrieben`.
  - `gebuehrenPosten(e: { weg: 'generalimporteur'|'landespruefstelle'; einzelgenehmigung: boolean; gutachten57a: boolean }): Posten[]`; belegt: Genehmigungsdatenbank ≤ 180 €, Landesprüfstelle ≈ 150 €, Überstellung 100–150 €; übrige `schaetzwert`.

- [ ] **Step 1:** Failing tests: Überschreibung ersetzt Vorgabe; jeder Richtwert-Posten hat `status 'schaetzwert'` und `stand`; `gebuehrenPosten` mit `generalimporteur` enthält Eintragung ≤ 180 und Status `belegt`.
- [ ] **Step 2–4:** FAIL → implementieren → PASS (Richtwerte plausibel wählen, jeweils mit Quellenhinweis „Branchenübliche Schätzung" und Stand). **Step 5:** Commit `feat: transport and fee models`.

---

### Task 9: Orchestrator `berechne()` und Ergebnisstruktur

**Files:**
- Create: `src/engine/types.ts`, `src/engine/schema.ts`, `src/engine/berechne.ts`
- Test: `tests/engine/berechne.test.ts`

**Interfaces:**
- Consumes: alle Engine-Funktionen aus Task 4–8.
- Produces:
  - Zod-`EingabeSchema` / `type Eingabe` (Modus, Fahrzeugart, Herkunft, Kaufpreis+Währung, Neu/Gebraucht-Daten, CO2/kW/Hubraum, Verzollungsort, Transportfelder, Gebührenoptionen, Datum-Felder).
  - `interface Ergebnis { posten: Posten[]; summe: number; summeNetto: number; vorsteuer: number; waehrungskurs?: { code: string; kurs: number; datum: string; quelle: 'ezb'|'manuell' }; warnungen: string[]; stichtag: string }`
  - `berechne(e: Eingabe, ctx: { stichtag: string; kurse: Record<string, number> }): Ergebnis` — reine Funktion, Summe = Σ Posten, Fremdwährung per `kurse` (fehlender/≤0 Kurs → `EingabeFehler`, nie NaN).

- Jedes Kostenfeld der Eingabe trägt `{ betrag: number; waehrung: string }` (Standard `EUR`); Kastenwagen/Pick-up/Pritsche (Spec §5.1) erzeugt nur eine Warnung „ggf. NoVA-frei" und rechnet erst nach Bestätigung (`nutzerBestaetigtNovaPflicht: boolean`).

- [ ] **Step 1:** Failing tests: Nebenkosten in USD werden mit demselben Kurs umgerechnet; Kastenwagen ohne Bestätigung → Warnung, NoVA-Posten fehlt; Drittland-Pkw-Szenario (USA, 20000 USD, Kurs 1,0 zur Vereinfachung, WLTP 120, Neuwagen) ergibt Posten `kaufpreis, fracht, zoll, eust, nova, gebuehren…` und `summe === Σ posten`; E-Pkw → NoVA-Posten 0 mit „befreit"; Kurs 0 → `EingabeFehler`; Property: `summe === Σ posten.betrag` für zufällige gültige Eingaben (fast-check).
- [ ] **Step 2–4:** FAIL → implementieren → PASS. **Step 5:** Commit `feat: calculation orchestrator`.

---

### Task 10: Wechselkurs-Service (`/api/fx`)

**Files:**
- Create: `src/lib/fx.ts`, `src/app/api/fx/route.ts`
- Test: `tests/lib/fx.test.ts`

**Interfaces:**
- Produces:
  - `parseEcbXml(xml: string): { datum: string; kurse: Record<string, number> }` — wirft bei ungültigem XML/fehlenden Währungen.
  - `getKurse(fetchFn?: typeof fetch, now?: () => number): Promise<{ datum: string; kurse: Record<string, number>; veraltet: boolean }>` — Cache ~24 h im Speicher, `stale-while-error`; feste URL `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`.
  - `GET /api/fx → 200 { datum, kurse, veraltet }` oder `503 { fehler }` (UI fällt auf manuellen Kurs zurück).

- [ ] **Step 1:** Failing tests mit Fixture-XML: korrektes Parsen (USD, GBP, JPY, CHF); kaputtes/leeres XML → Fehler; Cache-Treffer ohne zweiten Fetch; Fetch schlägt fehl, alter Cache vorhanden → `veraltet true`; Fetch schlägt fehl, kein Cache → Route liefert 503.
- [ ] **Step 2–4:** FAIL → implementieren (kein externer Input in der URL, Timeout 5 s) → PASS. **Step 5:** Commit `feat: ECB fx rate service`.

---

### Task 11: UI-Grundlage und Designsystem

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Create: `src/components/ThemeToggle.tsx`, `src/components/Card.tsx`, `src/lib/format.ts`
- Test: `tests/lib/format.test.ts`

**Interfaces:**
- Produces: `formatEur(n: number): string` (de-AT, `€ 1.234,56`), `formatProzent(n: number): string`; Design-Tokens (Farben, Radius, Schatten) in CSS-Variablen für hell/dunkel; `ThemeToggle` (System-Vorgabe + manuell, Persistenz localStorage).

- [ ] **Step 1:** Failing tests für `formatEur(1234.5) === '€ 1.234,50'` (oder die von `Intl` für `de-AT` erzeugte Form; der Test pinnt die tatsächlich ausgegebene Zeichenfolge, inkl. geschütztem Leerzeichen) und `formatProzent`.
- [ ] **Step 2–4:** FAIL → implementieren → PASS. **Step 5:** **Skill `frontend-design` aufrufen**, Look & Feel nach Spec §7 (modern/Fintech, hell + Dark Mode, große Summenzahl, Karten, weiche Schatten) umsetzen; Screenshot (Playwright, hell/dunkel, 390 px und 1280 px) in `docs/superpowers/research/screens/` ablegen und selbst prüfen. **Step 6:** Commit `feat: design system and theming`.

---

### Task 12: Formular (Privatmodus) und Live-Ergebnis

**Files:**
- Create: `src/components/FormularFahrzeug.tsx`, `FormularHerkunft.tsx`, `FormularTransport.tsx`, `FormularZulassung.tsx`, `ErgebnisPanel.tsx`, `src/lib/useBerechnung.ts`
- Modify: `src/app/page.tsx`
- Test: `tests/e2e/privat.spec.ts`

**Interfaces:**
- Consumes: `EingabeSchema`, `berechne`, `/api/fx`.
- Produces: `useBerechnung(eingabe: Partial<Eingabe>): { ergebnis?: Ergebnis; fehler: string[] }` (debounced, nutzt Zod-Safe-Parse; ungültige Eingaben zeigen Feldfehler statt zu rechnen).

- [ ] **Step 1:** Failing E2E: Pkw/USA/20000 USD/WLTP 120/Neu → Gesamtsumme sichtbar und ändert sich beim Ändern des CO2-Werts; Kurs-Feld zeigt EZB-Datum bzw. manuellen Eintrag, wenn `/api/fx` 503 liefert (per Route-Mock); Pflichtfeld fehlt → Fehlermeldung, kein „NaN".
- [ ] **Step 2–4:** FAIL → Formular in vier Schritten auf einer Seite mit sticky Ergebnis rechts (mobil: Summe unten angedockt) → PASS. **Step 5:** Commit `feat: private mode form and live result`.

---

### Task 13: Ergebnisdarstellung (Diagramm, Erklärungen, Kennzeichnung)

**Files:**
- Create: `src/components/KostenChart.tsx`, `src/components/PostenTabelle.tsx`, `src/components/StatusBadge.tsx`
- Test: `tests/e2e/ergebnis.spec.ts`

**Interfaces:**
- Consumes: `Ergebnis`, `Posten`.
- Produces: `PostenTabelle` (Zeile → aufklappbares „Warum?" mit `erklaerung`/`quelle`), `StatusBadge` für `schaetzwert`/`nicht_verifiziert`, `KostenChart` (Donut oder gestapelter Balken, barrierearm: Tabelle als Alternative, ausreichend Kontrast).

- [ ] **Step 1:** Failing E2E: Schätzwert-Posten zeigt Badge „Schätzwert"; „Warum?" öffnet Erklärung; Chart hat `aria-label` und die Summe der Segmente entspricht der Gesamtsumme (aus `data-`Attributen).
- [ ] **Step 2–4:** FAIL → implementieren → PASS; **Skill `design:accessibility-review`** auf die Seite anwenden und Befunde beheben. **Step 5:** Commit `feat: result visualization and explanations`.

---

### Task 14: Szenarienvergleich, URL-Teilen, lokales Speichern

**Files:**
- Create: `src/lib/url-state.ts`, `src/components/Vergleich.tsx`, `src/components/ShareButton.tsx`
- Test: `tests/lib/url-state.test.ts`, `tests/e2e/vergleich.spec.ts`

**Interfaces:**
- Produces:
  - `encodeState(state: { szenarien: Eingabe[] }): string` / `decodeState(s: string): { szenarien: Eingabe[] } | null` (komprimiert, URL-sicher, Versionspräfix; ungültig → `null`, nie Exception).
  - Vergleich zeigt zwei Szenarien nebeneinander mit Differenz je Posten und Gesamt.

- [ ] **Step 1:** Failing tests: Round-Trip `decodeState(encodeState(x))` ist gleich `x`; manipulierte/zu lange/leere Strings → `null`; E2E: Link kopieren → neuer Tab lädt dasselbe Ergebnis; zweites Szenario hinzufügen → Differenz sichtbar.
- [ ] **Step 2–4:** FAIL → implementieren (Zod-Validierung nach Decode) → PASS. **Step 5:** Commit `feat: comparison, share link and local persistence`.

---

### Task 15: Händlermodus (Netto, Vorsteuer, Marge)

**Files:**
- Create: `src/engine/haendler.ts`, `src/components/HaendlerPanel.tsx`
- Test: `tests/engine/haendler.test.ts`, `tests/e2e/haendler.spec.ts`

**Interfaces:**
- Produces: `berechneVerkauf(p: { nettoKosten: number; marge: { art: 'prozent'|'euro'; wert: number } }): { verkaufNetto: number; ust: number; verkaufBrutto: number; gewinn: number }`; `berechne()` liefert im Modus `gewerbe` `summeNetto` und `vorsteuer` (EUSt/Erwerbsteuer abziehbar).

- [ ] **Step 1:** Failing tests: Nettokosten 20000, Marge 10 % → `verkaufNetto 22000`, `ust 4400`, `verkaufBrutto 26400`, `gewinn 2000`; Marge 1500 € → `21500`; negative Marge zulässig mit Warnung; Gewerbe-Drittland: abziehbare EUSt reduziert die Kostenbasis.
- [ ] **Step 2–4:** FAIL → implementieren → PASS; UI: Modus-Umschalter, Hinweis zur NoVA-Vereinfachung (Spec §11). **Step 5:** Commit `feat: dealer mode`.

---

### Task 16: Charge (mehrere Fahrzeuge je Container)

**Files:**
- Create: `src/engine/charge.ts`, `src/components/ChargePanel.tsx`
- Test: `tests/engine/charge.test.ts`, `tests/e2e/charge.spec.ts`

**Interfaces:**
- Produces: `berechneCharge(e: { fahrzeuge: Eingabe[]; fixkosten: { container: number; spedition: number }; verteilung: 'wert'|'gleich' }, ctx): { je: Ergebnis[]; gesamt: Ergebnis }` — nur Drittland; EU-Fahrzeug in der Charge → `EingabeFehler`; Fixkosten-Summe über Fahrzeuge = Eingabe (Rundungsrest auf das teuerste Fahrzeug).

- [ ] **Step 1:** Failing tests: zwei Fahrzeuge (Werte 10000/30000), Container 4000 → Anteile 1000/3000 bei `wert`, 2000/2000 bei `gleich`; Summe der Anteile = 4000 auch bei krummer Verteilung (3 Fahrzeuge, 1000 €); gemischte Arten (Pkw + Motorrad) rechnen mit je eigener NoVA/Zollsatz; leere Charge → Fehler.
- [ ] **Step 2–4:** FAIL → implementieren → PASS. **Step 5:** Commit `feat: batch import`.

---

### Task 17: PDF per Headless Chromium (Kundenangebot und Kalkulation)

**Files:**
- Create: `src/app/print/page.tsx`, `src/app/api/pdf/route.ts`, `src/lib/pdf.ts`
- Test: `tests/lib/pdf.test.ts`, `tests/e2e/pdf.spec.ts`

**Interfaces:**
- Consumes: `EingabeSchema`, `berechne`.
- Produces: `POST /api/pdf` mit Body `{ eingabe, variante: 'kalkulation'|'angebot', firma?: { name; adresse; logoDataUrl? } }` → `application/pdf`. Variante `angebot` enthält **keine** Einkaufskosten/Marge. `renderPdf(input): Promise<Buffer>` mit Warteschlange (`PDF_CONCURRENCY`).

- [ ] **Step 1:** Failing tests: Body > 256 KB → 413; ungültiges Schema → 400; Logo nur als `data:image/(png|jpeg)` ≤ 512 KB; `angebot` enthält die Verkaufssumme, aber nicht den Text „Einkauf"; Chromium blockiert Requests auf fremde Origins (Test mit Seite, die `fetch('http://example.com')` versucht → Request abgebrochen); bei `PDF_CONCURRENCY=1` laufen zwei parallele Requests nacheinander; Rate-Limit je Client-IP (nur bei `TRUST_PROXY=true` aus `X-Forwarded-For`), überschrittenes Limit → 429.
- [ ] **Step 2–4:** FAIL → implementieren: Eingabe wird per Zod validiert und der Print-Route als **kurzlebiger Server-Token** (nicht als URL) übergeben; Playwright-Chromium mit Request-Interception (nur eigene Origin), Timeout 20 s; Print-Layout teilt Komponenten mit dem Ergebnis. → PASS. **Step 5:** Commit `feat: server-side PDF export`.

---

### Task 18: Docker, Compose und Container-Abnahme

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `README.md`

**Interfaces:**
- Produces: Image `nova-rechner`, Port 3000, Healthcheck auf `/api/health`, Non-Root-User, Umgebungsvariablen `BASE_PATH` (Build-Arg), `TRUST_PROXY`, `PDF_CONCURRENCY`, `CHROMIUM_PATH`.

- [ ] **Step 1:** Mehrstufiges Dockerfile (deps → build → runner auf Debian-slim mit Paket `chromium` und Schriften); `docker-compose.yml` mit Healthcheck, `read_only` + tmpfs für `/tmp`, `cap_drop: [ALL]`, `restart: unless-stopped`.
- [ ] **Step 2:** `docker build -t nova-rechner .` → Expected: erfolgreich.
- [ ] **Step 3:** `docker compose up -d` und `curl -fsS localhost:3000/api/health` → Expected: `{"status":"ok"}`; `docker compose ps` → Expected: `healthy`.
- [ ] **Step 4:** PDF **im Container** testen: `curl -s -o /tmp/test.pdf -X POST localhost:3000/api/pdf -H 'content-type: application/json' -d @tests/fixtures/pdf-body.json && file /tmp/test.pdf` → Expected: `PDF document`. Ausgehenden Zugriff aus dem Container als `docker compose exec` prüfen: nur der EZB-Host ist erreichbar bzw. wird benötigt.
- [ ] **Step 5:** README mit Start, Konfiguration, Rechtsstand-Pflege (wo Regelwerk-Daten liegen, wie Werte/Stand aktualisiert werden). Commit `feat: docker image and compose`.

---

### Task 19: E2E-Abnahme, Security- und Accessibility-Review

**Files:**
- Create: `tests/e2e/pfade.spec.ts`
- Modify: je nach Befund

- [ ] **Step 1:** E2E-Pfade: Pkw-EU-privat, Pkw-USA-Drittland, E-Pkw (NoVA 0), Motorrad, Charge, PDF-Download, Vergleich, Teilen-Link. `npx playwright test --trace off` → Expected: alle grün.
- [ ] **Step 2:** **Skills `securitymaxxing:ship-check`, `securitymaxxing:api` und `securitymaxxing:harden`** auf Repo und Dockerfile anwenden; belegte Befunde beheben, je Befund ein Commit.
- [ ] **Step 3:** **Skills `design:accessibility-review` und `design:design-critique`** auf die fertige Oberfläche; Befunde beheben. Responsive-Screenshots 390/768/1280 px, hell/dunkel.
- [ ] **Step 4:** Abschlussbericht an den Auftraggeber: Liste aller `nicht_verifiziert`- und `schaetzwert`-Daten mit Fundstelle, damit sie bewusst geprüft werden können. Commit `chore: final verification` und Push.
