/**
 * Typisierungs- und Zulassungsgebühren (Spezifikation § 5.7).
 * Belegt ist nur die Eintragung in die Genehmigungsdatenbank (ÖAMTC); alles andere sind
 * Annahmen. Überschriebene Beträge: Status der Vorgabe bleibt, außer ein belegter Posten
 * wird überschrieben – dann gilt er als `schaetzwert` (der Nutzerbetrag ist nicht belegt).
 */
import {
  COC,
  EINTRAGUNG,
  EINTRAGUNGSGEBUEHR,
  EINZELGENEHMIGUNG,
  GUTACHTEN_57A,
  KENNZEICHEN,
  ZULASSUNGSGEBUEHR,
  type GebuehrDef,
  type Weg,
} from '../regelwerk/gebuehren';
import { EingabeFehler } from './fehler';
import { pruefeBetrag, type Posten } from './posten';
import { runde2 } from './runde';

export interface GebuehrenEingabe {
  weg: Weg;
  einzelgenehmigung: boolean;
  gutachten57a: boolean;
  /** Direkt eingegebene Beträge in EUR je Posten-id. */
  ueberschrieben?: Partial<Record<string, number>>;
}

export function gebuehrenPosten(e: GebuehrenEingabe): Posten[] {
  const eintragung = EINTRAGUNG[e.weg];
  if (!eintragung) throw new EingabeFehler(`weg: Unbekannter Weg „${String(e.weg)}".`);
  const ue = e.ueberschrieben ?? {};
  for (const [id, wert] of Object.entries(ue)) {
    if (wert !== undefined) pruefeBetrag(`ueberschrieben.${id}`, wert);
  }

  const defs: GebuehrDef[] = [
    eintragung,
    ...(e.einzelgenehmigung ? [EINZELGENEHMIGUNG] : []),
    ...(e.gutachten57a ? [GUTACHTEN_57A] : []),
    COC,
    ZULASSUNGSGEBUEHR,
    KENNZEICHEN,
    EINTRAGUNGSGEBUEHR,
  ];

  return defs.map((d) => {
    const nutzer = ue[d.id];
    if (nutzer === undefined) {
      return { ...d, betrag: runde2(d.betrag) };
    }
    return {
      ...d,
      betrag: runde2(nutzer),
      status: 'schaetzwert',
      erklaerung: `${d.erklaerung} – vom Nutzer überschrieben (Vorgabe ${runde2(d.betrag)} €).`,
    };
  });
}
