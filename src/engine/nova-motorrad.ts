/**
 * Hubraum-Formel Motorrad 2008-01-01 – 2019-12-31:
 * Satz = round((Hubraum − Abzug) × Faktor), min. 0, max. Höchstsatz; ≤ 125 cm³: 0 %.
 * (Motorrad ab 2020: CO2-Formel in nova-co2.ts.)
 */
import type { HubraumPeriode } from '@/regelwerk';
import { EingabeFehler } from './fehler';
import {
  abschliessen,
  begrenze,
  kleinkraftradErgebnis,
  kopiere,
  type NovaEingabe,
  type NovaErgebnis,
  type Protokoll,
} from './nova-typen';
import { pruefeErhoehungsbetrag, pruefeHoechstsatzWortlaut } from './nova-verbrauch';
import { rundeProzent } from './runde';

export function berechneHubraum(e: NovaEingabe, p: HubraumPeriode, basis: Protokoll): NovaErgebnis {
  const prot = kopiere(basis);
  if (e.hubraum === undefined) {
    throw new EingabeFehler(`Für ${p.docId} fehlt der Hubraum (cm³).`);
  }
  const klein = kleinkraftradErgebnis(e, p.kleinkraftrad, p.docId, prot);
  if (klein) return klein;
  const satz = begrenze(rundeProzent((e.hubraum - p.abzugCm3) * p.faktor), p.hoechstsatz.prozent);
  pruefeErhoehungsbetrag(p.erhoehungsbetrag, prot);
  pruefeHoechstsatzWortlaut(p.hoechstsatz, prot);
  return abschliessen(
    { periodeId: p.docId, satz, bg: e.bg, malus: 0, abzugsposten: 0, bonus: 0, befreit: false, ersatz: null, protokoll: prot },
    e.kuerzung,
  );
}
