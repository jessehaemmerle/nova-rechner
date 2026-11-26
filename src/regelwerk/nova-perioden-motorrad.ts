/**
 * NoVA-Perioden Motorräder (vor 7/2021: § 2 Z 1 Krafträder; ab 7/2021: L3e, L4e, L5e, L7e;
 * bis 31.8.2022 auch L6e). Quelle: `docs/superpowers/research/nova-perioden.md` Abschnitt 3.
 */
import {
  HINWEIS_MINDESTSATZ_CO2,
  HINWEIS_VOR_2014,
  HOECHST_16_BETRAGSWORTLAUT,
  OHNE_CO2_HUBRAUM,
  STAND,
  UEBERGANG_2014,
  UEBERGANG_2020,
  UEBERGANG_2021B,
  erhoehungsbetrag,
  hoechstsatz,
  jahreswechsel,
} from './nova-perioden-gemeinsam';
import type { Co2Periode, HubraumPeriode } from './types';

const MR_2008: HubraumPeriode = {
  docId: 'MR-2008',
  art: 'motorrad',
  formel: 'hubraum',
  verfahren: 'HUBRAUM',
  von: '2008-01-01',
  bis: '2014-02-28',
  abzugCm3: 100,
  faktor: 0.02,
  hoechstsatz: HOECHST_16_BETRAGSWORTLAUT,
  kleinkraftrad: { bisCm3: 125, folge: 'satz_null' },
  erhoehungsbetrag: erhoehungsbetrag('grundbetrag'),
  quelle:
    'NoVAG § 6 idF R1 (NOR40025126) und R4 (NOR40105896); BMF „Rechtslage von 1. Juni 1996 bis 30. Juni 2008" und „von 1. Juli 2008 bis 28. Februar 2014"',
  stand: STAND,
  status: 'nicht_verifiziert',
  uebergang: null,
  hinweise: HINWEIS_VOR_2014,
};

const MR_2014: HubraumPeriode = {
  docId: 'MR-2014',
  art: 'motorrad',
  formel: 'hubraum',
  verfahren: 'HUBRAUM',
  von: '2014-03-01',
  bis: '2019-12-31',
  abzugCm3: 100,
  faktor: 0.02,
  hoechstsatz: hoechstsatz(20),
  kleinkraftrad: { bisCm3: 125, folge: 'satz_null' },
  erhoehungsbetrag: null,
  quelle: 'NoVAG § 6 Abs. 1 idF R10 (NOR40161297); BMF „Rechtslage von 1. März 2014 bis 31. Dezember 2019"',
  stand: STAND,
  status: 'belegt',
  uebergang: UEBERGANG_2014('MR-2008'),
  hinweise: [],
};

const MR_CO2 = {
  art: 'motorrad',
  formel: 'co2',
  verfahren: 'WMTC',
  divisor: 4,
  mindestsatzNullStatus: 'nicht_verifiziert',
  malus: [{ schwelleGramm: 150, euroProGramm: 20 }],
  abzugsposten: null,
  umweltbonus: null,
  /** Ohne CO2-Wert: Hubraum-Formel, gedeckelt mit dem Höchstsatz der Periode. */
  ohneCo2: [OHNE_CO2_HUBRAUM],
  nefz127Ersatz: false,
  nefzSonderregel: null,
  wohnmobilSA: null,
  personenbefoerderungN1: null,
  stand: STAND,
  status: 'belegt',
} as const;

/** Ab MR-2021b: ≤ 125 cm³ kein Kfz iSd NoVAG, Höchstsatz 30 %. */
const MR_AB_2021B = {
  ...MR_CO2,
  hoechstsatz: hoechstsatz(30),
  kleinkraftrad: { bisCm3: 125, folge: 'nicht_steuerbar' },
} as const;

const MR_2020: Co2Periode = {
  ...MR_CO2,
  docId: 'MR-2020',
  von: '2020-01-01',
  bis: '2021-06-30',
  abzugswert: 55,
  hoechstsatz: hoechstsatz(20),
  kleinkraftrad: { bisCm3: 125, folge: 'satz_null' },
  quelle: `NoVAG § 6 Abs. 1, 3, 4 idF R11 (NOR40218524); BMF „Rechtslage von 1. Jänner 2020 bis 30. Juni 2021"`,
  uebergang: UEBERGANG_2020('MR-2014'),
  hinweise: [HINWEIS_MINDESTSATZ_CO2],
};

const MR_2021B: Co2Periode = {
  ...MR_AB_2021B,
  docId: 'MR-2021b',
  von: '2021-07-01',
  bis: '2023-12-31',
  abzugswert: 55,
  quelle:
    'NoVAG § 6 Abs. 1, 6 idF R12 (NOR40230676), § 2 idF R16 (NOR40230674); BMF „Rechtslage von 1. Juli 2021 bis 30. Juni 2025"',
  uebergang: UEBERGANG_2021B('MR-2020'),
  hinweise: [HINWEIS_MINDESTSATZ_CO2],
};

const MR_2024: Co2Periode = {
  ...MR_AB_2021B,
  docId: 'MR-2024',
  von: '2024-01-01',
  bis: '2025-12-31',
  abzugswert: 53,
  quelle:
    'NoVAG § 6 Abs. 7 idF R12 (NOR40230676) und R13 (NOR40269623); BMF „Rechtslage von 1. Juli 2021 bis 30. Juni 2025" und „ab 1. Juli 2025"',
  uebergang: jahreswechsel('MR-2021b', 2024),
  hinweise: [
    'Nicht am 2025-07-01 geteilt: Werte vor und nach dem Reformstichtag identisch.',
    HINWEIS_MINDESTSATZ_CO2,
  ],
};

const MR_2026: Co2Periode = {
  ...MR_AB_2021B,
  docId: 'MR-2026',
  von: '2026-01-01',
  bis: '2027-12-31',
  abzugswert: 51,
  quelle:
    'NoVAG § 6 Abs. 7 idF R13 (NOR40269623) und R14 (NOR40279854); BMF „Rechtslage ab 1. Juli 2025"',
  uebergang: jahreswechsel('MR-2024', 2026),
  hinweise: [HINWEIS_MINDESTSATZ_CO2],
};

const MR_2028: Co2Periode = {
  ...MR_AB_2021B,
  docId: 'MR-2028',
  von: '2028-01-01',
  bis: '2029-12-31',
  abzugswert: 49,
  quelle: 'NoVAG § 6 Abs. 7 idF R14 (NOR40279854); BMF „Rechtslage ab 1. Juli 2025"',
  uebergang: jahreswechsel('MR-2026', 2028),
  hinweise: [
    HINWEIS_MINDESTSATZ_CO2,
    'Ab 2030 keine Periode: Gesetz senkt rechnerisch weiter (47 g), BMF listet nur bis 2029 → Warnung.',
  ],
};

export const MOTORRAD_PERIODEN: readonly (HubraumPeriode | Co2Periode)[] = [
  MR_2008,
  MR_2014,
  MR_2020,
  MR_2021B,
  MR_2024,
  MR_2026,
  MR_2028,
];
