/**
 * Zoll, Zollwert und Einfuhrumsatzsteuer (EUSt) bei Import aus einem Drittland.
 *
 * Reine Funktion: Zoll- und EUSt-Satz kommen als Anteil (0.1 = 10 %) von außen
 * (Regelwerk-Lookup erfolgt im Aufrufer). Alle Beträge in EUR, kaufmännisch auf Cent gerundet.
 */
import { EingabeFehler } from './fehler';
import { runde2 } from './runde';

export interface ZollEingabe {
  kaufpreisEur: number;
  /** Beförderungskosten bis zum Eintrittsort in die EU. */
  fracht: number;
  versicherung: number;
  /** Kosten nach dem Eintrittsort (z. B. Inlandstransport), nur in der EUSt-Basis. */
  nachlauf: number;
  /** Zollsatz als Anteil, 0..1 (0.1 = 10 %). */
  zollsatz: number;
  /** EUSt-Satz als Anteil, 0..1 (0.2 = 20 %). */
  eustSatz: number;
  /** Zollfrei dank Präferenzabkommen: Zoll entfällt, EUSt-Basis wird kleiner. */
  praeferenzfrei?: boolean;
}

export interface ZollErgebnis {
  zollwert: number;
  zoll: number;
  eustBasis: number;
  eust: number;
}

function pruefeBetrag(name: string, v: number): void {
  if (!Number.isFinite(v) || v < 0) {
    throw new EingabeFehler(`${name} muss eine Zahl ≥ 0 sein (erhalten: ${v}).`);
  }
}

function pruefeSatz(name: string, v: number): void {
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    throw new EingabeFehler(`${name} muss zwischen 0 und 1 liegen, z. B. 0.2 für 20 % (erhalten: ${v}).`);
  }
}

export function berechneZollUndEust(e: ZollEingabe): ZollErgebnis {
  pruefeBetrag('kaufpreisEur', e.kaufpreisEur);
  pruefeBetrag('fracht', e.fracht);
  pruefeBetrag('versicherung', e.versicherung);
  pruefeBetrag('nachlauf', e.nachlauf);
  pruefeSatz('zollsatz', e.zollsatz);
  pruefeSatz('eustSatz', e.eustSatz);

  const zollwert = runde2(e.kaufpreisEur + e.fracht + e.versicherung);
  const zoll = e.praeferenzfrei ? 0 : runde2(zollwert * e.zollsatz);
  const eustBasis = runde2(zollwert + zoll + e.nachlauf);
  const eust = runde2(eustBasis * e.eustSatz);

  return { zollwert, zoll, eustBasis, eust };
}
