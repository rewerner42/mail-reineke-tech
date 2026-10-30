// Server-side PDF generation via Cloudflare Browser Rendering (headless Chrome).
// The client builds the report HTML (same as the on-screen report); we render it
// to a real PDF here so the user gets a true one-click download instead of the
// browser print dialog. Reuses the existing print stylesheet for pixel parity.

import puppeteer, { type BrowserWorker } from "@cloudflare/puppeteer";

/** Generous upper bound for the posted report HTML (a full report is ~30–80 KB). */
export const MAX_HTML_BYTES = 400_000;

export interface RenderInput {
  html: string;
  origin: string; // e.g. https://sharp.reineke.tech
  css?: string; // inlined stylesheet (avoids an external fetch from the headless browser)
}

/** Defense-in-depth: drop executable/embeddable markup before headless render. */
export function sanitizeReportHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
}

/** Wrap the report fragment in a full document with our styles applied. The CSS
 * is inlined when provided (preferred — no external fetch); otherwise linked. */
export function wrapReportDocument(inner: string, origin: string, css?: string): string {
  const styles = css
    ? `<style>${css}</style>`
    : `<link rel="stylesheet" href="${origin}/styles.css" />`;
  return (
    `<!doctype html><html lang="de"><head><meta charset="utf-8" />` +
    `<base href="${origin}/" />${styles}` +
    `</head><body class="is-report"><div class="report-view">` +
    `<div class="report-doc" data-report-doc>${inner}</div></div></body></html>`
  );
}

export interface RenderDocumentInput {
  /** A complete HTML document, including its own <style> and @page rules. */
  document: string;
  origin: string;
  /** Hard limit on the whole render; the browser is closed either way. */
  timeoutMs?: number;
}

/**
 * Renders a complete HTML document to PDF.
 *
 * Unlike renderReportPdf this does not wrap the input — the Bericht v15 template
 * brings its own stylesheet and `@page { size: A4; margin: 0 }`, and wrapping it
 * would override the page geometry the layout is calibrated for.
 *
 * Images load from our own origin rather than being inlined as data URIs: the
 * logo sits in the header of every page, and base64 is a third larger than the
 * bytes it carries, which alone pushed a long report past the size limit.
 */
export async function renderDocumentPdf(
  endpoint: BrowserWorker,
  { document, origin, timeoutMs = 45_000 }: RenderDocumentInput,
): Promise<Uint8Array> {
  const browser = await puppeteer.launch(endpoint);
  try {
    const page = await browser.newPage();
    // Only our own origin and data: URIs may load — otherwise this endpoint
    // would work as an open proxy for anything the HTML references.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url.startsWith(`${origin}/`) || url === origin) {
        void req.continue();
      } else {
        void req.abort();
      }
    });
    await page.setContent(sanitizeReportHtml(document), {
      waitUntil: "networkidle0",
      timeout: timeoutMs,
    });
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      timeout: timeoutMs,
    });
    return pdf as Uint8Array;
  } finally {
    // Always close: a browser left open holds a Browser Rendering session until
    // it times out, and the next request then fails to launch one.
    await browser.close();
  }
}

export async function renderReportPdf(
  endpoint: BrowserWorker,
  { html, origin, css }: RenderInput,
): Promise<Uint8Array> {
  const browser = await puppeteer.launch(endpoint);
  try {
    const page = await browser.newPage();
    // Only allow our own origin (styles.css + /assets/*) and data: URIs to load.
    // Prevents abusing this endpoint as an open proxy / SSRF via external resources.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url.startsWith(`${origin}/`) || url === origin) {
        void req.continue();
      } else {
        void req.abort();
      }
    });
    await page.setContent(wrapReportDocument(sanitizeReportHtml(html), origin, css), {
      waitUntil: "networkidle0",
    });
    // preferCSSPageSize honours the report's `@page { size: A4; margin: 14mm }`,
    // so the PDF matches the on-screen print layout (4 pages) exactly.
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return pdf as Uint8Array;
  } finally {
    await browser.close();
  }
}
