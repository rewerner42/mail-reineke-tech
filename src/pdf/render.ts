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
  /**
   * Limit for the render itself. Keep it below the caller's own guard, so this
   * function fails first and its `finally` closes the browser — a browser left
   * behind holds a Browser Rendering session until it times out, and the next
   * request then cannot start one.
   */
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
  { document: dokument, origin, timeoutMs = 40_000 }: RenderDocumentInput,
): Promise<Uint8Array> {
  // One budget for the whole render, not one per step. Two 30 s limits in a row
  // can outlast a 45 s guard around the call, and a caller that gives up on a
  // Promise.race does not stop this function — the browser would then stay open
  // until Cloudflare tears the request down, holding a Browser Rendering session
  // that the next request cannot replace.
  const frist = Date.now() + timeoutMs;
  const rest = () => Math.max(1_000, frist - Date.now());

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
    await page.setContent(sanitizeReportHtml(dokument), {
      waitUntil: "networkidle0",
      timeout: rest(),
    });

    // A failed image does not shift the layout — the boxes have fixed sizes — so
    // a report with a missing logo or portrait would go out looking finished.
    // Ask the page instead of hoping.
    // Runs in the page, where `document` is the DOM — this file is typed against
    // the Workers runtime, which has no DOM, hence the cast.
    const fehlend = (await page.evaluate(() => {
      const d = (globalThis as unknown as { document: { images: ArrayLike<Record<string, unknown>> } })
        .document;
      return Array.from(d.images)
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => String(img.currentSrc || img.src || "(ohne src)"));
    })) as string[];
    if (fehlend.length) {
      throw new Error(`Bilder nicht geladen: ${[...new Set(fehlend)].join(", ")}`);
    }

    // The pages are fixed at A4 with `overflow: hidden`, which keeps the page
    // count right but means content past the margin is cut off without a trace.
    // The layout is calibrated against the catalogue, but DNS records, scanner
    // summaries and MDN's own wording go into it unbounded, so check the real
    // document rather than trusting the estimate.
    const ueberlauf = (await page.evaluate(() => {
      const d = globalThis as unknown as {
        document: { querySelectorAll: (s: string) => ArrayLike<Record<string, any>> };
        getComputedStyle: (el: unknown) => Record<string, string>;
      };
      const raus: Array<{ seite: number; px: number }> = [];
      Array.from(d.document.querySelectorAll(".page")).forEach((pg, i) => {
        const r = pg.getBoundingClientRect();
        const unten = r.bottom - parseFloat(d.getComputedStyle(pg).paddingBottom || "0");
        let schlimmste = 0;
        Array.from(pg.querySelectorAll("*") as ArrayLike<Record<string, any>>).forEach((el) => {
          const b = el.getBoundingClientRect();
          if (!b.width && !b.height) return;
          const pos = d.getComputedStyle(el).position;
          if (pos === "absolute" || pos === "fixed") return;
          if (b.bottom - unten > schlimmste) schlimmste = b.bottom - unten;
        });
        if (schlimmste > 1) raus.push({ seite: i + 1, px: Math.round(schlimmste) });
      });
      return raus;
    })) as Array<{ seite: number; px: number }>;
    if (ueberlauf.length) {
      // A clipped report is still more use than none, so this warns instead of
      // throwing — but it must not pass unnoticed.
      console.warn(
        "Bericht laeuft ueber den Satzspiegel: " +
          ueberlauf.map((u) => `Seite ${u.seite} um ${u.px} px`).join(", "),
      );
    }

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      timeout: rest(),
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
