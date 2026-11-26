/**
 * Typen des Regelwerks. Jede Regel aus `docs/superpowers/research/nova-perioden.md`
 * ist als Daten abgebildet (keine Code-Verzweigung je Periode). Die Engine (Task 4/5)
 * rechnet ausschließlich aus diesen Daten.
 *
 * Konventionen:
 * - Datum: ISO `yyyy-mm-dd`, `bis` jeweils einschließlich; `null` = offen.
 * - NoVA-Sätze in vollen Prozent (`80` = 80 %), Zoll-/EUSt-Sätze als Anteil (`0.2` = 20 %).
 * - Beträge in EUR, CO2 in g/km, Verbrauch in l/100 km, Hubraum in cm³.
 */

export type Status = 'belegt' | 'schaetzwert' | 'nicht_verifiziert';

export interface Beleg {
  quelle: string;
  /** Abrufdatum bzw. Stand der Quelle (ISO). */
  stand: string;
  status: Status;
}

export type IsoDatum = string;

export type Fahrzeugart = 'pkw' | 'e-pkw' | 'motorrad' | 'n1' | 'wohnmobil';

/** Art, nach der die NoVA-Rechtslage-Perioden geführt werden. */
export type PeriodenArt = 'pkw' | 'n1' | 'motorrad';

/** Messgröße, auf der der Steuersatz beruht. */
export type Messverfahren = 'VERBRAUCH' | 'HUBRAUM' | 'NEFZ' | 'WLTP' | 'WMTC';

/** Antriebe für Ökobonus (2008b–2013) und Umweltbonus (2014–2015). */
export type BonusAntrieb = 'hybrid' | 'e85' | 'erdgas_biogas' | 'fluessiggas' | 'wasserstoff';

/** Malus-Stufe: `euroProGramm` für jedes Gramm über `schwelleGramm`. Mehrere Stufen addieren sich. */
export interface MalusStufe {
  schwelleGramm: number;
  euroProGramm: number;
}

/**
 * Höchststeuersatz.
 * - `wortlaut: 'satz'`: Gesetz „Der Höchststeuersatz beträgt …" (ab 2014-03-01, belegt).
 * - `wortlaut: 'betrag'`: Gesetz „Die Abgabe beträgt höchstens 16 % der Bemessungsgrundlage"
 *   (R1/R4, vor 2014-03-01) – wörtlich eine Betragsgrenze.
 * `anwendung` ist die Lesart, der Dokument und Engine folgen (BMF: Grenze für den Satz).
 */
export interface Hoechstsatz {
  prozent: number;
  wortlaut: 'satz' | 'betrag';
  anwendung: 'satz';
  status: Status;
}

/**
 * Übergangsregel: Liegt der Stichtag in dieser Periode, gelten die Werte der Vorperiode
 * (`vorherigeDocId`) weiter, wenn der Kaufvertrag vor `vertragVor` geschlossen und vor
 * `lieferungVor` geliefert bzw. ig. erworben wurde (beide Daten ausschließlich).
 */
export interface Uebergang extends Beleg {
  art: 'jahreswechsel' | 'reformstichtag';
  vorherigeDocId: string;
  vertragVor: IsoDatum;
  lieferungVor: IsoDatum;
}

/**
 * Erhöhungsbetrag 20 % (§ 6 Abs. 6 idF R1/R4), wenn die NoVA nicht Teil der USt-BG ist.
 * `anzusetzen: false` = Controller-Ruling (EuGH C-433/09, Praxis umstritten): nicht rechnen, warnen.
 */
export interface Erhoehungsbetrag {
  prozent: number;
  bedingung: 'nova_nicht_teil_der_ust_bg';
  /** 'grundbetrag': nur auf den Grundbetrag, Bonus/Malus danach; sonst auf Grundbetrag ± Bonus/Malus. */
  basis: 'grundbetrag' | 'grundbetrag_und_bonus_malus';
  anzusetzen: boolean;
  status: Status;
}

/** Ersatz, wenn kein CO2-Wert vorliegt (Reihenfolge = Rangfolge, „sonst"). */
export type OhneCo2Ersatz =
  /** CO2 = Verbrauch × Faktor */
  | { art: 'verbrauch'; faktorBenzinUndAndere: number; faktorDiesel: number }
  /** CO2 = kW × Faktor */
  | { art: 'kw'; faktor: number }
  /** Satz = (Hubraum − abzugCm3) × faktor, gedeckelt mit dem Höchstsatz der Periode */
  | { art: 'hubraum'; abzugCm3: number; faktor: number };

