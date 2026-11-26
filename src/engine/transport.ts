/**
 * Transport- und Verschiffungskosten (Spezifikation § 5.6).
 *
 * Jeder Posten hat einen Vorgabewert (Richtwert, Annahme) und kann per `ueberschrieben`
 * ersetzt werden. Der Status bleibt der der Vorgabe (es gibt keinen Status „Nutzereingabe");
 * ein überschriebener Wert wird in der `erklaerung` ausdrücklich vermerkt, ein belegter
 * Wert würde auf `schaetzwert` zurückgestuft (der Nutzerbetrag ist nicht die Quelle).
 */
import {
  BELEG_RICHTWERT,
  FRACHT_EUR,
  ROUTEN,
  UEBERSTELLUNG_SPANNE,
  UEBERSTELLUNG_VORGABE,
  VERSICHERUNG_SATZ_VORGABE,
  type FahrzeugKlasse,
  type FrachtArt,
  type Route,
  type RouteId,
} from '../regelwerk/fracht';
import type { Wert } from '../regelwerk/types';
import { EingabeFehler } from './fehler';
import { pruefeBetrag, type Posten } from './posten';
import { runde2 } from './runde';

export { ROUTEN, type FahrzeugKlasse, type FrachtArt, type Route, type RouteId };
export type { Posten, Wert };

export type TransportFeld =
  | 'vorlauf'
  | 'seefracht'
  | 'hafen'
  | 'versicherung'
  | 'spedition'
  | 'nachlauf'
  | 'ueberstellung';

export interface TransportEingabe {
  route: RouteId;
  art: FrachtArt;
  klasse: FahrzeugKlasse;
  /** Warenwert (Kaufpreis) in EUR, Basis der Transportversicherung. */
  warenwertEur: number;
  /** Versicherungssatz als Anteil 0..1 (Vorgabe 0.015 = 1,5 %, Annahme). */
  versicherungssatz?: number;
  /** Direkt eingegebene Beträge in EUR; ersetzen die Vorgabe des jeweiligen Postens. */
  ueberschrieben?: Partial<Record<TransportFeld, number>>;
}

function findeRoute(id: RouteId): Route {
  const r = ROUTEN.find((x) => x.id === id);
  if (!r) throw new EingabeFehler(`route: Unbekannte Route „${String(id)}".`);
  return r;
}

/**
 * Richtwert für die Seefracht in EUR. `Wert.satz` trägt hier den Betrag in EUR
 * (kein Anteil); Status immer `schaetzwert`.
 */
export function richtwertFracht(route: RouteId, art: FrachtArt, klasse: FahrzeugKlasse): Wert {
  findeRoute(route);
  const betrag = FRACHT_EUR[route]?.[art]?.[klasse];
  if (betrag === undefined) {
    throw new EingabeFehler(`Keine Frachtannahme für ${String(route)}/${String(art)}/${String(klasse)}.`);
  }
  return {
    ...BELEG_RICHTWERT,
    satz: betrag,
    hinweis: 'satz = Betrag in EUR (Seefracht je Fahrzeug), keine Prozentangabe',
  };
}

export function transportPosten(e: TransportEingabe): Posten[] {
  const route = findeRoute(e.route);
  pruefeBetrag('warenwertEur', e.warenwertEur);
  const satz = e.versicherungssatz ?? VERSICHERUNG_SATZ_VORGABE;
  if (!Number.isFinite(satz) || satz < 0 || satz > 1) {
    throw new EingabeFehler(
      `versicherungssatz: Anteil zwischen 0 und 1 erwartet, z. B. 0.015 für 1,5 % (erhalten: ${satz}).`,
    );
  }
  const ue = e.ueberschrieben ?? {};
  for (const [feld, wert] of Object.entries(ue)) {
    if (wert !== undefined) pruefeBetrag(`ueberschrieben.${feld}`, wert);
  }

  const fracht = richtwertFracht(e.route, e.art, e.klasse);
  const quelleRichtwert = fracht.quelle;

  const posten = (
    id: TransportFeld,
    label: string,
    vorgabe: number,
    erklaerung: string,
    quelle: string,
  ): Posten => {
    const nutzer = ue[id];
    return {
      id,
      label,
      betrag: runde2(nutzer ?? vorgabe),
      status: 'schaetzwert',
      erklaerung: nutzer === undefined ? erklaerung : `${erklaerung} – vom Nutzer überschrieben.`,
      quelle,
    };
  };

  return [
    posten(
      'vorlauf',
      'Vorlauf im Ursprungsland',
      route.vorgaben.vorlauf,
      'Transport vom Standort des Fahrzeugs zum Verladehafen (Annahme).',
      quelleRichtwert,
    ),
    posten(
      'seefracht',
      `Seefracht (${e.art === 'roro' ? 'RoRo' : 'Container'})`,
      fracht.satz,
      `Seefracht ${route.label}, Klasse ${e.klasse} (Annahme, Stand ${fracht.stand}).`,
      quelleRichtwert,
    ),
    posten(
      'hafen',
      'Hafen- und Terminalgebühren',
      route.vorgaben.hafen,
      'Umschlag, Terminal- und Dokumentengebühren im Verlade- und Einfuhrhafen (Annahme).',
      quelleRichtwert,
    ),
    posten(
      'versicherung',
      'Transportversicherung',
      e.warenwertEur * satz,
      `${runde2(satz * 100)} % vom Warenwert ${runde2(e.warenwertEur)} € (Annahme).`,
      quelleRichtwert,
    ),
    posten(
      'spedition',
      'Spedition / Zollagent',
      route.vorgaben.spedition,
      'Zollabfertigung und Speditionsleistung (Annahme).',
      quelleRichtwert,
    ),
    posten(
      'nachlauf',
      'Nachlauf bis Österreich',
      route.vorgaben.nachlauf,
      `Transport vom Einfuhrhafen (${route.einfuhrLand}) bis Österreich (Annahme).`,
      quelleRichtwert,
    ),
    posten(
      'ueberstellung',
      'Überstellung (ausländisches Kennzeichen)',
      UEBERSTELLUNG_VORGABE,
      `ÖAMTC nennt ${UEBERSTELLUNG_SPANNE.von}–${UEBERSTELLUNG_SPANNE.bis} € (belegte Spanne); ${UEBERSTELLUNG_VORGABE} € ist eine Annahme innerhalb dieser Spanne.`,
      `ÖAMTC: Überstellung mit ausländischem Kennzeichen ${UEBERSTELLUNG_SPANNE.von}–${UEBERSTELLUNG_SPANNE.bis} € (Spanne belegt, Wert innerhalb der Spanne ist eine Annahme)`,
    ),
  ];
}
