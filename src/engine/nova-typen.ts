/**
 * Ein- und Ausgabetypen der NoVA-Berechnung sowie gemeinsame Bausteine der Formel-Familien.
 */
import type { BonusAntrieb, Fahrzeugart, Kleinkraftrad, Status } from '@/regelwerk';
import { EingabeFehler } from './fehler';
import { runde2 } from './runde';

export type Kraftstoff = 'benzin' | 'diesel' | 'andere';

/**
 * Kürzung bei EU-Gebrauchtimport (Wertentwicklung). Den Faktor und den Umfang bestimmt der
 * Aufrufer (Task 5); hier wird nur angewendet:
 * - `malus_und_abzug`: Malus, Abzugsposten und (2014–2015) Umweltbonus × faktor
 * - `bonus_malus`: nur Malus- und Bonusbeträge × faktor (vor 2014-03-01)
 */
export interface NovaKuerzung {
  faktor: number;
  umfang: 'malus_und_abzug' | 'bonus_malus';
}

export interface NovaEingabe {
  art: Fahrzeugart;
  /** Bemessungsgrundlage in EUR (netto). */
  bg: number;
  /** Stichtag der Rechtslage (ISO `yyyy-mm-dd`). */
  stichtag: string;
  /** CO2 in g/km je Messverfahren. Fehlender Wert ≠ 0 g/km. */
  co2Wltp?: number;
  co2Nefz?: number;
  co2Wmtc?: number;
  kw?: number;
  /** Hubraum in cm³. */
  hubraum?: number;
  /** Durchschnittsverbrauch in l/100 km (Perioden vor 2014-03-01). */
  verbrauch?: number;
  /** Nur nötig, wo die Periode nach Kraftstoff unterscheidet (vor 2014, PKW-2014). */
  kraftstoff?: Kraftstoff;
  /** NOx in mg/km (NOx/Partikel-Bonus 2008-07 – 2014-02). */
  noxMgProKm?: number;
  /** Partikel in g/km (Diesel, 2008-01 – 2014-02). */
  partikelGProKm?: number;
  /** Alternativer Antrieb (Ökobonus 2008-07 – 2014-02, Umweltbonus 2014–2015). */
  bonusAntrieb?: BonusAntrieb;
  /** Wohnmobil Aufbauart „SA": kW-Ansatz wählbar. */
  wohnmobilSA?: boolean;
  /** Aufbau in nicht selbsttragender Bauweise (Voraussetzung für „SA" 2020-01-01 – 2021-06-30). */
  wohnmobilNichtSelbsttragend?: boolean;
  /** N1 vor 2021-07-01: Einreihung in KN-Position 8703 bestätigt. */
  zolltarif8703?: boolean;
  kuerzung?: NovaKuerzung;
}

/** Welche Ersatzgröße statt des gemessenen CO2-Werts (bzw. Verbrauchs) verwendet wurde. */
export type Ersatzwert = 'nefz127' | 'kw2' | 'verbrauch' | 'hubraum' | 'kw' | null;

export interface NovaErgebnis {
  betrag: number;
  satzProzent: number;
  /** Malus nach Kürzung (Cent-gerundet). */
  malus: number;
  /** Abzugsposten nach Kürzung (Cent-gerundet). */
  abzugsposten: number;
  /** Bonus (vor 2014: CO2-/NOx-/Öko-/Partikel-Bonus; 2014–2015: Umweltbonus) nach Kürzung. */
  bonus: number;
  /** Keine NoVA: CO2 = 0 g/km, nicht steuerbar (N1, Kleinkraftrad ab 7/2021). */
  befreit: boolean;
  ersatzwertGenutzt: Ersatzwert;
  /** Schlechtester Status aus Periode und den tatsächlich angewendeten Einzelregeln. */
  status: Status;
  /** Docid der Periode, nach deren Werten gerechnet wurde (bei Verweisen die Ziel-Periode). */
  periodeId: string;
  /** Erläuterungen zum Rechenweg. */
  hinweise: string[];
  /** Ungeklärte Punkte, die das Ergebnis beeinflussen können. */
  warnungen: string[];
}

/** Ungerundetes Zwischenergebnis einer Formel-Familie (vor Kürzung und Rundung). */
export interface Roh {
  periodeId: string;
  satz: number;
  bg: number;
  malus: number;
  abzugsposten: number;
  bonus: number;
  befreit: boolean;
  ersatz: Ersatzwert;
  protokoll: Protokoll;
}

export interface Protokoll {
  status: Status;
  hinweise: string[];
  warnungen: string[];
}

const RANG: Record<Status, number> = { belegt: 0, schaetzwert: 1, nicht_verifiziert: 2 };

export function schlechterer(a: Status, b: Status): Status {
  return RANG[a] >= RANG[b] ? a : b;
}

export function neuesProtokoll(status: Status): Protokoll {
  return { status, hinweise: [], warnungen: [] };
}

