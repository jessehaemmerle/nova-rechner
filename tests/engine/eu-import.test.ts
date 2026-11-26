import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { berechneEuUst, istNeufahrzeug, nettoKaufpreis } from '@/engine/eu-import';
import { EingabeFehler } from '@/engine/fehler';

const neu = (km: number, erstinbetriebnahme: string, stichtag: string) =>
  istNeufahrzeug({ km, erstinbetriebnahme, stichtag });

describe('istNeufahrzeug (Kilometer)', () => {
  it('5.999 km sind neu, auch bei alter Erstinbetriebnahme', () => {
    expect(neu(5999, '2020-01-01', '2026-11-26')).toBe(true);
  });

  it('genau 6.000 km sind noch neu', () => {
    expect(neu(6000, '2020-01-01', '2026-11-26')).toBe(true);
  });

  it('6.001 km und 7 Monate seit der Erstinbetriebnahme sind gebraucht', () => {
    expect(neu(6001, '2026-04-26', '2026-11-26')).toBe(false);
  });

  it('6.001 km, aber erst 3 Monate alt: neu (Monatsgrenze genügt)', () => {
    expect(neu(6001, '2026-08-26', '2026-11-26')).toBe(true);
  });
});

describe('istNeufahrzeug (sechs Monate)', () => {
  it('genau 6 Monate nach der Erstinbetriebnahme: noch neu', () => {
    expect(neu(10000, '2026-05-26', '2026-11-26')).toBe(true);
  });

  it('einen Tag später: gebraucht (bei > 6.000 km)', () => {
    expect(neu(10000, '2026-05-26', '2026-11-27')).toBe(false);
  });

  it('Monatsende: 31.08. + 6 Monate = 28.02. (Nicht-Schaltjahr), dort noch neu', () => {
    expect(neu(10000, '2025-08-31', '2026-02-28')).toBe(true);
  });

  it('Monatsende: der Tag danach (01.03.) ist gebraucht', () => {
    expect(neu(10000, '2025-08-31', '2026-03-01')).toBe(false);
  });

  it('Monatsende im Schaltjahr: 31.08.2023 + 6 Monate = 29.02.2024 neu, 01.03.2024 gebraucht', () => {
    expect(neu(10000, '2023-08-31', '2024-02-29')).toBe(true);
    expect(neu(10000, '2023-08-31', '2024-03-01')).toBe(false);
  });

  it('Monatsende: 31.07. + 6 Monate = 31.01.; 30.08. + 6 Monate = 28.02.', () => {
    expect(neu(10000, '2025-07-31', '2026-01-31')).toBe(true);
    expect(neu(10000, '2025-07-31', '2026-02-01')).toBe(false);
    expect(neu(10000, '2025-08-30', '2026-02-28')).toBe(true);
    expect(neu(10000, '2025-08-30', '2026-03-01')).toBe(false);
  });

  it('Jahreswechsel: 15.11.2025 + 6 Monate = 15.05.2026', () => {
    expect(neu(10000, '2025-11-15', '2026-05-15')).toBe(true);
    expect(neu(10000, '2025-11-15', '2026-05-16')).toBe(false);
  });

  it('Erstinbetriebnahme am Stichtag ist neu', () => {
    expect(neu(0, '2026-11-26', '2026-11-26')).toBe(true);
  });
});

describe('istNeufahrzeug (Validierung)', () => {
  it('Erstinbetriebnahme nach dem Stichtag → EingabeFehler', () => {
    expect(() => neu(100, '2026-11-27', '2026-11-26')).toThrow(EingabeFehler);
    expect(() => neu(100, '2026-11-27', '2026-11-26')).toThrow(/Erstinbetriebnahme/);
  });

  it('negative Kilometer → EingabeFehler', () => {
    expect(() => neu(-1, '2026-01-01', '2026-11-26')).toThrow(EingabeFehler);
    expect(() => neu(-1, '2026-01-01', '2026-11-26')).toThrow(/Kilometer/);
  });

  it('NaN und Infinity bei den Kilometern → EingabeFehler', () => {
    expect(() => neu(NaN, '2026-01-01', '2026-11-26')).toThrow(/Kilometer/);
    expect(() => neu(Infinity, '2026-01-01', '2026-11-26')).toThrow(EingabeFehler);
  });

  it('ungültige Daten → EingabeFehler mit Feldnamen', () => {
    expect(() => neu(100, '2026-02-30', '2026-11-26')).toThrow(/Erstinbetriebnahme/);
    expect(() => neu(100, '2026-01-01', 'morgen')).toThrow(/Stichtag/);
    expect(() => neu(100, '2026-02-30', '2026-11-26')).toThrow(EingabeFehler);
  });
});

