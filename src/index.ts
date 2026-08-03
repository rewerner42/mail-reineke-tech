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
import {
  ampelFor,
  createLead,
  odooConfigFromEnv,
  recordScannedDomain,
  validateEmail,
  writeLeadFindings,
  type OdooConfig,
  type ScopingInput,
} from "./leads/odoo.js";
import { MAX_HTML_BYTES, renderReportPdf } from "./pdf/render.js";
import { buildReportBody } from "./report/build.js";
import {
  resolveBrand,
  BRANDS,
  DEFAULT_BRAND,
  applyBrandToHtml,
  sitePaletteCss,
  reportPaletteCss,
} from "./brand.js";
import type { Brand, BrandContact } from "./brand.js";
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
  // White-label brand id (e.g. "wsit") set per Worker env; falls back to Host.
  BRAND?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Security headers on EVERY response — including the static assets served via the
// ASSETS binding (so we rebuild the response to attach them reliably). Hardens the
// tool itself and fixes its own HTTP-Observatory grade. The CSP allows our own
// origin plus the brand's consent-gated analytics (Umami + Leadfeeder) — brands
// without analytics get a CSP with no third-party origin at all; script-src stays
// free of 'unsafe-inline'. Brand files never change at runtime → cache per id.
const CSP_CACHE = new Map<string, string>();
function cspFor(brand: Brand): string {
  const cached = CSP_CACHE.get(brand.id);
  if (cached) return cached;
  // Older client-branch brand files have no `analytics` field — they behave like
  // the default brand (see Brand.analytics), so mirror its origins here too.
  const a = brand.analytics ?? DEFAULT_BRAND.analytics;
  const umami = a?.umamiId ? " https://cloud.umami.is" : "";
  const lf = a?.leadfeederId ? " https://*.lfeeder.com" : "";
  const csp = [
    "default-src 'self'",
    `script-src 'self'${umami}${lf}`,
    `connect-src 'self'${umami}${lf}`,
    `img-src 'self' data:${lf}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  CSP_CACHE.set(brand.id, csp);
  return csp;
}

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=(), payment=(), usb=()",
};

app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  const brand = resolveBrand(c.env, url.host);
  // White-label: never serve another brand's private assets (e.g. the Sharp
  // partner logo or the Reineke /pentest page) from this brand's Worker.
  const foreignAsset = Object.values(BRANDS).some(
    (b) => b.id !== brand.id && (b.privateAssets ?? []).includes(url.pathname),
  );
  if (foreignAsset) {
    c.res = new Response("Not found", { status: 404 });
  } else {
    await next();
  }
  // Rebuild the response so headers are mutable (ASSETS responses can be immutable).
  let res = new Response(c.res.body, c.res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  res.headers.set("Content-Security-Policy", cspFor(brand));
  // White-label: rewrite served HTML for non-default brands (no-op for default,
  // so sharp/reineke is byte-unchanged). Skips JSON/PDF/asset responses.
  if (
    brand.id !== DEFAULT_BRAND.id &&
    (res.headers.get("content-type") || "").includes("text/html")
  ) {
    const html = applyBrandToHtml(await res.text(), brand);
    const headers = new Headers(res.headers);
    headers.delete("content-length"); // body changed — let the runtime recompute
    // The asset validators describe the static file, not this rewritten body —
    // keeping them would let a 304 serve an un-rewritten copy from the browser
    // cache, and the same ETag would be shared across brands.
    headers.delete("etag");
    headers.delete("last-modified");
    headers.set("Cache-Control", "no-cache");
    res = new Response(html, { status: res.status, statusText: res.statusText, headers });
  }
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
  message: "Bitte geben Sie eine gültige Domain ein (z.B. reineke-technik.de).",
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

app.get("/api/health", (c) =>
  c.json({ ok: true, service: resolveBrand(c.env, new URL(c.req.url).host).report.toolUrl }),
);

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
        message: "Bitte stimmen Sie der Verarbeitung Ihrer E-Mail-Adresse zu.",
      },
      400,
    );
  }
  if (!validateEmail(body.email)) {
    return c.json(
      {
        ok: false,
        code: "INVALID_EMAIL",
        message: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      },
      400,
    );
  }

  const email = (body.email as string).trim();
  const domain =
    typeof body.domain === "string" ? (normalizeDomain(body.domain) ?? undefined) : undefined;
  const lead = { email, domain, consent: true, channel: "freier-check" as const };

  const cfg = odooConfigFromEnv(c.env);
  if (!cfg) {
    // Not configured yet — don't lose the lead, surface it in the logs.
    console.warn("LEAD (Odoo not configured):", JSON.stringify({ ...lead, at: new Date().toISOString() }));
    return c.json({ ok: true, code: "NOT_CONFIGURED", message: "Bericht wird erstellt." });
  }

  const brand = resolveBrand(c.env, new URL(c.req.url).host);
  const result = await createLead(cfg, lead, { marketing: brand.odoo });
  if (!result.ok) {
    console.error("LEAD Odoo push failed:", result.code, result.message, JSON.stringify(lead));
    // Best-effort: still let the user through to their report.
    return c.json({ ok: true, code: result.code, message: "Bericht wird erstellt." });
  }
  // Lead-Substanz: Befunde + Ampel + Scan-Zähler NACH der Antwort anreichern —
  // serverseitig erhoben (autoritativ), kostet den Nutzer keine Wartezeit.
  if (domain && result.leadId) c.executionCtx.waitUntil(enrichLead(cfg, result.leadId, domain));
  return c.json({ ok: true, code: "OK", message: "Bericht wird erstellt.", leadId: result.leadId });
});

// ─── Befunde im Klartext + Technik-Ampel (serverseitige Erhebung) ─────────────
async function enrichLead(cfg: OdooConfig, leadId: number, domain: string): Promise<void> {
  try {
    const [email, dnssec, observatory] = await Promise.all([
      runEmailChecks(domain, []),
      analyzeDnssec(domain),
      analyzeObservatory(domain),
    ]);
    const obs = observatory?.data ?? null;
    const dmarcPolicy = (email.dmarc.data?.p as string | undefined) ?? null;
    const ampel = ampelFor({
      dmarcPolicy,
      dnssecGrade: dnssec.grade ?? null,
      obsGrade: obs?.grade ?? null,
    });
    const line = (label: string, check: { grade?: string | null; summary?: string }): string =>
      `${label}: ${check.grade ? `Note ${check.grade} — ` : ""}${check.summary ?? "—"}`;
    const befunde = [
      `Domain: ${domain}`,
      `DMARC-Policy: ${dmarcPolicy ?? "fehlt"}`,
      line("DMARC", email.dmarc),
      line("SPF", email.spf),
      line("DKIM", email.dkim),
      line("MX", email.mx),
      line("MTA-STS", email.mtaSts),
      line("TLS-RPT", email.tlsRpt),
      line("DNSSEC", dnssec),
      `Website (HTTP Observatory): ${obs ? `Note ${obs.grade} (${obs.testsPassed}/${obs.testsQuantity} Tests bestanden)` : "—"}`,
      `Technik-Ampel: ${ampel}`,
    ].join("\n");
    await writeLeadFindings(cfg, leadId, { befunde, ampel, domain });
  } catch (err) {
    console.warn("Lead-Anreicherung fehlgeschlagen:", err instanceof Error ? err.message : String(err));
  }
}

// ─── /pentest-Scoping: qualifizierte Pentest-Anfrage → Odoo ───────────────────
const SCOPING_TEXT_MAX = 2000;
function scopingStr(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
}

app.post("/api/pentest-lead", async (c) => {
  if (isCrossOrigin(c.req.header("Origin"), c.req.url)) return c.json(CROSS_ORIGIN_DENIED, 403);
  const brand = resolveBrand(c.env, new URL(c.req.url).host);
  if (!brand.funnel) return c.json({ ok: false, code: "NOT_FOUND", message: "Nicht verfügbar." }, 404);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, code: "BAD_REQUEST", message: "Ungültige Anfrage." }, 400);
  }
  if (body.consent !== true) {
    return c.json(
      { ok: false, code: "NO_CONSENT", message: "Bitte stimmen Sie der Verarbeitung Ihrer Angaben zu." },
      400,
    );
  }
  if (!validateEmail(body.email)) {
    return c.json(
      { ok: false, code: "INVALID_EMAIL", message: "Bitte geben Sie eine gültige E-Mail-Adresse ein." },
      400,
    );
  }
  const company = scopingStr(body.company);
  const contactName = scopingStr(body.name);
  if (!company || !contactName) {
    return c.json(
      { ok: false, code: "MISSING_FIELDS", message: "Bitte füllen Sie Firma und Name aus." },
      400,
    );
  }
  const scoping: ScopingInput = {
    company,
    contactName,
    role: scopingStr(body.role),
    phone: scopingStr(body.phone, 60),
    testart: scopingStr(body.testart),
    umfang: scopingStr(body.umfang, SCOPING_TEXT_MAX),
    anlass: scopingStr(body.anlass),
    frist: scopingStr(body.frist),
    freitext: scopingStr(body.freitext, SCOPING_TEXT_MAX),
  };
  const email = (body.email as string).trim();
  // Dubletten-/Befund-Schlüssel: die Domain der geschäftlichen Absenderadresse.
  const domain = normalizeDomain(email.split("@")[1] ?? "") ?? undefined;
  const lead = { email, domain, consent: true, channel: "pentest-scoping" as const, scoping };

  const cfg = odooConfigFromEnv(c.env);
  if (!cfg) {
    console.warn("PENTEST-LEAD (Odoo not configured):", JSON.stringify({ ...lead, at: new Date().toISOString() }));
    return c.json({ ok: true, code: "NOT_CONFIGURED", message: "Anfrage erhalten." });
  }
  const result = await createLead(cfg, lead, { marketing: brand.odoo });
  if (!result.ok) {
    console.error("PENTEST-LEAD Odoo push failed:", result.code, result.message, JSON.stringify(lead));
    return c.json({ ok: true, code: result.code, message: "Anfrage erhalten." });
  }
  if (domain && result.leadId) c.executionCtx.waitUntil(enrichLead(cfg, result.leadId, domain));
  return c.json({ ok: true, code: "OK", message: "Anfrage erhalten.", leadId: result.leadId });
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
  const brand = resolveBrand(c.env, new URL(c.req.url).host);
  const logoPath = brand.app.letterheadLogo;
  const logoMime = logoPath.endsWith(".svg") ? "image/svg+xml" : "image/png";
  let css = "";
  let inlineHtml = html;
  try {
    const [cssResp, logoResp] = await Promise.all([
      c.env.ASSETS.fetch(new Request(`${origin}/styles.css`)),
      c.env.ASSETS.fetch(new Request(`${origin}${logoPath}`)),
    ]);
    if (cssResp.ok) css = (await cssResp.text()) + sitePaletteCss(brand);
    if (logoResp.ok) {
      const buf = new Uint8Array(await logoResp.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) {
        bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      }
      inlineHtml = html.replaceAll(logoPath, `data:${logoMime};base64,${btoa(bin)}`);
    }
  } catch {
    /* fall back to linked stylesheet / external logo */
  }

  try {
    const pdf = await renderReportPdf(c.env.BROWSER, { html: inlineHtml, origin, css });
    const base = check
      ? `${brand.app.filenameSingle}-${check}-${domain}`
      : `${brand.app.filenameFull}-${domain}`;
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

// Pentest-Seite (nur Marken mit Lead-Strecke; sonst greift der SPA-Fallback).
app.get("/pentest", async (c, next) => {
  const brand = resolveBrand(c.env, new URL(c.req.url).host);
  if (!brand.funnel) return next();
  return c.env.ASSETS.fetch(new Request(new URL("/pentest.html", c.req.url)));
});

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
/**
 * Validate a sales-rep object posted from the report generator. It becomes the
 * report's "partner" card (the conductor/persona stays the brand default). All
 * fields are HTML-escaped at render time; here we coerce to strings, cap lengths
 * and require at least a name + e-mail.
 */
function parseRepInput(v: unknown): BrandContact | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const s = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
  const opt = (x: unknown, max: number) => s(x, max) || undefined;
  const name = s(o.name, 120);
  const mail = s(o.mail, 200);
  if (!name || !mail) return null;
  return {
    name,
    role: s(o.role, 120),
    org: s(o.org, 160),
    mail,
    tel: s(o.tel, 60),
    mobile: opt(o.mobile, 60),
    fax: opt(o.fax, 60),
    addr: s(o.addr, 200),
    web: s(o.web, 120),
    short: opt(o.short, 80),
  };
}

// Sales reps selectable in the report generator: the active brand's defaults.
// The UI merges these with reps the user added locally (localStorage).
app.get("/api/report-reps", async (c) => {
  if (!(await isReportAuthed(c))) {
    return c.json({ ok: false, code: "UNAUTHORIZED", message: "Bitte zuerst anmelden." }, 401);
  }
  const brand = resolveBrand(c.env, new URL(c.req.url).host);
  const reps =
    brand.report.reps && brand.report.reps.length
      ? brand.report.reps
      : brand.report.partner
        ? [brand.report.partner]
        : [];
  return c.json({ reps }, 200, { "Cache-Control": "no-store" });
});

app.post("/api/generate-report", async (c) => {
  if (isCrossOrigin(c.req.header("Origin"), c.req.url)) return c.json(CROSS_ORIGIN_DENIED, 403);
  if (!(await isReportAuthed(c))) {
    return c.json({ ok: false, code: "UNAUTHORIZED", message: "Bitte zuerst anmelden." }, 401);
  }
  if (!c.env.BROWSER) {
    return c.json({ ok: false, code: "NO_BROWSER", message: "PDF-Rendering nicht verfügbar." }, 503);
  }

  let body: { domain?: unknown; rep?: unknown };
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
  // Active brand, with the partner card swapped to the picked sales rep (if any).
  const baseBrand = resolveBrand(c.env, new URL(c.req.url).host);
  const rep = parseRepInput(body.rep);
  const brand = rep ? { ...baseBrand, report: { ...baseBrand.report, partner: rep } } : baseBrand;
  const wordmarkMime = brand.report.wordmarkAsset.endsWith(".svg") ? "image/svg+xml" : "image/png";
  const foxMime = brand.report.foxAsset.endsWith(".svg") ? "image/svg+xml" : "image/png";
  let css = "";
  let logoWordmark = "";
  let logoFox = "";
  try {
    const [cssResp, wmResp, foxResp] = await Promise.all([
      c.env.ASSETS.fetch(new Request(`${origin}/assets/report.css`)),
      c.env.ASSETS.fetch(new Request(`${origin}${brand.report.wordmarkAsset}`)),
      c.env.ASSETS.fetch(new Request(`${origin}${brand.report.foxAsset}`)),
    ]);
    if (cssResp.ok) css = (await cssResp.text()) + reportPaletteCss(brand);
    if (wmResp.ok) logoWordmark = `data:${wordmarkMime};base64,${bufToBase64(await wmResp.arrayBuffer())}`;
    if (foxResp.ok) logoFox = `data:${foxMime};base64,${bufToBase64(await foxResp.arrayBuffer())}`;
  } catch {
    /* fall back to an unstyled / logoless render rather than failing outright */
  }

  const reportBody = buildReportBody(
    domain,
    analyze,
    observatory,
    { wordmark: logoWordmark, fox: logoFox },
    brand,
  );
  if (reportBody.length > MAX_HTML_BYTES) {
    return c.json({ ok: false, code: "TOO_LARGE", message: "Report zu groß." }, 500);
  }

  try {
    const pdf = await renderReportPdf(c.env.BROWSER, { html: reportBody, origin, css });
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${brand.report.filenamePrefix}-${domain}.pdf"`,
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
  const brand = resolveBrand(c.env, new URL(c.req.url).host);
  if (brand.id === DEFAULT_BRAND.id) return c.env.ASSETS.fetch(c.req.raw);
  // Rewriting brands: the asset ETag describes the FILE, not our per-brand
  // rewrite, so a conditional request would get a 304 and leave the browser on
  // a stale, un-rewritten copy (e.g. missing the Pentest tab) forever. Always
  // ask for the full body; the rewrite step then strips the stale validators.
  const req = new Request(c.req.raw);
  req.headers.delete("If-None-Match");
  req.headers.delete("If-Modified-Since");
  return c.env.ASSETS.fetch(req);
});

export default app;
