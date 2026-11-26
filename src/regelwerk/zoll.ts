/**
 * Drittland-Zollsätze (Anteil des Zollwerts). Pro Fall überschreibbar.
 * Belegt: Pkw 10 %, Motorrad > 250 cm³ 6 % (ÖAMTC „Eigenimport"); übrige Klassen sind
 * Schätzwerte, bis der EU-Zolltarif (TARIC) je Unterposition geprüft ist.
 */
import { STAND } from './nova-perioden-gemeinsam';
import type { Wert } from './types';

export type Zollklasse =
  | 'pkw'
  | 'motorrad_ueber_250'
  | 'motorrad_bis_250'
  | 'lieferwagen'
  | 'wohnmobil';

const QUELLE_OEAMTC = 'ÖAMTC „Eigenimport" (Zollsätze Drittland); Spezifikation § 5.3';
const QUELLE_SCHAETZUNG =
  'Schätzwert, nicht geprüft (EU-Zolltarif/TARIC je Unterposition nicht recherchiert); Spezifikation § 5.3/§ 13';

export const ZOLLSAETZE: Record<Zollklasse, Wert> = {
  pkw: { satz: 0.1, quelle: QUELLE_OEAMTC, stand: STAND, status: 'belegt' },
  motorrad_ueber_250: { satz: 0.06, quelle: QUELLE_OEAMTC, stand: STAND, status: 'belegt' },
  motorrad_bis_250: {
    satz: 0.08,
    quelle: QUELLE_SCHAETZUNG,
    stand: STAND,
    status: 'schaetzwert',
    hinweis: 'Schätzwert – vor Verwendung prüfen, im Formular überschreibbar.',
  },
  lieferwagen: {
    satz: 0.22,
    quelle: QUELLE_SCHAETZUNG,
    stand: STAND,
    status: 'schaetzwert',
    hinweis:
      'Schätzwert – je nach Unterposition (neu/gebraucht, Motor) zwischen 10 % und 22 %; im Formular überschreibbar.',
  },
  wohnmobil: {
    satz: 0.1,
    quelle: QUELLE_SCHAETZUNG,
    stand: STAND,
    status: 'schaetzwert',
    hinweis: 'Schätzwert – Wohnmobile der Position 8703 wie Pkw angenommen; im Formular überschreibbar.',
  },
};

/** Hinweis aus Spezifikation § 5.3: Nullzoll für US-Ursprung seit Juli 2026 nicht belegt. */
export const ZOLL_HINWEIS_US_URSPRUNG =
  'Ob für US-Ursprungsfahrzeuge seit Juli 2026 Nullzoll gilt, ist nicht belegt; Standard bleibt der Satz der Tabelle.';
