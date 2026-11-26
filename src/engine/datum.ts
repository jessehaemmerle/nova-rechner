/**
 * Gemeinsame ISO-Datumshelfer der Engine (`yyyy-mm-dd`, reine Kalenderarithmetik ohne Zeitzonen).
 */
import { pruefeIsoDatum } from '@/regelwerk/fehler';
import { EingabeFehler } from './fehler';

/** Prüft ein ISO-Datum (`pruefeIsoDatum`); ungültig → EingabeFehler statt TypeError. */
export function datum(name: string, v: string): string {
  try {
    pruefeIsoDatum(v);
  } catch {
    throw new EingabeFehler(`${name}: ungültiges Datum „${v}" (erwartet: JJJJ-MM-TT).`);
  }
  return v;
}

/** Zerlegt ein (bereits geprüftes) ISO-Datum in [Jahr, Monat, Tag]. */
export function teile(iso: string): [number, number, number] {
  return [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))];
}

export function istSchaltjahr(j: number): boolean {
  return (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0;
}

/** Letzter Tag des Monats `monat` (1..12) im Jahr `jahr`. */
function tageImMonat(jahr: number, monat: number): number {
  if (monat === 2) return istSchaltjahr(jahr) ? 29 : 28;
  return [4, 6, 9, 11].includes(monat) ? 30 : 31;
}

/**
 * Addiert `monate` Kalendermonate zu einem (geprüften) ISO-Datum: gleicher Tag im Zielmonat,
 * fehlt er dort, gilt der letzte Tag des Zielmonats (31.08. + 6 Monate = 28./29.02.).
 */
export function plusMonate(iso: string, monate: number): string {
  const [j, m, t] = teile(iso);
  const index = j * 12 + (m - 1) + monate;
  const zj = Math.floor(index / 12);
  const zm = (index % 12) + 1;
  const zt = Math.min(t, tageImMonat(zj, zm));
  return `${String(zj).padStart(4, '0')}-${String(zm).padStart(2, '0')}-${String(zt).padStart(2, '0')}`;
}
