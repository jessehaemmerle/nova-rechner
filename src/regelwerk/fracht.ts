/**
 * Richtwerte für Transport und Verschiffung (Spezifikation § 5.6).
 *
 * ACHTUNG: Alle Beträge sind Annahmen (konservativ, gerundet), keine recherchierten oder
 * belegten Preise. Sie dienen nur zur Vorbefüllung und müssen durch ein Angebot ersetzt werden.
 */
import { STAND } from './nova-perioden-gemeinsam';
import type { Laenderkuerzel } from './ust-saetze';
import type { Beleg } from './types';

export type RouteId =
  | 'usa-bremerhaven'
  | 'usa-koper'
  | 'japan-koper'
  | 'uk-bremerhaven'
  | 'dubai-koper';

export type FrachtArt = 'roro' | 'container';
export type FahrzeugKlasse = 'klein' | 'mittel' | 'gross';

/** Vorgabewerte (EUR) für die ortsabhängigen Posten einer Route. */
export interface RoutenVorgaben {
  vorlauf: number;
  hafen: number;
  spedition: number;
  nachlauf: number;
}

export interface Route {
  id: RouteId;
  label: string;
  /** Einfuhrhafen-Land = Ort der Einfuhrabfertigung (EUSt-Satz). */
  einfuhrLand: Exclude<Laenderkuerzel, 'AT'>;
  vorgaben: RoutenVorgaben;
}

export const QUELLE_RICHTWERT = 'Richtwert (Annahme), keine Preisquelle geprüft; bitte Angebot einholen';

/** Beleg aller Richtwerte dieser Datei: immer Schätzwert. */
export const BELEG_RICHTWERT: Beleg = {
  quelle: QUELLE_RICHTWERT,
  stand: STAND,
  status: 'schaetzwert',
};

export const ROUTEN: readonly Route[] = [
  {
    id: 'usa-bremerhaven',
    label: 'USA → Bremerhaven (DE)',
    einfuhrLand: 'DE',
    vorgaben: { vorlauf: 400, hafen: 350, spedition: 300, nachlauf: 900 },
  },
  {
    id: 'usa-koper',
    label: 'USA → Koper (SI)',
    einfuhrLand: 'SI',
    vorgaben: { vorlauf: 400, hafen: 300, spedition: 300, nachlauf: 500 },
  },
  {
    id: 'japan-koper',
    label: 'Japan → Koper (SI)',
    einfuhrLand: 'SI',
    vorgaben: { vorlauf: 300, hafen: 300, spedition: 300, nachlauf: 500 },
  },
  {
    id: 'uk-bremerhaven',
    label: 'Vereinigtes Königreich → Bremerhaven (DE)',
    einfuhrLand: 'DE',
    vorgaben: { vorlauf: 250, hafen: 350, spedition: 300, nachlauf: 900 },
  },
  {
    id: 'dubai-koper',
    label: 'Dubai (VAE) → Koper (SI)',
    einfuhrLand: 'SI',
    vorgaben: { vorlauf: 250, hafen: 300, spedition: 300, nachlauf: 500 },
  },
];

/** Seefracht in EUR je Route, Art und Fahrzeugklasse (klein = z. B. Motorrad, mittel = Pkw, gross = Van/SUV). */
export const FRACHT_EUR: Record<RouteId, Record<FrachtArt, Record<FahrzeugKlasse, number>>> = {
  'usa-bremerhaven': {
    roro: { klein: 900, mittel: 1100, gross: 1500 },
    container: { klein: 1500, mittel: 1800, gross: 2300 },
  },
  'usa-koper': {
    roro: { klein: 1100, mittel: 1350, gross: 1800 },
    container: { klein: 1700, mittel: 2000, gross: 2600 },
  },
  'japan-koper': {
    roro: { klein: 1300, mittel: 1600, gross: 2100 },
    container: { klein: 2000, mittel: 2400, gross: 3000 },
  },
  'uk-bremerhaven': {
    roro: { klein: 400, mittel: 500, gross: 700 },
    container: { klein: 800, mittel: 1000, gross: 1300 },
  },
  'dubai-koper': {
    roro: { klein: 1000, mittel: 1250, gross: 1700 },
    container: { klein: 1600, mittel: 1900, gross: 2500 },
  },
};

/** Annahme: Transportversicherung 1,5 % des Warenwerts. */
export const VERSICHERUNG_SATZ_VORGABE = 0.015;

/** ÖAMTC: Überstellung mit ausländischem Kennzeichen 100–150 € (belegte Spanne). */
export const UEBERSTELLUNG_SPANNE = { von: 100, bis: 150 } as const;
/** Annahme innerhalb der belegten Spanne. */
export const UEBERSTELLUNG_VORGABE = 125;