describe('nettoKaufpreis', () => {
  it('brutto 11900 bei 19 % → 10000', () => {
    expect(nettoKaufpreis(11900, 'brutto', 0.19)).toBe(10000);
  });

  it('rundet kaufmännisch: brutto 100 bei 19 % → 84,03', () => {
    expect(nettoKaufpreis(100, 'brutto', 0.19)).toBe(84.03);
  });

  it('netto bleibt unverändert', () => {
    expect(nettoKaufpreis(10000, 'netto', 0.19)).toBe(10000);
  });

  it('privat_ohne_ust bleibt unverändert', () => {
    expect(nettoKaufpreis(10000, 'privat_ohne_ust', 0.19)).toBe(10000);
  });

  it('Satz 0 bei brutto: unverändert', () => {
    expect(nettoKaufpreis(5000, 'brutto', 0)).toBe(5000);
  });

  it('negativer oder nicht endlicher Preis → EingabeFehler', () => {
    expect(() => nettoKaufpreis(-1, 'netto', 0.19)).toThrow(EingabeFehler);
    expect(() => nettoKaufpreis(-1, 'netto', 0.19)).toThrow(/Kaufpreis/);
    expect(() => nettoKaufpreis(NaN, 'brutto', 0.19)).toThrow(/Kaufpreis/);
  });

  it('Satz außerhalb 0..1 oder NaN → EingabeFehler (auch bei netto)', () => {
    expect(() => nettoKaufpreis(100, 'brutto', -0.01)).toThrow(/USt-Satz/);
    expect(() => nettoKaufpreis(100, 'brutto', 1.01)).toThrow(EingabeFehler);
    expect(() => nettoKaufpreis(100, 'netto', 19)).toThrow(EingabeFehler);
    expect(() => nettoKaufpreis(100, 'brutto', NaN)).toThrow(EingabeFehler);
  });
});

describe('berechneEuUst', () => {
  it('Neufahrzeug, Privat: 20 % Erwerbsteuer, kein Vorsteuerabzug', () => {
    expect(berechneEuUst({ kaeufer: 'privat', neu: true, nettoKaufpreis: 20000 })).toEqual({
      erwerbsteuer: 4000,
      vorsteuerAbziehbar: 0,
    });
  });

  it('Neufahrzeug, Unternehmer: 20 % und abziehbar', () => {
    expect(berechneEuUst({ kaeufer: 'unternehmer', neu: true, nettoKaufpreis: 20000 })).toEqual({
      erwerbsteuer: 4000,
      vorsteuerAbziehbar: 4000,
    });
  });

  it('Gebraucht, Privat: keine österreichische USt', () => {
    expect(berechneEuUst({ kaeufer: 'privat', neu: false, nettoKaufpreis: 20000 })).toEqual({
      erwerbsteuer: 0,
      vorsteuerAbziehbar: 0,
    });
  });

  it('Gebraucht, Unternehmer: 20 % und abziehbar', () => {
    expect(berechneEuUst({ kaeufer: 'unternehmer', neu: false, nettoKaufpreis: 20000 })).toEqual({
      erwerbsteuer: 4000,
      vorsteuerAbziehbar: 4000,
    });
  });

  it('rundet auf Cent: 84,03 netto → 16,81', () => {
    expect(berechneEuUst({ kaeufer: 'privat', neu: true, nettoKaufpreis: 84.03 }).erwerbsteuer).toBe(16.81);
  });

  it('Kaufpreis 0 → 0/0', () => {
    expect(berechneEuUst({ kaeufer: 'unternehmer', neu: true, nettoKaufpreis: 0 })).toEqual({
      erwerbsteuer: 0,
      vorsteuerAbziehbar: 0,
    });
  });

  it('negativer oder nicht endlicher Nettokaufpreis → EingabeFehler', () => {
    expect(() => berechneEuUst({ kaeufer: 'privat', neu: true, nettoKaufpreis: -5 })).toThrow(EingabeFehler);
    expect(() => berechneEuUst({ kaeufer: 'privat', neu: true, nettoKaufpreis: NaN })).toThrow(/Nettokaufpreis/);
  });

  it('Eigenschaften: neu ⇒ Erwerbsteuer ≥ 0; Vorsteuer ≤ Erwerbsteuer; Privat ⇒ Vorsteuer 0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('privat' as const, 'unternehmer' as const),
        fc.boolean(),
        fc.double({ min: 0, max: 1_000_000, noNaN: true }),
        (kaeufer, istNeu, netto) => {
          const r = berechneEuUst({ kaeufer, neu: istNeu, nettoKaufpreis: netto });
          if (istNeu) expect(r.erwerbsteuer).toBeGreaterThanOrEqual(0);
          expect(r.vorsteuerAbziehbar).toBeLessThanOrEqual(r.erwerbsteuer);
          if (kaeufer === 'privat') expect(r.vorsteuerAbziehbar).toBe(0);
        },
      ),
    );
  });
});
