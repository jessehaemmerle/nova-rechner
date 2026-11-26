/**
 * Bausteine, die mehrere Perioden teilen. Werte und Fundstellen aus
 * `docs/superpowers/research/nova-perioden.md` (Abrufdatum 2026-11-26).
 */
import type {
  BonusAntrieb,
  Erhoehungsbetrag,
  Hoechstsatz,
  OhneCo2Ersatz,
  Uebergang,
  WohnmobilSA,
} from './types';

export const STAND = '2026-11-26';

export const BMF_BASIS =
  'BMF NoVA-Steuersatz, https://www.bmf.gv.at/themen/steuern/kraftfahrzeuge/normverbrauchsabgabe-uebersicht/';

export const BONUS_ANTRIEBE: BonusAntrieb[] = [
  'hybrid',
  'e85',
  'erdgas_biogas',
  'fluessiggas',
  'wasserstoff',
];

/** R1/R4 § 6 Abs. 3: „Die Abgabe beträgt höchstens 16% der Bemessungsgrundlage." */
export const HOECHST_16_BETRAGSWORTLAUT: Hoechstsatz = {
  prozent: 16,
  wortlaut: 'betrag',
  anwendung: 'satz',
  status: 'nicht_verifiziert',
};

/** Ab 2014-03-01: „Der Höchststeuersatz beträgt …" */
export function hoechstsatz(prozent: number): Hoechstsatz {
  return { prozent, wortlaut: 'satz', anwendung: 'satz', status: 'belegt' };
}

/** § 6 Abs. 6 idF R1/R4; nach Controller-Ruling (Spec § 14) nicht anzusetzen. */
export function erhoehungsbetrag(basis: Erhoehungsbetrag['basis']): Erhoehungsbetrag {
  return {
    prozent: 20,
    bedingung: 'nova_nicht_teil_der_ust_bg',
    basis,
    anzusetzen: false,
    status: 'nicht_verifiziert',
  };
}

export const OHNE_CO2_VERBRAUCH: OhneCo2Ersatz = {
  art: 'verbrauch',
  faktorBenzinUndAndere: 25,
  faktorDiesel: 28,
};
export const OHNE_CO2_KW: OhneCo2Ersatz = { art: 'kw', faktor: 2 };
export const OHNE_CO2_HUBRAUM: OhneCo2Ersatz = { art: 'hubraum', abzugCm3: 100, faktor: 0.02 };

/** R11 Abs. 4 Z 4 (2020-01-01 – 2021-06-30). */
export const WOHNMOBIL_SA_2020: WohnmobilSA = {
  kwFaktor: 2,
  mindestsatzProzent: 16,
  nurNichtSelbsttragend: true,
  mindestsatzGiltBei: ['kw_wahl'],
};

/** R12–R14 Abs. 6 Z 4 (ab 2021-07-01). */
export const WOHNMOBIL_SA_AB_2021B: WohnmobilSA = {
  kwFaktor: 2,
  mindestsatzProzent: 16,
  nurNichtSelbsttragend: false,
  mindestsatzGiltBei: ['kw_wahl', 'ohne_co2_wert'],
};

export const PERSONENBEFOERDERUNG_4_9_SITZE = {
  sitzplaetzeMin: 4,
  sitzplaetzeMax: 9,
  hoechstgewichtKg: 3500,
};

/** Jahreswechsel ab 2022 (R12–R14 § 6 Abs. 7): Vertrag vor 1.12., Lieferung vor 1.4. */
export function jahreswechsel(vorherigeDocId: string, jahr: number): Uebergang {
  return {
    art: 'jahreswechsel',
    vorherigeDocId,
    vertragVor: `${jahr - 1}-12-01`,
    lieferungVor: `${jahr}-04-01`,
    quelle: 'NoVAG § 6 Abs. 7 idF R12–R14; BMF NoVA-Steuersatz (Übergangsregel)',
    stand: STAND,
    status: 'belegt',
  };
}

/** Reformstichtage nach R20 § 15 (NOR40279855). */
export function reformstichtag(
  vorherigeDocId: string,
  vertragVor: string,
  lieferungVor: string,
  absatz: number,
): Uebergang {
  return {
    art: 'reformstichtag',
    vorherigeDocId,
    vertragVor,
    lieferungVor,
    quelle: `NoVAG § 15 Abs. ${absatz} idF R20 (NOR40279855)`,
    stand: STAND,
    status: 'belegt',
  };
}

export const UEBERGANG_2014 = (vorher: string) => reformstichtag(vorher, '2014-02-16', '2014-10-01', 15);
export const UEBERGANG_2020 = (vorher: string) => reformstichtag(vorher, '2019-12-01', '2020-06-01', 21);
export const UEBERGANG_2021B = (vorher: string) => reformstichtag(vorher, '2021-06-01', '2022-05-01', 25);
export const UEBERGANG_2025B = (vorher: string) => reformstichtag(vorher, '2025-07-01', '2025-12-31', 27);

export const HINWEIS_VOR_2014 = [
  'Erhöhungsbetrag 20 % bei EU-Eigenimport ungeklärt (EuGH C-433/09, abweichende BMF-/UFS-Praxis); laut Ruling nicht angesetzt, Warnung.',
  '16-%-Grenze lautet im Gesetz auf den Betrag („Die Abgabe beträgt höchstens 16% der Bemessungsgrundlage"); Dokument folgt der BMF-Lesart (Grenze für den Satz).',
];

export const HINWEIS_MINDESTSATZ_CO2 =
  'Steuersatz min. 0 % ist für CO2-Formeln nicht ausdrücklich geregelt (Annahme aus „keine Steuergutschrift").';
