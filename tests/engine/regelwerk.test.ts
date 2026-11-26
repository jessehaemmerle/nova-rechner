import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EUST_SAETZE,
  NOVA_PERIODEN,
  RegelwerkLuecke,
  WERTENTWICKLUNG_UMFANG,
  ZOLLSAETZE,
  periodenArt,
  selectNovaPeriode,
  selectWertentwicklungUmfang,
  type Co2Periode,
  type HubraumPeriode,
  type NovaPeriode,
  type PeriodenArt,
  type VerbrauchPeriode,
  type VerweisPeriode,
} from '@/regelwerk';

const RECHERCHE = readFileSync(
  fileURLToPath(new URL('../../docs/superpowers/research/nova-perioden.md', import.meta.url)),
  'utf8',
);

function co2(p: NovaPeriode): Co2Periode {
  if (p.formel !== 'co2') throw new Error(`${p.docId} ist keine CO2-Periode`);
  return p;
}
function verbrauch(p: NovaPeriode): VerbrauchPeriode {
  if (p.formel !== 'verbrauch') throw new Error(`${p.docId} ist keine Verbrauchs-Periode`);
  return p;
}
function hubraum(p: NovaPeriode): HubraumPeriode {
  if (p.formel !== 'hubraum') throw new Error(`${p.docId} ist keine Hubraum-Periode`);
  return p;
}
function verweis(p: NovaPeriode): VerweisPeriode {
  if (p.formel !== 'verweis_pkw') throw new Error(`${p.docId} ist keine Verweis-Periode`);
  return p;
}
function byId(docId: string): NovaPeriode {
  const p = NOVA_PERIODEN.find((x) => x.docId === docId);
  if (!p) throw new Error(`Periode ${docId} fehlt`);
  return p;
}
function plusEinTag(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const ARTEN: PeriodenArt[] = ['pkw', 'n1', 'motorrad'];

describe('selectNovaPeriode (Brief-Assertions)', () => {
  it('Pkw 2026-03-01 hat Abzugswert 91', () => {
    expect(co2(selectNovaPeriode('pkw', '2026-03-01')).abzugswert).toBe(91);
  });

  it('2025-06-30 und 2025-07-01 liefern verschiedene Perioden', () => {
    const a = selectNovaPeriode('pkw', '2025-06-30');
    const b = selectNovaPeriode('pkw', '2025-07-01');
    expect(a.docId).toBe('PKW-2025a');
    expect(b.docId).toBe('PKW-2025b');
    expect(a).not.toBe(b);
  });

  it('Pkw 2029-12-31 hat Abzugswert 82', () => {
    expect(co2(selectNovaPeriode('pkw', '2029-12-31')).abzugswert).toBe(82);
  });

  it('2007-12-31 wirft RegelwerkLuecke', () => {
    expect(() => selectNovaPeriode('pkw', '2007-12-31')).toThrow(RegelwerkLuecke);
  });

  it('Motorrad 2026-06-01 hat Abzugswert 51', () => {
    expect(co2(selectNovaPeriode('motorrad', '2026-06-01')).abzugswert).toBe(51);
  });

  it.each(ARTEN)('Perioden der Art %s sind lückenlos und überlappungsfrei', (art) => {
    const liste = NOVA_PERIODEN.filter((p) => p.art === art);
    expect(liste[0].von).toBe('2008-01-01');
    for (let i = 0; i < liste.length - 1; i++) {
      const bis = liste[i].bis;
      expect(bis, `${liste[i].docId} braucht ein Ende`).not.toBeNull();
      expect(liste[i].von <= (bis as string)).toBe(true);
      expect(plusEinTag(bis as string), `${liste[i].docId} -> ${liste[i + 1].docId}`).toBe(
        liste[i + 1].von,
      );
    }
    const letzte = liste[liste.length - 1];
    expect(letzte.bis === null || letzte.bis === '2029-12-31').toBe(true);
  });
});

describe('selectNovaPeriode (Grenzen)', () => {
  it('2030-01-01 wirft RegelwerkLuecke für alle Arten', () => {
    for (const art of ARTEN) {
      expect(() => selectNovaPeriode(art, '2030-01-01')).toThrow(RegelwerkLuecke);
    }
  });

  it('RegelwerkLuecke ist ein Error mit deutscher Meldung', () => {
    try {
      selectNovaPeriode('motorrad', '2030-01-01');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(RegelwerkLuecke);
      expect((e as Error).message).toMatch(/Rechtslage|Periode/);
    }
  });

  it('2008-01-01 und 2029-12-31 sind für alle Arten abgedeckt', () => {
    for (const art of ARTEN) {
      expect(selectNovaPeriode(art, '2008-01-01').von).toBe('2008-01-01');
      expect(() => selectNovaPeriode(art, '2029-12-31')).not.toThrow();
    }
  });

  it('2026-07-29 und 2026-07-30 sind verschiedene Pkw-Perioden; nur die spätere hat nefz127Ersatz', () => {
    const a = co2(selectNovaPeriode('pkw', '2026-07-29'));
    const b = co2(selectNovaPeriode('pkw', '2026-07-30'));
    expect(a.docId).toBe('PKW-2026a');
    expect(b.docId).toBe('PKW-2026b');
    expect(a.nefz127Ersatz).toBe(false);
    expect(b.nefz127Ersatz).toBe(true);
  });

  it('nefz127Ersatz ist nur ab 2026-07-30 gesetzt', () => {
    for (const p of NOVA_PERIODEN) {
      const flag = p.formel === 'co2' ? p.nefz127Ersatz : false;
      expect(flag, p.docId).toBe(p.art === 'pkw' && p.von >= '2026-07-30');
    }
  });

  it('weitere Stichtag-Grenzen werden getrennt', () => {
    expect(selectNovaPeriode('pkw', '2009-06-17').docId).toBe('PKW-2008b');
    expect(selectNovaPeriode('pkw', '2009-06-18').docId).toBe('PKW-2009');
    expect(selectNovaPeriode('pkw', '2014-02-28').docId).toBe('PKW-2013');
    expect(selectNovaPeriode('pkw', '2014-03-01').docId).toBe('PKW-2014');
    expect(selectNovaPeriode('n1', '2021-06-30').docId).toBe('N1-bis2021');
    expect(selectNovaPeriode('n1', '2021-07-01').docId).toBe('N1-2021b');
    expect(selectNovaPeriode('n1', '2026-03-01').docId).toBe('N1-ab2025b');
    expect(selectNovaPeriode('motorrad', '2014-02-28').docId).toBe('MR-2008');
    expect(selectNovaPeriode('motorrad', '2019-12-31').docId).toBe('MR-2014');
    expect(selectNovaPeriode('motorrad', '2020-01-01').docId).toBe('MR-2020');
  });

  it('ungültiges Datumsformat wird abgelehnt', () => {
    expect(() => selectNovaPeriode('pkw', '1.3.2026')).toThrow();
    expect(() => selectNovaPeriode('pkw', '2026-02-30')).toThrow();
  });
});

describe('NOVA_PERIODEN (Vollständigkeit und Belege)', () => {
  it('enthält 22 Pkw-, 7 N1- und 7 Motorrad-Perioden', () => {
    expect(NOVA_PERIODEN.filter((p) => p.art === 'pkw')).toHaveLength(22);
    expect(NOVA_PERIODEN.filter((p) => p.art === 'n1')).toHaveLength(7);
    expect(NOVA_PERIODEN.filter((p) => p.art === 'motorrad')).toHaveLength(7);
    expect(NOVA_PERIODEN).toHaveLength(36);
  });

  it('jede docId ist eindeutig und steht als Tabellenzeile im Recherche-Dokument', () => {
    const ids = NOVA_PERIODEN.map((p) => p.docId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of NOVA_PERIODEN) {
      expect(RECHERCHE, p.docId).toContain(`| ${p.docId} | ${p.von} | ${p.bis ?? 'offen'} |`);
    }
  });

  it('genau die 7 Perioden vor 3/2014 sind nicht_verifiziert', () => {
    const nv = NOVA_PERIODEN.filter((p) => p.status === 'nicht_verifiziert')
      .map((p) => p.docId)
      .sort();
    expect(nv).toEqual(
      ['MR-2008', 'PKW-2008a', 'PKW-2008b', 'PKW-2009', 'PKW-2010', 'PKW-2011', 'PKW-2013'].sort(),
    );
  });

  it('jede Periode hat nicht-leere Quelle, Stand und gültigen Status', () => {
    for (const p of NOVA_PERIODEN) {
      expect(p.quelle.trim().length, p.docId).toBeGreaterThan(0);
      expect(p.stand, p.docId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['belegt', 'schaetzwert', 'nicht_verifiziert']).toContain(p.status);
    }
  });

  it('Messverfahren passt zur Formelfamilie', () => {
    for (const p of NOVA_PERIODEN) {
      if (p.formel === 'verbrauch') expect(p.verfahren).toBe('VERBRAUCH');
      if (p.formel === 'hubraum') expect(p.verfahren).toBe('HUBRAUM');
      if (p.formel === 'co2') expect(['NEFZ', 'WLTP', 'WMTC']).toContain(p.verfahren);
    }
  });
});

describe('Stichprobe: Werte aus den Tabellen des Recherche-Dokuments (hart codiert)', () => {
  it('PKW-2008a: Verbrauchsformel, §14a Partikel (RIS 300 vs. BMF 200), Erhöhungsbetrag nur auf Grundbetrag', () => {
    const p = verbrauch(byId('PKW-2008a'));
    expect(p.verbrauchAbzug).toEqual({ benzinUndAndere: 3, diesel: 2 });
    expect(p.multiplikator).toBe(2);
    expect(p.hoechstsatz).toMatchObject({ prozent: 16, wortlaut: 'betrag', anwendung: 'satz' });
    expect(p.co2Malus).toEqual([]);
    expect(p.partikel14a).toEqual({
      grenzwertGProKm: 0.005,
      bonusEuroRis: 300,
      bonusEuroBmf: 200,
      bonusEuro: 300,
      malusProzentDerBg: 1.5,
      malusMaxEuro: 300,
    });
    expect(p.ohneVerbrauch).toEqual({ art: 'satz_aus_kw', faktor: 0.2 });
    expect(p.erhoehungsbetrag).toMatchObject({ prozent: 20, basis: 'grundbetrag', anzusetzen: false });
  });

  it('PKW-2008b: Malus > 180 g 25 €/g, Boni, ohne CO2 +20 €/kW über 100 kW', () => {
    const p = verbrauch(byId('PKW-2008b'));
    expect(p.co2Malus).toEqual([{ schwelleGramm: 180, euroProGramm: 25 }]);
    expect(p.co2Bonus).toEqual({ unterGramm: 120, euro: 300 });
    expect(p.noxPartikelBonus).toEqual({
      maxEuro: 200,
      benzinNoxMaxMg: 60,
      dieselNoxMaxMg: 80,
      dieselPartikelMaxGProKm: 0.005,
    });
    expect(p.oekoBonus?.maxEuro).toBe(500);
    expect(p.bonusSummeMaxEuro).toBe(500);
    expect(p.dieselPartikelMalus).toEqual({ grenzwertGProKm: 0.005, euro: 300 });
    expect(p.ohneCo2).toEqual({ art: 'kw_malus', euroProKw: 20, abKw: 100 });
    expect(p.erhoehungsbetrag.basis).toBe('grundbetrag');
  });

  it('PKW-2009: Erhöhungsbetrag auf Grundbetrag ± Bonus/Malus, Ersatz-CO2 und Ersatz-Verbrauch', () => {
    const p = verbrauch(byId('PKW-2009'));
    expect(p.erhoehungsbetrag.basis).toBe('grundbetrag_und_bonus_malus');
    expect(p.ohneCo2).toEqual({ art: 'verbrauch', faktorBenzinUndAndere: 25, faktorDiesel: 28 });
    expect(p.ohneVerbrauch).toEqual({
      art: 'verbrauch_aus_kw',
      kwDivisor: 10,
      zuschlagBenzinUndAndere: 3,
      zuschlagDiesel: 2,
    });
    expect(p.erdgasNm3JeLiterBenzin).toBe(1);
  });

  it('PKW-2010, PKW-2011, PKW-2013: Malus-Staffeln', () => {
    expect(verbrauch(byId('PKW-2010')).co2Malus).toEqual([{ schwelleGramm: 160, euroProGramm: 25 }]);
    expect(verbrauch(byId('PKW-2011')).co2Malus).toEqual([
      { schwelleGramm: 160, euroProGramm: 25 },
      { schwelleGramm: 180, euroProGramm: 25 },
      { schwelleGramm: 220, euroProGramm: 25 },
    ]);
    expect(verbrauch(byId('PKW-2013')).co2Malus).toEqual([
      { schwelleGramm: 150, euroProGramm: 25 },
      { schwelleGramm: 170, euroProGramm: 25 },
      { schwelleGramm: 210, euroProGramm: 25 },
    ]);
  });

  it('PKW-2014: NEFZ, 90/5, 32 %, Malus > 250 20 €/g, AP Diesel 350 / andere 450, Umweltbonus 600 statt AP', () => {
    const p = co2(byId('PKW-2014'));
    expect(p).toMatchObject({ verfahren: 'NEFZ', abzugswert: 90, divisor: 5 });
    expect(p.hoechstsatz).toMatchObject({ prozent: 32, wortlaut: 'satz' });
    expect(p.malus).toEqual([{ schwelleGramm: 250, euroProGramm: 20 }]);
    expect(p.abzugsposten).toEqual({ dieselEuro: 350, andereEuro: 450 });
    expect(p.umweltbonus).toMatchObject({ maxEuro: 600, stattAbzugsposten: true });
    expect(p.ohneCo2).toEqual([
      { art: 'verbrauch', faktorBenzinUndAndere: 25, faktorDiesel: 28 },
      { art: 'kw', faktor: 2 },
    ]);
    expect(p.uebergang).toMatchObject({ vertragVor: '2014-02-16', lieferungVor: '2014-10-01' });
  });

  it('PKW-2015 AP 400 mit Umweltbonus, PKW-2016 AP 300 ohne Umweltbonus', () => {
    const a = co2(byId('PKW-2015'));
    expect(a.abzugsposten).toEqual({ dieselEuro: 400, andereEuro: 400 });
    expect(a.umweltbonus?.maxEuro).toBe(600);
    const b = co2(byId('PKW-2016'));
    expect(b.abzugsposten).toEqual({ dieselEuro: 300, andereEuro: 300 });
    expect(b.umweltbonus).toBeNull();
  });

  it('PKW-2020: WLTP 115/5, 32 %, > 275 40 €/g, Wohnmobil SA nur nicht selbsttragend, NEFZ-Auslaufserie -> PKW-2016', () => {
    const p = co2(byId('PKW-2020'));
    expect(p).toMatchObject({ verfahren: 'WLTP', abzugswert: 115, divisor: 5 });
    expect(p.hoechstsatz.prozent).toBe(32);
    expect(p.malus).toEqual([{ schwelleGramm: 275, euroProGramm: 40 }]);
    expect(p.abzugsposten).toEqual({ dieselEuro: 350, andereEuro: 350 });
    expect(p.wohnmobilSA).toEqual({
      kwFaktor: 2,
      mindestsatzProzent: 16,
      nurNichtSelbsttragend: true,
      mindestsatzGiltBei: ['kw_wahl'],
    });
    expect(p.nefzSonderregel).toMatchObject({ art: 'fruehere_rechtslage', docId: 'PKW-2016' });
    expect(p.ohneCo2).toEqual([{ art: 'kw', faktor: 2 }]);
  });

  it('PKW-2021b bis PKW-2029: Abzugswerte, Höchstsätze, Malus', () => {
    const erwartet: [string, number, number, number, number][] = [
      ['PKW-2021a', 112, 32, 275, 40],
      ['PKW-2021b', 112, 50, 200, 50],
      ['PKW-2022', 107, 60, 185, 60],
      ['PKW-2023', 102, 70, 170, 70],
      ['PKW-2024', 97, 80, 155, 80],
      ['PKW-2025a', 94, 80, 155, 80],
      ['PKW-2025b', 94, 80, 155, 80],
      ['PKW-2026a', 91, 80, 155, 80],
      ['PKW-2026b', 91, 80, 155, 80],
      ['PKW-2027', 88, 80, 155, 80],
      ['PKW-2028', 85, 80, 155, 80],
      ['PKW-2029', 82, 80, 155, 80],
    ];
    for (const [id, abzug, max, schwelle, euro] of erwartet) {
      const p = co2(byId(id));
      expect(p.abzugswert, id).toBe(abzug);
      expect(p.divisor, id).toBe(5);
      expect(p.hoechstsatz.prozent, id).toBe(max);
      expect(p.malus, id).toEqual([{ schwelleGramm: schwelle, euroProGramm: euro }]);
      expect(p.abzugsposten, id).toEqual({ dieselEuro: 350, andereEuro: 350 });
    }
    expect(co2(byId('PKW-2021b')).wohnmobilSA).toEqual({
      kwFaktor: 2,
      mindestsatzProzent: 16,
      nurNichtSelbsttragend: false,
      mindestsatzGiltBei: ['kw_wahl', 'ohne_co2_wert'],
    });
    expect(co2(byId('PKW-2025a')).personenbefoerderungN1).toBeNull();
    expect(co2(byId('PKW-2025b')).personenbefoerderungN1).toEqual({
      sitzplaetzeMin: 4,
      sitzplaetzeMax: 9,
      hoechstgewichtKg: 3500,
    });
    expect(co2(byId('PKW-2027')).uebergang).toMatchObject({
      vertragVor: '2026-12-01',
      lieferungVor: '2027-04-01',
    });
  });

  it('N1: 2021b–2025a Werte und NEFZ-Sonderregel 140/238', () => {
    const erwartet: [string, number, number, number, number][] = [
      ['N1-2021b', 165, 50, 253, 50],
      ['N1-2022', 160, 60, 238, 60],
      ['N1-2023', 155, 70, 223, 70],
      ['N1-2024', 150, 80, 208, 80],
      ['N1-2025a', 147, 80, 208, 80],
    ];
    for (const [id, abzug, max, schwelle, euro] of erwartet) {
      const p = co2(byId(id));
      expect(p.verfahren, id).toBe('WLTP');
      expect(p.abzugswert, id).toBe(abzug);
      expect(p.hoechstsatz.prozent, id).toBe(max);
      expect(p.malus, id).toEqual([{ schwelleGramm: schwelle, euroProGramm: euro }]);
      expect(p.abzugsposten, id).toEqual({ dieselEuro: 350, andereEuro: 350 });
      expect(p.nefzSonderregel, id).toMatchObject({
        art: 'feste_werte',
        abzugGramm: 140,
        malusSchwelleGramm: 238,
      });
    }
    expect(co2(byId('N1-2021b')).nefzSonderregel?.status).toBe('belegt');
    expect(co2(byId('N1-2022')).nefzSonderregel?.status).toBe('nicht_verifiziert');
  });

  it('N1-bis2021 nur bei KN 8703, N1-ab2025b mit 4–9 Sitzen ≤ 3.500 kg', () => {
    const a = verweis(byId('N1-bis2021'));
    expect(a.steuerbarWenn).toEqual({ art: 'zolltarif', position: '8703' });
    expect(a.einreihungStatus).toBe('nicht_verifiziert');
    const b = verweis(byId('N1-ab2025b'));
    expect(b.steuerbarWenn).toEqual({
      art: 'personenbefoerderung',
      sitzplaetzeMin: 4,
      sitzplaetzeMax: 9,
      hoechstgewichtKg: 3500,
    });
    expect(b.bis).toBeNull();
  });

  it('Motorrad: Hubraum- und WMTC-Perioden', () => {
    const mr08 = hubraum(byId('MR-2008'));
    expect(mr08).toMatchObject({ abzugCm3: 100, faktor: 0.02 });
    expect(mr08.hoechstsatz).toMatchObject({ prozent: 16, wortlaut: 'betrag' });
    expect(mr08.kleinkraftrad).toEqual({ bisCm3: 125, folge: 'satz_null' });
    expect(mr08.erhoehungsbetrag?.prozent).toBe(20);
    const mr14 = hubraum(byId('MR-2014'));
    expect(mr14.hoechstsatz.prozent).toBe(20);
    expect(mr14.erhoehungsbetrag).toBeNull();

    const erwartet: [string, number, number][] = [
      ['MR-2020', 55, 20],
      ['MR-2021b', 55, 30],
      ['MR-2024', 53, 30],
      ['MR-2026', 51, 30],
      ['MR-2028', 49, 30],
    ];
    for (const [id, abzug, max] of erwartet) {
      const p = co2(byId(id));
      expect(p.verfahren, id).toBe('WMTC');
      expect(p.abzugswert, id).toBe(abzug);
      expect(p.divisor, id).toBe(4);
      expect(p.hoechstsatz.prozent, id).toBe(max);
      expect(p.malus, id).toEqual([{ schwelleGramm: 150, euroProGramm: 20 }]);
      expect(p.abzugsposten, id).toBeNull();
      expect(p.ohneCo2, id).toEqual([{ art: 'hubraum', abzugCm3: 100, faktor: 0.02 }]);
    }
    expect(co2(byId('MR-2020')).kleinkraftrad).toEqual({ bisCm3: 125, folge: 'satz_null' });
    expect(co2(byId('MR-2021b')).kleinkraftrad).toEqual({ bisCm3: 125, folge: 'nicht_steuerbar' });
  });
});

describe('Wertentwicklung EU-Gebrauchtimport (Geltungsbereich je Erstzulassung)', () => {
  it('deckt 2008-01-01 bis offen lückenlos ab', () => {
    expect(WERTENTWICKLUNG_UMFANG[0].von).toBe('2008-01-01');
    for (let i = 0; i < WERTENTWICKLUNG_UMFANG.length - 1; i++) {
      expect(plusEinTag(WERTENTWICKLUNG_UMFANG[i].bis as string)).toBe(
        WERTENTWICKLUNG_UMFANG[i + 1].von,
      );
    }
    expect(WERTENTWICKLUNG_UMFANG[WERTENTWICKLUNG_UMFANG.length - 1].bis).toBeNull();
  });

  it('vor 3/2014 nur Bonus/Malus (nicht_verifiziert), ab 3/2014 Saldo Malus − Abzugsposten', () => {
    expect(selectWertentwicklungUmfang('2013-05-01')).toMatchObject({
      gekuerzt: 'nur_bonus_malus',
      status: 'nicht_verifiziert',
    });
    expect(selectWertentwicklungUmfang('2019-03-07')).toMatchObject({
      gekuerzt: 'saldo_malus_abzugsposten',
      status: 'belegt',
      umweltbonusGekuerztStatus: 'nicht_verifiziert',
    });
    expect(selectWertentwicklungUmfang('2022-03-10')).toMatchObject({
      gekuerzt: 'saldo_malus_abzugsposten',
      status: 'belegt',
    });
    expect(() => selectWertentwicklungUmfang('2007-12-31')).toThrow(RegelwerkLuecke);
  });
});

describe('periodenArt', () => {
  it('bildet Fahrzeugarten auf Periodenarten ab', () => {
    expect(periodenArt('pkw')).toBe('pkw');
    expect(periodenArt('e-pkw')).toBe('pkw');
    expect(periodenArt('wohnmobil')).toBe('pkw');
    expect(periodenArt('n1')).toBe('n1');
    expect(periodenArt('motorrad')).toBe('motorrad');
  });
});

describe('Zoll- und EUSt-Sätze', () => {
  it('Pkw 10 % und Motorrad > 250 cm³ 6 % sind belegt, übrige Schätzwerte', () => {
    expect(ZOLLSAETZE.pkw).toMatchObject({ satz: 0.1, status: 'belegt' });
    expect(ZOLLSAETZE.motorrad_ueber_250).toMatchObject({ satz: 0.06, status: 'belegt' });
    for (const [klasse, w] of Object.entries(ZOLLSAETZE)) {
      if (klasse !== 'pkw' && klasse !== 'motorrad_ueber_250') {
        expect(w.status, klasse).toBe('schaetzwert');
      }
      expect(w.quelle.length, klasse).toBeGreaterThan(0);
    }
  });

  it('EUSt AT 20 % belegt; DE 19, NL 21, IT 22, SI 22 Schätzwert', () => {
    expect(EUST_SAETZE.AT).toMatchObject({ satz: 0.2, status: 'belegt' });
    expect(EUST_SAETZE.DE).toMatchObject({ satz: 0.19, status: 'schaetzwert' });
    expect(EUST_SAETZE.NL).toMatchObject({ satz: 0.21, status: 'schaetzwert' });
    expect(EUST_SAETZE.IT).toMatchObject({ satz: 0.22, status: 'schaetzwert' });
    expect(EUST_SAETZE.SI).toMatchObject({ satz: 0.22, status: 'schaetzwert' });
  });
});