/** Sonderregel für Fahrzeuge, für die nur ein NEFZ-Wert vorliegt (auslaufende Serie). */
export type NefzSonderregel =
  /** Weiter die Rechtslage der genannten Periode (z. B. PKW-2020: § 15 Abs. 22 → R10). */
  | ({ art: 'fruehere_rechtslage'; docId: string } & Beleg)
  /** NEFZ-Wert mit festen Werten; Höchstsatz und Malusbetrag folgen der Periode. */
  | ({ art: 'feste_werte'; abzugGramm: number; malusSchwelleGramm: number } & Beleg);

/** Wohnmobil mit Aufbauart „SA": wahlweise CO2 = kwFaktor × kW, dann Mindestsatz. */
export interface WohnmobilSA {
  kwFaktor: number;
  mindestsatzProzent: number;
  /** true: nur bei Aufbau in nicht selbsttragender Bauweise (2020-01-01 – 2021-06-30). */
  nurNichtSelbsttragend: boolean;
  /** 'kw_wahl': kW-Ansatz gewählt; 'ohne_co2_wert': mangels CO2-Wert nach kW gerechnet. */
  mindestsatzGiltBei: readonly ('kw_wahl' | 'ohne_co2_wert')[];
}

/** Motorrad ≤ bisCm3: Satz 0 % bzw. kein Kraftfahrzeug iSd NoVAG. */
export interface Kleinkraftrad {
  bisCm3: number;
  folge: 'satz_null' | 'nicht_steuerbar';
}

/** Kfz zur Personenbeförderung (z. B. pkw-artige N1), die nach den Pkw-Zeilen rechnen. */
export interface Personenbefoerderung {
  sitzplaetzeMin: number;
  sitzplaetzeMax: number;
  hoechstgewichtKg: number;
}

interface PeriodeBasis extends Beleg {
  /** ID der Zeile im Recherche-Dokument, z. B. 'PKW-2026b'. */
  docId: string;
  art: PeriodenArt;
  von: IsoDatum;
  bis: IsoDatum | null;
  uebergang: Uebergang | null;
  /** Erläuterungen ohne Rechenwirkung (Herkunft, Widersprüche, offene Punkte). */
  hinweise: readonly string[];
}

/** Pkw 2008-01-01 – 2014-02-28: Satz = round(multiplikator × (Verbrauch − Abzug)). */
export interface VerbrauchPeriode extends PeriodeBasis {
  formel: 'verbrauch';
  verfahren: 'VERBRAUCH';
  verbrauchAbzug: { benzinUndAndere: number; diesel: number };
  multiplikator: number;
  hoechstsatz: Hoechstsatz;
  /** Status der Untergrenze 0 % („nicht mehr als drei Liter … 0 %"). */
  mindestsatzNullStatus: Status;
  erhoehungsbetrag: Erhoehungsbetrag;
  /** Ohne Verbrauchsnachweis. */
  ohneVerbrauch:
    | { art: 'satz_aus_kw'; faktor: number }
    | { art: 'verbrauch_aus_kw'; kwDivisor: number; zuschlagBenzinUndAndere: number; zuschlagDiesel: number };
  /** Erdgas: 1 Nm³ entspricht so vielen Litern Benzin; null = nicht geregelt. */
  erdgasNm3JeLiterBenzin: number | null;
  co2Malus: readonly MalusStufe[];
  co2Bonus: { unterGramm: number; euro: number } | null;
  noxPartikelBonus: {
    maxEuro: number;
    benzinNoxMaxMg: number;
    dieselNoxMaxMg: number;
    dieselPartikelMaxGProKm: number;
  } | null;
  oekoBonus: { maxEuro: number; antriebe: readonly BonusAntrieb[] } | null;
  bonusSummeMaxEuro: number | null;
  /** Diesel mit Partikelausstoß über dem Grenzwert: Malus. */
  dieselPartikelMalus: { grenzwertGProKm: number; euro: number } | null;
  /** Ohne CO2-Wert (nur für Bonus/Malus relevant). */
  ohneCo2:
    | { art: 'kw_malus'; euroProKw: number; abKw: number }
    | { art: 'verbrauch'; faktorBenzinUndAndere: number; faktorDiesel: number }
    | null;
  /** § 14a (PKW-2008a): Diesel-Partikel-Bonus/-Malus. `bonusEuro` = anzuwendender Wert (RIS). */
  partikel14a: {
    grenzwertGProKm: number;
    bonusEuroRis: number;
    bonusEuroBmf: number;
    bonusEuro: number;
    malusProzentDerBg: number;
    malusMaxEuro: number;
  } | null;
}

