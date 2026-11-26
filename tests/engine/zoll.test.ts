import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EingabeFehler } from '@/engine/fehler';
import { berechneZollUndEust, type ZollEingabe } from '@/engine/zoll';

const basis: ZollEingabe = {
  kaufpreisEur: 20000,
  fracht: 1500,
  versicherung: 200,
  nachlauf: 600,
  zollsatz: 0.1,
  eustSatz: 0.2,
};

describe('berechneZollUndEust', () => {
  it('berechnet Zollwert, Zoll, EUSt-Basis und EUSt (Zoll 10 %, EUSt 20 %)', () => {
    expect(berechneZollUndEust(basis)).toEqual({
      zollwert: 21700,
      zoll: 2170,
      eustBasis: 24470,
      eust: 4894,
    });
  });

  it('setzt bei praeferenzfrei den Zoll auf 0; die EUSt-Basis ist dann kleiner', () => {
    expect(berechneZollUndEust({ ...basis, praeferenzfrei: true })).toEqual({
      zollwert: 21700,
      zoll: 0,
      eustBasis: 22300,
      eust: 4460,
    });
  });

  it('praeferenzfrei: false verhält sich wie nicht gesetzt', () => {
    expect(berechneZollUndEust({ ...basis, praeferenzfrei: false })).toEqual(berechneZollUndEust(basis));
  });

  it('ändert bei EUSt DE 19 % nur die EUSt', () => {
    const at = berechneZollUndEust(basis);
    const de = berechneZollUndEust({ ...basis, eustSatz: 0.19 });
    expect(de).toEqual({ ...at, eust: 4649.3 });
  });

  it('erlaubt Nullwerte', () => {
    expect(
      berechneZollUndEust({
        kaufpreisEur: 0,
        fracht: 0,
        versicherung: 0,
        nachlauf: 0,
        zollsatz: 0,
        eustSatz: 0,
      }),
    ).toEqual({ zollwert: 0, zoll: 0, eustBasis: 0, eust: 0 });
  });

  it('rundet halbe Cent kaufmännisch auf (Gleitkomma-sicher)', () => {
    // Zoll: 100,50 × 0,1 = 10,05 exakt; EUSt-Basis 110,55; EUSt 110,55 × 0,05 = 5,5275 → 5,53
    const r = berechneZollUndEust({
      kaufpreisEur: 100.5,
      fracht: 0,
      versicherung: 0,
      nachlauf: 0,
      zollsatz: 0.1,
      eustSatz: 0.05,
    });
    expect(r.zoll).toBe(10.05);
    expect(r.eustBasis).toBe(110.55);
    expect(r.eust).toBe(5.53);
    // x,xx5: Zoll 10,05 × ... → Zollwert 100,05 × 0,1 = 10,005 → 10,01
    expect(
      berechneZollUndEust({ ...basis, kaufpreisEur: 100.05, fracht: 0, versicherung: 0, nachlauf: 0 }).zoll,
    ).toBe(10.01);
  });

  it('rundet unter einem halben Cent ab', () => {
    expect(
      berechneZollUndEust({ ...basis, kaufpreisEur: 100.04, fracht: 0, versicherung: 0, nachlauf: 0 }).zoll,
    ).toBe(10);
  });

  describe('Validierung', () => {
    const felder = ['kaufpreisEur', 'fracht', 'versicherung', 'nachlauf'] as const;
    for (const feld of felder) {
      it(`lehnt negatives ${feld} ab`, () => {
        expect(() => berechneZollUndEust({ ...basis, [feld]: -1 })).toThrow(EingabeFehler);
        expect(() => berechneZollUndEust({ ...basis, [feld]: -1 })).toThrow(new RegExp(feld));
      });
      it(`lehnt NaN und Infinity bei ${feld} ab`, () => {
        expect(() => berechneZollUndEust({ ...basis, [feld]: Number.NaN })).toThrow(EingabeFehler);
        expect(() => berechneZollUndEust({ ...basis, [feld]: Infinity })).toThrow(EingabeFehler);
      });
    }

    for (const feld of ['zollsatz', 'eustSatz'] as const) {
      it(`lehnt ${feld} außerhalb 0..1 ab (Satz als Anteil, nicht Prozent)`, () => {
        expect(() => berechneZollUndEust({ ...basis, [feld]: -0.01 })).toThrow(EingabeFehler);
        expect(() => berechneZollUndEust({ ...basis, [feld]: 1.01 })).toThrow(EingabeFehler);
        expect(() => berechneZollUndEust({ ...basis, [feld]: 20 })).toThrow(new RegExp(feld));
        expect(() => berechneZollUndEust({ ...basis, [feld]: Number.NaN })).toThrow(EingabeFehler);
      });
      it(`erlaubt ${feld} an den Grenzen 0 und 1`, () => {
        expect(() => berechneZollUndEust({ ...basis, [feld]: 0 })).not.toThrow();
        expect(() => berechneZollUndEust({ ...basis, [feld]: 1 })).not.toThrow();
      });
    }

    it('nennt das Feld in einer deutschen Meldung', () => {
      expect(() => berechneZollUndEust({ ...basis, fracht: -5 })).toThrow(/fracht muss eine Zahl ≥ 0 sein/);
      expect(() => berechneZollUndEust({ ...basis, zollsatz: 2 })).toThrow(/zollsatz muss zwischen 0 und 1 liegen/);
    });
  });

  describe('Eigenschaften', () => {
    const betrag = fc.integer({ min: 0, max: 100_000_000 }).map((c) => c / 100);
    const satz = fc.integer({ min: 0, max: 100 }).map((p) => p / 100);
    const eingabe = fc.record({
      kaufpreisEur: betrag,
      fracht: betrag,
      versicherung: betrag,
      nachlauf: betrag,
      zollsatz: satz,
      eustSatz: satz,
      praeferenzfrei: fc.boolean(),
    });

    it('eust ≥ 0 und zoll ≤ zollwert', () => {
      fc.assert(
        fc.property(eingabe, (e) => {
          const r = berechneZollUndEust(e);
          expect(r.eust).toBeGreaterThanOrEqual(0);
          expect(r.zoll).toBeGreaterThanOrEqual(0);
          expect(r.zoll).toBeLessThanOrEqual(r.zollwert);
        }),
      );
    });

    it('ist monoton im Kaufpreis (Zollwert, Zoll, EUSt-Basis, EUSt)', () => {
      fc.assert(
        fc.property(eingabe, betrag, (e, extra) => {
          const klein = berechneZollUndEust(e);
          const gross = berechneZollUndEust({ ...e, kaufpreisEur: e.kaufpreisEur + extra });
          expect(gross.zollwert).toBeGreaterThanOrEqual(klein.zollwert);
          expect(gross.zoll).toBeGreaterThanOrEqual(klein.zoll);
          expect(gross.eustBasis).toBeGreaterThanOrEqual(klein.eustBasis);
          expect(gross.eust).toBeGreaterThanOrEqual(klein.eust);
        }),
      );
    });
  });
});
