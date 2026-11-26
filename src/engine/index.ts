export { EingabeFehler } from './fehler';
export { runde2, rundeProzent } from './runde';
export {
  berechneMitPeriode,
  berechneNova,
  type Ersatzwert,
  type Kraftstoff,
  type NovaEingabe,
  type NovaErgebnis,
  type NovaKuerzung,
} from './nova';
export {
  berechneNovaGebraucht,
  istJahrestag,
  rechtslageStichtag,
  volleJahre,
  wertminderungsFaktor,
  type GebrauchtKontext,
  type Herkunft,
  type NovaGebrauchtErgebnis,
  type RechtslageEingabe,
} from './wertminderung';
export { berechneZollUndEust, type ZollEingabe, type ZollErgebnis } from './zoll';
