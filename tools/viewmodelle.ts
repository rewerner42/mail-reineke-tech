// Writes a view model per reference signal, for the layout tool to render.
//
// tools/referenz renders the real Jinja2 template with headless Chrome and
// reports page counts and overflow. It reads the view models from here instead
// of computing its own, so the logic exists once (in src/report) while the
// layout still gets checked against the original template.
//
//   npx tsx tools/viewmodelle.ts <ausgabeordner> [--synthetisch]
//
// With --synthetisch it writes one dataset per catalogue key instead of the
// eleven reference datasets, so every approved text gets rendered and measured
// at least once (PROMPT.md 3.5).

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildViewmodel, type Katalog } from "../src/report/viewmodel.js";
import type { Signal } from "../src/report/signal.js";
import { adaptReferenz } from "./referenz-signal.js";
import { grenzfaelle, synthetisch } from "./synthetisch.js";

const SIG = fileURLToPath(new URL("../tests/fixtures/referenz/signale", import.meta.url));
const DATEN = fileURLToPath(new URL("../src/report/daten", import.meta.url));
const out = process.argv[2];
const synth = process.argv.includes("--synthetisch");
if (!out) {
  console.error("Aufruf: npx tsx tools/viewmodelle.ts <ausgabeordner> [--synthetisch]");
  process.exit(2);
}

const katalog = JSON.parse(readFileSync(`${DATEN}/katalog.json`, "utf8")) as Katalog;
const firma = JSON.parse(readFileSync(`${DATEN}/firma.json`, "utf8"));

mkdirSync(`${out}/signale`, { recursive: true });

function schreibe(slug: string, sig: Signal): void {
  const vm = buildViewmodel(sig, katalog, firma, {
    assets: "ASSETS_URL",
    berichtNr: `RT-DS-${sig.scan_date.replace(/-/g, "")}-01`,
  });
  writeFileSync(`${out}/${slug}.viewmodel.json`, JSON.stringify(vm, null, 2));
  // The layout tool globs its signal folder, so signals go in a subfolder of
  // their own; it finds each dataset's view model by the signal's domain, which
  // for a synthetic case is the catalogue key.
  writeFileSync(`${out}/signale/${slug}.json`, JSON.stringify({ ...sig, domain: slug }, null, 2));
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
console.log(`${n} View-Modelle nach ${out}`);
