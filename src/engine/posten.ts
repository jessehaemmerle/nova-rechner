import { EingabeFehler } from './fehler';
import type { Status } from '../regelwerk/types';

/** Eine Kostenposition (Betrag in EUR, auf Cent gerundet) mit Beleg-Status. */
export interface Posten {
  /** Eindeutig je Aufruf der erzeugenden Funktion. */
  id: string;
  label: string;
  betrag: number;
  status: Status;
  erklaerung: string;
  quelle?: string;
}

/** Wirft `EingabeFehler`, wenn `wert` kein endlicher, nicht-negativer Betrag ist. */
export function pruefeBetrag(feld: string, wert: number): void {
  if (!Number.isFinite(wert) || wert < 0) {
    throw new EingabeFehler(`${feld}: Betrag muss eine Zahl ≥ 0 sein (erhalten: ${wert}).`);
  }
}
