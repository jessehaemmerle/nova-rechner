/**
 * Allgemeine NoVA-Regeln (Recherche-Dokument § 0.2), gültig für alle Perioden.
 */
import { STAND } from './nova-perioden-gemeinsam';
import type { Beleg } from './types';

/** Erster und letzter Tag, für den das Regelwerk Perioden führt. */
export const REGELWERK_BEGINN = '2008-01-01';
export const REGELWERK_ENDE = '2029-12-31';

/** Steuersatz auf volle Prozent, kaufmännisch (halbe Prozent aufrunden). */
export const RUNDUNG_STEUERSATZ: { art: 'kaufmaennisch_half_up'; stellen: 0 } & Beleg = {
  art: 'kaufmaennisch_half_up',
  stellen: 0,
  quelle: 'NoVAG § 6 idF R1, R4, R10–R14 („auf volle Prozentsätze auf- bzw. abzurunden"); BMF „kaufmännisch gerundet"',
  stand: STAND,
  status: 'belegt',
};

/** NoVA ist nie negativ (keine Steuergutschrift). */
export const KEINE_STEUERGUTSCHRIFT: Beleg = {
  quelle: 'NoVAG § 6a Abs. 2 idF R3/R5–R9; § 6 Abs. 3 idF R10; § 6 Abs. 2 idF R11–R14',
  stand: STAND,
  status: 'belegt',
};

/** Ersatzwert ab 2026-07-30 (nur wenn `Co2Periode.nefz127Ersatz`): CO2 = 1,27 × NEFZ. */
export const NEFZ_ERSATZ_FAKTOR: { faktor: number } & Beleg = {
  faktor: 1.27,
  quelle: 'NoVAG § 6 Abs. 6 Z 2 idF R14 (NOR40279854), § 15 Abs. 29; BMF NoVA-Steuersatz (30.7.2026)',
  stand: STAND,
  status: 'belegt',
};
