/**
 * EU-Gebrauchtimport: Wertminderungsfaktor, Rechtslage-Stichtag (Erstzulassung bzw. Zulassung,
 * Übergangsregeln) und NoVA-Berechnung für Gebrauchtfahrzeuge.
 * Golden-Werte E1a/E1b/E2: `docs/superpowers/research/nova-perioden.md` Abschnitt 5 (wörtlich).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  EingabeFehler,
  berechneNovaGebraucht,
  rechtslageStichtag,
  volleJahre,
  wertminderungsFaktor,
  type NovaEingabe,
} from '@/engine';
import { RegelwerkLuecke } from '@/regelwerk';

const HEUTE = '2026-11-26';

const pkw = (bg: number, rest: Partial<NovaEingabe>): NovaEingabe => ({
  art: 'pkw',
  bg,
  stichtag: '1900-01-01', // wird von berechneNovaGebraucht durch den Rechtslage-Stichtag ersetzt
  ...rest,
});

describe('wertminderungsFaktor (Brief)', () => {
  it.each([
    [0, 1],
    [3, 0.625],
    [7, 0.125],
    [12, 0.125],
  ])('%i volle Jahre → %d', (jahre, faktor) => {
    expect(wertminderungsFaktor(jahre)).toBe(faktor);
  });

  it('mit Neuwagenwert: BG 15.000 / Neuwagenwert 30.000 → 0,5', () => {
    expect(wertminderungsFaktor(3, 15000, 30000)).toBe(0.5);
  });

  it('mit Neuwagenwert: gedeckelt auf 0..1', () => {
    expect(wertminderungsFaktor(0, 40000, 30000)).toBe(1);
    expect(wertminderungsFaktor(5, 0, 30000)).toBe(0);
  });

  it('ungültige Eingaben → EingabeFehler', () => {
    expect(() => wertminderungsFaktor(-1)).toThrow(EingabeFehler);
    expect(() => wertminderungsFaktor(1.5)).toThrow(EingabeFehler);
    expect(() => wertminderungsFaktor(2, 10000, 0)).toThrow(EingabeFehler);
    expect(() => wertminderungsFaktor(2, undefined, 30000)).toThrow(EingabeFehler);
    expect(() => wertminderungsFaktor(2, -5, 30000)).toThrow(EingabeFehler);
  });

  it('Property: Faktor in [1/8, 1] und nicht steigend in den Jahren', () => {
    fc.assert(
      fc.property(fc.nat(200), fc.nat(200), (a, b) => {
        const [j1, j2] = a <= b ? [a, b] : [b, a];
        const f1 = wertminderungsFaktor(j1);
        const f2 = wertminderungsFaktor(j2);
        return f1 >= 1 / 8 && f1 <= 1 && f2 >= 1 / 8 && f2 <= 1 && f2 <= f1;
      }),
    );
  });
});

describe('volleJahre (vollendete Jahre, Jahrestag zählt als vollendet)', () => {
  it('genau 4 Jahre am Jahrestag, einen Tag davor 3', () => {
    expect(volleJahre('2022-03-10', '2026-03-10')).toBe(4);
    expect(volleJahre('2022-03-10', '2026-03-09')).toBe(3);
  });

  it('Schalttag 2020-02-29: Jahrestag in Nicht-Schaltjahren ist der 28.2.', () => {
    expect(volleJahre('2020-02-29', '2021-02-27')).toBe(0);
    expect(volleJahre('2020-02-29', '2021-02-28')).toBe(1);
    expect(volleJahre('2020-02-29', '2024-02-28')).toBe(3);
    expect(volleJahre('2020-02-29', '2024-02-29')).toBe(4);
    expect(volleJahre('2020-02-29', '2025-02-28')).toBe(5);
  });

  it('gleicher Tag → 0; Ende vor Beginn → EingabeFehler', () => {
    expect(volleJahre('2024-05-05', '2024-05-05')).toBe(0);
    expect(() => volleJahre('2024-05-05', '2024-05-04')).toThrow(EingabeFehler);
  });
});

describe('rechtslageStichtag', () => {
  it('Übergang Jahreswechsel (Brief): Vertrag 2025-11-10, Lieferung 2026-03-20 → 2025-12-31', () => {
    expect(
      rechtslageStichtag({
        herkunft: 'DRITTLAND',
        zulassung: '2026-03-25',
        vertrag: '2025-11-10',
        lieferung: '2026-03-20',
      }),
    ).toBe('2025-12-31');
  });

  it('Vertrag 2025-12-02 (Brief) → keine Übergangsregel', () => {
    expect(
      rechtslageStichtag({
        herkunft: 'DRITTLAND',
        zulassung: '2026-03-25',
        vertrag: '2025-12-02',
        lieferung: '2026-03-20',
      }),
    ).toBe('2026-03-25');
  });

  it('Lieferung am 1.4. (Frist ausschließlich) → keine Übergangsregel', () => {
    expect(
      rechtslageStichtag({
        herkunft: 'DRITTLAND',
        zulassung: '2026-04-02',
        vertrag: '2025-11-10',
        lieferung: '2026-04-01',
      }),
    ).toBe('2026-04-02');
  });

  it('ohne Vertrag oder Lieferung → keine Übergangsregel', () => {
    expect(rechtslageStichtag({ herkunft: 'DRITTLAND', zulassung: '2026-03-25' })).toBe('2026-03-25');
    expect(
      rechtslageStichtag({ herkunft: 'DRITTLAND', zulassung: '2026-03-25', vertrag: '2025-11-10' }),
    ).toBe('2026-03-25');
    expect(
      rechtslageStichtag({ herkunft: 'DRITTLAND', zulassung: '2026-03-25', lieferung: '2026-03-20' }),
    ).toBe('2026-03-25');
  });

  it('Reformstichtag 1.7.2025 (Abs. 27): Lieferung vor 31.12.2025 → Rechtslage PKW-2025a (2025-06-30)', () => {
    expect(
      rechtslageStichtag({
        herkunft: 'DRITTLAND',
        zulassung: '2025-12-30',
        vertrag: '2025-06-15',
        lieferung: '2025-12-30',
      }),
    ).toBe('2025-06-30');
  });

  it('Reformstichtag 1.7.2025: Lieferung am 31.12.2025 ist nicht „vor 31.12.2025" → keine Übergangsregel', () => {
    expect(
      rechtslageStichtag({
        herkunft: 'DRITTLAND',
        zulassung: '2025-12-31',
        vertrag: '2025-06-15',
        lieferung: '2025-12-31',
      }),
    ).toBe('2025-12-31');
  });

  it('Reformstichtag 1.7.2025: Vertrag am 1.7.2025 → keine Übergangsregel', () => {
    expect(
      rechtslageStichtag({
        herkunft: 'DRITTLAND',
        zulassung: '2025-09-01',
        vertrag: '2025-07-01',
        lieferung: '2025-08-01',
      }),
    ).toBe('2025-09-01');
  });

  it('Reformstichtag 1.1.2020 (Abs. 21): eigene Fristen statt 1.12./1.4.', () => {
    // Lieferung im Mai 2020 – nach der Jahreswechsel-Frist 1.4., aber vor 1.6.2020
    expect(
      rechtslageStichtag({
        herkunft: 'DRITTLAND',
        zulassung: '2020-05-20',
        vertrag: '2019-11-20',
        lieferung: '2020-05-15',
      }),
    ).toBe('2019-12-31');
  });

  it('Jahreswechsel vor 2022 ohne Übergangsregel (2021-01-01 hat keine)', () => {
    expect(
      rechtslageStichtag({
        herkunft: 'DRITTLAND',
        zulassung: '2021-02-01',
        vertrag: '2020-11-01',
        lieferung: '2021-01-20',
      }),
    ).toBe('2021-02-01');
  });

  it('Übergang je Periodenart: Motorrad 1.1.2025 hat keinen Jahreswechsel, Pkw schon', () => {
    const p = {
      herkunft: 'DRITTLAND' as const,
      zulassung: '2025-02-01',
      vertrag: '2024-11-01',
      lieferung: '2025-01-20',
    };
    expect(rechtslageStichtag(p)).toBe('2024-12-31');
    expect(rechtslageStichtag({ ...p, art: 'motorrad' })).toBe('2025-02-01');
  });

  it('EU: Rechtslage = Erstzulassung (Übergangsregel des Kaufs in AT nicht anwendbar)', () => {
    expect(
      rechtslageStichtag({
        herkunft: 'EU',
        erstzulassung: '2019-04-01',
        zulassung: '2026-03-25',
        vertrag: '2025-11-10',
        lieferung: '2026-03-20',
        heute: HEUTE,
      }),
    ).toBe('2019-04-01');
  });

  it('Drittland ignoriert die Erstzulassung', () => {
    expect(
      rechtslageStichtag({ herkunft: 'DRITTLAND', erstzulassung: '2019-04-01', zulassung: '2026-03-25' }),
    ).toBe('2026-03-25');
  });

  it('EU ohne Erstzulassung, Erstzulassung nach Zulassung oder in der Zukunft → EingabeFehler', () => {
    expect(() => rechtslageStichtag({ herkunft: 'EU', zulassung: '2026-03-25', heute: HEUTE })).toThrow(
      EingabeFehler,
    );
    expect(() =>
      rechtslageStichtag({ herkunft: 'EU', erstzulassung: '2026-03-26', zulassung: '2026-03-25', heute: HEUTE }),
    ).toThrow(EingabeFehler);
    expect(() =>
      rechtslageStichtag({ herkunft: 'EU', erstzulassung: '2026-11-27', zulassung: '2027-01-10', heute: HEUTE }),
    ).toThrow(EingabeFehler);
  });

  it('ungültiges Datum oder Vertrag nach Lieferung → EingabeFehler', () => {
    expect(() => rechtslageStichtag({ herkunft: 'DRITTLAND', zulassung: '2026-02-30' })).toThrow(EingabeFehler);
    expect(() =>
      rechtslageStichtag({
        herkunft: 'DRITTLAND',
        zulassung: '2026-03-25',
        vertrag: '2026-03-21',
        lieferung: '2026-03-20',
      }),
    ).toThrow(EingabeFehler);
  });
});

describe('berechneNovaGebraucht', () => {
  it('E1a (BMF-Beispiel): Erstzulassung DE 7.3.2019, Zulassung AT Juni 2026, Neuwagenwert 28.500 → 2.588,07', () => {
    const r = berechneNovaGebraucht(pkw(8000, { co2Nefz: 270 }), {
      herkunft: 'EU',
      erstzulassung: '2019-03-07',
      zulassung: '2026-06-15',
      neuwagenwert: 28500,
      heute: HEUTE,
    });
    expect(r.rechtslageStichtag).toBe('2019-03-07');
    expect(r.periodeId).toBe('PKW-2016');
    expect(r.satzProzent).toBe(32);
    expect(r.wertminderungsFaktor).toBe(8000 / 28500);
    expect(r.betrag).toBe(2588.07);
  });

  it('E1b (BMF-Beispiel): wie E1a, Neuwagenwert unbekannt, 7 volle Jahre → Faktor 1/8 → 2.572,50', () => {
    const r = berechneNovaGebraucht(pkw(8000, { co2Nefz: 270 }), {
      herkunft: 'EU',
      erstzulassung: '2019-03-07',
      zulassung: '2026-06-15',
      heute: HEUTE,
    });
    expect(r.volleJahre).toBe(7);
    expect(r.wertminderungsFaktor).toBe(0.125);
    expect(r.malus).toBe(50);
    expect(r.abzugsposten).toBe(37.5);
    expect(r.betrag).toBe(2572.5);
  });

  it('E2: Erstzulassung DE 10.3.2022, Zulassung AT 26.11.2026, 4 volle Jahre → Faktor 0,5 → 4.075,00', () => {
    const r = berechneNovaGebraucht(pkw(20000, { co2Wltp: 200 }), {
      herkunft: 'EU',
      erstzulassung: '2022-03-10',
      zulassung: '2026-11-26',
      heute: HEUTE,
    });
    expect(r.rechtslageStichtag).toBe('2022-03-10');
    expect(r.periodeId).toBe('PKW-2022');
    expect(r.volleJahre).toBe(4);
    expect(r.wertminderungsFaktor).toBe(0.5);
    expect(r.satzProzent).toBe(19);
    expect(r.malus).toBe(450);
    expect(r.abzugsposten).toBe(175);
    expect(r.betrag).toBe(4075);
    expect(r.status).toBe('belegt');
  });

  it('E2-Jahrestag: Zulassung genau 4 Jahre nach Erstzulassung → 0,5; einen Tag früher → 3 Jahre, 0,625', () => {
    const ctx = { herkunft: 'EU' as const, erstzulassung: '2022-03-10', heute: HEUTE };
    const genau = berechneNovaGebraucht(pkw(20000, { co2Wltp: 200 }), { ...ctx, zulassung: '2026-03-10' });
    const kurz = berechneNovaGebraucht(pkw(20000, { co2Wltp: 200 }), { ...ctx, zulassung: '2026-03-09' });
    expect(genau.wertminderungsFaktor).toBe(0.5);
    expect(genau.betrag).toBe(4075);
    expect(kurz.volleJahre).toBe(3);
    expect(kurz.wertminderungsFaktor).toBe(0.625);
    expect(kurz.betrag).toBe(3800 + 550 * 0.625);
  });

  it('Schalttag-Erstzulassung 2020-02-29: am 28.2.2021 ein volles Jahr', () => {
    const ctx = { herkunft: 'EU' as const, erstzulassung: '2020-02-29', heute: HEUTE };
    const e = pkw(20000, { co2Wltp: 200 });
    expect(berechneNovaGebraucht(e, { ...ctx, zulassung: '2021-02-27' }).wertminderungsFaktor).toBe(1);
    expect(berechneNovaGebraucht(e, { ...ctx, zulassung: '2021-02-28' }).wertminderungsFaktor).toBe(0.875);
  });

  it('EU-Import Erstzulassung 2019-04-01 wählt die Periode dieses Datums (PKW-2016)', () => {
    const r = berechneNovaGebraucht(pkw(8000, { co2Nefz: 270 }), {
      herkunft: 'EU',
      erstzulassung: '2019-04-01',
      zulassung: '2026-06-15',
      heute: HEUTE,
    });
    expect(r.rechtslageStichtag).toBe('2019-04-01');
    expect(r.periodeId).toBe('PKW-2016');
  });

  it('Drittland ignoriert die Erstzulassung: Zulassungsdatum, volle Malus/Abzugsposten, Faktor 1', () => {
    const r = berechneNovaGebraucht(pkw(20000, { co2Wltp: 200 }), {
      herkunft: 'DRITTLAND',
      erstzulassung: '2019-04-01',
      zulassung: '2026-03-01',
    });
    expect(r.rechtslageStichtag).toBe('2026-03-01');
    expect(r.periodeId).toBe('PKW-2026a');
    expect(r.wertminderungsFaktor).toBe(1);
    expect(r.volleJahre).toBeNull();
    expect(r.malus).toBe((200 - 155) * 80);
    expect(r.abzugsposten).toBe(350);
  });

  it('Drittland mit Übergangsregel: Werte PKW-2025b', () => {
    const r = berechneNovaGebraucht(pkw(20000, { co2Wltp: 200 }), {
      herkunft: 'DRITTLAND',
      erstzulassung: '2019-04-01',
      zulassung: '2026-03-25',
      vertrag: '2025-11-10',
      lieferung: '2026-03-20',
    });
    expect(r.rechtslageStichtag).toBe('2025-12-31');
    expect(r.periodeId).toBe('PKW-2025b');
    expect(r.hinweise.join(' ')).toMatch(/Übergangsregel/);
  });

  it('Erstzulassung 2007-06-01 → RegelwerkLuecke mit Warntext', () => {
    const f = () =>
      berechneNovaGebraucht(pkw(10000, { co2Nefz: 150 }), {
        herkunft: 'EU',
        erstzulassung: '2007-06-01',
        zulassung: '2026-03-01',
        heute: HEUTE,
      });
    expect(f).toThrow(RegelwerkLuecke);
    expect(f).toThrow('Für Pkw am 2007-06-01 ist keine NoVA-Rechtslage hinterlegt: Das Regelwerk beginnt am 2008-01-01.');
  });

  it('Erstzulassung nach der Zulassung → EingabeFehler', () => {
    expect(() =>
      berechneNovaGebraucht(pkw(10000, { co2Wltp: 150 }), {
        herkunft: 'EU',
        erstzulassung: '2026-03-02',
        zulassung: '2026-03-01',
        heute: HEUTE,
      }),
    ).toThrow(EingabeFehler);
  });

  it('Kürzung von außen vorgegeben → EingabeFehler (Faktor bestimmt diese Funktion)', () => {
    expect(() =>
      berechneNovaGebraucht(pkw(10000, { co2Wltp: 150, kuerzung: { faktor: 0.5, umfang: 'malus_und_abzug' } }), {
        herkunft: 'DRITTLAND',
        zulassung: '2026-03-01',
      }),
    ).toThrow(EingabeFehler);
  });

  it('Erstzulassung vor 2014-03-01: Umfang „bonus_malus", kein Abzugsposten, Status nicht_verifiziert', () => {
    // B-PKW-2011 als EU-Import, 4 volle Jahre → Faktor 0,5: Grund 5.600 + Malus 3.625 × 0,5
    const r = berechneNovaGebraucht(
      pkw(40000, { kraftstoff: 'benzin', verbrauch: 10.1, co2Nefz: 235, noxMgProKm: 70 }),
      { herkunft: 'EU', erstzulassung: '2012-01-01', zulassung: '2016-01-01', heute: HEUTE },
    );
    expect(r.periodeId).toBe('PKW-2011');
    expect(r.kuerzungUmfang).toBe('bonus_malus');
    expect(r.wertminderungsFaktor).toBe(0.5);
    expect(r.abzugsposten).toBe(0);
    expect(r.malus).toBe(1812.5);
    expect(r.betrag).toBe(7412.5);
    expect(r.status).toBe('nicht_verifiziert');
    expect(r.warnungen.join(' ')).toMatch(/Abzugsposten/);
  });

  it('Erstzulassung ab 2014-03-01: Umfang „malus_und_abzug"', () => {
    const r = berechneNovaGebraucht(pkw(20000, { co2Wltp: 200 }), {
      herkunft: 'EU',
      erstzulassung: '2022-03-10',
      zulassung: '2026-11-26',
      heute: HEUTE,
    });
    expect(r.kuerzungUmfang).toBe('malus_und_abzug');
  });

  it('EU, 0 volle Jahre → Faktor 1, keine Kürzung angewendet', () => {
    const r = berechneNovaGebraucht(pkw(20000, { co2Wltp: 200 }), {
      herkunft: 'EU',
      erstzulassung: '2026-01-15',
      zulassung: '2026-06-15',
      heute: HEUTE,
    });
    expect(r.wertminderungsFaktor).toBe(1);
    expect(r.kuerzungUmfang).toBeNull();
    expect(r.malus).toBe((200 - 155) * 80);
    expect(r.abzugsposten).toBe(350);
  });
});
