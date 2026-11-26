/**
 * CO2-Formel (Pkw ab 2014-03-01, N1 2021-07-01 – 2025-06-30, Motorrad ab 2020):
 * Satz = round((CO2 − Abzugswert) / Divisor), min. 0, max. Höchstsatz;
 * NoVA = BG × Satz + Σ Malus − Abzugsposten (bzw. − Umweltbonus), nie negativ.
 *
 * Reihenfolge: (Befreiung, in nova.ts) → Kleinkraftrad → Messwert bzw. Ersatzwert →
 * Satz (gerundet, gedeckelt, ggf. Wohnmobil-Mindestsatz) → Malus → Abzugsposten.
 * Bei Wahlrechten (1,27 × NEFZ oder 2 × kW; Wohnmobil „SA") wird die günstigere Variante gewählt.
 */
import { NEFZ_ERSATZ_FAKTOR, type Co2Periode, type MalusStufe, type WohnmobilSA } from '@/regelwerk';
import { EingabeFehler } from './fehler';
import {
  abschliessen,
  begrenze,
  kleinkraftradErgebnis,
  kopiere,
  malusAusStufen,
  regelAngewendet,
  verlangeKraftstoff,
  type Ersatzwert,
  type NovaEingabe,
  type NovaErgebnis,
  type Protokoll,
  type Roh,
  zahl,
} from './nova-typen';
import { runde2, rundeProzent } from './runde';

type Kandidat =
  | {
      art: 'co2';
      co2: number;
      abzug: number;
      malus: readonly MalusStufe[];
      mindestsatz: number | null;
      ersatz: Ersatzwert;
      protokoll: Protokoll;
    }
  | { art: 'hubraum'; hubraum: number; abzugCm3: number; faktor: number; protokoll: Protokoll };

const VERFAHREN_FELD = { WLTP: 'co2Wltp', NEFZ: 'co2Nefz', WMTC: 'co2Wmtc' } as const;

function g(n: number): string {
  return `${zahl(runde2(n))} g/km`;
}

/** Wohnmobil „SA": kW-Wahl verfügbar? */
function saVerfuegbar(e: NovaEingabe, p: Co2Periode, prot: Protokoll): WohnmobilSA | null {
  if (e.art !== 'wohnmobil' || !e.wohnmobilSA) return null;
  const sa = p.wohnmobilSA;
  if (!sa) {
    prot.hinweise.push(`Wohnmobil „SA": in ${p.docId} keine Sonderregel (kW-Wahl erst ab 2020-01-01).`);
    return null;
  }
  if (sa.nurNichtSelbsttragend && e.wohnmobilNichtSelbsttragend !== true) {
    prot.hinweise.push(
      `Wohnmobil „SA": kW-Wahl in ${p.docId} nur bei Aufbau in nicht selbsttragender Bauweise – nicht angegeben, daher nicht angewendet.`,
    );
    return null;
  }
  return sa;
}

function kwKandidat(
  e: NovaEingabe & { kw: number },
  p: Co2Periode,
  faktor: number,
  mindestsatz: number | null,
  prot: Protokoll,
): Kandidat {
  const co2 = e.kw * faktor;
  const k = kopiere(prot);
  k.hinweise.push(`Ersatzwert: CO2 = ${zahl(faktor)} × ${zahl(e.kw)} kW = ${g(co2)}.`);
  return { art: 'co2', co2, abzug: p.abzugswert, malus: p.malus, mindestsatz, ersatz: 'kw2', protokoll: k };
}

/** Erste anwendbare Ersatzregel ohne CO2-Wert (Reihenfolge = Rangfolge). */
function ohneCo2Kandidat(
  e: NovaEingabe,
  p: Co2Periode,
  prot: Protokoll,
  wohnmobilMindestsatz: number | null,
): Kandidat | null {
  for (const regel of p.ohneCo2) {
    if (regel.art === 'verbrauch' && e.verbrauch !== undefined) {
      const diesel = verlangeKraftstoff(e, 'Ersatzwert aus dem Verbrauch') === 'diesel';
      const faktor = diesel ? regel.faktorDiesel : regel.faktorBenzinUndAndere;
      const co2 = e.verbrauch * faktor;
      const k = kopiere(prot);
      regelAngewendet(k, regel.status, `Ersatzwert ohne CO2-Wert aus dem Verbrauch (${regel.quelle})`);
      k.hinweise.push(`Ersatzwert: CO2 = ${zahl(e.verbrauch)} l/100 km × ${faktor} = ${g(co2)}.`);
      return { art: 'co2', co2, abzug: p.abzugswert, malus: p.malus, mindestsatz: null, ersatz: 'verbrauch', protokoll: k };
    }
    if (regel.art === 'kw' && e.kw !== undefined) {
      const k = kwKandidat({ ...e, kw: e.kw }, p, regel.faktor, wohnmobilMindestsatz, prot);
      regelAngewendet(k.protokoll, regel.status, `Ersatzwert ohne CO2-Wert ${regel.faktor} × kW (${regel.quelle})`);
      return k;
    }
    if (regel.art === 'hubraum' && e.hubraum !== undefined) {
      const k = kopiere(prot);
      regelAngewendet(k, regel.status, `Ohne CO2-Wert: Hubraum-Formel (${regel.quelle})`);
      k.hinweise.push(
        `Ohne WMTC-Wert: Satz nach Hubraum (${zahl(e.hubraum)} cm³ − ${regel.abzugCm3}) × ${zahl(regel.faktor)}.`,
      );
      return { art: 'hubraum', hubraum: e.hubraum, abzugCm3: regel.abzugCm3, faktor: regel.faktor, protokoll: k };
    }
  }
  return null;
}

