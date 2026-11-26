import { describe, expect, it } from 'vitest';
import { EingabeFehler } from '../../src/engine/fehler';
import { gebuehrenPosten } from '../../src/engine/gebuehren';

const voll = { weg: 'generalimporteur', einzelgenehmigung: true, gutachten57a: true } as const;

describe('gebuehrenPosten', () => {
  it('Generalimporteur: Eintragung höchstens 180 €, belegt, ÖAMTC-Quelle', () => {
    const p = gebuehrenPosten(voll).find((x) => x.id === 'eintragung_genehmigungsdatenbank');
    expect(p).toBeDefined();
    expect(p?.betrag).toBe(180);
    expect(p?.betrag).toBeLessThanOrEqual(180);
    expect(p?.status).toBe('belegt');
    expect(p?.label).toContain('bis zu');
    expect(p?.quelle).toContain('ÖAMTC');
    expect(p?.quelle).toContain('Eigenimport');
  });

  it('Landesprüfstelle: rund 150 €, belegt', () => {
    const p = gebuehrenPosten({ ...voll, weg: 'landespruefstelle' }).find(
      (x) => x.id === 'eintragung_genehmigungsdatenbank',
    );
    expect(p?.betrag).toBe(150);
    expect(p?.status).toBe('belegt');
  });

  it('einzelgenehmigung:false lässt die Einzelgenehmigung weg, true nimmt sie auf', () => {
    expect(
      gebuehrenPosten({ ...voll, einzelgenehmigung: false }).some(
        (x) => x.id === 'einzelgenehmigung',
      ),
    ).toBe(false);
    expect(gebuehrenPosten(voll).some((x) => x.id === 'einzelgenehmigung')).toBe(true);
  });

  it('gutachten57a:false lässt das Gutachten weg', () => {
    expect(
      gebuehrenPosten({ ...voll, gutachten57a: false }).some((x) => x.id === 'gutachten57a'),
    ).toBe(false);
    expect(gebuehrenPosten(voll).some((x) => x.id === 'gutachten57a')).toBe(true);
  });

  it('alle übrigen Posten sind Schätzwerte mit Annahme-Quelle', () => {
    const rest = gebuehrenPosten(voll).filter((x) => x.id !== 'eintragung_genehmigungsdatenbank');
    expect(rest.map((x) => x.id)).toEqual([
      'einzelgenehmigung',
      'gutachten57a',
      'coc',
      'zulassungsgebuehr',
      'kennzeichen',
      'eintragungsgebuehr',
    ]);
    for (const p of rest) {
      expect(p.status).toBe('schaetzwert');
      expect(p.quelle).toBe(
        'Annahme, keine Gebührenquelle geprüft; Betrag beim Amt der Landesregierung / Zulassungsstelle erfragen',
      );
      expect(p.betrag).toBeGreaterThan(0);
    }
  });

  it('jede id ist je Aufruf eindeutig', () => {
    for (const weg of ['generalimporteur', 'landespruefstelle'] as const) {
      const ids = gebuehrenPosten({ ...voll, weg }).map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('Überschreibung ersetzt den Betrag; ein überschriebener belegter Posten gilt nicht mehr als belegt', () => {
    const p = gebuehrenPosten({
      ...voll,
      ueberschrieben: { eintragung_genehmigungsdatenbank: 99.999, coc: 0 },
    });
    const e = p.find((x) => x.id === 'eintragung_genehmigungsdatenbank');
    expect(e?.betrag).toBe(100);
    expect(e?.status).toBe('schaetzwert');
    expect(e?.erklaerung).toContain('vom Nutzer überschrieben');
    expect(p.find((x) => x.id === 'coc')?.betrag).toBe(0);
  });

  it('Validierung: negative/NaN-Überschreibung → EingabeFehler mit Feldname', () => {
    expect(() => gebuehrenPosten({ ...voll, ueberschrieben: { coc: -1 } })).toThrow(/coc/);
    expect(() => gebuehrenPosten({ ...voll, ueberschrieben: { kennzeichen: Number.NaN } })).toThrow(
      EingabeFehler,
    );
    expect(() => gebuehrenPosten({ ...voll, weg: 'x' as never })).toThrow(/weg/);
  });
});
