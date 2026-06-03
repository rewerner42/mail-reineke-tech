import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { analyzeDmarc } from "./analyzers/dmarc.js";
import { analyzeSpf } from "./analyzers/spf.js";
import { analyzeDkim } from "./analyzers/dkim.js";
import { analyzeMx } from "./analyzers/mx.js";
import { analyzeMtaSts } from "./analyzers/mta-sts.js";
import { analyzeTlsRpt } from "./analyzers/tls-rpt.js";
import { analyzeDnssec } from "./analyzers/dnssec.js";
import { analyzeObservatory, fetchGradeDistribution } from "./observatory.js";
import { createLead, odooConfigFromEnv, recordScannedDomain, validateEmail } from "./leads/odoo.js";
import { MAX_HTML_BYTES, renderReportPdf } from "./pdf/render.js";
import { buildReportBody } from "./report/build.js";
import type { BrowserWorker } from "@cloudflare/puppeteer";
import type { AnalysisResponse } from "./types.js";

type Bindings = {
  ASSETS: Fetcher;
  // Odoo CRM lead capture (set as Worker secrets; see README).
  ODOO_URL?: string;
  ODOO_DB?: string;
  ODOO_USERNAME?: string;
  ODOO_API_KEY?: string;
  // Browser Rendering binding for server-side PDF export.
  BROWSER?: BrowserWorker;
  // Password (no username) gating the internal report generator at /report.
  REPORT_PASSWORD?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Security headers on EVERY response — including the static assets served via the
// ASSETS binding (so we rebuild the response to attach them reliably). Hardens the
// tool itself and fixes its own HTTP-Observatory grade. The CSP allows our own
// origin plus the consent-gated analytics (Umami + Leadfeeder); script-src stays
// free of 'unsafe-inline'.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cloud.umami.is https://*.lfeeder.com",
  "connect-src 'self' https://cloud.umami.is https://*.lfeeder.com",
  "img-src 'self' data: https://*.lfeeder.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=(), payment=(), usb=()",
};

