/** Kein Regelwerk für den Stichtag (vor 2008, nach 2029 oder Lücke). */
export class RegelwerkLuecke extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegelwerkLuecke';
  }
}

const ISO_DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Prüft ein ISO-Datum `yyyy-mm-dd` auf Format und Kalendergültigkeit. */
export function pruefeIsoDatum(stichtag: string): void {
  const m = ISO_DATUM.exec(stichtag);
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
  if (!d || d.toISOString().slice(0, 10) !== stichtag) {
    throw new TypeError(`Ungültiges Datum „${stichtag}" (erwartet: JJJJ-MM-TT).`);
  }
}
