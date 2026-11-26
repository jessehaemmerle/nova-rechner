/**
 * Typisierung und Zulassung (Spezifikation § 5.7).
 * Belegt (ÖAMTC „Eigenimport"): nur die Eintragung in die Genehmigungsdatenbank.
 * Alle anderen Beträge sind Platzhalter-Annahmen, keine Gebührenquelle geprüft.
 */
import { STAND } from './nova-perioden-gemeinsam';
import type { Status } from './types';

export type Weg = 'generalimporteur' | 'landespruefstelle';

export interface GebuehrDef {
  id: string;
  label: string;
  betrag: number;
  status: Status;
  erklaerung: string;
  quelle: string;
}

export const GEBUEHREN_STAND = STAND;

export const QUELLE_ANNAHME =
  'Annahme, keine Gebührenquelle geprüft; Betrag beim Amt der Landesregierung / Zulassungsstelle erfragen';
const QUELLE_OEAMTC = 'ÖAMTC „Eigenimport"';

export const EINTRAGUNG_ID = 'eintragung_genehmigungsdatenbank';

export const EINTRAGUNG: Record<Weg, GebuehrDef> = {
  generalimporteur: {
    id: EINTRAGUNG_ID,
    label: 'Eintragung Genehmigungsdatenbank über Generalimporteur (bis zu)',
    betrag: 180,
    status: 'belegt',
    erklaerung: 'Laut ÖAMTC höchstens 180 €; angesetzt wird der Höchstbetrag.',
    quelle: QUELLE_OEAMTC,
  },
  landespruefstelle: {
    id: EINTRAGUNG_ID,
    label: 'Eintragung Genehmigungsdatenbank über Landesprüfstelle (rund)',
    betrag: 150,
    status: 'belegt',
    erklaerung: 'Laut ÖAMTC rund 150 €.',
    quelle: QUELLE_OEAMTC,
  },
};

const annahme = (id: string, label: string, betrag: number, erklaerung: string): GebuehrDef => ({
  id,
  label,
  betrag,
  status: 'schaetzwert',
  erklaerung: `${erklaerung} Gerundete Annahme (Stand ${STAND}), kein amtlicher Tarif.`,
  quelle: QUELLE_ANNAHME,
});

export const EINZELGENEHMIGUNG = annahme(
  'einzelgenehmigung',
  'Einzelgenehmigung / Typisierung',
  400,
  'Nur nötig, wenn keine Typgenehmigung/Übereinstimmung vorliegt.',
);
export const GUTACHTEN_57A = annahme(
  'gutachten57a',
  '§ 57a-Gutachten (Begutachtungsplakette)',
  100,
  'Nur nötig, wenn ein Gutachten gebraucht wird.',
);
export const COC = annahme('coc', 'CoC-Beschaffung', 250, 'Übereinstimmungsbescheinigung vom Hersteller/Importeur.');
export const ZULASSUNGSGEBUEHR = annahme('zulassungsgebuehr', 'Zulassungsgebühr', 120, 'Gebühren der Zulassungsstelle.');
export const KENNZEICHEN = annahme('kennzeichen', 'Kennzeichen', 40, 'Kennzeichentafeln.');
export const EINTRAGUNGSGEBUEHR = annahme(
  'eintragungsgebuehr',
  'Eintragungsgebühr',
  30,
  'Eintragung in den Zulassungsschein bzw. das Zulassungsverfahren.',
);