/** Motorrad 2008-01-01 – 2019-12-31: Satz = round((Hubraum − abzugCm3) × faktor). */
export interface HubraumPeriode extends PeriodeBasis {
  formel: 'hubraum';
  verfahren: 'HUBRAUM';
  abzugCm3: number;
  faktor: number;
  hoechstsatz: Hoechstsatz;
  kleinkraftrad: Kleinkraftrad;
  erhoehungsbetrag: Erhoehungsbetrag | null;
}

/**
 * CO2-Formel (Pkw ab 2014-03-01, N1 2021-07-01 – 2025-06-30, Motorrad ab 2020):
 * Satz = round((CO2 − abzugswert) / divisor), max. hoechstsatz;
 * NoVA = BG × Satz + Σ Malus − Abzugsposten (bzw. − Umweltbonus), nie negativ.
 */
export interface Co2Periode extends PeriodeBasis {
  formel: 'co2';
  verfahren: 'NEFZ' | 'WLTP' | 'WMTC';
  abzugswert: number;
  divisor: number;
  hoechstsatz: Hoechstsatz;
  /** Status der Untergrenze 0 % (Annahme, nicht ausdrücklich geregelt). */
  mindestsatzNullStatus: Status;
  malus: readonly MalusStufe[];
  abzugsposten: { dieselEuro: number; andereEuro: number } | null;
  /** Umweltbonus statt Abzugsposten (PKW-2014/2015). */
  umweltbonus: { maxEuro: number; antriebe: readonly BonusAntrieb[]; stattAbzugsposten: true } | null;
  ohneCo2: readonly OhneCo2Ersatz[];
  /** Liegt nur ein NEFZ-Wert vor: wahlweise CO2 = NEFZ_ERSATZ_FAKTOR × NEFZ (ab 2026-07-30). */
  nefz127Ersatz: boolean;
  nefzSonderregel: NefzSonderregel | null;
  wohnmobilSA: WohnmobilSA | null;
  kleinkraftrad: Kleinkraftrad | null;
  /** Ab PKW-2025b gelten die Pkw-Zeilen auch für diese Fahrzeuge. */
  personenbefoerderungN1: Personenbefoerderung | null;
}

/** Bedingung, unter der ein N1 nach den Pkw-Zeilen (gleicher Stichtag) steuerbar ist. */
export type SteuerbarBedingung =
  | { art: 'zolltarif'; position: '8703' }
  | ({ art: 'personenbefoerderung' } & Personenbefoerderung);

/** N1 ohne eigene Formel: steuerbar nur unter Bedingung, dann Pkw-Periode zum selben Stichtag. */
export interface VerweisPeriode extends PeriodeBasis {
  formel: 'verweis_pkw';
  verfahren: 'WLTP' | null;
  steuerbarWenn: SteuerbarBedingung;
  /** Fahrzeuge, die keine Kraftfahrzeuge iSd NoVAG sind. */
  nichtSteuerbar: readonly string[];
  /** Status der Einreihung im Einzelfall (Nutzerbestätigung nötig). */
  einreihungStatus: Status;
}

export type NovaPeriode = VerbrauchPeriode | HubraumPeriode | Co2Periode | VerweisPeriode;

/** Was bei EU-Gebrauchtimport um die Wertentwicklung gekürzt wird, je Erstzulassungszeitraum. */
export interface WertentwicklungsUmfang extends Beleg {
  von: IsoDatum;
  bis: IsoDatum | null;
  /** Pkw-Perioden des Zeitraums laut Tabelle § 0.2 des Recherche-Dokuments (die Regel gilt nach Erstzulassungsdatum). */
  docIds: readonly string[];
  gekuerzt: 'saldo_malus_abzugsposten' | 'nur_bonus_malus';
  /** Ob der Umweltbonus (statt Abzugsposten) gekürzt wird; null = kein Umweltbonus im Zeitraum. */
  umweltbonusGekuerztStatus: Status | null;
  offen: readonly string[];
}

/** Wert mit Beleg (Zoll, EUSt, allgemeine Konstanten). */
export interface Wert extends Beleg {
  /** Anteil, z. B. 0.1 = 10 %. */
  satz: number;
  hinweis?: string;
}
