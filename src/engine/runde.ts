/**
 * Kaufmännische Rundung (ROUND_HALF_UP, betragsmäßig symmetrisch) ohne Gleitkommafehler.
 *
 * Gleitkommazahlen stellen Dezimalwerte wie 1,005 nur näherungsweise dar
 * (1.005 * 100 = 100.49999999999999). Beide Funktionen runden deshalb zuerst auf
 * 12 signifikante Stellen (entfernt das Rauschen der Binärdarstellung und der
 * vorangegangenen Rechenschritte) und runden dann die exakte Dezimalzahl.
 * 12 Stellen reichen für Beträge bis 10^9 € mit Cent-Genauigkeit.
 */

const SIGNIFIKANTE_STELLEN = 12;

/** Entfernt Binär-Rauschen: 100.49999999999999 → 100.5, 11.000000000000002 → 11. */
function entrausche(n: number): number {
  return Number(n.toPrecision(SIGNIFIKANTE_STELLEN));
}

/** Rundet |n| kaufmännisch auf `stellen` Nachkommastellen; Vorzeichen bleibt. */
function rundeHalfUp(n: number, stellen: number): number {
  if (!Number.isFinite(n)) throw new RangeError(`Nicht rundbarer Wert: ${n}`);
  const vorzeichen = n < 0 ? -1 : 1;
  const faktor = 10 ** stellen;
  const skaliert = entrausche(entrausche(Math.abs(n)) * faktor);
  // `+ 0` normalisiert −0 zu 0.
  return (vorzeichen * Math.floor(skaliert + 0.5)) / faktor + 0;
}

/** Kaufmännisch auf Cent (2 Nachkommastellen): runde2(1.005) = 1.01. */
export function runde2(n: number): number {
  return rundeHalfUp(n, 2);
}

/** Kaufmännisch auf volle Prozent: rundeProzent(17.5) = 18. */
export function rundeProzent(n: number): number {
  return rundeHalfUp(n, 0);
}
