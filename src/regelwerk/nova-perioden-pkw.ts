/**
 * NoVA-Perioden Personenkraftwagen (M1; vor 1.7.2021: § 2 Z 2 = KN-Position 8703).
 * Quelle: `docs/superpowers/research/nova-perioden.md` Abschnitt 1 und 4 (Wohnmobil).
 * Ein Objekt je Tabellenzeile; `docId` = Spalte „ID".
 */
import {
  BMF_BASIS,
  BONUS_ANTRIEBE,
  HINWEIS_MINDESTSATZ_CO2,
  HINWEIS_VOR_2014,
  HOECHST_16_BETRAGSWORTLAUT,
  PERSONENBEFOERDERUNG_4_9_SITZE,
  QUELLE_R10_UEBERTRAGEN,
  STAND,
  UEBERGANG_2014,
  UEBERGANG_2020,
  UEBERGANG_2021B,
  UEBERGANG_2025B,
  WOHNMOBIL_SA_2020,
  WOHNMOBIL_SA_AB_2021B,
  beleg,
  erhoehungsbetrag,
  hoechstsatz,
  jahreswechsel,
  ohneCo2Kw,
  ohneCo2Verbrauch,
} from './nova-perioden-gemeinsam';
import type { Co2Periode, VerbrauchPeriode } from './types';

// ---------------------------------------------------------------------------
// Verbrauchsformel 2008-01-01 – 2014-02-28 (alle `nicht_verifiziert`)
// ---------------------------------------------------------------------------

const VERBRAUCH_GRUNDLAGE = {
  art: 'pkw',
  formel: 'verbrauch',
  verfahren: 'VERBRAUCH',
  verbrauchAbzug: { benzinUndAndere: 3, diesel: 2 },
  multiplikator: 2,
  hoechstsatz: HOECHST_16_BETRAGSWORTLAUT,
  mindestsatzNullStatus: 'belegt',
  stand: STAND,
  status: 'nicht_verifiziert',
  uebergang: null,
} as const;

/** § 6a idF R3/R5–R9: Boni und Partikel-Malus (ab 2008-07-01). */
const BONUS_MALUS_6A = {
  co2Bonus: { unterGramm: 120, euro: 300 },
  noxPartikelBonus: {
    maxEuro: 200,
    benzinNoxMaxMg: 60,
    dieselNoxMaxMg: 80,
    dieselPartikelMaxGProKm: 0.005,
  },
  oekoBonus: { maxEuro: 500, antriebe: BONUS_ANTRIEBE },
  bonusSummeMaxEuro: 500,
  dieselPartikelMalus: { grenzwertGProKm: 0.005, euro: 300 },
  partikel14a: null,
} as const;

/** Ab PKW-2009 (R4/R5): Ersatzwerte ohne CO2 bzw. ohne Verbrauch, Erdgas-Umrechnung. */
const BELEG_ERSATZ_AB_2009 = beleg(
  'NoVAG § 6 idF R4 (NOR40105896), § 6a idF R5 (NOR40105897); Recherche-Dokument PKW-2009 (PKW-2010/2011/2013: „wie PKW-2009" bzw. „wie PKW-2011")',
  'nicht_verifiziert',
);

const ERSATZ_AB_2009 = {
  ohneCo2: { art: 'verbrauch', faktorBenzinUndAndere: 25, faktorDiesel: 28, ...BELEG_ERSATZ_AB_2009 },
  ohneVerbrauch: {
    art: 'verbrauch_aus_kw',
    kwDivisor: 10,
    zuschlagBenzinUndAndere: 3,
    zuschlagDiesel: 2,
    ...BELEG_ERSATZ_AB_2009,
  },
  erdgasNm3JeLiterBenzin: 1,
  erhoehungsbetrag: erhoehungsbetrag('grundbetrag_und_bonus_malus'),
} as const;

const HINWEIS_BONUS_EINGABEN =
  'Bonus-Regeln brauchen Eingaben (NOx, Partikel, Antriebsart), die in der Spezifikation nicht vorgesehen sind.';

