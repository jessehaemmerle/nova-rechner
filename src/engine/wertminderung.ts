/**
 * Gebrauchtfahrzeuge: Rechtslage-Stichtag (EU: Erstzulassung, Drittland: Zulassung, Übergangsregeln)
 * und Kürzung um die Wertentwicklung bei EU/EWR-Import. Rechnet über `berechneNova` (Task 4).
 *
 * BMF „NoVA-Steuersatz" (https://www.bmf.gv.at/themen/steuern/kraftfahrzeuge/normverbrauchsabgabe-uebersicht/nova-steuersatz.html,
 * gegengelesen 2026-11-26):
 * - „… anhand der Rechtslage zu berechnen, die zum Zeitpunkt der erstmaligen Zulassung im übrigen
 *   Unionsgebiet in Österreich gültig war."
 * - „Ist … auch der ursprüngliche Neuwagenwert bekannt, wird der Bonus/Malus sowie der Abzugsposten
 *   um den entsprechenden Wertverlust reduziert. Es wird nur der aliquote Anteil angesetzt."
 * - „Ist der Neuwagenwert nicht bekannt, erfolgt die Berücksichtigung der Wertentwicklung durch eine
 *   Achtelung: Pro vollem abgelaufenen Jahr wird der Bonus/Malus und der Abzugsposten um ein Achtel
 *   reduziert. Nach sieben Jahren bleibt stets ein Achtel bestehen …"
 * - Übergangsregelung: Kaufvertrag vor dem 1. Dezember, Lieferung bzw. ig. Erwerb vor dem 1. April des
 *   Folgejahres → Rechtslage bis 31. Dezember. Laut Recherche-Dokument § 0.2 gilt das nur für
 *   Jahreswechsel ab 2022; Reformstichtage haben eigene Fristen (R20 § 15). Beides steht als Daten in
 *   `NovaPeriode.uebergang` und wird hier nur ausgewertet.
 */
import {
  NOVA_PERIODEN,
  RegelwerkLuecke,
  WERTENTWICKLUNG_VERFAHREN,
  periodenArt,
  selectNovaPeriode,
  selectWertentwicklungUmfang,
  type PeriodenArt,
  type Uebergang,
} from '@/regelwerk';
import { pruefeIsoDatum } from '@/regelwerk/fehler';
import { EingabeFehler } from './fehler';
import { berechneNova } from './nova';
import { schlechterer, zahl, type NovaEingabe, type NovaErgebnis, type NovaKuerzung } from './nova-typen';

export type Herkunft = 'EU' | 'DRITTLAND';

export interface RechtslageEingabe {
  herkunft: Herkunft;
  /** Erstmalige Zulassung im übrigen Unionsgebiet (nur EU; bei Drittland ignoriert). */
  erstzulassung?: string;
  /** Zulassung bzw. Lieferung im Inland (ISO). */
  zulassung: string;
  /** Unwiderruflicher schriftlicher Kaufvertrag (Übergangsregel, nur Drittland). */
  vertrag?: string;
  /** Lieferung bzw. innergemeinschaftlicher Erwerb (Übergangsregel, nur Drittland). */
  lieferung?: string;
  /** Periodenart für die Übergangsregel; Standard Pkw. */
  art?: PeriodenArt;
  /** Heutiges Datum (ISO) für die Prüfung „Erstzulassung nicht in der Zukunft"; Standard: UTC-Datum jetzt. */
  heute?: string;
}

export interface GebrauchtKontext extends Omit<RechtslageEingabe, 'art'> {
  /** Ursprünglicher Neuwagenwert (EUR); bekannt → Faktor = BG / Neuwagenwert. */
  neuwagenwert?: number;
}

export interface NovaGebrauchtErgebnis extends NovaErgebnis {
  /** Stichtag, nach dessen Rechtslage gerechnet wurde. */
  rechtslageStichtag: string;
  /** Angewendeter Faktor (1 = keine Kürzung, z. B. Drittland). */
  wertminderungsFaktor: number;
  /** Volle Jahre seit Erstzulassung (nur EU), sonst null. */
  volleJahre: number | null;
  /** Umfang der Kürzung; null, wenn nicht gekürzt (Drittland, Faktor 1). */
  kuerzungUmfang: NovaKuerzung['umfang'] | null;
  /** Angewendete Übergangsregel, sonst null. */
  uebergang: Uebergang | null;
}

/**
 * Kürzungsfaktor der Wertentwicklung (Daten: `WERTENTWICKLUNG_VERFAHREN`).
 * - Neuwagenwert bekannt: `bg / neuwagenwert`, gedeckelt auf 0..1.
 * - sonst: `max(1/8, 1 − vollJahre/8)`.
 */
