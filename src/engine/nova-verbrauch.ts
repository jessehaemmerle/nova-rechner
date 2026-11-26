/**
 * Verbrauchsformel Pkw 2008-01-01 – 2014-02-28 (alle Perioden `nicht_verifiziert`):
 * Satz = round(Multiplikator × (Verbrauch − Abzug)), min. 0, max. 16 % (BMF-Lesart: Satzgrenze);
 * Grundbetrag = BG × Satz; danach Bonus/Malus (§ 6a bzw. § 14a).
 * Erhöhungsbetrag 20 % wird laut Regelwerk nicht angesetzt (`anzusetzen: false`), nur gewarnt.
 */
import type { Hoechstsatz, VerbrauchPeriode } from '@/regelwerk';
import { EingabeFehler } from './fehler';
import {
  abschliessen,
  begrenze,
  kopiere,
  malusAusStufen,
  regelAngewendet,
  verlangeKraftstoff,
  type Ersatzwert,
  type NovaEingabe,
  type NovaErgebnis,
  type Protokoll,
  zahl,
} from './nova-typen';
import { rundeProzent } from './runde';

function satzAusVerbrauch(
  e: NovaEingabe,
  p: VerbrauchPeriode,
  diesel: boolean,
  prot: Protokoll,
): { satz: number; verbrauch: number | undefined; ausKw: boolean } {
  const max = p.hoechstsatz.prozent;
  const abzug = diesel ? p.verbrauchAbzug.diesel : p.verbrauchAbzug.benzinUndAndere;
  const ausVerbrauch = (v: number) => begrenze(rundeProzent(p.multiplikator * (v - abzug)), max);
  if (e.verbrauch !== undefined) return { satz: ausVerbrauch(e.verbrauch), verbrauch: e.verbrauch, ausKw: false };

  const ov = p.ohneVerbrauch;
  if (e.kw === undefined) {
    throw new EingabeFehler(
      `Für ${p.docId} fehlt der Verbrauch; der Ersatz ohne Verbrauchsnachweis braucht die Leistung (kW).`,
    );
  }
  if (ov.art === 'satz_aus_kw') {
    regelAngewendet(prot, ov.status, `Ohne Verbrauchsnachweis: Satz = ${zahl(ov.faktor)} × kW (${ov.quelle})`);
    return { satz: begrenze(rundeProzent(ov.faktor * e.kw), max), verbrauch: undefined, ausKw: true };
  }
  const zuschlag = diesel ? ov.zuschlagDiesel : ov.zuschlagBenzinUndAndere;
  const verbrauch = e.kw / ov.kwDivisor + zuschlag;
  regelAngewendet(prot, ov.status, `Ohne Verbrauchsnachweis: Verbrauch = kW / ${ov.kwDivisor} + ${zuschlag} (${ov.quelle})`);
  prot.hinweise.push(
    `Ersatzwert: Verbrauch = ${zahl(e.kw)} kW / ${ov.kwDivisor} + ${zuschlag} = ${zahl(verbrauch)} l/100 km.`,
  );
  return { satz: ausVerbrauch(verbrauch), verbrauch, ausKw: true };
}

