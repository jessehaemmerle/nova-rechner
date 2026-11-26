import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runde2, rundeProzent } from '@/engine/runde';

describe('runde2 (kaufmännisch auf Cent)', () => {
  it('rundet halbe Cent auf, auch wenn die Gleitkommadarstellung knapp darunter liegt', () => {
    expect(runde2(1.005)).toBe(1.01);
    expect(runde2(1.015)).toBe(1.02);
    expect(runde2(2.675)).toBe(2.68);
    expect(runde2(1.255)).toBe(1.26);
    expect(runde2(10.235)).toBe(10.24);
  });

  it('rundet unter einem halben Cent ab', () => {
    expect(runde2(1.004)).toBe(1);
    expect(runde2(28.0701754)).toBe(28.07);
  });

  it('rundet negative Werte betragsmäßig (symmetrisch)', () => {
    expect(runde2(-1.005)).toBe(-1.01);
    expect(runde2(-0.004)).toBe(0);
  });

  it('lässt Cent-Beträge unverändert', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10_000_000, max: 10_000_000 }), (cent) => {
        expect(runde2(cent / 100)).toBe(cent / 100);
      }),
    );
  });

  it('rundet exakte halbe Cent (n + 0,5 Cent) stets auf', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), (cent) => {
        // Dezimal exakt "cent,5" Cent: aus der Zeichenkette erzeugt, wie ein Nutzer sie eingibt.
        const wert = Number(`${Math.floor(cent / 100)}.${String(cent % 100).padStart(2, '0')}5`);
        expect(runde2(wert)).toBe((cent + 1) / 100);
      }),
    );
  });
});

describe('rundeProzent (kaufmännisch auf volle Prozent)', () => {
  it('rundet halbe Prozent auf', () => {
    expect(rundeProzent(17.5)).toBe(18);
    expect(rundeProzent(0.5)).toBe(1);
    expect(rundeProzent(8.8)).toBe(9);
    expect(rundeProzent(10.4)).toBe(10);
  });

  it('beseitigt Gleitkommarauschen vor dem Runden', () => {
    // (650 − 100) × 0,02 = 11.000000000000002
    expect(rundeProzent((650 - 100) * 0.02)).toBe(11);
    // 2 × (6,25 − 3) = 6,5 → 7; (1,27 × 50 − 51) / 4 = 3,125 → 3
    expect(rundeProzent(2 * (6.25 - 3))).toBe(7);
    expect(rundeProzent((1.27 * 50 - 51) / 4)).toBe(3);
    // 0,1 + 0,2 + 0,2 = 0.5000000000000001 bzw. 4,35 + 0,15 = 4,5 → 5
    expect(rundeProzent(4.35 + 0.15)).toBe(5);
    expect(rundeProzent(2.4999999999999996)).toBe(3);
  });

  it('rundet negative Werte betragsmäßig', () => {
    expect(rundeProzent(-2.5)).toBe(-3);
    expect(rundeProzent(-2.4)).toBe(-2);
  });
});
