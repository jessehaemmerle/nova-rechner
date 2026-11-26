import { describe, expect, it } from 'vitest';
import { EingabeFehler } from '../../src/engine/fehler';
import { EUST_SAETZE } from '../../src/regelwerk/ust-saetze';
import { ZOLLSAETZE } from '../../src/regelwerk/zoll';
import {
  ROUTEN,
  richtwertFracht,
  transportPosten,
  type TransportEingabe,
} from '../../src/engine/transport';

const basis: TransportEingabe = {
  route: 'usa-bremerhaven',
  art: 'roro',
  klasse: 'mittel',
  warenwertEur: 20000,
};

const finde = (posten: ReturnType<typeof transportPosten>, id: string) => {
  const p = posten.find((x) => x.id === id);
  if (!p) throw new Error(`Posten ${id} fehlt`);
  return p;
};

describe('ROUTEN', () => {
  it('enthält die geforderten Routen mit Einfuhrland', () => {
    const ids = ROUTEN.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'usa-bremerhaven',
        'usa-koper',
        'japan-koper',
        'uk-bremerhaven',
        'dubai-koper',
      ]),
    );
    expect(ROUTEN.find((r) => r.id === 'usa-bremerhaven')?.einfuhrLand).toBe('DE');
    expect(ROUTEN.find((r) => r.id === 'dubai-koper')?.einfuhrLand).toBe('SI');
  });
});

describe('richtwertFracht', () => {
  it('liefert für jede Kombination einen Schätzwert mit Stand und Annahme-Quelle', () => {
    for (const r of ROUTEN) {
      for (const art of ['roro', 'container'] as const) {
        for (const klasse of ['klein', 'mittel', 'gross'] as const) {
          const w = richtwertFracht(r.id, art, klasse);
          expect(w.status).toBe('schaetzwert');
          expect(w.stand).toBe('2026-11-26');
          expect(w.quelle).toBe(
            'Richtwert (Annahme), keine Preisquelle geprüft; bitte Angebot einholen',
          );
          expect(w.satz).toBeGreaterThan(0);
        }
      }
    }
  });

  it("kennzeichnet den EUR-Betrag mit einheit 'eur', Zoll-/EUSt-Sätze bleiben Anteile", () => {
    for (const r of ROUTEN) {
      for (const art of ['roro', 'container'] as const) {
        for (const klasse of ['klein', 'mittel', 'gross'] as const) {
          expect(richtwertFracht(r.id, art, klasse).einheit).toBe('eur');
        }
      }
    }
    for (const w of [...Object.values(ZOLLSAETZE), ...Object.values(EUST_SAETZE)]) {
      expect([undefined, 'anteil']).toContain(w.einheit);
    }
  });

  it('hat hart codierte Beispielwerte (EUR in satz)', () => {
    expect(richtwertFracht('usa-bremerhaven', 'roro', 'mittel').satz).toBe(1100);
    expect(richtwertFracht('japan-koper', 'container', 'gross').satz).toBe(3000);
  });

  it('wirft bei unbekannter Route', () => {
    expect(() => richtwertFracht('mars' as never, 'roro', 'klein')).toThrow(EingabeFehler);
  });
});

describe('transportPosten', () => {
  it('liefert alle sieben Posten mit eindeutiger id', () => {
    const p = transportPosten(basis);
    expect(p.map((x) => x.id)).toEqual([
      'vorlauf',
      'seefracht',
      'hafen',
      'versicherung',
      'spedition',
      'nachlauf',
      'ueberstellung',
    ]);
    expect(new Set(p.map((x) => x.id)).size).toBe(p.length);
  });

  it('verwendet den Richtwert für die Seefracht und markiert ihn als Schätzwert', () => {
    const f = finde(transportPosten(basis), 'seefracht');
    expect(f.betrag).toBe(1100);
    expect(f.status).toBe('schaetzwert');
    expect(f.quelle).toContain('Annahme');
  });

  it('Überschreibung ersetzt die Vorgabe und wird in der Erklärung vermerkt', () => {
    const p = transportPosten({ ...basis, ueberschrieben: { seefracht: 1234.5 } });
    const f = finde(p, 'seefracht');
    expect(f.betrag).toBe(1234.5);
    expect(f.erklaerung).toContain('vom Nutzer überschrieben');
    expect(f.status).toBe('schaetzwert');
    // nicht überschriebene Posten bleiben bei der Vorgabe
    expect(finde(p, 'ueberstellung').erklaerung).not.toContain('überschrieben');
  });

  it('Überschreibung mit 0 ist erlaubt und gewinnt', () => {
    const p = transportPosten({ ...basis, ueberschrieben: { vorlauf: 0 } });
    expect(finde(p, 'vorlauf').betrag).toBe(0);
  });

  it('Überstellung: 125 € Schätzwert innerhalb der belegten ÖAMTC-Spanne 100–150 €', () => {
    const u = finde(transportPosten(basis), 'ueberstellung');
    expect(u.betrag).toBe(125);
    expect(u.status).toBe('schaetzwert');
    expect(u.quelle).toContain('ÖAMTC');
    expect(u.quelle).toContain('100–150');
  });

  it('Versicherung = Satz × Warenwert, kaufmännisch gerundet (Standard 1,5 %)', () => {
    expect(finde(transportPosten(basis), 'versicherung').betrag).toBe(300);
    const v = finde(transportPosten({ ...basis, warenwertEur: 33333.33 }), 'versicherung');
    expect(v.betrag).toBe(500); // 499,99995 → 500,00
    expect(v.status).toBe('schaetzwert');
  });

  it('Versicherungssatz ist überschreibbar, Betrags-Überschreibung hat Vorrang', () => {
    expect(
      finde(transportPosten({ ...basis, versicherungssatz: 0.02 }), 'versicherung').betrag,
    ).toBe(400);
    expect(
      finde(
        transportPosten({ ...basis, versicherungssatz: 0.02, ueberschrieben: { versicherung: 99 } }),
        'versicherung',
      ).betrag,
    ).toBe(99);
  });

  it('alle Beträge sind auf Cent gerundet', () => {
    const p = transportPosten({
      ...basis,
      ueberschrieben: { vorlauf: 10.005, nachlauf: 1.234 },
    });
    expect(finde(p, 'vorlauf').betrag).toBe(10.01);
    expect(finde(p, 'nachlauf').betrag).toBe(1.23);
  });

  it('Validierung: negative/NaN-Beträge und Satz außerhalb 0..1 → EingabeFehler mit Feldname', () => {
    expect(() => transportPosten({ ...basis, warenwertEur: -1 })).toThrow(/warenwertEur/);
    expect(() => transportPosten({ ...basis, warenwertEur: Number.NaN })).toThrow(EingabeFehler);
    expect(() => transportPosten({ ...basis, versicherungssatz: 1.5 })).toThrow(
      /versicherungssatz/,
    );
    expect(() => transportPosten({ ...basis, versicherungssatz: -0.1 })).toThrow(EingabeFehler);
    expect(() =>
      transportPosten({ ...basis, ueberschrieben: { hafen: -5 } }),
    ).toThrow(/hafen/);
    expect(() =>
      transportPosten({ ...basis, ueberschrieben: { spedition: Number.NaN } }),
    ).toThrow(EingabeFehler);
    expect(() => transportPosten({ ...basis, route: 'mars' as never })).toThrow(EingabeFehler);
  });
});
