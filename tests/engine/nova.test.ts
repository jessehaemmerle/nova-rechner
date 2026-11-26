/**
 * NoVA-Berechnung je Periode. Golden-Tests: alle Rechenbeispiele aus
 * `docs/superpowers/research/nova-perioden.md` Abschnitt 5 (ID im Testnamen, Werte wörtlich).
 * Vor 2014-03-01 gilt die Variante „ohne Erhöhungsbetrag" (Regelwerk: `anzusetzen: false`).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EingabeFehler, berechneMitPeriode, berechneNova, type NovaEingabe } from '@/engine';
import { NOVA_PERIODEN, RegelwerkLuecke, type NovaPeriode } from '@/regelwerk';

function periode(docId: string): NovaPeriode {
  const p = NOVA_PERIODEN.find((x) => x.docId === docId);
  if (!p) throw new Error(`Periode ${docId} fehlt`);
  return p;
}

const pkw = (stichtag: string, bg: number, rest: Partial<NovaEingabe>): NovaEingabe => ({
  art: 'pkw',
  bg,
  stichtag,
  ...rest,
});

describe('berechneNova – Grundfälle Periode 2026 (Brief)', () => {
  it('Pkw BG 30.000, CO2 120 → 1.450 (Satz 6 %)', () => {
    const r = berechneNova(pkw('2026-03-01', 30000, { co2Wltp: 120 }));
    expect(r.satzProzent).toBe(6);
    expect(r.malus).toBe(0);
    expect(r.abzugsposten).toBe(350);
    expect(r.betrag).toBe(1450);
    expect(r.befreit).toBe(false);
    expect(r.ersatzwertGenutzt).toBeNull();
    expect(r.periodeId).toBe('PKW-2026a');
    expect(r.status).toBe('belegt');
    expect(r.warnungen).toEqual([]);
  });

  it('Pkw CO2 170 → 5.650 (Satz 16 %, Malus 1.200)', () => {
    const r = berechneNova(pkw('2026-03-01', 30000, { co2Wltp: 170 }));
    expect(r.satzProzent).toBe(16);
    expect(r.malus).toBe(1200);
    expect(r.betrag).toBe(5650);
  });

  it('Pkw CO2 91 → 0 (nicht negativ)', () => {
    const r = berechneNova(pkw('2026-03-01', 30000, { co2Wltp: 91 }));
    expect(r.satzProzent).toBe(0);
    expect(r.betrag).toBe(0);
  });

  it('Pkw CO2 unter dem Abzugswert → Satz 0 %, Betrag 0 (kein negativer Satz)', () => {
    const r = berechneNova(pkw('2026-03-01', 30000, { co2Wltp: 40 }));
    expect(r.satzProzent).toBe(0);
    expect(r.betrag).toBe(0);
  });

  it('Pkw CO2 500 → Satz 80 % (Höchstsatz)', () => {
    const r = berechneNova(pkw('2026-03-01', 30000, { co2Wltp: 500 }));
    expect(r.satzProzent).toBe(80);
    expect(r.malus).toBe((500 - 155) * 80);
    expect(r.betrag).toBe(24000 + 27600 - 350);
  });

  it('e-pkw mit CO2 0 → befreit, Betrag 0', () => {
    const r = berechneNova({ art: 'e-pkw', bg: 50000, stichtag: '2026-03-01', co2Wltp: 0 });
    expect(r.befreit).toBe(true);
    expect(r.betrag).toBe(0);
    expect(r.satzProzent).toBe(0);
    expect(r.hinweise.join(' ')).toMatch(/0 g\/km/);
  });

  it('e-pkw ohne CO2-Wert → EingabeFehler (fehlender Wert ist nicht 0 g/km)', () => {
    expect(() => berechneNova({ art: 'e-pkw', bg: 50000, stichtag: '2026-03-01', kw: 150 })).toThrow(
      EingabeFehler,
    );
  });

  it('e-pkw mit CO2 > 0 → EingabeFehler (widersprüchlich)', () => {
    expect(() => berechneNova({ art: 'e-pkw', bg: 50000, stichtag: '2026-03-01', co2Wltp: 20 })).toThrow(
      EingabeFehler,
    );
  });

  it('Pkw mit ausdrücklichem CO2 0 → befreit', () => {
    const r = berechneNova(pkw('2026-03-01', 50000, { co2Wltp: 0 }));
    expect(r.befreit).toBe(true);
    expect(r.betrag).toBe(0);
  });

  it('Motorrad BG 15.000, WMTC 120 → 2.550 (Satz 17 %)', () => {
    const r = berechneNova({ art: 'motorrad', bg: 15000, stichtag: '2026-03-01', co2Wmtc: 120, hubraum: 700 });
    expect(r.satzProzent).toBe(17);
    expect(r.abzugsposten).toBe(0);
    expect(r.betrag).toBe(2550);
    expect(r.periodeId).toBe('MR-2026');
  });

  it('Motorrad Hubraum 125 → Betrag 0 mit Hinweis', () => {
    const r = berechneNova({ art: 'motorrad', bg: 5000, stichtag: '2026-03-01', co2Wmtc: 120, hubraum: 125 });
    expect(r.betrag).toBe(0);
    expect(r.hinweise.join(' ')).toMatch(/125 cm³/);
  });

  it('Wohnmobil ohne CO2-Wert, kW 50 → 2 × kW = 100 g → rechnerisch 2 % → Mindestsatz 16 %', () => {
    const r = berechneNova({ art: 'wohnmobil', bg: 30000, stichtag: '2026-03-01', kw: 50 });
    expect(r.ersatzwertGenutzt).toBe('kw2');
    expect(r.satzProzent).toBe(16);
    expect(r.betrag).toBe(4800 - 350);
  });

  it('Wohnmobil „SA" mit kW-Wahl: Mindestsatz 16 % auf kW-Basis', () => {
    const r = berechneNova({
      art: 'wohnmobil',
      bg: 30000,
      stichtag: '2026-03-01',
      co2Wltp: 300,
      kw: 50,
      wohnmobilSA: true,
    });
    // WLTP 300: 42 % + Malus 11.600 vs. kW-Ansatz 100 g: 16 % (Mindestsatz) → günstiger
    expect(r.ersatzwertGenutzt).toBe('kw2');
    expect(r.satzProzent).toBe(16);
    expect(r.betrag).toBe(4450);
  });

  it('Wohnmobil mit WLTP-Wert: kein Mindestsatz (Satz 2 %)', () => {
    const r = berechneNova({ art: 'wohnmobil', bg: 30000, stichtag: '2026-03-01', co2Wltp: 100 });
    expect(r.ersatzwertGenutzt).toBeNull();
    expect(r.satzProzent).toBe(2);
    expect(r.betrag).toBe(600 - 350);
  });

  it('CO2 fehlt, kW 100 → Ersatzwert 200 g/km, ersatzwertGenutzt kw2', () => {
    const r = berechneNova(pkw('2026-03-01', 30000, { kw: 100 }));
    expect(r.ersatzwertGenutzt).toBe('kw2');
    // (200 − 91) / 5 = 21,8 → 22 %; 6.600 + (200 − 155) × 80 − 350
    expect(r.satzProzent).toBe(22);
    expect(r.malus).toBe(3600);
    expect(r.betrag).toBe(9850);
  });

  it('CO2 und kW fehlen bei Verbrenner → EingabeFehler', () => {
    expect(() => berechneNova(pkw('2026-03-01', 30000, {}))).toThrow(EingabeFehler);
  });

  it('Motorrad ohne WMTC und ohne Hubraum → EingabeFehler', () => {
    expect(() => berechneNova({ art: 'motorrad', bg: 10000, stichtag: '2026-03-01' })).toThrow(EingabeFehler);
  });

  it('ungültige BG → EingabeFehler', () => {
    expect(() => berechneNova(pkw('2026-03-01', -1, { co2Wltp: 120 }))).toThrow(EingabeFehler);
    expect(() => berechneNova(pkw('2026-03-01', Number.NaN, { co2Wltp: 120 }))).toThrow(EingabeFehler);
  });

  it('negativer CO2-Wert → EingabeFehler', () => {
    expect(() => berechneNova(pkw('2026-03-01', 30000, { co2Wltp: -5 }))).toThrow(EingabeFehler);
  });

  it('Stichtag ab 2030 → RegelwerkLuecke', () => {
    expect(() => berechneNova(pkw('2030-01-01', 30000, { co2Wltp: 120 }))).toThrow(RegelwerkLuecke);
  });
});

describe('Golden-Tests Pkw (Recherche-Dokument § 5)', () => {
  it('B-PKW-2008a: Benzin, BG 20.000, 7,4 l → 1.800,00 (ohne Erhöhungsbetrag)', () => {
    const r = berechneNova(pkw('2008-03-01', 20000, { kraftstoff: 'benzin', verbrauch: 7.4 }));
    expect(r.periodeId).toBe('PKW-2008a');
    expect(r.satzProzent).toBe(9);
    expect(r.betrag).toBe(1800);
    expect(r.status).toBe('nicht_verifiziert');
    expect(r.warnungen.join(' ')).toMatch(/Erhöhungsbetrag/);
  });

  it('B-PKW-2008b: Diesel, BG 25.000, 6,5 l, CO2 190, Partikel ≤ 0,005, NOx > 80 → 2.500,00', () => {
    const r = berechneNova(
      pkw('2008-10-01', 25000, {
        kraftstoff: 'diesel',
        verbrauch: 6.5,
        co2Nefz: 190,
        partikelGProKm: 0.004,
        noxMgProKm: 90,
      }),
    );
    expect(r.periodeId).toBe('PKW-2008b');
    expect(r.satzProzent).toBe(9);
    expect(r.malus).toBe(250);
    expect(r.bonus).toBe(0);
    expect(r.betrag).toBe(2500);
    expect(r.status).toBe('nicht_verifiziert');
  });

  it('B-PKW-2009: Benzin, BG 30.000, 8,2 l, CO2 195, NOx > 60 → 3.375,00', () => {
    const r = berechneNova(
      pkw('2009-09-01', 30000, { kraftstoff: 'benzin', verbrauch: 8.2, co2Nefz: 195, noxMgProKm: 70 }),
    );
    expect(r.periodeId).toBe('PKW-2009');
    expect(r.satzProzent).toBe(10);
    expect(r.malus).toBe(375);
    expect(r.betrag).toBe(3375);
  });

  it('B-PKW-2010: Benzin, BG 20.000, 6,9 l, CO2 165, NOx > 60 → 1.725,00', () => {
    const r = berechneNova(
      pkw('2010-06-01', 20000, { kraftstoff: 'benzin', verbrauch: 6.9, co2Nefz: 165, noxMgProKm: 70 }),
    );
    expect(r.periodeId).toBe('PKW-2010');
    expect(r.satzProzent).toBe(8);
    expect(r.malus).toBe(125);
    expect(r.betrag).toBe(1725);
  });

  it('B-PKW-2011: Benzin, BG 40.000, 10,1 l, CO2 235, NOx > 60 → 9.225,00 (gestaffelter Malus 3.625)', () => {
    const r = berechneNova(
      pkw('2012-01-01', 40000, { kraftstoff: 'benzin', verbrauch: 10.1, co2Nefz: 235, noxMgProKm: 70 }),
    );
    expect(r.periodeId).toBe('PKW-2011');
    expect(r.satzProzent).toBe(14);
    expect(r.malus).toBe(3625);
    expect(r.betrag).toBe(9225);
  });

  it('B-PKW-2013: Diesel, BG 18.000, 4,5 l, CO2 118, NOx > 80 → 600,00 (CO2-Bonus 300)', () => {
    const r = berechneNova(
      pkw('2013-06-01', 18000, { kraftstoff: 'diesel', verbrauch: 4.5, co2Nefz: 118, noxMgProKm: 90 }),
    );
    expect(r.periodeId).toBe('PKW-2013');
    expect(r.satzProzent).toBe(5);
    expect(r.bonus).toBe(300);
    expect(r.betrag).toBe(600);
    // Partikelwert fehlt im Beispiel: Partikel-Malus nicht geprüft → Warnung statt stiller Annahme
    expect(r.warnungen.join(' ')).toMatch(/Partikel/);
  });

  it('B-PKW-2014: Benzin, BG 25.000, NEFZ 140 → 2.050,00; Diesel-Variante → 2.150,00', () => {
    const benzin = berechneNova(pkw('2014-06-01', 25000, { co2Nefz: 140, kraftstoff: 'benzin' }));
    expect(benzin.periodeId).toBe('PKW-2014');
    expect(benzin.satzProzent).toBe(10);
    expect(benzin.abzugsposten).toBe(450);
    expect(benzin.betrag).toBe(2050);
    expect(benzin.status).toBe('belegt');
    const diesel = berechneNova(pkw('2014-06-01', 25000, { co2Nefz: 140, kraftstoff: 'diesel' }));
    expect(diesel.abzugsposten).toBe(350);
    expect(diesel.betrag).toBe(2150);
  });

  it('B-PKW-2014 ohne Kraftstoffangabe → EingabeFehler (Abzugsposten hängt davon ab)', () => {
    expect(() => berechneNova(pkw('2014-06-01', 25000, { co2Nefz: 140 }))).toThrow(EingabeFehler);
  });

  it('B-PKW-2015: BG 30.000, NEFZ 263 → Satz 35 → Max. 32 %, 9.460,00', () => {
    const r = berechneNova(pkw('2015-06-01', 30000, { co2Nefz: 263 }));
    expect(r.periodeId).toBe('PKW-2015');
    expect(r.satzProzent).toBe(32);
    expect(r.malus).toBe(260);
    expect(r.abzugsposten).toBe(400);
    expect(r.betrag).toBe(9460);
  });

  it('B-PKW-2016: BG 22.000, NEFZ 128 → 1.460,00', () => {
    const r = berechneNova(pkw('2017-06-01', 22000, { co2Nefz: 128 }));
    expect(r.periodeId).toBe('PKW-2016');
    expect(r.satzProzent).toBe(8);
    expect(r.betrag).toBe(1460);
  });

  it('B-PKW-2020: BG 30.000, WLTP 160 → 2.350,00', () => {
    const r = berechneNova(pkw('2020-06-01', 30000, { co2Wltp: 160 }));
    expect(r.periodeId).toBe('PKW-2020');
    expect(r.satzProzent).toBe(9);
    expect(r.betrag).toBe(2350);
  });

  it('B-PKW-2021a: BG 30.000, WLTP 160 → 2.650,00', () => {
    const r = berechneNova(pkw('2021-03-01', 30000, { co2Wltp: 160 }));
    expect(r.periodeId).toBe('PKW-2021a');
    expect(r.satzProzent).toBe(10);
    expect(r.betrag).toBe(2650);
  });

  it('B-PKW-2021b: BG 40.000, WLTP 220 → 9.450,00', () => {
    const r = berechneNova(pkw('2021-09-01', 40000, { co2Wltp: 220 }));
    expect(r.periodeId).toBe('PKW-2021b');
    expect(r.satzProzent).toBe(22);
    expect(r.malus).toBe(1000);
    expect(r.betrag).toBe(9450);
  });

  it('B-PKW-2022: BG 40.000, WLTP 220 → 10.950,00', () => {
    const r = berechneNova(pkw('2022-06-01', 40000, { co2Wltp: 220 }));
    expect(r.satzProzent).toBe(23);
    expect(r.malus).toBe(2100);
    expect(r.betrag).toBe(10950);
  });

  it('B-PKW-2023: BG 40.000, WLTP 220 → 12.750,00', () => {
    const r = berechneNova(pkw('2023-06-01', 40000, { co2Wltp: 220 }));
    expect(r.satzProzent).toBe(24);
    expect(r.malus).toBe(3500);
    expect(r.betrag).toBe(12750);
  });

  it('B-PKW-2024: BG 40.000, WLTP 220 → 14.850,00', () => {
    const r = berechneNova(pkw('2024-06-01', 40000, { co2Wltp: 220 }));
    expect(r.satzProzent).toBe(25);
    expect(r.malus).toBe(5200);
    expect(r.betrag).toBe(14850);
  });

  it('B-PKW-2024-max: WLTP 500 → 80,6 → 81 → Max. 80 %', () => {
    const r = berechneNova(pkw('2024-06-01', 10000, { co2Wltp: 500 }));
    expect(r.satzProzent).toBe(80);
  });

  it('B-PKW-2025a: BG 40.000, WLTP 132 → 2.850,00', () => {
    const r = berechneNova(pkw('2025-03-01', 40000, { co2Wltp: 132 }));
    expect(r.periodeId).toBe('PKW-2025a');
    expect(r.satzProzent).toBe(8);
    expect(r.betrag).toBe(2850);
  });

  it('B-PKW-2025b: BG 35.000, WLTP 150 → 3.500,00', () => {
    const r = berechneNova(pkw('2025-09-01', 35000, { co2Wltp: 150 }));
    expect(r.periodeId).toBe('PKW-2025b');
    expect(r.satzProzent).toBe(11);
    expect(r.betrag).toBe(3500);
  });

  it('B-PKW-2026a: BG 35.000, WLTP 150 → 3.850,00', () => {
    const r = berechneNova(pkw('2026-03-01', 35000, { co2Wltp: 150 }));
    expect(r.periodeId).toBe('PKW-2026a');
    expect(r.satzProzent).toBe(12);
    expect(r.betrag).toBe(3850);
  });

  it('B-PKW-2026b: BG 20.000, nur NEFZ 100, 85 kW → 1.050,00 (1,27 × NEFZ günstiger)', () => {
    const r = berechneNova(pkw('2026-09-01', 20000, { co2Nefz: 100, kw: 85 }));
    expect(r.periodeId).toBe('PKW-2026b');
    expect(r.ersatzwertGenutzt).toBe('nefz127');
    expect(r.satzProzent).toBe(7);
    expect(r.betrag).toBe(1050);
  });

  it('B-PKW-2026b Option 2 × kW (nur kW 85) → 4.050,00', () => {
    const r = berechneNova(pkw('2026-09-01', 20000, { kw: 85 }));
    expect(r.ersatzwertGenutzt).toBe('kw2');
    expect(r.satzProzent).toBe(16);
    expect(r.malus).toBe(1200);
    expect(r.betrag).toBe(4050);
  });

  it('B-PKW-2027: BG 50.000, WLTP 180 → 10.650,00', () => {
    const r = berechneNova(pkw('2027-06-01', 50000, { co2Wltp: 180 }));
    expect(r.periodeId).toBe('PKW-2027');
    expect(r.satzProzent).toBe(18);
    expect(r.malus).toBe(2000);
    expect(r.betrag).toBe(10650);
  });

  it('B-PKW-2028: BG 50.000, WLTP 180 → 11.150,00', () => {
    const r = berechneNova(pkw('2028-06-01', 50000, { co2Wltp: 180 }));
    expect(r.satzProzent).toBe(19);
    expect(r.betrag).toBe(11150);
  });

  it('B-PKW-2029: BG 50.000, WLTP 180 → 11.650,00', () => {
    const r = berechneNova(pkw('2029-06-01', 50000, { co2Wltp: 180 }));
    expect(r.satzProzent).toBe(20);
    expect(r.betrag).toBe(11650);
  });
});

describe('Golden-Tests EU-Gebrauchtimport über den Kürzungs-Hook', () => {
  it('E1a (BMF-Beispiel): PKW-2016, BG 8.000, NEFZ 270, Neuwagenwert 28.500 → 2.588,07', () => {
    const r = berechneNova(
      pkw('2019-03-07', 8000, {
        co2Nefz: 270,
        kuerzung: { faktor: 8000 / 28500, umfang: 'malus_und_abzug' },
      }),
    );
    expect(r.periodeId).toBe('PKW-2016');
    expect(r.satzProzent).toBe(32);
    expect(r.betrag).toBe(2588.07);
  });

  it('E1b (BMF-Beispiel): wie E1a, Neuwagenwert unbekannt, Faktor 1/8 → 2.572,50', () => {
    const r = berechneNova(
      pkw('2019-03-07', 8000, { co2Nefz: 270, kuerzung: { faktor: 1 / 8, umfang: 'malus_und_abzug' } }),
    );
    expect(r.malus).toBe(50);
    expect(r.abzugsposten).toBe(37.5);
    expect(r.betrag).toBe(2572.5);
  });

  it('E2: PKW-2022, BG 20.000, WLTP 200, 4 volle Jahre → Faktor 0,5 → 4.075,00', () => {
    const r = berechneNova(
      pkw('2022-03-10', 20000, { co2Wltp: 200, kuerzung: { faktor: 0.5, umfang: 'malus_und_abzug' } }),
    );
    expect(r.periodeId).toBe('PKW-2022');
    expect(r.satzProzent).toBe(19);
    expect(r.malus).toBe(450);
    expect(r.abzugsposten).toBe(175);
    expect(r.betrag).toBe(4075);
  });

  it('Kürzung „bonus_malus" (vor 2014): kürzt Malus und Bonus, kein Abzugsposten', () => {
    // B-PKW-2011 mit Faktor 0,5: Grund 5.600 + Malus 3.625 × 0,5
    const r = berechneNova(
      pkw('2012-01-01', 40000, {
        kraftstoff: 'benzin',
        verbrauch: 10.1,
        co2Nefz: 235,
        noxMgProKm: 70,
        kuerzung: { faktor: 0.5, umfang: 'bonus_malus' },
      }),
    );
    expect(r.malus).toBe(1812.5);
    expect(r.betrag).toBe(7412.5);
    expect(r.warnungen.join(' ')).toMatch(/Wertentwicklung/);
  });

  it('Kürzungsfaktor außerhalb 0..1 → EingabeFehler', () => {
    expect(() =>
      berechneNova(pkw('2022-03-10', 20000, { co2Wltp: 200, kuerzung: { faktor: 1.2, umfang: 'malus_und_abzug' } })),
    ).toThrow(EingabeFehler);
  });
});

describe('Golden-Tests N1', () => {
  const n1 = (stichtag: string, co2Wltp: number): NovaEingabe => ({ art: 'n1', bg: 30000, stichtag, co2Wltp });

  it('B-N1-2021b: BG 30.000, WLTP 230 → 3.550,00', () => {
    const r = berechneNova(n1('2021-09-01', 230));
    expect(r.periodeId).toBe('N1-2021b');
    expect(r.satzProzent).toBe(13);
    expect(r.malus).toBe(0);
    expect(r.betrag).toBe(3550);
  });

  it('B-N1-2022: BG 30.000, WLTP 250 → 5.770,00', () => {
    const r = berechneNova(n1('2022-06-01', 250));
    expect(r.satzProzent).toBe(18);
    expect(r.malus).toBe(720);
    expect(r.betrag).toBe(5770);
  });

  it('B-N1-2023: BG 30.000, WLTP 250 → 7.240,00', () => {
    const r = berechneNova(n1('2023-06-01', 250));
    expect(r.satzProzent).toBe(19);
    expect(r.malus).toBe(1890);
    expect(r.betrag).toBe(7240);
  });

  it('B-N1-2024: BG 30.000, WLTP 250 → 9.010,00', () => {
    const r = berechneNova(n1('2024-06-01', 250));
    expect(r.satzProzent).toBe(20);
    expect(r.malus).toBe(3360);
    expect(r.betrag).toBe(9010);
  });

  it('B-N1-2025a: BG 30.000, WLTP 250 → 9.310,00', () => {
    const r = berechneNova(n1('2025-03-01', 250));
    expect(r.periodeId).toBe('N1-2025a');
    expect(r.satzProzent).toBe(21);
    expect(r.betrag).toBe(9310);
  });

  it('B-N1-bis2021: Kastenwagen (KN 8704), 2019 → nicht steuerbar, 0,00 mit Hinweis', () => {
    const r = berechneNova({ art: 'n1', bg: 25000, stichtag: '2019-06-01', co2Nefz: 180, zolltarif8703: false });
    expect(r.betrag).toBe(0);
    expect(r.befreit).toBe(true);
    expect(r.periodeId).toBe('N1-bis2021');
    expect(r.hinweise.join(' ')).toMatch(/8703/);
  });

  it('N1-bis2021 ohne Angabe zur Einreihung → nicht stillschweigend NoVA, Betrag 0 mit Warnung', () => {
    const r = berechneNova({ art: 'n1', bg: 25000, stichtag: '2019-06-01', co2Nefz: 180 });
    expect(r.betrag).toBe(0);
    expect(r.befreit).toBe(true);
    expect(r.warnungen.join(' ')).toMatch(/8703/);
  });

  it('N1-bis2021 mit KN 8703 → Pkw-Periode zum selben Stichtag (PKW-2016)', () => {
    const r = berechneNova({ art: 'n1', bg: 22000, stichtag: '2019-06-01', co2Nefz: 128, zolltarif8703: true });
    expect(r.periodeId).toBe('PKW-2016');
    expect(r.betrag).toBe(1460);
    // Einreihung im Einzelfall nicht verifiziert → schlechtester Status (PKW-2016 selbst ist belegt)
    expect(r.status).toBe('nicht_verifiziert');
    expect(r.warnungen.join(' ')).toMatch(/Einreihung in KN 8703/);
    expect(r.hinweise.join(' ')).toMatch(/N1-bis2021/);
  });

  it('B-N1-ab2025b: pkw-artiger N1, 5 Sitze, 2026-03 → PKW-2026a, BG 35.000, WLTP 150 → 3.850,00', () => {
    const r = berechneNova({ art: 'n1', bg: 35000, stichtag: '2026-03-01', co2Wltp: 150 });
    expect(r.periodeId).toBe('PKW-2026a');
    expect(r.betrag).toBe(3850);
    expect(r.hinweise.join(' ')).toMatch(/Kastenwagen/);
  });

  it('N1-2022 nur NEFZ (auslaufende Serie): feste Werte 140/238 g, Status nicht_verifiziert', () => {
    // (250 − 140) / 5 = 22 %; 6.600 + (250 − 238) × 60 − 350
    const r = berechneNova({ art: 'n1', bg: 30000, stichtag: '2022-06-01', co2Nefz: 250 });
    expect(r.satzProzent).toBe(22);
    expect(r.malus).toBe(720);
    expect(r.betrag).toBe(6970);
    expect(r.status).toBe('nicht_verifiziert');
  });
});

describe('Golden-Tests Motorrad', () => {
  const mr = (stichtag: string, rest: Partial<NovaEingabe>, bg = 15000): NovaEingabe => ({
    art: 'motorrad',
    bg,
    stichtag,
    ...rest,
  });

  it('B-MR-2008: BG 10.000, 650 cm³ → 1.100,00 (ohne Erhöhung); 1.000 cm³ → Max. 16 %', () => {
    const r = berechneNova(mr('2010-01-01', { hubraum: 650 }, 10000));
    expect(r.periodeId).toBe('MR-2008');
    expect(r.satzProzent).toBe(11);
    expect(r.betrag).toBe(1100);
    expect(r.status).toBe('nicht_verifiziert');
    expect(r.warnungen.join(' ')).toMatch(/16-%-Grenze lautet im Gesetz auf den Betrag/);
    expect(r.warnungen.join(' ')).toMatch(/Erhöhungsbetrag 20 %/);
    expect(berechneNova(mr('2010-01-01', { hubraum: 1000 }, 10000)).satzProzent).toBe(16);
  });

  it('B-MR-2014: BG 12.000, 900 cm³ → 1.920,00; 1.300 cm³ → Max. 20 %', () => {
    const r = berechneNova(mr('2016-01-01', { hubraum: 900 }, 12000));
    expect(r.periodeId).toBe('MR-2014');
    expect(r.satzProzent).toBe(16);
    expect(r.betrag).toBe(1920);
    expect(berechneNova(mr('2016-01-01', { hubraum: 1300 }, 12000)).satzProzent).toBe(20);
  });

  it('B-MR-2020: BG 15.000, WMTC 170 → Max. 20 %, 3.400,00; WMTC 130 → 2.850,00', () => {
    const r = berechneNova(mr('2020-06-01', { co2Wmtc: 170, hubraum: 900 }));
    expect(r.periodeId).toBe('MR-2020');
    expect(r.satzProzent).toBe(20);
    expect(r.malus).toBe(400);
    expect(r.betrag).toBe(3400);
    const z = berechneNova(mr('2020-06-01', { co2Wmtc: 130, hubraum: 900 }));
    expect(z.satzProzent).toBe(19);
    expect(z.betrag).toBe(2850);
  });

  it('B-MR-2021b: BG 15.000, WMTC 170 → 4.750,00', () => {
    const r = berechneNova(mr('2022-06-01', { co2Wmtc: 170, hubraum: 900 }));
    expect(r.periodeId).toBe('MR-2021b');
    expect(r.satzProzent).toBe(29);
    expect(r.betrag).toBe(4750);
  });

  it('B-MR-2024: BG 15.000, WMTC 132 → 3.000,00', () => {
    const r = berechneNova(mr('2024-06-01', { co2Wmtc: 132, hubraum: 900 }));
    expect(r.periodeId).toBe('MR-2024');
    expect(r.satzProzent).toBe(20);
    expect(r.betrag).toBe(3000);
  });

  it('B-MR-2026: BG 15.000, WMTC 134 → 3.150,00', () => {
    const r = berechneNova(mr('2026-06-01', { co2Wmtc: 134, hubraum: 900 }));
    expect(r.satzProzent).toBe(21);
    expect(r.betrag).toBe(3150);
  });

  it('B-MR-2028: BG 15.000, WMTC 160 → 4.400,00', () => {
    const r = berechneNova(mr('2028-06-01', { co2Wmtc: 160, hubraum: 900 }));
    expect(r.periodeId).toBe('MR-2028');
    expect(r.satzProzent).toBe(28);
    expect(r.malus).toBe(200);
    expect(r.betrag).toBe(4400);
  });

  it.each(['2010-01-01', '2016-01-01', '2020-06-01', '2022-06-01', '2024-06-01', '2026-06-01', '2028-06-01'])(
    'B-MR-125: 125 cm³ am %s → 0,00',
    (stichtag) => {
      const r = berechneNova(mr(stichtag, { hubraum: 125, co2Wmtc: 90 }));
      expect(r.betrag).toBe(0);
      expect(r.hinweise.join(' ')).toMatch(/125 cm³/);
    },
  );

  it.each([
    ['2026-06-01', 'MR-2026'],
    ['2028-06-01', 'MR-2028'],
    ['2022-06-01', 'MR-2021b'],
    ['2020-06-01', 'MR-2020'],
  ])('Motorrad am %s (%s) mit WMTC, aber ohne Hubraum → EingabeFehler (Kleinkraftrad nicht prüfbar)', (stichtag, docId) => {
    // Sonde aus dem Review: WMTC 60 ergäbe 2026 sonst Satz 2 %, 80 € – auch für ein ≤ 125-cm³-Rad
    expect(() => berechneNova(mr(stichtag, { co2Wmtc: 60 }, 4000))).toThrow(EingabeFehler);
    expect(() => berechneNova(mr(stichtag, { co2Wmtc: 60 }, 4000))).toThrow(/Hubraum/);
    expect(() => berechneNova(mr(stichtag, { co2Wmtc: 60 }, 4000))).toThrow(new RegExp(docId));
  });

  it.each(['2010-01-01', '2016-01-01'])(
    'Motorrad am %s (Hubraum-Formel) ohne Hubraum → EingabeFehler',
    (stichtag) => {
      expect(() => berechneNova(mr(stichtag, {}, 4000))).toThrow(EingabeFehler);
      expect(() => berechneNova(mr(stichtag, {}, 4000))).toThrow(/Hubraum/);
    },
  );

  it('Motorrad 2026 mit Hubraum 126 und WMTC 60 → besteuert (2 %, 80 €); mit 125 cm³ → 0', () => {
    const r = berechneNova(mr('2026-06-01', { co2Wmtc: 60, hubraum: 126 }, 4000));
    expect(r.satzProzent).toBe(2);
    expect(r.betrag).toBe(80);
    const k = berechneNova(mr('2026-06-01', { co2Wmtc: 60, hubraum: 125 }, 4000));
    expect(k.betrag).toBe(0);
    expect(k.befreit).toBe(true);
  });

  it('MR-2026 ohne WMTC: Hubraum-Formel, max. 30 %', () => {
    const r = berechneNova(mr('2026-06-01', { hubraum: 2000 }));
    expect(r.ersatzwertGenutzt).toBe('hubraum');
    expect(r.satzProzent).toBe(30);
    expect(r.betrag).toBe(4500);
  });
});

describe('Stichtagsgrenzen', () => {
  it('2026-07-29 vs. 2026-07-30: 1,27 × NEFZ erst ab 30.7.', () => {
    const vorher = { co2Nefz: 100, kw: 85 };
    const a = berechneNova(pkw('2026-07-29', 20000, vorher));
    expect(a.periodeId).toBe('PKW-2026a');
    expect(a.ersatzwertGenutzt).toBe('kw2');
    expect(a.betrag).toBe(4050);
    const b = berechneNova(pkw('2026-07-30', 20000, vorher));
    expect(b.periodeId).toBe('PKW-2026b');
    expect(b.ersatzwertGenutzt).toBe('nefz127');
    expect(b.betrag).toBe(1050);
    // nur NEFZ, kein kW: am 29.7. kein zulässiger Ersatzwert
    expect(() => berechneNova(pkw('2026-07-29', 20000, { co2Nefz: 100 }))).toThrow(EingabeFehler);
    expect(berechneNova(pkw('2026-07-30', 20000, { co2Nefz: 100 })).betrag).toBe(1050);
  });

  it('2025-06-30 vs. 2025-07-01: N1 wechselt von eigener Formel zu den Pkw-Zeilen', () => {
    const e = { art: 'n1' as const, bg: 30000, co2Wltp: 250 };
    const a = berechneNova({ ...e, stichtag: '2025-06-30' });
    expect(a.periodeId).toBe('N1-2025a');
    expect(a.betrag).toBe(9310);
    const b = berechneNova({ ...e, stichtag: '2025-07-01' });
    expect(b.periodeId).toBe('PKW-2025b');
    // (250 − 94) / 5 = 31,2 → 31 %; 9.300 + (250 − 155) × 80 − 350
    expect(b.satzProzent).toBe(31);
    expect(b.betrag).toBe(16550);
    // Pkw: identische Werte, aber neue Periode
    expect(berechneNova(pkw('2025-06-30', 35000, { co2Wltp: 150 })).periodeId).toBe('PKW-2025a');
    expect(berechneNova(pkw('2025-07-01', 35000, { co2Wltp: 150 })).periodeId).toBe('PKW-2025b');
  });

  it('2009-06-17 vs. 2009-06-18: Ersatz ohne CO2 wechselt von kW-Malus zu Verbrauch × 25', () => {
    const e = { kraftstoff: 'benzin' as const, verbrauch: 8, kw: 150, noxMgProKm: 70 };
    const a = berechneNova(pkw('2009-06-17', 20000, e));
    expect(a.periodeId).toBe('PKW-2008b');
    // Satz 2 × 5 = 10 %; ohne CO2: (150 − 100) × 20 = 1.000
    expect(a.malus).toBe(1000);
    expect(a.betrag).toBe(3000);
    const b = berechneNova(pkw('2009-06-18', 20000, e));
    expect(b.periodeId).toBe('PKW-2009');
    // CO2 = 8 × 25 = 200 g; Malus (200 − 180) × 25 = 500
    expect(b.ersatzwertGenutzt).toBe('verbrauch');
    expect(b.malus).toBe(500);
    expect(b.betrag).toBe(2500);
  });

  it('2021-06-30 vs. 2021-07-01: Pkw Höchstsatz 32 → 50 %, Malus 275/40 → 200/50; N1 wird steuerbar', () => {
    const a = berechneNova(pkw('2021-06-30', 40000, { co2Wltp: 300 }));
    expect(a.periodeId).toBe('PKW-2021a');
    expect(a.satzProzent).toBe(32);
    expect(a.malus).toBe(1000);
    expect(a.betrag).toBe(12800 + 1000 - 350);
    const b = berechneNova(pkw('2021-07-01', 40000, { co2Wltp: 300 }));
    expect(b.periodeId).toBe('PKW-2021b');
    expect(b.satzProzent).toBe(38);
    expect(b.malus).toBe(5000);
    expect(b.betrag).toBe(15200 + 5000 - 350);
    const n1a = berechneNova({ art: 'n1', bg: 30000, stichtag: '2021-06-30', co2Wltp: 230 });
    expect(n1a.befreit).toBe(true);
    expect(n1a.betrag).toBe(0);
    const n1b = berechneNova({ art: 'n1', bg: 30000, stichtag: '2021-07-01', co2Wltp: 230 });
    expect(n1b.periodeId).toBe('N1-2021b');
    expect(n1b.betrag).toBe(3550);
  });

  it('2019-12-31 vs. 2020-01-01: NEFZ (Abzug 90) → WLTP (Abzug 115)', () => {
    const a = berechneNova(pkw('2019-12-31', 30000, { co2Nefz: 140, co2Wltp: 160 }));
    expect(a.periodeId).toBe('PKW-2016');
    expect(a.satzProzent).toBe(10);
    expect(a.betrag).toBe(2700);
    const b = berechneNova(pkw('2020-01-01', 30000, { co2Nefz: 140, co2Wltp: 160 }));
    expect(b.periodeId).toBe('PKW-2020');
    expect(b.satzProzent).toBe(9);
    expect(b.betrag).toBe(2350);
  });

  it('PKW-2020, nur NEFZ (auslaufende Serie): weiter Rechtslage PKW-2016 (§ 15 Abs. 22)', () => {
    const r = berechneNova(pkw('2020-06-01', 22000, { co2Nefz: 128 }));
    expect(r.periodeId).toBe('PKW-2016');
    expect(r.betrag).toBe(1460);
    expect(r.warnungen.join(' ')).toMatch(/auslaufenden Serie/);
  });
});

describe('berechneMitPeriode', () => {
  it('rechnet mit einer vorgegebenen Periode', () => {
    const r = berechneMitPeriode(pkw('2026-03-01', 35000, { co2Wltp: 150 }), periode('PKW-2029'));
    expect(r.periodeId).toBe('PKW-2029');
    // (150 − 82) / 5 = 13,6 → 14 %
    expect(r.satzProzent).toBe(14);
    expect(r.betrag).toBe(4550);
  });
});

describe('Eigenschaften (fast-check)', () => {
  const co2Perioden = NOVA_PERIODEN.filter((p) => p.formel === 'co2');

  it('betrag ist bei gleicher BG und Periode monoton nicht fallend im CO2-Wert', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...co2Perioden),
        fc.integer({ min: 0, max: 2_000_000 }).map((c) => c / 10),
        fc.integer({ min: 1, max: 600 }),
        fc.integer({ min: 0, max: 600 }),
        (p, bg, co2a, delta) => {
          const feld = p.verfahren === 'WMTC' ? 'co2Wmtc' : p.verfahren === 'NEFZ' ? 'co2Nefz' : 'co2Wltp';
          const basis: NovaEingabe = {
            art: p.art === 'motorrad' ? 'motorrad' : p.art === 'n1' ? 'n1' : 'pkw',
            bg,
            stichtag: p.von,
            kraftstoff: 'benzin',
            hubraum: 500,
          };
          const a = berechneMitPeriode({ ...basis, [feld]: co2a }, p);
          const b = berechneMitPeriode({ ...basis, [feld]: co2a + delta }, p);
          expect(b.betrag).toBeGreaterThanOrEqual(a.betrag);
        },
      ),
    );
  });

  it('betrag ≥ 0 immer; betrag = 0, wenn befreit', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('pkw', 'e-pkw', 'motorrad', 'n1', 'wohnmobil') as fc.Arbitrary<NovaEingabe['art']>,
        fc.integer({ min: 2008, max: 2029 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 0, max: 20_000_000 }).map((c) => c / 100),
        fc.option(fc.integer({ min: 0, max: 400 }), { nil: undefined }),
        fc.integer({ min: 1, max: 400 }),
        fc.boolean(),
        fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
        (art, jahr, monat, bg, co2, kw, zolltarif8703, faktor) => {
          const e: NovaEingabe = {
            art,
            bg,
            stichtag: `${jahr}-${String(monat).padStart(2, '0')}-15`,
            co2Wltp: art === 'e-pkw' ? 0 : co2,
            co2Nefz: art === 'e-pkw' ? 0 : co2,
            co2Wmtc: art === 'e-pkw' ? 0 : co2,
            kw,
            hubraum: 100 + kw * 5,
            verbrauch: 3 + kw / 30,
            kraftstoff: 'diesel',
            partikelGProKm: 0.004,
            noxMgProKm: 100,
            zolltarif8703,
            kuerzung:
              faktor === undefined
                ? undefined
                : { faktor, umfang: jahr < 2014 ? 'bonus_malus' : 'malus_und_abzug' },
          };
          const r = berechneNova(e);
          expect(r.betrag).toBeGreaterThanOrEqual(0);
          if (r.befreit) expect(r.betrag).toBe(0);
        },
      ),
    );
  });
});
