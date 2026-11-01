// One entry point for the report, used by all three delivery paths.
//
// The manual generator behind /report, the prospect mail and the self-service
// request at /bericht all produce the same report from the same generator —
// nothing is formulated at request time, everything comes out of the approved
// catalogue in daten/katalog.json.

import { analyzeObservatory } from "../observatory.js";
import { renderDocumentPdf } from "../pdf/render.js";
import { berichtNummer } from "./nummer.js";
import { buildSignal, type Signal } from "./signal.js";
import { berichtHtml } from "./template.js";
import { buildViewmodel, type Katalog } from "./viewmodel.js";
import katalogJson from "./daten/katalog.json";
import firmaJson from "./daten/firma.json";
import type { OdooConfig } from "../leads/odoo.js";
import type { AnalysisResponse, CheckResult, ObservatoryResult } from "../types.js";
import type { BrowserWorker } from "@cloudflare/puppeteer";

const KATALOG = katalogJson as unknown as Katalog;

/**
 * Upper bound for the generated document. A full report is 50–80 KB: the images
 * are loaded from our own origin instead of being inlined, which is what used to
 * blow the budget — the logo sits in the header of every page, and base64 costs
 * a third more than the bytes it carries. Fifteen pages of inlined logo alone
 * came to over 300 KB.
 */
export const MAX_BERICHT_BYTES = 400_000;

/** ISO date (YYYY-MM-DD) in UTC — the scan date printed on the report. */
function scanDatum(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface BerichtEingabe {
  analyze: AnalysisResponse;
  observatory: CheckResult<ObservatoryResult> | undefined;
  /** Our own origin; images are loaded from <origin>/assets. */
  origin: string;
  /** Null when Odoo is not configured — the number then falls back. */
  odoo: OdooConfig | null;
  now?: Date;
}

export interface Bericht {
  pdf: Uint8Array;
  /** The number printed on the report; record it with the recipient's consent. */
  nummer: string;
  /** Where the number came from, so a fallback can be spotted in the logs. */
  nummerAus: "odoo" | "ersatz";
  signal: Signal;
}

/** Builds the view model and the HTML, without touching the network. */
export function berichtDokument(
  signal: Signal,
  opts: { origin: string; nummer: string },
): { html: string; viewmodel: Record<string, unknown> } {
  const viewmodel = buildViewmodel(signal, KATALOG, firmaJson as never, {
    assets: `${opts.origin}/assets`,
    berichtNr: opts.nummer,
  });
  return { html: berichtHtml(viewmodel), viewmodel };
}

export async function erzeugeBericht(
  browser: BrowserWorker,
  e: BerichtEingabe,
): Promise<Bericht> {
  const now = e.now ?? new Date();
  const signal = buildSignal(e.analyze, e.observatory, scanDatum(now));
  const { nummer, aus } = await berichtNummer(e.odoo, { now });
  const { html } = berichtDokument(signal, { origin: e.origin, nummer });
  // Fail loudly. The old path checked a cap and returned null on breach, which
  // on the mail route meant a mail going out without its attachment and nobody
  // noticing.
  if (html.length > MAX_BERICHT_BYTES) {
    throw new Error(`Bericht zu groß: ${html.length} Bytes, erlaubt ${MAX_BERICHT_BYTES}`);
  }
  const pdf = await renderDocumentPdf(browser, { document: html, origin: e.origin });
  return { pdf, nummer, nummerAus: aus, signal };
}

/** Runs the scans the report needs. Separate so callers can reuse a scan. */
export async function scanneFuerBericht(
  domain: string,
  email: Omit<AnalysisResponse, "domain" | "queriedAt" | "dnssec">,
  dnssec: AnalysisResponse["dnssec"],
): Promise<{ analyze: AnalysisResponse; observatory: CheckResult<ObservatoryResult> }> {
  const observatory = await analyzeObservatory(domain);
  return {
    analyze: { domain, queriedAt: new Date().toISOString(), ...email, dnssec },
    observatory,
  };
}
