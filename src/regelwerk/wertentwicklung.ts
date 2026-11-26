/**
 * EU/EWR-Gebrauchtimport: Kürzung um die Wertentwicklung (Recherche-Dokument § 0.2).
 * Rechtslage = Zeitpunkt der erstmaligen Zulassung im übrigen Unionsgebiet.
 */
import { pruefeIsoDatum, RegelwerkLuecke } from './fehler';
import { STAND } from './nova-perioden-gemeinsam';
import type { Beleg, WertentwicklungsUmfang } from './types';

/**
 * Kürzungsfaktor:
 * - Neuwagenwert bekannt: aktuelle BG / Neuwagenwert.
 * - Neuwagenwert unbekannt: max(untergrenze, 1 − volle Jahre seit Erstzulassung / jahreNenner).
 * Angewendet auf den Saldo bzw. den Bonus/Malus laut `WertentwicklungsUmfang.gekuerzt`.
 */
export const WERTENTWICKLUNG_VERFAHREN: {
  neuwagenwertBekannt: 'verhaeltnis_bg_zu_neuwagenwert';
  jahreNenner: number;
  untergrenze: number;
  rundung: 'cent';
} & Beleg = {
  neuwagenwertBekannt: 'verhaeltnis_bg_zu_neuwagenwert',
  jahreNenner: 8,
  untergrenze: 1 / 8,
  rundung: 'cent',
  quelle: 'NoVAG § 6 Abs. 8 idF R14 (NOR40279854); BMF NoVA-Steuersatz (Beispiele E1a/E1b)',
  stand: STAND,
  status: 'belegt',
};

/** Geltungsbereich je Erstzulassungszeitraum (Tabelle § 0.2), nach Datum sortiert. */
export const WERTENTWICKLUNG_UMFANG: readonly WertentwicklungsUmfang[] = [
  {
    von: '2008-01-01',
    bis: '2014-02-28',
    docIds: ['PKW-2008a', 'PKW-2008b', 'PKW-2009', 'PKW-2010', 'PKW-2011', 'PKW-2013'],
    gekuerzt: 'nur_bonus_malus',
    umweltbonusGekuerztStatus: null,
    quelle:
      'BMF „Rechtslage von 1. Juni 1996 bis 30. Juni 2008" und „von 1. Juli 2008 bis 28. Februar 2014"; NoVAG § 6 Abs. 8 idF R14; § 6a Abs. 6 idF R6–R9',
    stand: STAND,
    status: 'nicht_verifiziert',
    offen: [
      'Nur Bonus/Malus; einen Abzugsposten gab es nicht – die Saldo-Regel darf nicht mit einem Abzugsposten angewendet werden.',
      'Historisch: R3/R5 (bis 15.6.2010) ohne Wertentwicklungsklausel, R6–R9 § 6a Abs. 6 kürzen nur den Malus; für Importe ab heute gilt R14 Abs. 8 („Bonus-Malus-Berechnung").',
      'CO2-Bonus/-Malus sicher erfasst; NOx/Partikel-Bonus, Ökobonus, Partikel-Malus (+300 €) und kW-Malus nicht belegt.',
      'Reihenfolge zum Erhöhungsbetrag offen.',
    ],
  },
  {
    von: '2014-03-01',
    bis: '2019-12-31',
    docIds: ['PKW-2014', 'PKW-2015', 'PKW-2016'],
    gekuerzt: 'saldo_malus_abzugsposten',
    umweltbonusGekuerztStatus: 'nicht_verifiziert',
    quelle:
      'NoVAG § 6 Abs. 8 idF R14 (NOR40279854); BMF NoVA-Steuersatz Beispiel E1; BMF „Rechtslage von 1. März 2014 bis 31. Dezember 2019"',
    stand: STAND,
    status: 'belegt',
    offen: [
      'Ob der Umweltbonus (600 €, statt Abzugsposten) als „Bonus" gekürzt wird, ist nicht durch ein Beispiel belegt.',
      'Historischer Text R10 § 6 Abs. 6 nannte nur die „Bonus-Malus-Berechnung"; für Importe ab heute gilt R14 Abs. 8.',
    ],
  },
  {
    von: '2020-01-01',
    bis: null,
    docIds: [
      'PKW-2020',
      'PKW-2021a',
      'PKW-2021b',
      'PKW-2022',
      'PKW-2023',
      'PKW-2024',
      'PKW-2025a',
      'PKW-2025b',
      'PKW-2026a',
      'PKW-2026b',
      'PKW-2027',
      'PKW-2028',
      'PKW-2029',
    ],
    gekuerzt: 'saldo_malus_abzugsposten',
    umweltbonusGekuerztStatus: null,
    quelle:
      'NoVAG § 6 Abs. 8 idF R14 (NOR40279854, „Bonus-Malus-Berechnung und den Abzugsbetrag"); BMF-Periodenseiten ab 2020',
    stand: STAND,
    status: 'belegt',
    offen: [],
  },
];

/** Geltungsbereich der Wertentwicklung für ein Erstzulassungsdatum. */
export function selectWertentwicklungUmfang(erstzulassung: string): WertentwicklungsUmfang {
  pruefeIsoDatum(erstzulassung);
  const u = WERTENTWICKLUNG_UMFANG.find(
    (x) => x.von <= erstzulassung && (x.bis === null || erstzulassung <= x.bis),
  );
  if (!u) {
    throw new RegelwerkLuecke(
      `Für die Erstzulassung am ${erstzulassung} ist keine Wertentwicklungs-Regel hinterlegt (Regelwerk ab 2008-01-01).`,
    );
  }
  return u;
}