export function wertminderungsFaktor(vollJahre: number, bg?: number, neuwagenwert?: number): number {
  if (!Number.isInteger(vollJahre) || vollJahre < 0) {
    throw new EingabeFehler(`Volle Jahre müssen eine ganze Zahl ≥ 0 sein (erhalten: ${vollJahre}).`);
  }
  if (neuwagenwert !== undefined) {
    if (!Number.isFinite(neuwagenwert) || neuwagenwert <= 0) {
      throw new EingabeFehler(`Neuwagenwert muss eine Zahl > 0 sein (erhalten: ${neuwagenwert}).`);
    }
    if (bg === undefined || !Number.isFinite(bg) || bg < 0) {
      throw new EingabeFehler(`Mit Neuwagenwert ist eine Bemessungsgrundlage ≥ 0 nötig (erhalten: ${bg}).`);
    }
    return Math.min(1, Math.max(0, bg / neuwagenwert));
  }
  const { jahreNenner, untergrenze } = WERTENTWICKLUNG_VERFAHREN;
  return Math.max(untergrenze, 1 - vollJahre / jahreNenner);
}

/**
 * Vollendete Jahre zwischen `von` und `bis` (ISO). Ein Jahr ist am Jahrestag vollendet
 * (2022-03-10 → 2026-03-10 = 4, → 2026-03-09 = 3). Fehlt der Jahrestag (29.2. in einem
 * Nicht-Schaltjahr), gilt der letzte Tag des Monats, also der 28.2. (wie § 903 ABGB).
 */
export function volleJahre(von: string, bis: string): number {
  const a = datum('Beginn', von);
  const b = datum('Ende', bis);
  if (b < a) throw new EingabeFehler(`Ende ${bis} liegt vor Beginn ${von}.`);
  const [vy, vm, vd] = teile(a);
  const [by, bm, bd] = teile(b);
  let jahre = by - vy;
  // Jahrestag im Jahr `by`; 29.2. → 28.2., wenn `by` kein Schaltjahr ist
  const tagJahrestag = vm === 2 && vd === 29 && !istSchaltjahr(by) ? 28 : vd;
  if (bm < vm || (bm === vm && bd < tagJahrestag)) jahre -= 1;
  return jahre;
}

/** Rechtslage-Stichtag; siehe `ermittleRechtslage`. */
export function rechtslageStichtag(p: RechtslageEingabe): string {
  return ermittleRechtslage(p).stichtag;
}

/**
 * EU: Erstzulassungsdatum (Übergangsregeln des Kaufs im Inland greifen nicht, die Rechtslage ist durch
 * die Erstzulassung fixiert). Drittland: Zulassungsdatum; liegt es in einer Periode mit Übergangsregel
 * und wurden Vertrag vor `vertragVor` und Lieferung vor `lieferungVor` (beide ausschließlich)
 * angegeben, gilt der letzte Tag der Vorperiode. Ohne Vertrag oder Lieferung keine Übergangsregel.
 */
function ermittleRechtslage(p: RechtslageEingabe): { stichtag: string; uebergang: Uebergang | null } {
  const zulassung = datum('Zulassung', p.zulassung);
  if (p.herkunft === 'EU') {
    if (p.erstzulassung === undefined) {
      throw new EingabeFehler('EU-Import: Datum der Erstzulassung im übrigen Unionsgebiet fehlt.');
    }
    const ez = datum('Erstzulassung', p.erstzulassung);
    const heute = datum('Heute', p.heute ?? new Date().toISOString().slice(0, 10));
    if (ez > heute) throw new EingabeFehler(`Erstzulassung ${ez} liegt in der Zukunft.`);
    if (ez > zulassung) throw new EingabeFehler(`Erstzulassung ${ez} liegt nach der Zulassung ${zulassung}.`);
    return { stichtag: ez, uebergang: null };
  }
  if (p.vertrag === undefined || p.lieferung === undefined) return { stichtag: zulassung, uebergang: null };
  const vertrag = datum('Kaufvertrag', p.vertrag);
  const lieferung = datum('Lieferung', p.lieferung);
  if (vertrag > lieferung) {
    throw new EingabeFehler(`Kaufvertrag ${vertrag} liegt nach der Lieferung ${lieferung}.`);
  }
  const art = p.art ?? 'pkw';
  const u = selectNovaPeriode(art, zulassung).uebergang;
  if (!u || !(vertrag < u.vertragVor && lieferung < u.lieferungVor)) return { stichtag: zulassung, uebergang: null };
  const vorher = NOVA_PERIODEN.find((x) => x.art === art && x.docId === u.vorherigeDocId);
  if (!vorher?.bis) throw new RegelwerkLuecke(`Vorperiode ${u.vorherigeDocId} ist im Regelwerk nicht hinterlegt.`);
  return { stichtag: vorher.bis, uebergang: u };
}

