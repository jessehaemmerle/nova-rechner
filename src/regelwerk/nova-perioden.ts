/**
 * Öffentlicher Einstieg: alle NoVA-Rechtslage-Perioden und die Auswahl nach Stichtag.
 * Daten je Familie in nova-perioden-pkw.ts, -n1.ts, -motorrad.ts.
 */
import { REGELWERK_BEGINN, REGELWERK_ENDE } from './allgemein';
import { pruefeIsoDatum, RegelwerkLuecke } from './fehler';
import { MOTORRAD_PERIODEN } from './nova-perioden-motorrad';
import { N1_PERIODEN } from './nova-perioden-n1';
import { PKW_PERIODEN } from './nova-perioden-pkw';
import type { Fahrzeugart, NovaPeriode, PeriodenArt } from './types';

/** Alle 36 Perioden, je Art nach `von` sortiert (Pkw, N1, Motorrad). */
export const NOVA_PERIODEN: readonly NovaPeriode[] = [
  ...PKW_PERIODEN,
  ...N1_PERIODEN,
  ...MOTORRAD_PERIODEN,
];

const ART_LABEL: Record<PeriodenArt, string> = {
  pkw: 'Pkw',
  n1: 'N1',
  motorrad: 'Motorrad',
};

/**
 * Liefert die Periode, deren Zeitraum den Stichtag (ISO `yyyy-mm-dd`) enthält.
 * @throws RegelwerkLuecke vor 2008-01-01, nach 2029-12-31 oder wenn keine Periode passt.
 */
export function selectNovaPeriode(art: PeriodenArt, stichtag: string): NovaPeriode {
  pruefeIsoDatum(stichtag);
  if (stichtag < REGELWERK_BEGINN) {
    throw new RegelwerkLuecke(
      `Für ${ART_LABEL[art]} am ${stichtag} ist keine NoVA-Rechtslage hinterlegt: Das Regelwerk beginnt am ${REGELWERK_BEGINN}.`,
    );
  }
  if (stichtag > REGELWERK_ENDE) {
    throw new RegelwerkLuecke(
      `Für ${ART_LABEL[art]} am ${stichtag} ist keine NoVA-Rechtslage hinterlegt: Das BMF nennt Werte nur bis ${REGELWERK_ENDE}.`,
    );
  }
  const periode = NOVA_PERIODEN.find(
    (p) => p.art === art && p.von <= stichtag && (p.bis === null || stichtag <= p.bis),
  );
  if (!periode) {
    throw new RegelwerkLuecke(
      `Für ${ART_LABEL[art]} am ${stichtag} ist keine NoVA-Rechtslage-Periode hinterlegt.`,
    );
  }
  return periode;
}

/** Ordnet die Fahrzeugart der Art zu, nach der die Perioden geführt werden. */
export function periodenArt(f: Fahrzeugart): PeriodenArt {
  const zuordnung: Record<Fahrzeugart, PeriodenArt> = {
    pkw: 'pkw',
    'e-pkw': 'pkw',
    wohnmobil: 'pkw',
    n1: 'n1',
    motorrad: 'motorrad',
  };
  return zuordnung[f];
}