const PKW_2008A: VerbrauchPeriode = {
  ...VERBRAUCH_GRUNDLAGE,
  docId: 'PKW-2008a',
  von: '2008-01-01',
  bis: '2008-06-30',
  quelle:
    'NoVAG § 6 idF R1 (NOR40025126), § 14a idF R2 (NOR40090577), § 2 idF R15 (NOR12054297); BMF „Rechtslage von 1. Juni 1996 bis 30. Juni 2008"',
  erhoehungsbetrag: erhoehungsbetrag('grundbetrag'),
  ohneVerbrauch: {
    art: 'satz_aus_kw',
    faktor: 0.2,
    ...beleg('NoVAG § 6 idF R1 (NOR40025126); Recherche-Dokument PKW-2008a', 'nicht_verifiziert'),
  },
  erdgasNm3JeLiterBenzin: null,
  co2Malus: [],
  co2Bonus: null,
  noxPartikelBonus: null,
  oekoBonus: null,
  bonusSummeMaxEuro: null,
  dieselPartikelMalus: null,
  ohneCo2: null,
  partikel14a: {
    grenzwertGProKm: 0.005,
    bonusEuroRis: 300,
    bonusEuroBmf: 200,
    bonusEuro: 300,
    malusProzentDerBg: 1.5,
    malusMaxEuro: 300,
  },
  hinweise: [
    ...HINWEIS_VOR_2014,
    'Diesel-Partikel-Bonus § 14a: RIS 300 €, BMF 200 €; RIS-Wert angewendet (Ruling: RIS-Text gilt).',
  ],
};

const PKW_2008B: VerbrauchPeriode = {
  ...VERBRAUCH_GRUNDLAGE,
  ...BONUS_MALUS_6A,
  docId: 'PKW-2008b',
  von: '2008-07-01',
  bis: '2009-06-17',
  quelle:
    'NoVAG § 6 idF R1 (NOR40025126), § 6a idF R3 (NOR40096512), § 2 idF R15 (NOR12054297); BMF „Rechtslage von 1. Juli 2008 bis 28. Februar 2014"',
  erhoehungsbetrag: erhoehungsbetrag('grundbetrag'),
  ohneVerbrauch: {
    art: 'satz_aus_kw',
    faktor: 0.2,
    ...beleg(
      'aus R1 (§ 6 idF NOR40025126, gilt bis 17.06.2009) übertragen; im Recherche-Dokument nur für PKW-2008a ausdrücklich genannt',
      'nicht_verifiziert',
    ),
  },
  erdgasNm3JeLiterBenzin: null,
  co2Malus: [{ schwelleGramm: 180, euroProGramm: 25 }],
  ohneCo2: {
    art: 'kw_malus',
    euroProKw: 20,
    abKw: 100,
    ...beleg('NoVAG § 6a idF R3 (NOR40096512); Recherche-Dokument PKW-2008b', 'nicht_verifiziert'),
  },
  hinweise: [
    ...HINWEIS_VOR_2014,
    HINWEIS_BONUS_EINGABEN,
    'CO2 nur für Bonus/Malus; Erhöhungsbetrag nur auf den Grundbetrag, Bonus/Malus danach.',
    'Ersatz ohne Verbrauchsnachweis (0,2 × kW) aus § 6 idF R1 übernommen; im Dokument nur bei PKW-2008a ausdrücklich genannt.',
  ],
};

const PKW_2009: VerbrauchPeriode = {
  ...VERBRAUCH_GRUNDLAGE,
  ...BONUS_MALUS_6A,
  ...ERSATZ_AB_2009,
  docId: 'PKW-2009',
  von: '2009-06-18',
  bis: '2009-12-31',
  quelle:
    'NoVAG § 6 idF R4 (NOR40105896), § 6a idF R5 (NOR40105897), § 2 idF R15 (NOR12054297); BMF „Rechtslage von 1. Juli 2008 bis 28. Februar 2014"',
  co2Malus: [{ schwelleGramm: 180, euroProGramm: 25 }],
  hinweise: [...HINWEIS_VOR_2014, HINWEIS_BONUS_EINGABEN],
};