export function berechneVerbrauch(e: NovaEingabe, p: VerbrauchPeriode, basis: Protokoll): NovaErgebnis {
  const prot = kopiere(basis);
  const diesel = verlangeKraftstoff(e, `Verbrauchsabzug in ${p.docId}`) === 'diesel';
  let ersatz: Ersatzwert = null;

  // Satz aus Verbrauch (bzw. Ersatz ohne Verbrauchsnachweis)
  const { satz, verbrauch, ausKw } = satzAusVerbrauch(e, p, diesel, prot);
  if (ausKw) ersatz = 'kw';

  // CO2 (nur für Bonus/Malus)
  let co2 = e.co2Nefz;
  let malus = 0;
  let bonus = 0;
  const bonusMalus = p.co2Malus.length > 0;
  if (co2 === undefined && bonusMalus) {
    const oc = p.ohneCo2;
    if (oc?.art === 'kw_malus') {
      if (e.kw === undefined) {
        throw new EingabeFehler(`Für ${p.docId} fehlt der CO2-Wert; der Ersatz-Malus ohne CO2-Wert braucht die Leistung (kW).`);
      }
      regelAngewendet(prot, oc.status, `Ohne CO2-Wert: Malus ${oc.euroProKw} €/kW über ${oc.abKw} kW (${oc.quelle})`);
      malus += Math.max(0, e.kw - oc.abKw) * oc.euroProKw;
      ersatz ??= 'kw';
    } else if (oc?.art === 'verbrauch' && verbrauch !== undefined) {
      const faktor = diesel ? oc.faktorDiesel : oc.faktorBenzinUndAndere;
      co2 = verbrauch * faktor;
      regelAngewendet(prot, oc.status, `Ohne CO2-Wert: CO2 = Verbrauch × ${faktor} (${oc.quelle})`);
      prot.hinweise.push(`Ersatzwert: CO2 = ${zahl(verbrauch)} l/100 km × ${faktor} = ${zahl(co2)} g/km.`);
      ersatz ??= 'verbrauch';
    } else {
      throw new EingabeFehler(`Für ${p.docId} fehlt der CO2-Wert (NEFZ/Typenschein) für Bonus/Malus.`);
    }
  }
  if (co2 !== undefined) malus += malusAusStufen(co2, p.co2Malus);

  // Boni (§ 6a)
  let boni = 0;
  if (p.co2Bonus && co2 !== undefined && co2 < p.co2Bonus.unterGramm) {
    boni += p.co2Bonus.euro;
    prot.hinweise.push(`CO2-Bonus ${p.co2Bonus.euro} € (CO2 < ${p.co2Bonus.unterGramm} g/km).`);
  }
  const np = p.noxPartikelBonus;
  if (np) {
    const nox = e.noxMgProKm;
    if (nox === undefined) {
      prot.warnungen.push('NOx-Wert fehlt: NOx/Partikel-Bonus nicht geprüft (nicht angesetzt).');
    } else if (diesel) {
      if (nox <= np.dieselNoxMaxMg) {
        if (e.partikelGProKm === undefined) {
          prot.warnungen.push('Partikelwert fehlt: NOx/Partikel-Bonus (Diesel) nicht geprüft (nicht angesetzt).');
        } else if (e.partikelGProKm <= np.dieselPartikelMaxGProKm) {
          boni += np.maxEuro;
          prot.hinweise.push(`NOx/Partikel-Bonus ${np.maxEuro} €.`);
        }
      }
    } else if (nox <= np.benzinNoxMaxMg) {
      boni += np.maxEuro;
      prot.hinweise.push(`NOx-Bonus ${np.maxEuro} €.`);
    }
  }
  if (p.oekoBonus && e.bonusAntrieb && p.oekoBonus.antriebe.includes(e.bonusAntrieb)) {
    boni += p.oekoBonus.maxEuro;
    prot.hinweise.push(`Ökobonus ${p.oekoBonus.maxEuro} € (${e.bonusAntrieb}).`);
  }
  if (p.bonusSummeMaxEuro !== null && boni > p.bonusSummeMaxEuro) {
    prot.hinweise.push(`Summe der Boni auf ${p.bonusSummeMaxEuro} € begrenzt.`);
    boni = p.bonusSummeMaxEuro;
  }
  bonus += boni;

  // Diesel-Partikel (§ 6a Malus bzw. § 14a)
  if (diesel && p.dieselPartikelMalus) {
    const pm = p.dieselPartikelMalus;
    if (e.partikelGProKm === undefined) {
      prot.warnungen.push(
        `Partikelwert fehlt: Partikel-Malus (+${pm.euro} € über ${zahl(pm.grenzwertGProKm)} g/km) nicht geprüft.`,
      );
    } else if (e.partikelGProKm > pm.grenzwertGProKm) {
      malus += pm.euro;
      prot.hinweise.push(`Partikel-Malus ${pm.euro} €.`);
    }
  }
  if (diesel && p.partikel14a) {
    const pa = p.partikel14a;
    if (e.partikelGProKm === undefined) {
      prot.warnungen.push('Partikelwert fehlt: Partikel-Bonus/-Malus nach § 14a nicht geprüft.');
    } else if (e.partikelGProKm <= pa.grenzwertGProKm) {
      bonus += pa.bonusEuro;
      prot.hinweise.push(`Partikel-Bonus § 14a ${pa.bonusEuro} € (RIS; BMF nennt ${pa.bonusEuroBmf} €).`);
    } else {
      const m = Math.min((e.bg * pa.malusProzentDerBg) / 100, pa.malusMaxEuro);
      malus += m;
      prot.hinweise.push(`Partikel-Malus § 14a ${zahl(pa.malusProzentDerBg)} % der BG, max. ${pa.malusMaxEuro} €.`);
    }
  }

  pruefeErhoehungsbetrag(p.erhoehungsbetrag, prot);
  pruefeHoechstsatzWortlaut(p.hoechstsatz, prot);

  return abschliessen(
    { periodeId: p.docId, satz, bg: e.bg, malus, abzugsposten: 0, bonus, befreit: false, ersatz, protokoll: prot },
    e.kuerzung,
  );
}

/** Vor 2014-03-01 lautet die 16-%-Grenze im Gesetz auf den Betrag; gerechnet wird sie als Satzgrenze. */
export function pruefeHoechstsatzWortlaut(h: Hoechstsatz, prot: Protokoll): void {
  if (h.wortlaut !== 'betrag') return;
  prot.warnungen.push(
    `${h.prozent}-%-Grenze lautet im Gesetz auf den Betrag („Die Abgabe beträgt höchstens ${h.prozent}% der Bemessungsgrundlage"); gerechnet als Grenze für den Satz (BMF-Lesart, Status: ${h.status}).`,
  );
}

/** Erhöhungsbetrag: laut Regelwerk nicht anzusetzen → Warnung; anderes ist nicht implementiert. */
export function pruefeErhoehungsbetrag(
  eb: { prozent: number; anzusetzen: boolean; status: string } | null,
  prot: Protokoll,
): void {
  if (!eb) return;
  if (eb.anzusetzen) {
    throw new Error('Erhöhungsbetrag mit anzusetzen: true ist in der Engine nicht implementiert.');
  }
  prot.warnungen.push(
    `Erhöhungsbetrag ${eb.prozent} % (§ 6 Abs. 6, wenn NoVA nicht Teil der USt-BG) nicht angesetzt (EuGH C-433/09, Praxis umstritten); mit Erhöhungsbetrag wäre die NoVA höher.`,
  );
}
