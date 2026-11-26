/**
 * NoVA-Perioden leichte Nutzfahrzeuge (N1).
 * Quelle: `docs/superpowers/research/nova-perioden.md` Abschnitt 2.
 */
import {
  HINWEIS_MINDESTSATZ_CO2,
  PERSONENBEFOERDERUNG_4_9_SITZE,
  STAND,
  UEBERGANG_2021B,
  UEBERGANG_2025B,
  beleg,
  hoechstsatz,
  jahreswechsel,
  ohneCo2Kw,
} from './nova-perioden-gemeinsam';
import type { Co2Periode, NefzSonderregel, VerweisPeriode } from './types';

const N1_BIS_2021: VerweisPeriode = {
  docId: 'N1-bis2021',
  art: 'n1',
  formel: 'verweis_pkw',
  verfahren: null,
  von: '2008-01-01',
  bis: '2021-06-30',
  steuerbarWenn: { art: 'zolltarif', position: '8703' },
  nichtSteuerbar: ['Güterfahrzeuge der KN-Position 8704'],
  einreihungStatus: 'nicht_verifiziert',
  quelle: 'NoVAG § 2 Z 2 idF R15 (NOR12054297)',
  stand: STAND,
  status: 'belegt',
  uebergang: null,
  hinweise: [
    'Keine eigene N1-Kategorie: nur Fahrzeuge der KN-Position 8703 („hauptsächlich zur Personenbeförderung") sind Kraftfahrzeuge nach § 2 Z 2 → dann Pkw-Zeilen zum selben Stichtag.',
    'Einreihung 8703/8704 ist Einzelfallfrage → Nutzerbestätigung.',
  ],
};

/** R12 Abs. 5: NEFZ-only (auslaufende Serie) mit Abzug 140 g und Malusgrenze 238 g. */
function nefzN1(status: 'belegt' | 'nicht_verifiziert'): NefzSonderregel {
  return {
    art: 'feste_werte',
    abzugGramm: 140,
    malusSchwelleGramm: 238,
    quelle: 'NoVAG § 6 Abs. 5 idF R12 (NOR40230676)',
    stand: STAND,
    status,
  };
}

const N1_CO2 = {
  art: 'n1',
  formel: 'co2',
  verfahren: 'WLTP',
  divisor: 5,
  mindestsatzNullStatus: 'nicht_verifiziert',
  abzugsposten: { dieselEuro: 350, andereEuro: 350 },
  umweltbonus: null,
  ohneCo2: [
    ohneCo2Kw(
      beleg('NoVAG § 6 idF R12 (NOR40230676); Recherche-Dokument N1-2021b (N1-2022 bis N1-2025a: „wie oben")'),
    ),
  ],
  nefz127Ersatz: false,
  wohnmobilSA: null,
  kleinkraftrad: null,
  personenbefoerderungN1: null,
  stand: STAND,
  status: 'belegt',
} as const;

const HINWEIS_NEFZ_ANPASSUNG =
  'NEFZ-Sonderregel: Abs. 7 passt nur Abs. 2 und 3 an; ob die festen Werte 140/238 g jährlich angepasst werden, ist offen.';
const QUELLE_N1 = 'NoVAG § 6 Abs. 7 idF R12 (NOR40230676); BMF „Rechtslage von 1. Juli 2021 bis 30. Juni 2025"';

const N1_2021B: Co2Periode = {
  ...N1_CO2,
  docId: 'N1-2021b',
  von: '2021-07-01',
  bis: '2021-12-31',
  abzugswert: 165,
  hoechstsatz: hoechstsatz(50),
  malus: [{ schwelleGramm: 253, euroProGramm: 50 }],
  nefzSonderregel: nefzN1('belegt'),
  quelle:
    'NoVAG § 6 Abs. 3 idF R12 (NOR40230676), § 2 idF R16 (NOR40230674); BMF „Rechtslage von 1. Juli 2021 bis 30. Juni 2025"',
  uebergang: UEBERGANG_2021B('N1-bis2021'),
  hinweise: [HINWEIS_MINDESTSATZ_CO2],
};

