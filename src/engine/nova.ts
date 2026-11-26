/**
 * Öffentlicher Einstieg der NoVA-Berechnung je Rechtslage-Periode.
 * Formel-Familien: nova-co2.ts (CO2), nova-verbrauch.ts (Verbrauch vor 2014),
 * nova-motorrad.ts (Hubraum vor 2020). Gebrauchtwagen-Wertentwicklung und Wahl des
 * Rechtslage-Stichtags (Erstzulassung, Übergangsregeln) liegen beim Aufrufer (Task 5);
 * hier wird nur ein übergebener Kürzungsfaktor angewendet.
 */
import {
  NOVA_PERIODEN,
  RegelwerkLuecke,
  periodenArt,
  selectNovaPeriode,
  type NovaPeriode,
  type VerweisPeriode,
} from '@/regelwerk';
import { EingabeFehler } from './fehler';
import { berechneCo2 } from './nova-co2';
import { berechneHubraum } from './nova-motorrad';
import {
  abschliessen,
  kopiere,
  neuesProtokoll,
  nullErgebnis,
  regelAngewendet,
  type NovaEingabe,
  type NovaErgebnis,
  type Protokoll,
} from './nova-typen';
import { berechneVerbrauch } from './nova-verbrauch';

export type { Ersatzwert, Kraftstoff, NovaEingabe, NovaErgebnis, NovaKuerzung } from './nova-typen';

/** Wählt die Periode zum Stichtag und berechnet die NoVA. */
export function berechneNova(e: NovaEingabe): NovaErgebnis {
  validiere(e);
  return berechneMitPeriode(e, selectNovaPeriode(periodenArt(e.art), e.stichtag));
}

/** Berechnet die NoVA mit einer vorgegebenen Periode (`e.stichtag` wird nur für Verweise genutzt). */
export function berechneMitPeriode(e: NovaEingabe, p: NovaPeriode): NovaErgebnis {
  validiere(e);
  const prot = neuesProtokoll(p.status);
  if (p.status !== 'belegt') {
    prot.warnungen.push(
      `Periode ${p.docId} ist nicht verifiziert (Status: ${p.status}); Erläuterungen in den Hinweisen der Periode im Regelwerk.`,
    );
  }

  if (p.formel === 'verweis_pkw') return verweis(e, p, prot);

  if (istBefreit(e)) {
    prot.hinweise.push(
      'CO2 = 0 g/km (Elektro/Wasserstoff): von der NoVA befreit (BMF „Befreiung", Spezifikation 5.2; § 3 NoVAG nicht Teil der Recherche).',
    );
    return abschliessen(nullErgebnis(p.docId, prot, true), undefined);
  }

  switch (p.formel) {
    case 'co2': {
      const sonder = p.nefzSonderregel;
      if (sonder?.art === 'fruehere_rechtslage' && e.co2Wltp === undefined && e.co2Nefz !== undefined) {
        const ziel = periodeNachId(sonder.docId);
        const r = berechneMitPeriode(e, ziel);
        const p2: Protokoll = { status: r.status, hinweise: r.hinweise, warnungen: r.warnungen };
        regelAngewendet(p2, sonder.status, `NEFZ-only in ${p.docId}: weiter Rechtslage ${ziel.docId} (${sonder.quelle})`);
        r.status = p2.status;
        r.hinweise.unshift(`Nur NEFZ-Wert in ${p.docId}: gerechnet nach ${ziel.docId} (${sonder.quelle}).`);
        r.warnungen.push(
          `Weitergeltung von ${ziel.docId} nur für Fahrzeuge einer auslaufenden Serie (§ 15 Abs. 22) – sonst ist ein WLTP-Wert bzw. 2 × kW anzusetzen.`,
        );
        return r;
      }
      return berechneCo2(e, p, prot);
    }
    case 'verbrauch':
      return berechneVerbrauch(e, p, prot);
    case 'hubraum':
      return berechneHubraum(e, p, prot);
  }
}