const PKW_2010: VerbrauchPeriode = {
  ...VERBRAUCH_GRUNDLAGE,
  ...BONUS_MALUS_6A,
  ...ERSATZ_AB_2009,
  docId: 'PKW-2010',
  von: '2010-01-01',
  bis: '2011-02-28',
  quelle:
    'NoVAG § 6 idF R4 (NOR40105896), § 6a idF R5/R6/R7 (NOR40105897, NOR40119031, NOR40124281), § 2 idF R15 (NOR12054297)',
  co2Malus: [{ schwelleGramm: 160, euroProGramm: 25 }],
  hinweise: [
    ...HINWEIS_VOR_2014,
    HINWEIS_BONUS_EINGABEN,
    'BMF-Seite nennt die Schwelle 160 g/km ab 1.1.2009; RIS (R3/R5 § 6a Abs. 1 Z 2 lit. b) ab 1.1.2010 – RIS-Wert übernommen.',
  ],
};

const PKW_2011: VerbrauchPeriode = {
  ...VERBRAUCH_GRUNDLAGE,
  ...BONUS_MALUS_6A,
  ...ERSATZ_AB_2009,
  docId: 'PKW-2011',
  von: '2011-03-01',
  bis: '2012-12-31',
  quelle:
    'NoVAG § 6 idF R4 (NOR40105896), § 6a idF R7/R8/R9 (NOR40124281, NOR40143928, NOR40143931), § 2 idF R15 (NOR12054297)',
  co2Malus: [
    { schwelleGramm: 160, euroProGramm: 25 },
    { schwelleGramm: 180, euroProGramm: 25 },
    { schwelleGramm: 220, euroProGramm: 25 },
  ],
  hinweise: [
    ...HINWEIS_VOR_2014,
    HINWEIS_BONUS_EINGABEN,
    'Malus gestaffelt (Stufen addieren sich). Ökobonus lückenlos: bis 31.8.2012 lt. R7, ab 1.9.2012 verlängert bis 31.12.2014 lt. R8.',
  ],
};

const PKW_2013: VerbrauchPeriode = {
  ...VERBRAUCH_GRUNDLAGE,
  ...BONUS_MALUS_6A,
  ...ERSATZ_AB_2009,
  docId: 'PKW-2013',
  von: '2013-01-01',
  bis: '2014-02-28',
  quelle:
    'NoVAG § 6 idF R4 (NOR40105896), § 6a idF R9 (NOR40143931), § 2 idF R15 (NOR12054297)',
  co2Malus: [
    { schwelleGramm: 150, euroProGramm: 25 },
    { schwelleGramm: 170, euroProGramm: 25 },
    { schwelleGramm: 210, euroProGramm: 25 },
  ],
  hinweise: [...HINWEIS_VOR_2014, HINWEIS_BONUS_EINGABEN, 'Malus gestaffelt (Stufen addieren sich).'],
};

// ---------------------------------------------------------------------------
// CO2-Formel ab 2014-03-01 (alle `belegt`)
// ---------------------------------------------------------------------------

const CO2_GRUNDLAGE = {
  art: 'pkw',
  formel: 'co2',
  divisor: 5,
  mindestsatzNullStatus: 'nicht_verifiziert',
  stand: STAND,
  status: 'belegt',
  nefz127Ersatz: false,
  nefzSonderregel: null,
  kleinkraftrad: null,
  personenbefoerderungN1: null,
  umweltbonus: null,
} as const;

/** PKW-2014 bis PKW-2016 (R10, NEFZ). */
const NEFZ_ZEIT = {
  ...CO2_GRUNDLAGE,
  verfahren: 'NEFZ',
  abzugswert: 90,
  hoechstsatz: hoechstsatz(32),
  malus: [{ schwelleGramm: 250, euroProGramm: 20 }],
  wohnmobilSA: null,
} as const;

const UMWELTBONUS = { maxEuro: 600, antriebe: BONUS_ANTRIEBE, stattAbzugsposten: true } as const;

const QUELLE_R10 = `NoVAG § 6 idF R10 (NOR40161297); BMF „Rechtslage von 1. März 2014 bis 31. Dezember 2019"`;
const HINWEIS_ERSATZ_R10 =
  'Ohne CO2: Verbrauch × 25 (Benzin/andere) bzw. × 28 (Diesel), sonst 2 × kW (im Dokument bei PKW-2014 genannt; § 6 idF R10 gilt bis 2019).';

/** PKW-2014: im Recherche-Dokument ausdrücklich genannt → belegt. */
const BELEG_OHNE_CO2_2014 = beleg('NoVAG § 6 idF R10 (NOR40161297); Recherche-Dokument PKW-2014');
const OHNE_CO2_2014 = [ohneCo2Verbrauch(BELEG_OHNE_CO2_2014), ohneCo2Kw(BELEG_OHNE_CO2_2014)];