const N1_2022: Co2Periode = {
  ...N1_CO2,
  docId: 'N1-2022',
  von: '2022-01-01',
  bis: '2022-12-31',
  abzugswert: 160,
  hoechstsatz: hoechstsatz(60),
  malus: [{ schwelleGramm: 238, euroProGramm: 60 }],
  nefzSonderregel: nefzN1('nicht_verifiziert'),
  quelle: QUELLE_N1,
  uebergang: jahreswechsel('N1-2021b', 2022),
  hinweise: [HINWEIS_NEFZ_ANPASSUNG, HINWEIS_MINDESTSATZ_CO2],
};

const N1_2023: Co2Periode = {
  ...N1_CO2,
  docId: 'N1-2023',
  von: '2023-01-01',
  bis: '2023-12-31',
  abzugswert: 155,
  hoechstsatz: hoechstsatz(70),
  malus: [{ schwelleGramm: 223, euroProGramm: 70 }],
  nefzSonderregel: nefzN1('nicht_verifiziert'),
  quelle: QUELLE_N1,
  uebergang: jahreswechsel('N1-2022', 2023),
  hinweise: [HINWEIS_NEFZ_ANPASSUNG, HINWEIS_MINDESTSATZ_CO2],
};

const N1_2024: Co2Periode = {
  ...N1_CO2,
  docId: 'N1-2024',
  von: '2024-01-01',
  bis: '2024-12-31',
  abzugswert: 150,
  hoechstsatz: hoechstsatz(80),
  malus: [{ schwelleGramm: 208, euroProGramm: 80 }],
  nefzSonderregel: nefzN1('nicht_verifiziert'),
  quelle: QUELLE_N1,
  uebergang: jahreswechsel('N1-2023', 2024),
  hinweise: [HINWEIS_NEFZ_ANPASSUNG, HINWEIS_MINDESTSATZ_CO2],
};

const N1_2025A: Co2Periode = {
  ...N1_CO2,
  docId: 'N1-2025a',
  von: '2025-01-01',
  bis: '2025-06-30',
  abzugswert: 147,
  hoechstsatz: hoechstsatz(80),
  malus: [{ schwelleGramm: 208, euroProGramm: 80 }],
  nefzSonderregel: nefzN1('nicht_verifiziert'),
  quelle: QUELLE_N1,
  uebergang: jahreswechsel('N1-2024', 2025),
  hinweise: [HINWEIS_NEFZ_ANPASSUNG, HINWEIS_MINDESTSATZ_CO2],
};

const N1_AB_2025B: VerweisPeriode = {
  docId: 'N1-ab2025b',
  art: 'n1',
  formel: 'verweis_pkw',
  verfahren: 'WLTP',
  von: '2025-07-01',
  bis: null,
  steuerbarWenn: { art: 'personenbefoerderung', ...PERSONENBEFOERDERUNG_4_9_SITZE },
  nichtSteuerbar: [
    'Kastenwagen mit zwei Sitzreihen nach § 2 Abs. 1 Z 4 lit. a',
    'Pritschenwagen mit zwei Sitzreihen nach § 2 Abs. 1 Z 4 lit. b',
    'N1 mit höchstens 3 Sitzplätzen',
  ],
  einreihungStatus: 'belegt',
  quelle: 'NoVAG § 2 idF R18 (NOR40269622) und R19 (NOR40273765); BMF „Rechtslage ab 1. Juli 2025"',
  stand: STAND,
  status: 'belegt',
  uebergang: UEBERGANG_2025B('N1-2025a'),
  hinweise: [
    'Kfz mit 4–9 Sitzplätzen, ≤ 3.500 kg → Pkw-Zeilen (PKW-2025b ff.) zum selben Stichtag.',
    'Bedingungen für Kastenwagen/Pritsche siehe R18 Z 4.',
    'Ende offen; Auswahl endet mit dem Regelwerk am 2029-12-31.',
  ],
};

export const N1_PERIODEN: readonly (Co2Periode | VerweisPeriode)[] = [
  N1_BIS_2021,
  N1_2021B,
  N1_2022,
  N1_2023,
  N1_2024,
  N1_2025A,
  N1_AB_2025B,
];
