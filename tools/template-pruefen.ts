// Compares the ported template against the original it replaces.
//
// src/report/template.ts is a hand port of the Jinja2 template; the Worker
// cannot run Jinja2. This renders the same view model through both and compares
// the result, so any divergence is a failing check instead of a quietly
// different PDF.
//
// Whitespace between tags is normalised away — the two engines indent
// differently and the browser does not care — but every tag, attribute and
// character of text has to match.
//
//   npm run bericht:pruefen -- --vorlage     (renders both and compares)
//   npx tsx tools/template-pruefen.ts <ordner-mit-jinja2-html> [<ordner-mit-viewmodellen>]

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { berichtHtml } from "../src/report/template.js";

const dir = process.argv[2];
if (!dir) {
  console.error("Aufruf: npx tsx tools/template-pruefen.ts <ordner-mit-html> [<ordner-mit-viewmodellen>]");
  process.exit(2);
}
const vmDir = process.argv[3] ?? dir;

/**
 * Drops whitespace that cannot affect rendering, keeps everything else.
 *
 * Image paths are folded back to the placeholder: the layout tool substitutes a
 * local file:// URI for them so Chrome can load the images, while the Worker
 * serves them from its own origin. That difference is by design (PROMPT.md 6.1
 * excludes it from the acceptance), everything else is not.
 */
function normal(html: string): string {
  return html
    .replace(/file:\/\/[^"')\s]*\/public\/assets/g, "ASSETS_URL")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .replace(/\s+>/g, ">")
    .trim();
}

/** Where two strings first differ, with a little context on both sides. */
function ersteAbweichung(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const von = Math.max(0, i - 90);
  return `  bei Zeichen ${i}:\n    Vorlage:    …${a.slice(von, i + 90)}…\n    Portierung: …${b.slice(von, i + 90)}…`;
}

// Divergent output is written out for inspection, in a folder of its own so a
// second run does not read it back as input.
const PORTIERT = `${dir}/portiert`;

let fehler = 0;
let geprueft = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".html")).sort()) {
  const slug = f.slice(0, -".html".length);
  const vm = JSON.parse(readFileSync(`${vmDir}/${slug}.viewmodel.json`, "utf8"));
  const jinja = normal(readFileSync(`${dir}/${f}`, "utf8"));
  const meins = normal(berichtHtml(vm));
  geprueft++;
  if (jinja !== meins) {
    fehler++;
    console.log(`[ABWEICHUNG] ${slug} (${jinja.length} vs ${meins.length} Zeichen)`);
    console.log(ersteAbweichung(jinja, meins));
    mkdirSync(PORTIERT, { recursive: true });
    writeFileSync(`${PORTIERT}/${slug}.html`, berichtHtml(vm));
  }
}
console.log(
  fehler
    ? `\nVorlage: ${fehler} von ${geprueft} Datensätzen abweichend.`
    : `\nVorlage: ${geprueft} von ${geprueft} Datensätzen zeichengleich mit der Jinja2-Vorlage.`,
);
process.exit(fehler ? 1 : 0);