/** PKW-2015/2016: aus R10 übertragen, im Dokument nicht genannt → nicht_verifiziert. */
const BELEG_OHNE_CO2_UEBERTRAGEN = beleg(QUELLE_R10_UEBERTRAGEN, 'nicht_verifiziert');
const OHNE_CO2_2015_2016 = [
  ohneCo2Verbrauch(BELEG_OHNE_CO2_UEBERTRAGEN),
  ohneCo2Kw(BELEG_OHNE_CO2_UEBERTRAGEN),
];

const PKW_2014: Co2Periode = {
  ...NEFZ_ZEIT,
  docId: 'PKW-2014',
  von: '2014-03-01',
  bis: '2014-12-31',
  quelle: QUELLE_R10,
  abzugsposten: { dieselEuro: 350, andereEuro: 450 },
  umweltbonus: UMWELTBONUS,
  ohneCo2: OHNE_CO2_2014,
  uebergang: UEBERGANG_2014('PKW-2013'),
  hinweise: [
    'Umweltbonus max. 600 € (Hybrid, E85, Erdgas/Biogas, Flüssiggas, H2) statt Abzugsposten; kein Erhöhungsbetrag mehr.',
    HINWEIS_ERSATZ_R10,
    HINWEIS_MINDESTSATZ_CO2,
  ],
};

const PKW_2015: Co2Periode = {
  ...NEFZ_ZEIT,
  docId: 'PKW-2015',
  von: '2015-01-01',
  bis: '2015-12-31',
  quelle: QUELLE_R10,
  abzugsposten: { dieselEuro: 400, andereEuro: 400 },
  umweltbonus: UMWELTBONUS,
  ohneCo2: OHNE_CO2_2015_2016,
  uebergang: null,
  hinweise: [
    'Umweltbonus max. 600 € statt Abzugsposten (bis 31.12.2015).',
    HINWEIS_ERSATZ_R10,
    HINWEIS_MINDESTSATZ_CO2,
  ],
};

const PKW_2016: Co2Periode = {
  ...NEFZ_ZEIT,
  docId: 'PKW-2016',
  von: '2016-01-01',
  bis: '2019-12-31',
  quelle: QUELLE_R10,
  abzugsposten: { dieselEuro: 300, andereEuro: 300 },
  ohneCo2: OHNE_CO2_2015_2016,
  uebergang: null,
  hinweise: [HINWEIS_ERSATZ_R10, HINWEIS_MINDESTSATZ_CO2],
};

const AP_350 = { dieselEuro: 350, andereEuro: 350 } as const;

/** PKW-2020 / PKW-2021a (R11, WLTP). */
const WLTP_R11 = {
  ...CO2_GRUNDLAGE,
  verfahren: 'WLTP',
  hoechstsatz: hoechstsatz(32),
  malus: [{ schwelleGramm: 275, euroProGramm: 40 }],
  abzugsposten: AP_350,
  ohneCo2: [
    ohneCo2Kw(
      beleg('NoVAG § 6 idF R11 (NOR40218524); Recherche-Dokument PKW-2020 (PKW-2021a: „wie PKW-2020")'),
    ),
  ],
  wohnmobilSA: WOHNMOBIL_SA_2020,
  nefzSonderregel: {
    art: 'fruehere_rechtslage',
    docId: 'PKW-2016',
    quelle: 'NoVAG § 15 Abs. 22 idF R20 (NOR40279855)',
    stand: STAND,
    status: 'belegt',
  },
} as const;

const HINWEISE_R11 = [
  'WLTP kombiniert (PHEV: gewichtet kombiniert).',
  'EU-Erstzulassung vor 1.1.2020: weiter NEFZ-Recht (§ 15 Abs. 20) – ergibt sich aus dem Stichtag Erstzulassung.',
  HINWEIS_MINDESTSATZ_CO2,
];

const PKW_2020: Co2Periode = {
  ...WLTP_R11,
  docId: 'PKW-2020',
  von: '2020-01-01',
  bis: '2020-12-31',
  abzugswert: 115,
  quelle: `NoVAG § 6 idF R11 (NOR40218524), § 15 idF R20 (NOR40279855); BMF „Rechtslage von 1. Jänner 2020 bis 30. Juni 2021"`,
  uebergang: UEBERGANG_2020('PKW-2016'),
  hinweise: HINWEISE_R11,
};

