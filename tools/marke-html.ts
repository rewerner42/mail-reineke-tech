// Schreibt den Bericht einer Markenfassung als HTML, je Datensatz eine Datei.
//
// Die Jinja2-Vorlage unter tools/referenz kennt nur die Reineke-Fassung. Die
// Markenfassung prüft deshalb das HTML, das der Worker wirklich erzeugt:
// tools/referenz/html-pruefen.py rendert es mit Headless Chrome und meldet
// Seitenzahl und Überlauf.
//
//   npx tsx tools/marke-html.ts <marke> <ausgabeordner> [--synthetisch] [--vertrieb <name>]
//
// Bilder kommen aus public/assets (file://), wie beim Prüfstand für Reineke.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BRANDS } from "../src/brand.js";
import { berichtDokument } from "../src/report/bericht.js";
import { fassungFuer } from "../src/report/fassung.js";
import type { Signal } from "../src/report/signal.js";
import { adaptReferenz } from "./referenz-signal.js";
import { grenzfaelle, synthetisch } from "./synthetisch.js";

const SIG = fileURLToPath(new URL("../tests/fixtures/referenz/signale", import.meta.url));
const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));

const [markenId, out] = process.argv.slice(2);
const synth = process.argv.includes("--synthetisch");
const vertriebName = process.argv.includes("--vertrieb")
  ? process.argv[process.argv.indexOf("--vertrieb") + 1]
  : undefined;
const marke = markenId ? BRANDS[markenId] : undefined;
if (!marke || !out) {
  console.error("Aufruf: npx tsx tools/marke-html.ts <marke> <ausgabeordner> [--synthetisch] [--vertrieb <name>]");
  process.exit(2);
}
const vertrieb = vertriebName
  ? marke.report.reps?.find((r) => r.name.toLowerCase().includes(vertriebName.toLowerCase()))
  : undefined;
if (vertriebName && !vertrieb) {
  console.error(`Kein Vertriebler „${vertriebName}“ bei ${marke.id}.`);
  process.exit(2);
}
const fassung = fassungFuer(marke, vertrieb);
if (!fassung) {
  console.error(`${marke.id} hat keine eigene Fassung (report.v15).`);
  process.exit(2);
}

mkdirSync(out, { recursive: true });

function schreibe(slug: string, sig: Signal): void {
  const { html } = berichtDokument(sig, {
    origin: `file://${PUBLIC}`,
    nummer: `${fassung!.nummer.kuerzel}-${sig.scan_date.replace(/-/g, "")}-0001`,
    fassung,
  });
  writeFileSync(`${out}/${slug}.html`, html);
}

let n = 0;
if (synth) {
  for (const [key, sig] of [...synthetisch(), ...grenzfaelle()]) {
    schreibe(key, { ...sig, domain: key });
    n++;
  }
} else {
  for (const f of readdirSync(SIG).filter((x) => x.endsWith(".json")).sort()) {
    const sig = adaptReferenz(JSON.parse(readFileSync(`${SIG}/${f}`, "utf8")));
    schreibe(sig.domain, sig);
    n++;
  }
}
console.log(`${n} Berichte (${marke.id}${vertrieb ? `, ${vertrieb.name}` : ""}) nach ${out}`);
