// Stylesheet-Ergänzungen für Markenfassungen (src/report/fassung.ts).
//
// Bewusst eine eigene Datei: css.ts wird von tools/css-uebernehmen.py aus der
// Jinja2-Vorlage neu geschrieben, und die Reineke-Fassung bekommt diese Regeln
// nie zu sehen. Die Maße sind wie dort im Browser kalibriert; nach einer
// Änderung `npm run bericht:pruefen:marke` laufen lassen.

export const MARKE_CSS = String.raw`
  /* Kopfzeile: Markenlogo statt Fuchs und Firmenname */
  .k-logo { display: block; flex: none; height: 2.9mm; width: auto; margin-bottom: .15mm; }

  /* Deckblatt: Markenlogo oben, Reineke unten. Das Reineke-Zeichen steht in der
     Spalte „Vertraulich“ — eine vierte Spalte hätte die Bericht-Nr. umbrochen. */
  .dcw .dcw-marke { position: absolute; top: 72mm; left: 15mm; right: 15mm; text-align: center; }
  .dcw .dcw-marke img { display: inline-block; width: 100mm; height: auto; }
  .dcw .dcw-fuss .dcw-co { margin-top: 1.2mm; color: #5a5a5a; }
  .dcw .dcw-vertr { display: flex; justify-content: space-between; align-items: flex-start; gap: 4mm; }
  .dcw .dcw-vertr .dcw-rt { display: block; flex: none; width: 13mm; height: auto; }

  /* Kapitel 03: Absatz zur Zusammenarbeit an der Stelle des Spruchs */
  .partner-logo { display: block; width: 32mm; height: auto; margin-top: 2.6mm; }
`;