const PKW_2021A: Co2Periode = {
  ...WLTP_R11,
  docId: 'PKW-2021a',
  von: '2021-01-01',
  bis: '2021-06-30',
  abzugswert: 112,
  quelle: `NoVAG § 6 Abs. 5 idF R11 (NOR40218524, −3 g ab 2021); BMF „Rechtslage von 1. Jänner 2020 bis 30. Juni 2021"`,
  uebergang: null,
  hinweise: HINWEISE_R11,
};

/** Ab PKW-2021b (R12–R14, WLTP). */
const WLTP_AB_2021B = {
  ...CO2_GRUNDLAGE,
  verfahren: 'WLTP',
  abzugsposten: AP_350,
  ohneCo2: [
    ohneCo2Kw(
      beleg(
        'NoVAG § 6 Abs. 6 idF R12–R14; Recherche-Dokument PKW-2021b, PKW-2025b, PKW-2026b (übrige Zeilen „wie PKW-2021b" bzw. „wie PKW-2026b")',
      ),
    ),
  ],
  wohnmobilSA: WOHNMOBIL_SA_AB_2021B,
  hinweise: [HINWEIS_MINDESTSATZ_CO2],
} as const;

const MALUS_155_80 = [{ schwelleGramm: 155, euroProGramm: 80 }];
const QUELLE_R12 = 'NoVAG § 6 Abs. 7 idF R12 (NOR40230676); BMF „Rechtslage von 1. Juli 2021 bis 30. Juni 2025"';
const QUELLE_R13 = 'NoVAG § 6 Abs. 7 idF R13 (NOR40269623); BMF „Rechtslage ab 1. Juli 2025"';
const QUELLE_R14 = `NoVAG § 6 Abs. 7 idF R14 (NOR40279854); BMF „Rechtslage ab 1. Juli 2025", BMF NoVA-Steuersatz (30.7.2026)`;

const PKW_2021B: Co2Periode = {
  ...WLTP_AB_2021B,
  docId: 'PKW-2021b',
  von: '2021-07-01',
  bis: '2021-12-31',
  abzugswert: 112,
  hoechstsatz: hoechstsatz(50),
  malus: [{ schwelleGramm: 200, euroProGramm: 50 }],
  quelle: 'NoVAG § 6 idF R12 (NOR40230676); BMF „Rechtslage von 1. Juli 2021 bis 30. Juni 2025"',
  uebergang: UEBERGANG_2021B('PKW-2021a'),
};

const PKW_2022: Co2Periode = {
  ...WLTP_AB_2021B,
  docId: 'PKW-2022',
  von: '2022-01-01',
  bis: '2022-12-31',
  abzugswert: 107,
  hoechstsatz: hoechstsatz(60),
  malus: [{ schwelleGramm: 185, euroProGramm: 60 }],
  quelle: QUELLE_R12,
  uebergang: jahreswechsel('PKW-2021b', 2022),
};

const PKW_2023: Co2Periode = {
  ...WLTP_AB_2021B,
  docId: 'PKW-2023',
  von: '2023-01-01',
  bis: '2023-12-31',
  abzugswert: 102,
  hoechstsatz: hoechstsatz(70),
  malus: [{ schwelleGramm: 170, euroProGramm: 70 }],
  quelle: QUELLE_R12,
  uebergang: jahreswechsel('PKW-2022', 2023),
};

const PKW_2024: Co2Periode = {
  ...WLTP_AB_2021B,
  docId: 'PKW-2024',
  von: '2024-01-01',
  bis: '2024-12-31',
  abzugswert: 97,
  hoechstsatz: hoechstsatz(80),
  malus: MALUS_155_80,
  quelle: QUELLE_R12,
  uebergang: jahreswechsel('PKW-2023', 2024),
};

const PKW_2025A: Co2Periode = {
  ...WLTP_AB_2021B,
  docId: 'PKW-2025a',
  von: '2025-01-01',
  bis: '2025-06-30',
  abzugswert: 94,
  hoechstsatz: hoechstsatz(80),
  malus: MALUS_155_80,
  quelle: QUELLE_R12,
  uebergang: jahreswechsel('PKW-2024', 2025),
};

