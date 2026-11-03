// Checks the ported page planning against the original template's own numbers.
//
// src/report/seitenplan.ts is a hand port of the {% set %} block at the top of
// tools/referenz/vorlage/template.html.j2. Rather than trusting it, this reads
// the HTML that the Jinja2 template produced and compares two things per
// dataset: how many pages it actually has, and every page number it printed in
// its table of contents. A single off-by-one in a calibrated constant moves a
// page break, and this is what catches it.
//
//   npx tsx tools/seitenplan-pruefen.ts <ordner-mit-gerendertem-html>

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { seitenplan, type PlanEingabe } from "../src/report/seitenplan.js";

const dir = process.argv[2];
if (!dir) {
  console.error("Aufruf: npx tsx tools/seitenplan-pruefen.ts <ordner-mit-html>");
  process.exit(2);
}
const vmDir = process.argv[3] ?? dir;

/** The table of contents prints every page number in a <span class="inh-s">. */
function inhaltsverzeichnis(html: string): number[] {
  return [...html.matchAll(/class="inh-s">(\d+)</g)].map((m) => Number(m[1]));
}

function seiten(html: string): number {
  return [...html.matchAll(/class="page[ "]/g)].length;
}

/**
 * The same numbers in the same order the contents prints them: chapters 01, 02,
 * the pentest row, 03, 04, the appointment row, 05, then every finding, then
 * "Bereits umgesetzt" when there is a positive list, then appendices A and B.
 */
function erwartet(v: PlanEingabe & Record<string, any>): { N: number; inh: number[] } {
  const p = seitenplan(v);
  const inh = [p.P_ZF, p.P_EMP, p.P_PT, p.P_UEBER, p.P_NEXT, p.P_NEXT, p.F_START];
  for (const f of v.feststellungen) inh.push(p.FS[f.nr]!);
  if (v.positiv.length) inh.push(p.P_UMGESETZT);
  inh.push(p.P_ANH_A, p.P_ANH_B);
  return { N: p.N, inh };
}

let fehler = 0;
let geprueft = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".html")).sort()) {
  const slug = f.slice(0, -".html".length);
  const html = readFileSync(`${dir}/${f}`, "utf8");
  const vm = JSON.parse(readFileSync(`${vmDir}/${slug}.viewmodel.json`, "utf8"));
  const soll = erwartet(vm);
  const istN = seiten(html);
  const istInh = inhaltsverzeichnis(html);
  const meldungen: string[] = [];
  if (soll.N !== istN) meldungen.push(`Seitenzahl: geplant ${soll.N}, gerendert ${istN}`);
  if (soll.inh.join(",") !== istInh.join(",")) {
    meldungen.push(`Inhaltsverzeichnis: geplant [${soll.inh}], gerendert [${istInh}]`);
  }
  geprueft++;
  if (meldungen.length) {
    fehler++;
    console.log(`[ABWEICHUNG] ${slug}`);
    for (const m of meldungen) console.log(`    - ${m}`);
  }
}
console.log(
  fehler
    ? `\nSeitenplanung: ${fehler} von ${geprueft} Datensätzen abweichend.`
    : `\nSeitenplanung: ${geprueft} von ${geprueft} Datensätzen wie von der Vorlage gerendert.`,
);
process.exit(fehler ? 1 : 0);