app.use("*", async (c, next) => {
  await next();
  // Rebuild the response so headers are mutable (ASSETS responses can be immutable).
  const res = new Response(c.res.body, c.res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  c.res = res;
});

app.use("/api/*", cors({ origin: "*", maxAge: 86400 }));

// Domain validation: ASCII labels, optional IDN should be punycoded by client.
const DOMAIN_REGEX =
  /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

function normalizeDomain(input: string): string | null {
  if (!input) return null;
  let d = input.trim().toLowerCase();
  // Strip protocol if user pasted a URL
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  // Strip user@ if they pasted an email
  if (d.includes("@")) d = d.split("@").pop() ?? d;
  // Strip trailing dot
  d = d.replace(/\.$/, "");
  if (!DOMAIN_REGEX.test(d)) return null;
  return d;
}

const INVALID_DOMAIN = {
  error: "INVALID_DOMAIN",
  message: "Bitte gib eine gültige Domain ein (z.B. reineke-technik.de).",
} as const;

function parseSelectors(param: string | undefined): string[] {
  return param
    ? param.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
}

/**
 * True if a request's Origin is a *different* host than the one serving it.
 * Used to reject cross-site abuse of the write endpoints (lead capture, PDF).
 * A missing Origin is treated as same-origin so legitimate clients aren't broken.
 */
function isCrossOrigin(originHeader: string | undefined, reqUrl: string): boolean {
  if (!originHeader) return false;
  try {
    return new URL(originHeader).host !== new URL(reqUrl).host;
  } catch {
    return true; // malformed Origin → block
  }
}

const CROSS_ORIGIN_DENIED = {
  ok: false,
  code: "CROSS_ORIGIN",
  message: "Ungültige Anfrage-Herkunft.",
} as const;

/** Best-effort: log a scanned domain into the Odoo model (no-op if Odoo unset). */
function recordDomainSafe(c: Context<{ Bindings: Bindings }>, domain: string): void {
  const cfg = odooConfigFromEnv(c.env);
  if (cfg) c.executionCtx.waitUntil(recordScannedDomain(cfg, domain).catch(() => {}));
}

/** Run the e-mail authentication + transport checks (no DNSSEC, no Observatory). */
async function runEmailChecks(domain: string, extraSelectors: string[]) {
  const [dmarc, spf, dkim, mx, mtaSts, tlsRpt] = await Promise.all([
    analyzeDmarc(domain),
    analyzeSpf(domain),
    analyzeDkim(domain, extraSelectors),
    analyzeMx(domain),
    analyzeMtaSts(domain),
    analyzeTlsRpt(domain),
  ]);
  return { dmarc, spf, dkim, mx, mtaSts, tlsRpt };
}

// ── Report-Generator: Auth (nur Passwort, kein Benutzername) ──────────────────
const REPORT_COOKIE = "rpt";
const REPORT_TTL_MS = 8 * 60 * 60 * 1000; // 8 h

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Length-independent equality to avoid leaking the password via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function makeReportToken(secret: string): Promise<string> {
  const exp = Date.now() + REPORT_TTL_MS;
  return `${exp}.${await hmacHex(secret, `report.${exp}`)}`;
}

async function verifyReportToken(secret: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = `${exp}.${await hmacHex(secret, `report.${exp}`)}`;
  return timingSafeEqual(token, expected);
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

function isReportAuthed(c: Context<{ Bindings: Bindings }>): Promise<boolean> {
  const secret = c.env.REPORT_PASSWORD;
  if (!secret) return Promise.resolve(false);
  return verifyReportToken(secret, readCookie(c.req.header("Cookie"), REPORT_COOKIE));
}

app.get("/api/health", (c) => c.json({ ok: true, service: "mail.reineke.tech" }));

// E-mail tab: DMARC, SPF, DKIM, MX, MTA-STS, TLS-RPT.
app.get("/api/email", async (c) => {
  const domain = normalizeDomain(c.req.query("domain") ?? "");
  if (!domain) return c.json(INVALID_DOMAIN, 400);
  recordDomainSafe(c, domain);

  const email = await runEmailChecks(domain, parseSelectors(c.req.query("selectors")));
  return c.json(
    { domain, queriedAt: new Date().toISOString(), ...email },
    200,
    { "Cache-Control": "no-store" },
  );
});

// DNSSEC tab: chain-of-trust validation only (fast).
app.get("/api/dnssec", async (c) => {
  const domain = normalizeDomain(c.req.query("domain") ?? "");
  if (!domain) return c.json(INVALID_DOMAIN, 400);
  recordDomainSafe(c, domain);

  const dnssec = await analyzeDnssec(domain);
  return c.json(
    { domain, queriedAt: new Date().toISOString(), dnssec },
    200,
    { "Cache-Control": "no-store" },
  );
});

// Website tab: MDN HTTP Observatory scan. Fresh scans take ~10s, so this is its
// own endpoint and the frontend loads it independently with a progress state.
app.get("/api/observatory", async (c) => {
  const domain = normalizeDomain(c.req.query("domain") ?? "");
  if (!domain) return c.json(INVALID_DOMAIN, 400);
  recordDomainSafe(c, domain);

  const result = await analyzeObservatory(domain);
  return c.json(
    { domain, queriedAt: new Date().toISOString(), observatory: result },
    200,
    { "Cache-Control": "no-store" },
  );
});

// Global Observatory grade distribution — powers the benchmark chart.
app.get("/api/grade-distribution", async (c) => {
  const distribution = await fetchGradeDistribution();
  return c.json({ distribution }, 200, { "Cache-Control": "public, max-age=86400" });
});

// All-in-one endpoint (API consumers): every DNS-based check in one response.
app.get("/api/analyze", async (c) => {
  const domain = normalizeDomain(c.req.query("domain") ?? "");
  if (!domain) return c.json(INVALID_DOMAIN, 400);
  recordDomainSafe(c, domain);

  const [email, dnssec] = await Promise.all([
    runEmailChecks(domain, parseSelectors(c.req.query("selectors"))),
    analyzeDnssec(domain),
  ]);

  const response: AnalysisResponse = {
    domain,
    queriedAt: new Date().toISOString(),
    ...email,
    dnssec,
  };
  return c.json(response, 200, { "Cache-Control": "no-store" });
});

// Lead capture: the report download is gated behind an e-mail + DSGVO consent.
// We enforce a valid e-mail and explicit consent here, then best-effort push the
// lead into Odoo CRM. A configuration/Odoo failure must NOT block the user from
// their report, so we log the lead (observability) and still return ok.
app.post("/api/lead", async (c) => {
  if (isCrossOrigin(c.req.header("Origin"), c.req.url)) return c.json(CROSS_ORIGIN_DENIED, 403);

  let body: { email?: unknown; domain?: unknown; consent?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, code: "BAD_REQUEST", message: "Ungültige Anfrage." }, 400);
  }

  if (body.consent !== true) {
    return c.json(
      {
        ok: false,
        code: "NO_CONSENT",
        message: "Bitte stimme der Verarbeitung deiner E-Mail-Adresse zu.",
      },
      400,
    );
  }
  if (!validateEmail(body.email)) {
    return c.json(
      {
        ok: false,
        code: "INVALID_EMAIL",
        message: "Bitte gib eine gültige E-Mail-Adresse ein.",
      },
      400,
    );
  }

  const email = (body.email as string).trim();
  const domain =
    typeof body.domain === "string" ? (normalizeDomain(body.domain) ?? undefined) : undefined;
  const lead = { email, domain, consent: true };

  const cfg = odooConfigFromEnv(c.env);
  if (!cfg) {
    // Not configured yet — don't lose the lead, surface it in the logs.
    console.warn("LEAD (Odoo not configured):", JSON.stringify({ ...lead, at: new Date().toISOString() }));
    return c.json({ ok: true, code: "NOT_CONFIGURED", message: "Bericht wird erstellt." });
  }

  const result = await createLead(cfg, lead);
  if (!result.ok) {
    console.error("LEAD Odoo push failed:", result.code, result.message, JSON.stringify(lead));
    // Best-effort: still let the user through to their report.
    return c.json({ ok: true, code: result.code, message: "Bericht wird erstellt." });
  }
  return c.json({ ok: true, code: "OK", message: "Bericht wird erstellt.", leadId: result.leadId });
});