export function kopiere(p: Protokoll): Protokoll {
  return { status: p.status, hinweise: [...p.hinweise], warnungen: [...p.warnungen] };
}

/** Wendet eine Einzelregel mit eigenem Status an; nicht belegte Regeln erzeugen eine Warnung. */
export function regelAngewendet(p: Protokoll, status: Status, beschreibung: string): void {
  p.status = schlechterer(p.status, status);
  if (status !== 'belegt') p.warnungen.push(`${beschreibung} (Status: ${status}).`);
}

/** Befreit/nicht steuerbar: alles 0. */
export function nullErgebnis(periodeId: string, protokoll: Protokoll, befreit: boolean): Roh {
  return {
    periodeId,
    satz: 0,
    bg: 0,
    malus: 0,
    abzugsposten: 0,
    bonus: 0,
    befreit,
    ersatz: null,
    protokoll,
  };
}

/** Motorrad ≤ Kleinkraftrad-Grenze: Satz 0 % bzw. nicht steuerbar; sonst null. */
export function kleinkraftradErgebnis(
  e: NovaEingabe,
  kk: Kleinkraftrad | null,
  periodeId: string,
  prot: Protokoll,
): NovaErgebnis | null {
  if (!kk || e.hubraum === undefined || e.hubraum > kk.bisCm3) return null;
  const nichtSteuerbar = kk.folge === 'nicht_steuerbar';
  prot.hinweise.push(
    `Hubraum ${zahl(e.hubraum)} cm³ ≤ ${kk.bisCm3} cm³: ${nichtSteuerbar ? 'kein Kraftfahrzeug iSd NoVAG, keine NoVA' : 'Steuersatz 0 %'}.`,
  );
  return abschliessen(nullErgebnis(periodeId, prot, nichtSteuerbar), undefined);
}

/** Kraftstoff, wenn die Periode danach unterscheidet; sonst EingabeFehler. */
export function verlangeKraftstoff(e: NovaEingabe, wofuer: string): Kraftstoff {
  if (!e.kraftstoff) {
    throw new EingabeFehler(`Kraftstoff (Benzin/Diesel/andere) fehlt: ${wofuer} hängt davon ab.`);
  }
  return e.kraftstoff;
}

/** Wendet die Kürzung an, rundet und begrenzt auf ≥ 0 (keine Steuergutschrift). */
export function abschliessen(roh: Roh, kuerzung: NovaKuerzung | undefined): NovaErgebnis {
  const p = kopiere(roh.protokoll);
  let { malus, abzugsposten, bonus } = roh;
  if (kuerzung && !roh.befreit) {
    const f = kuerzung.faktor;
    malus *= f;
    bonus *= f;
    if (kuerzung.umfang === 'malus_und_abzug') {
      abzugsposten *= f;
      if (roh.bonus > 0) {
        regelAngewendet(
          p,
          'nicht_verifiziert',
          'Umweltbonus (statt Abzugsposten) um die Wertentwicklung gekürzt – nicht durch ein Beispiel belegt',
        );
      }
    }
    if (kuerzung.umfang === 'bonus_malus') {
      regelAngewendet(
        p,
        'nicht_verifiziert',
        'Wertentwicklung vor 2014-03-01: alle Bonus- und Malusbeträge gekürzt; belegt ist nur der CO2-Bonus/-Malus, die Reihenfolge zum Erhöhungsbetrag ist offen',
      );
    }
    p.hinweise.push(
      `Wertentwicklung: ${kuerzung.umfang === 'malus_und_abzug' ? 'Malus und Abzugsposten' : 'Bonus/Malus'} × ${zahl(runde2(f * 100))} %.`,
    );
  }
  const grund = (roh.bg * roh.satz) / 100;
  const betrag = roh.befreit ? 0 : Math.max(0, runde2(grund + malus - abzugsposten - bonus));
  return {
    betrag,
    satzProzent: roh.satz,
    malus: runde2(malus),
    abzugsposten: runde2(abzugsposten),
    bonus: runde2(bonus),
    befreit: roh.befreit,
    ersatzwertGenutzt: roh.ersatz,
    status: p.status,
    periodeId: roh.periodeId,
    hinweise: p.hinweise,
    warnungen: p.warnungen,
  };
}

/** Zahl im deutschen Format für Hinweise (max. 4 Nachkommastellen). */
export function zahl(n: number): string {
  return n.toLocaleString('de-AT', { maximumFractionDigits: 4 });
}

/** Malus aus Stufen (Stufen addieren sich). */
export function malusAusStufen(
  co2: number,
  stufen: readonly { schwelleGramm: number; euroProGramm: number }[],
): number {
  return stufen.reduce((s, st) => s + Math.max(0, co2 - st.schwelleGramm) * st.euroProGramm, 0);
}

/** Satz begrenzen: min. 0, max. Höchstsatz. */
export function begrenze(satz: number, hoechst: number): number {
  return Math.min(Math.max(satz, 0), hoechst);
}
