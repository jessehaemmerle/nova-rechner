/**
 * Einfuhrumsatzsteuer-Sätze nach Ort der Einfuhrabfertigung (Anteil, 0.2 = 20 %).
 * Österreich belegt; andere Einfuhrhafen-Länder Schätzwerte bis geprüft (Spezifikation § 5.3).
 */
import { STAND } from './nova-perioden-gemeinsam';
import type { Wert } from './types';

export type Laenderkuerzel = 'AT' | 'DE' | 'NL' | 'IT' | 'SI';

const QUELLE_SCHAETZUNG =
  'Schätzwert, nicht geprüft (Normalsatz des Einfuhrlandes); Spezifikation § 5.3/§ 13';

export const EUST_SAETZE: Record<Laenderkuerzel, Wert> = {
  AT: {
    satz: 0.2,
    quelle: 'UStG 1994 § 10 Abs. 1 (Normalsatz 20 %); BMF „Fahrzeugimport aus Drittstaaten"',
    stand: STAND,
    status: 'belegt',
  },
  DE: { satz: 0.19, quelle: QUELLE_SCHAETZUNG, stand: STAND, status: 'schaetzwert' },
  NL: { satz: 0.21, quelle: QUELLE_SCHAETZUNG, stand: STAND, status: 'schaetzwert' },
  IT: { satz: 0.22, quelle: QUELLE_SCHAETZUNG, stand: STAND, status: 'schaetzwert' },
  SI: { satz: 0.22, quelle: QUELLE_SCHAETZUNG, stand: STAND, status: 'schaetzwert' },
};