const PKW_2025B: Co2Periode = {
  ...WLTP_AB_2021B,
  docId: 'PKW-2025b',
  von: '2025-07-01',
  bis: '2025-12-31',
  abzugswert: 94,
  hoechstsatz: hoechstsatz(80),
  malus: MALUS_155_80,
  personenbefoerderungN1: PERSONENBEFOERDERUNG_4_9_SITZE,
  quelle: 'NoVAG § 6 idF R13 (NOR40269623), § 2 idF R18 (NOR40269622); BMF „Rechtslage ab 1. Juli 2025"',
  uebergang: UEBERGANG_2025B('PKW-2025a'),
  hinweise: [
    'Ab hier gilt § 6 Abs. 3 Z 3 auch für andere Kfz zur Personenbeförderung mit 4–9 Sitzplätzen, ≤ 3.500 kg (z. B. pkw-artige N1).',
    HINWEIS_MINDESTSATZ_CO2,
  ],
};

const AB_2025B = {
  ...WLTP_AB_2021B,
  hoechstsatz: hoechstsatz(80),
  malus: MALUS_155_80,
  personenbefoerderungN1: PERSONENBEFOERDERUNG_4_9_SITZE,
} as const;

const PKW_2026A: Co2Periode = {
  ...AB_2025B,
  docId: 'PKW-2026a',
  von: '2026-01-01',
  bis: '2026-07-29',
  abzugswert: 91,
  quelle: QUELLE_R13,
  uebergang: jahreswechsel('PKW-2025b', 2026),
};

/** Ab 2026-07-30: wahlweise CO2 = 1,27 × NEFZ (R14 Abs. 6 Z 2, § 15 Abs. 29). */
const AB_2026B = {
  ...AB_2025B,
  nefz127Ersatz: true,
  hinweise: [
    'Liegt nur ein NEFZ-Wert vor: wahlweise CO2 = 1,27 × NEFZ; sonst 2 × kW (R14 § 6 Abs. 6 Z 2, § 15 Abs. 29).',
    HINWEIS_MINDESTSATZ_CO2,
  ],
} as const;

const PKW_2026B: Co2Periode = {
  ...AB_2026B,
  docId: 'PKW-2026b',
  von: '2026-07-30',
  bis: '2026-12-31',
  abzugswert: 91,
  quelle: `NoVAG § 6 Abs. 6 Z 2 idF R14 (NOR40279854), § 15 Abs. 29 idF R20 (NOR40279855); ${BMF_BASIS}nova-steuersatz.html (30.7.2026)`,
  uebergang: null,
};

const PKW_2027: Co2Periode = {
  ...AB_2026B,
  docId: 'PKW-2027',
  von: '2027-01-01',
  bis: '2027-12-31',
  abzugswert: 88,
  quelle: QUELLE_R14,
  uebergang: jahreswechsel('PKW-2026b', 2027),
};

const PKW_2028: Co2Periode = {
  ...AB_2026B,
  docId: 'PKW-2028',
  von: '2028-01-01',
  bis: '2028-12-31',
  abzugswert: 85,
  quelle: QUELLE_R14,
  uebergang: jahreswechsel('PKW-2027', 2028),
};

const PKW_2029: Co2Periode = {
  ...AB_2026B,
  docId: 'PKW-2029',
  von: '2029-01-01',
  bis: '2029-12-31',
  abzugswert: 82,
  quelle: QUELLE_R14,
  uebergang: jahreswechsel('PKW-2028', 2029),
  hinweise: [
    ...AB_2026B.hinweise,
    'Ab 2030 keine Periode: Gesetz senkt rechnerisch weiter (79 g), BMF listet nur bis 2029 → Warnung.',
  ],
};

export const PKW_PERIODEN: readonly (VerbrauchPeriode | Co2Periode)[] = [
  PKW_2008A,
  PKW_2008B,
  PKW_2009,
  PKW_2010,
  PKW_2011,
  PKW_2013,
  PKW_2014,
  PKW_2015,
  PKW_2016,
  PKW_2020,
  PKW_2021A,
  PKW_2021B,
  PKW_2022,
  PKW_2023,
  PKW_2024,
  PKW_2025A,
  PKW_2025B,
  PKW_2026A,
  PKW_2026B,
  PKW_2027,
  PKW_2028,
  PKW_2029,
];