// Server-side PDF export: the client posts the already-built report HTML and we
// render it to a real PDF (Browser Rendering) for a true one-click download.
// On any failure the frontend falls back to the browser print dialog.
app.post("/api/report-pdf", async (c) => {
  if (isCrossOrigin(c.req.header("Origin"), c.req.url)) return c.json(CROSS_ORIGIN_DENIED, 403);
  if (!c.env.BROWSER) {
    return c.json(
      { ok: false, code: "NO_BROWSER", message: "PDF-Rendering nicht verfügbar." },
      503,
    );
  }

  let body: { html?: unknown; domain?: unknown; check?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, code: "BAD_REQUEST", message: "Ungültige Anfrage." }, 400);
  }

  const html = typeof body.html === "string" ? body.html : "";
  if (!html || html.length > MAX_HTML_BYTES) {
    return c.json(
      { ok: false, code: "BAD_HTML", message: "Report-Inhalt fehlt oder ist zu groß." },
      400,
    );
  }
  // Sanity check: only render our own report markup.
  if (!html.includes("report-letterhead")) {
    return c.json(
      { ok: false, code: "UNEXPECTED_HTML", message: "Unerwarteter Report-Inhalt." },
      400,
    );
  }

  const origin = new URL(c.req.url).origin;
  const domain =
    typeof body.domain === "string" ? (normalizeDomain(body.domain) ?? "report") : "report";
  const check = typeof body.check === "string" ? body.check.replace(/[^a-z0-9]/gi, "") : "";

  // Inline the stylesheet + logo (served via the ASSETS binding) so the headless
  // browser needs no external fetches — fully self-contained, fast, env-agnostic.
  let css = "";
  let inlineHtml = html;
  try {
    const [cssResp, logoResp] = await Promise.all([
      c.env.ASSETS.fetch(new Request(`${origin}/styles.css`)),
      c.env.ASSETS.fetch(new Request(`${origin}/assets/reineke-logo.png`)),
    ]);
    if (cssResp.ok) css = await cssResp.text();
    if (logoResp.ok) {
      const buf = new Uint8Array(await logoResp.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) {
        bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      }
      inlineHtml = html.replaceAll("/assets/reineke-logo.png", `data:image/png;base64,${btoa(bin)}`);
    }
  } catch {
    /* fall back to linked stylesheet / external logo */
  }

  try {
    const pdf = await renderReportPdf(c.env.BROWSER, { html: inlineHtml, origin, css });
    const base = check ? `Befund-${check}-${domain}` : `Sicherheitsbericht-${domain}`;
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${base}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("PDF render failed:", err instanceof Error ? err.message : String(err));
    return c.json(
      { ok: false, code: "RENDER_FAILED", message: "PDF konnte nicht erstellt werden." },
      502,
    );
  }
});

// ── Report-Generator (passwortgeschützte Seite) ───────────────────────────────
// Saubere URL für die geschützte Seite (liefert report.html aus den Assets).
app.get("/report", (c) => c.env.ASSETS.fetch(new Request(new URL("/report.html", c.req.url))));