function benoetigt(p: Co2Periode): string {
  const teile = [`${p.verfahren}-CO2-Wert`];
  if (p.nefz127Ersatz || p.nefzSonderregel) teile.push('NEFZ-Wert');
  for (const r of p.ohneCo2) {
    if (r.art === 'verbrauch') teile.push('Verbrauch (mit Kraftstoff)');
    if (r.art === 'kw') teile.push('kW');
    if (r.art === 'hubraum') teile.push('Hubraum');
  }
  return teile.join(' oder ');
}

function sammleKandidaten(e: NovaEingabe, p: Co2Periode, prot: Protokoll): Kandidat[] {
  const gemessen = e[VERFAHREN_FELD[p.verfahren]];
  const sa = saVerfuegbar(e, p, prot);
  const wohnmobilKw = e.art === 'wohnmobil' && p.wohnmobilSA ? p.wohnmobilSA : null;

  if (gemessen !== undefined) {
    const k: Kandidat[] = [
      { art: 'co2', co2: gemessen, abzug: p.abzugswert, malus: p.malus, mindestsatz: null, ersatz: null, protokoll: kopiere(prot) },
    ];
    if (sa && e.kw !== undefined) {
      const min = sa.mindestsatzGiltBei.includes('kw_wahl') ? sa.mindestsatzProzent : null;
      k.push(kwKandidat({ ...e, kw: e.kw }, p, sa.kwFaktor, min, prot));
    }
    return k;
  }

  const kandidaten: Kandidat[] = [];
  if (e.co2Nefz !== undefined && p.verfahren !== 'NEFZ') {
    const sonder = p.nefzSonderregel;
    if (sonder?.art === 'feste_werte') {
      const k = kopiere(prot);
      regelAngewendet(k, sonder.status, `NEFZ-Sonderregel (auslaufende Serie) mit festen Werten ${sonder.abzugGramm}/${sonder.malusSchwelleGramm} g (${sonder.quelle})`);
      k.warnungen.push('NEFZ-Sonderregel gilt nur für Fahrzeuge einer auslaufenden Serie.');
      k.hinweise.push(`Nur NEFZ-Wert: Abzug ${sonder.abzugGramm} g, Malusgrenze ${sonder.malusSchwelleGramm} g.`);
      const malus = p.malus.map((m) => ({ ...m, schwelleGramm: sonder.malusSchwelleGramm }));
      return [
        { art: 'co2', co2: e.co2Nefz, abzug: sonder.abzugGramm, malus, mindestsatz: null, ersatz: null, protokoll: k },
      ];
    }
    if (p.nefz127Ersatz) {
      const co2 = Number((NEFZ_ERSATZ_FAKTOR.faktor * e.co2Nefz).toPrecision(12));
      const k = kopiere(prot);
      regelAngewendet(k, NEFZ_ERSATZ_FAKTOR.status, `Ersatzwert 1,27 × NEFZ (${NEFZ_ERSATZ_FAKTOR.quelle})`);
      k.hinweise.push(`Ersatzwert: CO2 = ${zahl(NEFZ_ERSATZ_FAKTOR.faktor)} × NEFZ ${zahl(e.co2Nefz)} = ${g(co2)}.`);
      if (e.art === 'wohnmobil') {
        k.warnungen.push(
          'Wohnmobil mit 1,27 × NEFZ: ob der Mindestsatz 16 % auch hier gilt, ist nicht geklärt; nicht angewendet (Mindestsatz nur beim kW-Ansatz).',
        );
      }
      kandidaten.push({ art: 'co2', co2, abzug: p.abzugswert, malus: p.malus, mindestsatz: null, ersatz: 'nefz127', protokoll: k });
    } else {
      prot.hinweise.push(`NEFZ-Wert in ${p.docId} nicht als Ersatz zulässig (1,27 × NEFZ erst ab 2026-07-30).`);
    }
  }
  if (p.verfahren === 'NEFZ' && e.co2Wltp !== undefined) {
    prot.hinweise.push(`${p.docId} rechnet nach NEFZ; der WLTP-Wert wird nicht verwendet.`);
  }

  let wohnmobilMindestsatz: number | null = null;
  if (wohnmobilKw) {
    const gilt =
      wohnmobilKw.mindestsatzGiltBei.includes('ohne_co2_wert') ||
      (sa !== null && wohnmobilKw.mindestsatzGiltBei.includes('kw_wahl'));
    wohnmobilMindestsatz = gilt ? wohnmobilKw.mindestsatzProzent : null;
  }
  const ersatz = ohneCo2Kandidat(e, p, prot, wohnmobilMindestsatz);
  if (ersatz) kandidaten.push(ersatz);

  if (kandidaten.length === 0) {
    throw new EingabeFehler(
      `Für ${p.docId} fehlt der CO2-Wert; ein fehlender Wert wird nicht als 0 g/km gelesen. Benötigt: ${benoetigt(p)}.`,
    );
  }
  return kandidaten;
}

