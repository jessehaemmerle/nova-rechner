/** Eingabe reicht für die Berechnung nicht aus oder ist widersprüchlich. */
export class EingabeFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EingabeFehler';
  }
}