// Login: nur Passwort (kein Benutzername) → signiertes HttpOnly-Cookie.
app.post("/api/report-auth", async (c) => {
  if (isCrossOrigin(c.req.header("Origin"), c.req.url)) return c.json(CROSS_ORIGIN_DENIED, 403);
  const secret = c.env.REPORT_PASSWORD;
  if (!secret) {
    return c.json(
      { ok: false, code: "NOT_CONFIGURED", message: "Report-Login ist nicht konfiguriert." },
      503,
    );
  }
  let body: { password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, code: "BAD_REQUEST", message: "Ungültige Anfrage." }, 400);
  }
  const pw = typeof body.password === "string" ? body.password : "";
  if (!timingSafeEqual(pw, secret)) {
    return c.json({ ok: false, code: "INVALID", message: "Falsches Passwort." }, 401);
  }
  const token = await makeReportToken(secret);
  const secure = new URL(c.req.url).protocol === "https:" ? "; Secure" : "";
  c.header(
    "Set-Cookie",
    `${REPORT_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${REPORT_TTL_MS / 1000}${secure}`,
  );
  return c.json({ ok: true });
});

// Auth-Status (die Seite entscheidet damit: Login-Formular vs. Generator).
app.get("/api/report-auth", async (c) =>
  c.json({ authed: await isReportAuthed(c) }, 200, { "Cache-Control": "no-store" }),
);

// Report erzeugen: Domain scannen → gebrandeten Report bauen → als PDF rendern.
app.post("/api/generate-report", async (c) => {
  if (isCrossOrigin(c.req.header("Origin"), c.req.url)) return c.json(CROSS_ORIGIN_DENIED, 403);
  if (!(await isReportAuthed(c))) {
    return c.json({ ok: false, code: "UNAUTHORIZED", message: "Bitte zuerst anmelden." }, 401);
  }
  if (!c.env.BROWSER) {
    return c.json({ ok: false, code: "NO_BROWSER", message: "PDF-Rendering nicht verfügbar." }, 503);
  }

  let body: { domain?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, code: "BAD_REQUEST", message: "Ungültige Anfrage." }, 400);
  }
  const domain = normalizeDomain(typeof body.domain === "string" ? body.domain : "");
  if (!domain) return c.json(INVALID_DOMAIN, 400);
  recordDomainSafe(c, domain);

  // Scans serverseitig (autoritativ): E-Mail-Auth + DNSSEC + Website-Header.
  const [email, dnssec, observatory] = await Promise.all([
    runEmailChecks(domain, []),
    analyzeDnssec(domain),
    analyzeObservatory(domain),
  ]);
  const analyze: AnalysisResponse = { domain, queriedAt: new Date().toISOString(), ...email, dnssec };

  // Stylesheet + Logos aus den Assets inlinen — keine externen Fetches im Headless-Browser.
  const origin = new URL(c.req.url).origin;
  let css = "";
  let logoPartner = "";
  let logoReineke = "";
  try {
    const [cssResp, partnerResp, foxResp] = await Promise.all([
      c.env.ASSETS.fetch(new Request(`${origin}/assets/report.css`)),
      c.env.ASSETS.fetch(new Request(`${origin}/assets/wsit-logo.svg`)),
      c.env.ASSETS.fetch(new Request(`${origin}/assets/reineke-official.svg`)),
    ]);
    if (cssResp.ok) css = await cssResp.text();
    if (partnerResp.ok) logoPartner = `data:image/svg+xml;base64,${bufToBase64(await partnerResp.arrayBuffer())}`;
    if (foxResp.ok) logoReineke = `data:image/svg+xml;base64,${bufToBase64(await foxResp.arrayBuffer())}`;
  } catch {
    /* fall back to an unstyled / logoless render rather than failing outright */
  }

  const reportBody = buildReportBody(domain, analyze, observatory, {
    partner: logoPartner,
    reineke: logoReineke,
  });
  if (reportBody.length > MAX_HTML_BYTES) {
    return c.json({ ok: false, code: "TOO_LARGE", message: "Report zu groß." }, 500);
  }

  try {
    const pdf = await renderReportPdf(c.env.BROWSER, { html: reportBody, origin, css });
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="WS-IT-Befund-${domain}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("generate-report render failed:", err instanceof Error ? err.message : String(err));
    return c.json({ ok: false, code: "RENDER_FAILED", message: "PDF konnte nicht erstellt werden." }, 502);
  }
});

// Static assets fallback (frontend)
app.get("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
