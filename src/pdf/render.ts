// Server-side PDF generation via Cloudflare Browser Rendering (headless Chrome).
// The client builds the report HTML (same as the on-screen report); we render it
// to a real PDF here so the user gets a true one-click download instead of the
// browser print dialog. Reuses the existing print stylesheet for pixel parity.

import puppeteer, { type BrowserWorker } from "@cloudflare/puppeteer";

/** Generous upper bound for the posted report HTML (a full report is ~30–80 KB). */
export const MAX_HTML_BYTES = 400_000;

export interface RenderInput {
  html: string;
  origin: string; // e.g. https://wsit.reineke.tech
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