function abzugUndBonus(e: NovaEingabe, p: Co2Periode, prot: Protokoll): { abzugsposten: number; bonus: number } {
  const ub = p.umweltbonus;
  if (ub && e.bonusAntrieb && ub.antriebe.includes(e.bonusAntrieb)) {
    prot.hinweise.push(`Umweltbonus ${ub.maxEuro} € (${e.bonusAntrieb}) statt Abzugsposten.`);
    return { abzugsposten: 0, bonus: ub.maxEuro };
  }
  const ap = p.abzugsposten;
  if (!ap) return { abzugsposten: 0, bonus: 0 };
  if (ap.dieselEuro === ap.andereEuro) return { abzugsposten: ap.dieselEuro, bonus: 0 };
  const diesel = verlangeKraftstoff(e, `Abzugsposten in ${p.docId}`) === 'diesel';
  return { abzugsposten: diesel ? ap.dieselEuro : ap.andereEuro, bonus: 0 };
}

function rechne(e: NovaEingabe, p: Co2Periode, k: Kandidat): Roh {
  const prot = k.protokoll;
  let satz: number;
  let malus = 0;
  let ersatz: Ersatzwert;
  if (k.art === 'hubraum') {
    satz = begrenze(rundeProzent((k.hubraum - k.abzugCm3) * k.faktor), p.hoechstsatz.prozent);
    ersatz = 'hubraum';
  } else {
    const roh = (k.co2 - k.abzug) / p.divisor;
    satz = begrenze(rundeProzent(roh), p.hoechstsatz.prozent);
    if (roh < 0) prot.hinweise.push('Rechnerischer Satz negativ → 0 % (Annahme, siehe Regelwerk).');
    if (k.mindestsatz !== null && satz < k.mindestsatz) {
      prot.hinweise.push(`Wohnmobil: Mindestsatz ${k.mindestsatz} % beim kW-Ansatz (rechnerisch ${satz} %).`);
      satz = k.mindestsatz;
    }
    malus = malusAusStufen(k.co2, k.malus);
    ersatz = k.ersatz;
  }
  const { abzugsposten, bonus } = abzugUndBonus(e, p, prot);
  return { periodeId: p.docId, satz, bg: e.bg, malus, abzugsposten, bonus, befreit: false, ersatz, protokoll: prot };
}

export function berechneCo2(e: NovaEingabe, p: Co2Periode, basis: Protokoll): NovaErgebnis {
  const prot = kopiere(basis);
  const klein = kleinkraftradErgebnis(e, p.kleinkraftrad, p.docId, prot);
  if (klein) return klein;

  const kandidaten = sammleKandidaten(e, p, prot);
  const ergebnisse = kandidaten.map((k) => abschliessen(rechne(e, p, k), e.kuerzung));
  let best = ergebnisse[0];
  for (const r of ergebnisse.slice(1)) if (r.betrag < best.betrag) best = r;
  if (ergebnisse.length > 1) {
    const andere = ergebnisse
      .filter((r) => r !== best)
      .map((r) => `${r.ersatzwertGenutzt ?? 'Messwert'}: ${zahl(r.betrag)} €`)
      .join(', ');
    best.hinweise.push(`Wahlrecht: günstigere Variante gewählt (${best.ersatzwertGenutzt ?? 'Messwert'}; verworfen: ${andere}).`);
  }
  return best;
}