/**
 * NoVA für ein Gebrauchtfahrzeug: wählt den Rechtslage-Stichtag (`e.stichtag` wird ersetzt) und
 * kürzt bei EU-Herkunft nach dem Geltungsbereich der Erstzulassungsperiode
 * (`WERTENTWICKLUNG_UMFANG`): ab 2014-03-01 Saldo Malus − Abzugsposten, davor nur Bonus/Malus.
 * @throws RegelwerkLuecke Stichtag vor 2008-01-01 oder nach 2029-12-31.
 * @throws EingabeFehler ungültige/widersprüchliche Daten oder vorgegebene `kuerzung`.
 */
export function berechneNovaGebraucht(e: NovaEingabe, ctx: GebrauchtKontext): NovaGebrauchtErgebnis {
  if (e.kuerzung) {
    throw new EingabeFehler('Kürzung wird aus Herkunft und Erstzulassung bestimmt und darf nicht vorgegeben werden.');
  }
  const art = periodenArt(e.art);
  const { stichtag, uebergang } = ermittleRechtslage({ ...ctx, art });
  // Fehlende Rechtslage zuerst melden (Warntext aus selectNovaPeriode), vor allen Folgeprüfungen.
  selectNovaPeriode(art, stichtag);

  const zusatzHinweise: string[] = [];
  const zusatzWarnungen: string[] = [];
  let status: NovaErgebnis['status'] = 'belegt';
  let faktor = 1;
  let jahre: number | null = null;
  let kuerzung: NovaKuerzung | undefined;

  if (ctx.herkunft === 'EU') {
    jahre = volleJahre(stichtag, ctx.zulassung);
    faktor = wertminderungsFaktor(jahre, e.bg, ctx.neuwagenwert);
    zusatzHinweise.push(
      `EU-Import: Rechtslage der Erstzulassung am ${stichtag}; ${
        ctx.neuwagenwert !== undefined
          ? `Wertentwicklung BG / Neuwagenwert = ${zahl(e.bg)} / ${zahl(ctx.neuwagenwert)}`
          : `${jahre} volle Jahre bis zur Zulassung am ${ctx.zulassung} (Jahrestag zählt als vollendet)`
      } → Faktor ${zahl(faktor)}.`,
    );
    if (faktor < 1) {
      const u = selectWertentwicklungUmfang(stichtag);
      kuerzung = { faktor, umfang: u.gekuerzt === 'saldo_malus_abzugsposten' ? 'malus_und_abzug' : 'bonus_malus' };
      status = schlechterer(status, u.status);
      if (u.status !== 'belegt') {
        zusatzWarnungen.push(
          `Geltungsbereich der Wertentwicklung für Erstzulassung ${u.von} – ${u.bis ?? 'offen'} nicht verifiziert (Status: ${u.status}): ${u.offen.join(' ')}`,
        );
      }
    }
  } else {
    zusatzHinweise.push(
      `Drittland-Import: Rechtslage der Zulassung bzw. Lieferung im Inland (${stichtag}); volle Malus/Abzugsposten, keine Wertentwicklung.`,
    );
  }
  if (uebergang) {
    zusatzHinweise.push(
      `Übergangsregel (${uebergang.quelle}): Kaufvertrag vor ${uebergang.vertragVor}, Lieferung vor ${uebergang.lieferungVor} → Rechtslage ${uebergang.vorherigeDocId} (Stichtag ${stichtag}).`,
    );
    status = schlechterer(status, uebergang.status);
  }

  const r = berechneNova({ ...e, stichtag, kuerzung });
  return {
    ...r,
    status: schlechterer(r.status, status),
    hinweise: [...zusatzHinweise, ...r.hinweise],
    warnungen: [...r.warnungen, ...zusatzWarnungen],
    rechtslageStichtag: stichtag,
    wertminderungsFaktor: faktor,
    volleJahre: jahre,
    kuerzungUmfang: kuerzung?.umfang ?? null,
    uebergang,
  };
}

/** Prüft ein ISO-Datum (`pruefeIsoDatum`); ungültig → EingabeFehler statt TypeError. */
function datum(name: string, v: string): string {
  try {
    pruefeIsoDatum(v);
  } catch {
    throw new EingabeFehler(`${name}: ungültiges Datum „${v}" (erwartet: JJJJ-MM-TT).`);
  }
  return v;
}

function teile(iso: string): [number, number, number] {
  return [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))];
}

function istSchaltjahr(j: number): boolean {
  return (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0;
}
