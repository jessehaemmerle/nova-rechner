/**
 * EU-Import: Neufahrzeug-Abgrenzung, Nettokaufpreis und österreichische Erwerbsteuer.
 *
 * BMF (Fahrzeug-Einzelbesteuerung/Neufahrzeuge, UStG 1994 Art. 1 Abs. 8 und Art. 12 / § 1 Abs. 1 Z 1 iVm Art. 1):
 * - „neu": höchstens 6.000 km ODER Erstinbetriebnahme höchstens sechs Monate zurück;
 *   „gebraucht": mehr als 6.000 km UND Erstinbetriebnahme mehr als sechs Monate zurück.
 * - Neufahrzeug aus der EU: 20 % Erwerbsteuer in Österreich auf den Nettokaufpreis, für jeden Käufer.
 * - Gebrauchtfahrzeug: Unternehmer kauft von Unternehmer → 20 % Erwerbsteuer (als Vorsteuer abziehbar);
 *   Privatperson → keine österreichische USt (die ausländische USt steckt im Preis).
 * - Differenzbesteuerung: Weist die Rechnung sie aus, ist der Nettopreis die NoVA-Basis (nur Hinweis,
 *   keine Berechnung hier).
 *
 * Reine Funktionen; Beträge in EUR, kaufmännisch auf Cent gerundet; Sätze als Anteil (0.2 = 20 %).
 */
import { EUST_SAETZE } from '@/regelwerk';
import { datum, plusMonate } from './datum';
import { EingabeFehler } from './fehler';
import { runde2 } from './runde';

/**
 * Österreichischer Normalsteuersatz (Anteil). Datensatz und Quelle: src/regelwerk/ust-saetze.ts
 * (`EUST_SAETZE.AT`, UStG 1994 § 10 Abs. 1); der Erwerbsteuersatz ist der Normalsatz.
 */
export const AT_UST_SATZ = EUST_SAETZE.AT.satz;

/** Kilometergrenze: bis einschließlich dieser Laufleistung gilt ein Fahrzeug als neu. */
const NEU_MAX_KM = 6000;
/** Zeitgrenze in Monaten ab Erstinbetriebnahme. */
const NEU_MAX_MONATE = 6;

export type KaufpreisArt = 'netto' | 'brutto' | 'privat_ohne_ust';

/**
 * Neufahrzeug im Sinne des UStG: `km ≤ 6.000` ODER `stichtag ≤ Erstinbetriebnahme + 6 Monate`.
 *
 * Monatsarithmetik: Erstinbetriebnahme + 6 Kalendermonate, gleicher Tag des Monats; fehlt der Tag im
 * Zielmonat, gilt der letzte Tag des Monats (31.08. + 6 Monate = 28.02. bzw. 29.02.). Gewählte Lesart
 * von „höchstens sechs Monate": An diesem Endtag selbst ist das Fahrzeug noch neu, erst der Folgetag
 * ist „mehr als sechs Monate" (analog Fristende nach § 903 ABGB).
 * @throws EingabeFehler negative/nicht endliche Kilometer, ungültige Daten, Erstinbetriebnahme nach Stichtag.
 */
export function istNeufahrzeug(p: { km: number; erstinbetriebnahme: string; stichtag: string }): boolean {
  if (!Number.isFinite(p.km) || p.km < 0) {
    throw new EingabeFehler(`Kilometerstand muss eine Zahl ≥ 0 sein (erhalten: ${p.km}).`);
  }
  const erst = datum('Erstinbetriebnahme', p.erstinbetriebnahme);
  const stichtag = datum('Stichtag', p.stichtag);
  if (erst > stichtag) {
    throw new EingabeFehler(`Erstinbetriebnahme ${erst} liegt nach dem Stichtag ${stichtag}.`);
  }
  // ISO-Datumsstrings sind lexikographisch vergleichbar.
  return p.km <= NEU_MAX_KM || stichtag <= plusMonate(erst, NEU_MAX_MONATE);
}

/**
 * Nettokaufpreis: `brutto` → `runde2(preis / (1 + satz))`; `netto` und `privat_ohne_ust` (Preis enthält
 * keine abziehbare/erstattbare USt, z. B. Privatverkauf) bleiben unverändert.
 * @param ustSatzVerkaeufer Umsatzsteuersatz des Verkäuferlandes als Anteil, 0..1 (0.19 = 19 %).
 * @throws EingabeFehler Preis < 0 oder nicht endlich; Satz außerhalb 0..1.
 */
export function nettoKaufpreis(preis: number, art: KaufpreisArt, ustSatzVerkaeufer: number): number {
  if (!Number.isFinite(preis) || preis < 0) {
    throw new EingabeFehler(`Kaufpreis muss eine Zahl ≥ 0 sein (erhalten: ${preis}).`);
  }
  if (!Number.isFinite(ustSatzVerkaeufer) || ustSatzVerkaeufer < 0 || ustSatzVerkaeufer > 1) {
    throw new EingabeFehler(`USt-Satz des Verkäufers muss ein Anteil zwischen 0 und 1 sein (erhalten: ${ustSatzVerkaeufer}).`);
  }
  return art === 'brutto' ? runde2(preis / (1 + ustSatzVerkaeufer)) : preis;
}

/**
 * Österreichische Erwerbsteuer beim EU-Import.
 * - Neufahrzeug: 20 % des Nettokaufpreises für jeden Käufer.
 * - Gebraucht: nur Unternehmer (20 %); Privatperson 0.
 * `vorsteuerAbziehbar` = Erwerbsteuer nur für Unternehmer, sonst 0.
 * @throws EingabeFehler Nettokaufpreis < 0 oder nicht endlich.
 */
export function berechneEuUst(p: {
  kaeufer: 'privat' | 'unternehmer';
  neu: boolean;
  nettoKaufpreis: number;
}): { erwerbsteuer: number; vorsteuerAbziehbar: number } {
  if (!Number.isFinite(p.nettoKaufpreis) || p.nettoKaufpreis < 0) {
    throw new EingabeFehler(`Nettokaufpreis muss eine Zahl ≥ 0 sein (erhalten: ${p.nettoKaufpreis}).`);
  }
  const unternehmer = p.kaeufer === 'unternehmer';
  const steuerpflichtig = p.neu || unternehmer;
  const erwerbsteuer = steuerpflichtig ? runde2(p.nettoKaufpreis * AT_UST_SATZ) : 0;
  return { erwerbsteuer, vorsteuerAbziehbar: unternehmer ? erwerbsteuer : 0 };
}
