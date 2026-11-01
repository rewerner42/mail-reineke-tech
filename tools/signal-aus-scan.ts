// Builds a signal (and view model) from a saved scan, for checking a live report.
//
// The Worker renders with Cloudflare's Chrome, the layout tool with the one on
// this machine. Feeding the same scan through both is how we find out whether
// the page breaks fall in the same places.
//
//   npx tsx tools/signal-aus-scan.ts <analyze.json> <observatory.json> <ausgabeordner>

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildSignal } from "../src/report/signal.js";
import { berichtDokument } from "../src/report/bericht.js";

const [analyzePfad, obsPfad, out] = process.argv.slice(2);
if (!analyzePfad || !obsPfad || !out) {
  console.error("Aufruf: npx tsx tools/signal-aus-scan.ts <analyze.json> <observatory.json> <ordner>");
  process.exit(2);
}

const analyze = JSON.parse(readFileSync(analyzePfad, "utf8"));
const obsDatei = JSON.parse(readFileSync(obsPfad, "utf8"));
const observatory = obsDatei.observatory ?? obsDatei;
const sig = buildSignal(analyze, observatory, new Date().toISOString().slice(0, 10));
const { viewmodel } = berichtDokument(sig, { origin: "ASSETS_URL_ORIGIN", nummer: "RT-DS-00000000-0000" });
// The layout tool substitutes the image paths itself, so hand it the placeholder.
viewmodel.assets = "ASSETS_URL";
viewmodel.logo = "ASSETS_URL/logo.png";
viewmodel.qr_termin = "ASSETS_URL/qr-termin.svg";
const firma = viewmodel.firma as Record<string, any>;
for (const k of firma.kontakte) if (k.foto_url) k.foto_url = `ASSETS_URL/${k.foto}`;
firma.vorstellung.foto_url = `ASSETS_URL/${firma.vorstellung.foto}`;

mkdirSync(`${out}/signale`, { recursive: true });
writeFileSync(`${out}/${sig.domain}.viewmodel.json`, JSON.stringify(viewmodel, null, 2));
writeFileSync(`${out}/signale/${sig.domain}.json`, JSON.stringify(sig, null, 2));
console.log(`${sig.domain}: ${(viewmodel.feststellungen as unknown[]).length} Feststellungen, ` +
  `Handlungsbedarf ${(viewmodel.level as Record<string, unknown>).key}`);