/** N1 ohne eigene Formel: steuerbar nur unter Bedingung, dann Pkw-Periode zum selben Stichtag. */
function verweis(e: NovaEingabe, p: VerweisPeriode, prot: Protokoll): NovaErgebnis {
  const b = p.steuerbarWenn;
  if (b.art === 'zolltarif') {
    if (e.zolltarif8703 !== true) {
      prot.hinweise.push(
        `${p.docId}: N1 nur steuerbar bei Einreihung in KN-Position ${b.position} (Personenbeförderung); ${p.nichtSteuerbar.join(', ')} sind nicht steuerbar → keine NoVA.`,
      );
      if (e.zolltarif8703 === undefined) {
        prot.warnungen.push(
          `Einreihung in KN ${b.position} nicht bestätigt: ohne Bestätigung wird keine NoVA angesetzt. Bei KN ${b.position} wäre nach den Pkw-Zeilen zu rechnen.`,
        );
      }
      return abschliessen(nullErgebnis(p.docId, prot, true), undefined);
    }
  }
  const pkw = selectNovaPeriode('pkw', e.stichtag);
  const r = berechneMitPeriode(e, pkw);
  const vorspann: string[] = [`${p.docId}: N1 rechnet nach den Pkw-Zeilen (${pkw.docId}).`];
  if (b.art === 'zolltarif') {
    vorspann.push(`Einreihung KN ${b.position} laut Eingabe bestätigt.`);
    const p2: Protokoll = { status: r.status, hinweise: r.hinweise, warnungen: r.warnungen };
    regelAngewendet(p2, p.einreihungStatus, `Einreihung in KN ${b.position} ist eine Einzelfallfrage`);
    r.status = p2.status;
  } else {
    vorspann.push(
      `Steuerbar als Kfz zur Personenbeförderung mit ${b.sitzplaetzeMin}–${b.sitzplaetzeMax} Sitzplätzen, ≤ ${b.hoechstgewichtKg} kg. Nicht steuerbar: ${p.nichtSteuerbar.join('; ')}.`,
    );
  }
  r.hinweise.unshift(...vorspann);
  r.warnungen.unshift(...kopiere(prot).warnungen);
  return r;
}

function periodeNachId(docId: string): NovaPeriode {
  const p = NOVA_PERIODEN.find((x) => x.docId === docId);
  if (!p) throw new RegelwerkLuecke(`Periode ${docId} ist im Regelwerk nicht hinterlegt.`);
  return p;
}

/** Befreiung nur bei ausdrücklichem CO2 = 0; ein fehlender Wert ist nie 0 g/km. */
function istBefreit(e: NovaEingabe): boolean {
  const werte = [e.co2Wltp, e.co2Nefz, e.co2Wmtc].filter((v): v is number => v !== undefined);
  const null0 = werte.some((v) => v === 0);
  const positiv = werte.some((v) => v > 0);
  if (null0 && positiv) {
    throw new EingabeFehler('Widersprüchliche CO2-Werte: ein Wert ist 0 g/km, ein anderer größer 0.');
  }
  if (e.art === 'e-pkw') {
    if (positiv) {
      throw new EingabeFehler('Elektro/Wasserstoff-Pkw mit CO2 > 0 g/km: bitte als Pkw (z. B. Hybrid) erfassen.');
    }
    if (!null0) {
      throw new EingabeFehler('Elektro/Wasserstoff-Pkw: CO2-Wert 0 g/km ausdrücklich angeben (fehlender Wert ≠ 0 g/km).');
    }
  }
  return null0;
}

function validiere(e: NovaEingabe): void {
  const nichtNegativ = (name: string, v: number | undefined) => {
    if (v !== undefined && !(Number.isFinite(v) && v >= 0)) {
      throw new EingabeFehler(`${name} muss eine Zahl ≥ 0 sein (erhalten: ${v}).`);
    }
  };
  const positiv = (name: string, v: number | undefined) => {
    if (v !== undefined && !(Number.isFinite(v) && v > 0)) {
      throw new EingabeFehler(`${name} muss eine Zahl > 0 sein (erhalten: ${v}).`);
    }
  };
  if (!Number.isFinite(e.bg) || e.bg < 0) {
    throw new EingabeFehler(`Bemessungsgrundlage muss eine Zahl ≥ 0 sein (erhalten: ${e.bg}).`);
  }
  nichtNegativ('CO2 (WLTP)', e.co2Wltp);
  nichtNegativ('CO2 (NEFZ)', e.co2Nefz);
  nichtNegativ('CO2 (WMTC)', e.co2Wmtc);
  nichtNegativ('Verbrauch', e.verbrauch);
  nichtNegativ('NOx', e.noxMgProKm);
  nichtNegativ('Partikel', e.partikelGProKm);
  positiv('Leistung (kW)', e.kw);
  positiv('Hubraum', e.hubraum);
  if (e.kuerzung) {
    const f = e.kuerzung.faktor;
    if (!Number.isFinite(f) || f < 0 || f > 1) {
      throw new EingabeFehler(`Kürzungsfaktor muss zwischen 0 und 1 liegen (erhalten: ${f}).`);
    }
  }
}
