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
import {
  buildCustomerEmail,
  buildPentestEmail,
  buildReportFailureAlert,
  sendMail,
  type LeadKind,
  type PentestNotification,
} from "./leads/notify.js";
import { MAX_HTML_BYTES, renderReportPdf } from "./pdf/render.js";
import { buildReportBody } from "./report/build.js";
import {
  resolveBrand,
  BRANDS,
  DEFAULT_BRAND,
  applyBrandToHtml,
  reportPaletteCss,
} from "./brand.js";
import type { Brand, BrandContact } from "./brand.js";
import type { BrowserWorker } from "@cloudflare/puppeteer";
import type { AnalysisResponse } from "./types.js";
import { normalizeDomain } from "./domain.js";
import { parseReportRequest } from "./leads/report-request.js";

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
  // Resend-API-Key für die Sofort-Benachrichtigung (optional; ohne ihn still aus).
  RESEND_API_KEY?: string;
  // Turnstile-Secret zur Prüfung des Formular-Tokens (optional).
  TURNSTILE_SECRET?: string;
  /** Kommagetrennte Adressen, die Widerspruch eingelegt haben — kein Versand. */
  SUPPRESSED_EMAILS?: string;
  // White-label brand id (e.g. "wsit") set per Worker env; falls back to Host.
  BRAND?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Security headers on EVERY response — including the static assets served via the
// ASSETS binding (so we rebuild the response to attach them reliably). Hardens the
// tool itself and fixes its own HTTP-Observatory grade. The CSP allows our own
// origin plus the brand's consent-gated analytics (Umami) — brands without
// analytics get a CSP with no third-party origin at all; script-src stays
// free of 'unsafe-inline'. Brand files never change at runtime → cache per id.
const CSP_CACHE = new Map<string, string>();
export function cspFor(brand: Brand): string {
  const cached = CSP_CACHE.get(brand.id);
  if (cached) return cached;
  // Older client-branch brand files have no `analytics` field — they behave like
  // the default brand (see Brand.analytics), so mirror its origins here too.
  const a = brand.analytics ?? DEFAULT_BRAND.analytics;
  // Umami lädt das Skript von cloud.umami.is, sendet die Ereignisse aber an
  // gateway.umami.is — ohne beide Herkünfte blockiert die CSP still die Messung.
  const umamiScript = a?.umamiId ? " https://cloud.umami.is" : "";
  const umamiSend = a?.umamiId ? " https://cloud.umami.is https://gateway.umami.is" : "";
  // Turnstile lädt sein Skript und rendert die Challenge in einem iframe.
  const ts = brand.funnel?.turnstileSiteKey ? " https://challenges.cloudflare.com" : "";
  // PostHog lädt Zusatzmodule nach und wechselt seine Hosts über die Zeit —
  // deshalb empfiehlt der Anbieter die Platzhalter-Schreibweise *.posthog.com.
  const ph = a?.posthogToken ? " https://*.posthog.com" : "";
  const csp = [
    "default-src 'self'",
    `script-src 'self'${umamiScript}${ts}${ph}`,
    `connect-src 'self'${umamiSend}${ts}${ph}`,
    `frame-src 'self'${ts}`,
    // PostHogs Recorder laeuft in einem Worker aus einem Blob. Die Doku des
    // Anbieters nennt blob: UND data: -- data: fehlte hier.
    ...(ph ? ["worker-src 'self' blob: data:"] : []),
    "img-src 'self' data:",
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

// ─── Befunde im Klartext + Technik-Ampel (serverseitige Erhebung) ─────────────
async function enrichLead(
  cfg: OdooConfig,
  leadId: number,
  domain: string,
): Promise<{ befunde: string; ampel: string } | null> {
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
    return { befunde, ampel };
  } catch (err) {
    console.warn("Lead-Anreicherung fehlgeschlagen:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Sofort-Benachrichtigung (Resend) — zweiter Kanal neben Odoo. Läuft NACH der
// Anreicherung, damit Befunde und Ampel enthalten sind; scheitert sie, ist das
// für den Nutzer folgenlos.
async function notifyPentestLead(
  env: Bindings,
  origin: string,
  brand: Brand,
  base: PentestNotification,
  enrich: Promise<{ befunde: string; ampel: string } | null>,
  skipCustomerMail = false,
): Promise<void> {
  const cfg = brand.funnel?.notify;
  const key = env.RESEND_API_KEY;
  if (!cfg || !key) return;

  const [found, logo] = await Promise.all([
    enrich.catch(() => null),
    brandLogoBase64(env, origin, brand),
  ]);
  const n: PentestNotification = { ...base, befunde: found?.befunde, ampel: found?.ampel };

  // 1) Interne Benachrichtigung — Antworten geht direkt an den Interessenten.
  const intern = buildPentestEmail(n, logo ?? undefined);
  const a = await sendMail(key, {
    from: cfg.from,
    to: cfg.to,
    replyTo: n.email,
    subject: intern.subject,
    html: intern.html,
    attachments: intern.attachments,
  });
  if (!a.ok) console.warn("Resend (intern) fehlgeschlagen:", a.error);

  // 2) Eingangsbestätigung an den Interessenten — mit Sicherheitsbericht im Anhang.
  if (skipCustomerMail) return;
  const to = cfg.customerCopyTo ?? n.email;
  let pdf: Uint8Array | null = null;
  let pdfFehler: string | null = null;
  // Der Bericht gilt der GEPRÜFTEN Domain; nur wenn keine angefordert wurde,
  // fällt er auf die Domain der E-Mail-Adresse zurück.
  const berichtsDomain = n.reportDomain ?? n.domain;
  if (berichtsDomain) {
    try {
      pdf = await buildReportPdf(env, origin, berichtsDomain, reportBrandFor(brand, n.kind));
      if (!pdf) pdfFehler = "Browser Rendering nicht verfügbar oder Report zu groß.";
    } catch (err) {
      pdfFehler = err instanceof Error ? err.message : String(err);
      console.warn("Bericht für Kundenmail nicht erstellt:", pdfFehler);
    }
  }
  // Wer einen Bericht ANGEFORDERT hat und keinen bekommt, erzeugt Nacharbeit —
  // die muss jemand mitbekommen, nicht nur das Protokoll.
  if (pdfFehler && n.kind === "bericht") {
    const alarm = buildReportFailureAlert(n, pdfFehler);
    const al = await sendMail(key, { from: cfg.from, to: cfg.to, subject: alarm.subject, html: alarm.html });
    if (!al.ok) console.error("Alarmmail fehlgeschlagen:", al.error);
  }
  const kunde = buildCustomerEmail(n, {
    bookingUrl: brand.funnel!.bookingUrl,
    hasReport: Boolean(pdf),
    logoBase64: logo ?? undefined,
  });
  const attachments = [...(logo ? buildPentestEmail(n, logo).attachments : [])];
  if (pdf && berichtsDomain) {
    attachments.push({
      filename: `${brand.report.filenamePrefix}-${berichtsDomain}.pdf`,
      content: bufToBase64(pdf.buffer as ArrayBuffer),
      content_type: "application/pdf",
    });
  }
  const b = await sendMail(key, {
    from: cfg.from,
    to,
    replyTo: cfg.to,
    subject: kunde.subject,
    html: kunde.html,
    attachments,
  });
  if (!b.ok) console.warn("Resend (Kunde) fehlgeschlagen:", b.error);
}

/**
 * Trennungsregel: Ein Selbstbedienungsbericht trägt ausschließlich die feste
 * Markenkarte. Wer nicht angemeldet ist, darf nie bestimmen, welche Person auf
 * dem Dokument als Ansprechpartner erscheint. Heute hält das nur zufällig —
 * `reineke.report.partner` ist `null`; sobald dort eine Karte oder `reps`
 * stünden, trüge der Bericht sie stillschweigend mit.
 */
function reportBrandFor(brand: Brand, kind: LeadKind | undefined): Brand {
  if (kind !== "bericht") return brand;
  return { ...brand, report: { ...brand.report, partner: null, reps: undefined } };
}

// ─── Bericht als PDF (nur Kundenmail; /api/generate-report baut eigenständig) ─
async function buildReportPdf(
  env: Bindings,
  origin: string,
  domain: string,
  brand: Brand,
): Promise<Uint8Array | null> {
  if (!env.BROWSER) return null;
  const [email, dnssec, observatory] = await Promise.all([
    runEmailChecks(domain, []),
    analyzeDnssec(domain),
    analyzeObservatory(domain),
  ]);
  const analyze: AnalysisResponse = { domain, queriedAt: new Date().toISOString(), ...email, dnssec };
  const wordmarkMime = brand.report.wordmarkAsset.endsWith(".svg") ? "image/svg+xml" : "image/png";
  const foxMime = brand.report.foxAsset.endsWith(".svg") ? "image/svg+xml" : "image/png";
  let css = "";
  let logoWordmark = "";
  let logoFox = "";
  try {
    const [cssResp, wmResp, foxResp] = await Promise.all([
      env.ASSETS.fetch(new Request(`${origin}/assets/report.css`)),
      env.ASSETS.fetch(new Request(`${origin}${brand.report.wordmarkAsset}`)),
      env.ASSETS.fetch(new Request(`${origin}${brand.report.foxAsset}`)),
    ]);
    if (cssResp.ok) css = (await cssResp.text()) + reportPaletteCss(brand);
    if (wmResp.ok) logoWordmark = `data:${wordmarkMime};base64,${bufToBase64(await wmResp.arrayBuffer())}`;
    if (foxResp.ok) logoFox = `data:${foxMime};base64,${bufToBase64(await foxResp.arrayBuffer())}`;
  } catch {
    /* lieber ungestylt rendern als gar nicht */
  }
  const html = buildReportBody(domain, analyze, observatory, { wordmark: logoWordmark, fox: logoFox }, brand);
  if (html.length > MAX_HTML_BYTES) return null;
  return renderReportPdf(env.BROWSER, { html, origin, css });
}

/** Markenlogo als base64 — wird der Mail angehängt und per cid: eingebettet. */
async function brandLogoBase64(env: Bindings, origin: string, brand: Brand): Promise<string | null> {
  try {
    const r = await env.ASSETS.fetch(new Request(`${origin}${brand.app.letterheadLogo}`));
    if (!r.ok) return null;
    return bufToBase64(await r.arrayBuffer());
  } catch {
    return null;
  }
}

// ─── Zählgrenze pro IP ───────────────────────────────────────────────────────
// Zweck: verhindern, dass eine einzelne Quelle in Serie Bestätigungsmails an
// fremde Adressen auslöst. Turnstile fängt Skripte ab, diese Grenze den Rest.
//
// Speicher ist der Edge-Cache (kein KV/Durable Object nötig). Bewusste
// Einschränkung: Der Zähler gilt je Rechenzentrum. Eine einzelne IP wird
// normalerweise stets zum selben Standort geleitet, ein weltweit verteilter
// Angreifer könnte die Grenze aber umgehen — für den Missbrauchsfall hinter
// Turnstile reicht das, exakte Buchführung wäre KV-Sache.
const RATE_LIMIT = 6; // Anfragen …
const RATE_WINDOW_SEC = 3600; // … je Stunde und Zähler

/**
 * Zählt eine Anfrage und meldet, ob die Grenze überschritten ist.
 * `scope` trennt die Strecken (Pentest / Bericht) und die Bezugsgröße
 * (IP / Empfängeradresse) in eigene Zähler — sonst verbraucht die
 * niederschwellige Berichtsanfrage das Kontingent der Pentest-Anfrage.
 */
async function rateLimitExceeded(
  origin: string,
  scope: string,
  id: string | undefined,
  max: number = RATE_LIMIT,
): Promise<boolean> {
  if (!id) return false; // ohne Bezugsgröße nicht raten — lieber durchlassen
  try {
    const cache = caches.default;
    // Der Edge-Cache akzeptiert nur Schlüssel innerhalb der eigenen Zone —
    // ein Fantasie-Host würde still verworfen.
    const key = new Request(`${origin}/__ratelimit/${scope}/${encodeURIComponent(id)}`);
    const now = Math.floor(Date.now() / 1000);
    let count = 0;
    let expires = now + RATE_WINDOW_SEC;
    const hit = await cache.match(key);
    if (hit) {
      const [c, e] = (await hit.text()).split("|");
      const storedExpiry = Number(e);
      if (storedExpiry > now) {
        count = Number(c) || 0;
        expires = storedExpiry; // Fenster NICHT verlängern
      }
    }
    if (count >= max) return true;
    await cache.put(
      key,
      new Response(`${count + 1}|${expires}`, {
        headers: { "Cache-Control": `max-age=${Math.max(1, expires - now)}` },
      }),
    );
    return false;
  } catch {
    return false; // Zählfehler darf keine Anfrage kosten
  }
}

// ─── Turnstile: Bot-Abwehr am Scoping-Formular ───────────────────────────────
// Bewusst zweigeteilt: ein FALSCHER Token wird abgewiesen (das ist der
// Angriffsfall), ein NICHT ERREICHBARER Dienst nicht — sonst kostet uns eine
// Störung bei Cloudflare echte Anfragen. Der Lead wird dann als ungeprüft
// markiert, damit der Unterschied im CRM sichtbar bleibt.
type TurnstileResult = "ok" | "invalid" | "unverified";

async function verifyTurnstile(
  secret: string,
  token: unknown,
  ip: string | undefined,
): Promise<TurnstileResult> {
  if (typeof token !== "string" || !token) return "invalid";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!r.ok) return "unverified";
    const body = (await r.json()) as { success?: boolean };
    return body.success ? "ok" : "invalid";
  } catch {
    return "unverified"; // Dienststörung darf keine Anfrage kosten
  } finally {
    clearTimeout(timer);
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
  const origin = new URL(c.req.url).origin;
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
  let botCheck: TurnstileResult = "ok";
  if (brand.funnel.turnstileSiteKey && c.env.TURNSTILE_SECRET) {
    botCheck = await verifyTurnstile(
      c.env.TURNSTILE_SECRET,
      body["cf-turnstile-response"],
      c.req.header("CF-Connecting-IP"),
    );
    if (botCheck === "invalid") {
      return c.json(
        {
          ok: false,
          code: "BOT_CHECK_FAILED",
          message: "Die Sicherheitsprüfung ist fehlgeschlagen. Bitte laden Sie die Seite neu.",
        },
        403,
      );
    }
  }
  if (!validateEmail(body.email)) {
    return c.json(
      { ok: false, code: "INVALID_EMAIL", message: "Bitte geben Sie eine gültige E-Mail-Adresse ein." },
      400,
    );
  }
  // Über der Grenze: Anfrage wird trotzdem erfasst und intern gemeldet — nur die
  // Bestätigungsmail an den Interessenten entfällt, damit niemand fremde
  // Postfächer zumüllen kann.
  const throttled = await rateLimitExceeded(origin, "pentest", c.req.header("CF-Connecting-IP"));
  const company = scopingStr(body.company);
  // Vorname/Nachname getrennt erfasst; `name` bleibt als Rückfallebene erhalten,
  // damit ältere Formularstände weiterhin angenommen werden.
  const firstName = scopingStr(body.firstName, 100);
  const lastName = scopingStr(body.lastName, 100);
  const contactName = [firstName, lastName].filter(Boolean).join(" ") || scopingStr(body.name);
  if (!company || !contactName) {
    return c.json(
      { ok: false, code: "MISSING_FIELDS", message: "Bitte füllen Sie Firma, Vorname und Nachname aus." },
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
  const lead = {
    email,
    domain,
    consent: true,
    channel: "pentest-scoping" as const,
    scoping:
      botCheck === "unverified"
        ? { ...scoping, freitext: `${scoping.freitext ?? ""}\n[Hinweis: Bot-Prüfung war nicht erreichbar]`.trim() }
        : scoping,
  };

  const notifyBase: PentestNotification = {
    company,
    contactName,
    role: scoping.role,
    email,
    phone: scoping.phone,
    testart: scoping.testart,
    umfang: scoping.umfang,
    anlass: scoping.anlass,
    frist: scoping.frist,
    freitext: scoping.freitext,
    domain,
    toolUrl: brand.report.toolUrl,
  };

  const cfg = odooConfigFromEnv(c.env);
  if (!cfg) {
    console.warn("PENTEST-LEAD (Odoo not configured):", JSON.stringify({ ...lead, at: new Date().toISOString() }));
    // Ohne CRM bleibt die Benachrichtigung der einzige Kanal — trotzdem senden.
    c.executionCtx.waitUntil(notifyPentestLead(c.env, origin, brand, notifyBase, Promise.resolve(null), throttled));
    return c.json({ ok: true, code: "NOT_CONFIGURED", message: "Anfrage erhalten." });
  }
  const result = await createLead(cfg, lead, { marketing: brand.odoo });
  if (!result.ok) {
    console.error("PENTEST-LEAD Odoo push failed:", result.code, result.message, JSON.stringify(lead));
    c.executionCtx.waitUntil(notifyPentestLead(c.env, origin, brand, notifyBase, Promise.resolve(null), throttled));
    return c.json({ ok: true, code: result.code, message: "Anfrage erhalten." });
  }
  // Anreicherung einmal starten; Odoo schreibt sie, die Benachrichtigung wartet darauf.
  const enrich =
    domain && result.leadId ? enrichLead(cfg, result.leadId, domain) : Promise.resolve(null);
  c.executionCtx.waitUntil(enrich);
  c.executionCtx.waitUntil(
    notifyPentestLead(c.env, origin, brand, { ...notifyBase, leadId: result.leadId }, enrich, throttled),
  );
  return c.json({
    ok: true,
    code: throttled ? "RATE_LIMITED" : "OK",
    message: throttled
      ? "Ihre Anfrage liegt uns bereits vor — wir melden uns innerhalb von 2 Werktagen. Wenn es eilt, buchen Sie direkt einen Termin oder rufen Sie an: +49 172 2872390."
      : "Anfrage erhalten.",
    leadId: result.leadId,
  });
});

// ─── /bericht: Selbstbedienungs-Berichtsanfrage ───────────────────────────────
// Bewusst von /api/pentest-lead getrennt: eigene Zähler, eigene Pflichtfelder,
// eigene Texte — und ein eingefrorener Vertrag für die Pentest-Strecke.
//
// TRENNUNG zum passwortgeschützten Generator (/report):
//   • kein Anmeldezustand — `isReportAuthed` wird hier nie aufgerufen
//   • keine Vertriebsmitarbeiter-Auswahl (siehe `reportBrandFor`)
//   • das PDF verlässt diesen Weg NUR per E-Mail, nie in der Antwort
//   • Turnstile + drei Zähler + CRM-Spur statt Passwort

/** Wortlaut der Werbeeinwilligung — muss mit public/bericht.html übereinstimmen.
 *  Bei jeder Textänderung die Fassung hochzählen, sonst ist der Nachweis wertlos. */
const CONTACT_CONSENT_VERSION = "2026-08-26";
const CONTACT_CONSENT_WORDING =
  "Die Reineke Technik GmbH darf mich zu diesem Bericht und zu ihren Leistungen rund um " +
  "IT-Sicherheit per E-Mail und Telefon kontaktieren. Ich kann das jederzeit widerrufen.";

/** Adressen, die Widerspruch eingelegt haben (Worker-Variable SUPPRESSED_EMAILS,
 *  kommagetrennt). Bewusst schlicht: Der Fall ist selten und wird von Hand
 *  gepflegt — aber ohne diese Sperre könnte die Anfrage eines Dritten dieselbe
 *  Adresse jederzeit erneut anschreiben. */
function istGesperrt(env: Bindings, email: string): boolean {
  const list = env.SUPPRESSED_EMAILS;
  if (!list) return false;
  const ziel = email.trim().toLowerCase();
  return list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(ziel);
}

const REPORT_RATE_IP = 6; // Berichte je Stunde und IP
const REPORT_RATE_ADDRESS = 3; // … je Stunde und Empfängeradresse
const REPORT_RATE_PAIR = 2; // dieselbe Adresse + dieselbe Domain
// Nicht 1: Die Zähler laufen hoch, BEVOR der Bericht im Hintergrund gebaut ist.
// Bei 1 sperrt ein fehlgeschlagener Versand den Nutzer eine Stunde für genau
// seine Anfrage aus. Zwei erlaubt den einen Wiederholversuch, stoppt aber Schleifen.

app.post("/api/report-request", async (c) => {
  if (isCrossOrigin(c.req.header("Origin"), c.req.url)) return c.json(CROSS_ORIGIN_DENIED, 403);
  const origin = new URL(c.req.url).origin;
  const brand = resolveBrand(c.env, new URL(c.req.url).host);
  if (!brand.funnel) return c.json({ ok: false, code: "NOT_FOUND", message: "Nicht verfügbar." }, 404);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, code: "BAD_REQUEST", message: "Ungültige Anfrage." }, 400);
  }

  // Bot-Abwehr: Anders als beim Scoping-Formular wird hier ABGELEHNT, wenn die
  // Prüfung gar nicht eingerichtet ist. Dieser Weg verschickt Anhänge an frei
  // eingetippte Adressen — ohne Bot-Abwehr darf er nicht laufen.
  let botCheck: TurnstileResult = "ok";
  if (brand.funnel.turnstileSiteKey) {
    if (!c.env.TURNSTILE_SECRET) {
      console.error("BERICHT abgewiesen: TURNSTILE_SECRET fehlt, Sitekey ist gesetzt.");
      return c.json(
        { ok: false, code: "NOT_CONFIGURED", message: "Der Versand ist gerade nicht verfügbar. Bitte rufen Sie uns an." },
        503,
      );
    }
    botCheck = await verifyTurnstile(
      c.env.TURNSTILE_SECRET,
      body["cf-turnstile-response"],
      c.req.header("CF-Connecting-IP"),
    );
    if (botCheck === "invalid") {
      return c.json(
        { ok: false, code: "BOT_CHECK_FAILED", message: "Die Sicherheitsprüfung ist fehlgeschlagen. Bitte laden Sie die Seite neu." },
        403,
      );
    }
  }

  const parsed = parseReportRequest(body);
  if (!parsed.ok) {
    return c.json({ ok: false, code: parsed.code, message: parsed.message }, parsed.status);
  }
  const { email, contactName, reportDomain, company, phone } = parsed.fields;
  const ip = c.req.header("CF-Connecting-IP");
  // Drei Zähler, kurzschließend: IP gegen Serienmissbrauch, Adresse gegen das
  // Zumüllen eines fremden Postfachs, Paar gegen die versehentliche Doppelanfrage.
  const throttled =
    istGesperrt(c.env, email) ||
    (await rateLimitExceeded(origin, "bericht-ip", ip, REPORT_RATE_IP)) ||
    (await rateLimitExceeded(origin, "bericht-adr", email.toLowerCase(), REPORT_RATE_ADDRESS)) ||
    (await rateLimitExceeded(origin, "bericht-paar", `${email.toLowerCase()}|${reportDomain}`, REPORT_RATE_PAIR));

  // Angefragte Domain im Zähler vermerken, auf dem das "Wiederholung =
  // Kaufsignal" des Vertriebs beruht. Der eigentliche Scan läuft erst im
  // Hintergrund (waitUntil) und kann noch scheitern — für dieses Signal zählt
  // die Nachfrage, nicht ihr Ergebnis.
  if (!throttled) recordDomainSafe(c, reportDomain);

  const scoping: ScopingInput = {
    company,
    contactName,
    phone,
    freitext:
      botCheck === "unverified" ? "[Hinweis: Bot-Prüfung war nicht erreichbar]" : undefined,
  };
  // Dubletten-Schlüssel bleibt die Domain der Absenderadresse: Sie sagt, WER der
  // Interessent ist. Die geprüfte Domain sagt, WORÜBER er etwas wissen will.
  const domain = parsed.fields.emailDomain;
  const lead = {
    email,
    domain,
    consent: true,
    channel: "bericht-anfrage" as const,
    scoping,
    reportDomain,
    contactConsent: {
      granted: parsed.fields.contactConsent,
      at: new Date().toISOString(),
      ip,
      wording: CONTACT_CONSENT_WORDING,
      version: CONTACT_CONSENT_VERSION,
    },
  };

  const notifyBase: PentestNotification = {
    kind: "bericht",
    company: company ?? contactName,
    contactName,
    email,
    phone,
    domain,
    reportDomain,
    toolUrl: brand.report.toolUrl,
  };

  // Ohne Resend gibt es keinen Versandweg. Dann darf die Antwort auch keine
  // Zustellung versprechen — sonst wartet der Nutzer auf etwas, das nie kommt.
  if (!c.env.RESEND_API_KEY || !brand.funnel.notify) {
    console.error("BERICHT: kein Versandweg (RESEND_API_KEY/notify fehlt) —", email, reportDomain);
    return c.json(
      {
        ok: false,
        code: "NO_MAILER",
        message:
          "Der automatische Versand ist gerade nicht verfügbar. Rufen Sie uns kurz an (+49 172 2872390) — " +
          "dann schicken wir Ihnen den Bericht von Hand.",
      },
      503,
    );
  }

  const cfg = odooConfigFromEnv(c.env);
  if (!cfg) {
    console.warn("BERICHT (Odoo nicht konfiguriert):", JSON.stringify({ ...lead, at: new Date().toISOString() }));
    c.executionCtx.waitUntil(notifyPentestLead(c.env, origin, brand, notifyBase, Promise.resolve(null), throttled));
    return c.json(reportRequestOk(throttled, email, reportDomain), 200, NO_STORE);
  }
  const result = await createLead(cfg, lead, { marketing: brand.odoo });
  if (!result.ok) {
    // Der Versand hängt bewusst NICHT am CRM: Ein Odoo-Ausfall darf niemanden
    // seinen Bericht kosten. Damit die Anfrage trotzdem nicht verschwindet,
    // wird sie hier laut protokolliert.
    console.error("BERICHT Odoo-Anlage fehlgeschlagen:", result.code, result.message, JSON.stringify(lead));
    c.executionCtx.waitUntil(notifyPentestLead(c.env, origin, brand, notifyBase, Promise.resolve(null), throttled));
    return c.json(reportRequestOk(throttled, email, reportDomain), 200, NO_STORE);
  }
  const enrich = domain && result.leadId ? enrichLead(cfg, result.leadId, domain) : Promise.resolve(null);
  c.executionCtx.waitUntil(enrich);
  c.executionCtx.waitUntil(
    notifyPentestLead(c.env, origin, brand, { ...notifyBase, leadId: result.leadId }, enrich, throttled),
  );
  return c.json(reportRequestOk(throttled, email, reportDomain, result.leadId), 200, NO_STORE);
});

const NO_STORE = { "Cache-Control": "no-store" } as const;

function reportRequestOk(throttled: boolean, email: string, domain: string, leadId?: number) {
  return {
    ok: true,
    code: throttled ? "RATE_LIMITED" : "OK",
    message: throttled
      ? `Aus Ihrem Netz wurden in der letzten Stunde schon mehrere Berichte angefordert — deshalb ` +
        `versenden wir nicht automatisch weiter. Ihre Anfrage liegt uns vor: Wir schicken den Bericht ` +
        `für ${domain} persönlich. Wenn es eilt: +49 172 2872390.`
      : `Wir prüfen ${domain} gerade live und schicken das PDF an ${email}. Das dauert ein bis zwei Minuten.`,
    leadId,
  };
}

app.get("/sitemap.xml", async (c, next) => {
  const brand = resolveBrand(c.env, new URL(c.req.url).host);
  if (!brand.seo) return next();
  // Bewusst ohne <lastmod>: Google ignoriert die Angabe, sobald sie unzuverlässig
  // ist — ein erfundenes Datum wäre schlechter als gar keines.
  const urls = brand.seo.sitemapPaths
    .map((p) => `  <url><loc>${brand.seo!.origin}${p}</loc></url>`)
    .join("\n");
  return c.body(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    200,
    { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "max-age=3600" },
  );
});

app.get("/robots.txt", async (c, next) => {
  const brand = resolveBrand(c.env, new URL(c.req.url).host);
  if (!brand.seo) return next();
  return c.body(
    `User-agent: *\nAllow: /\n\nSitemap: ${brand.seo.origin}/sitemap.xml\n`,
    200,
    { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "max-age=3600" },
  );
});

// Die drei Prüf-Ansichten sind EINE Datei; die Routen existieren nur, damit
// Deep-Links funktionieren. Ohne sie würde die 404-Behandlung sie verschlucken.
app.get("/website", (c) => c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url))));
app.get("/dnssec", (c) => c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url))));

app.get("/report", (c) => c.env.ASSETS.fetch(new Request(new URL("/report.html", c.req.url))));

// Pentest-Seite (nur Marken mit Lead-Strecke; sonst greift der SPA-Fallback).
app.get("/pentest", async (c, next) => {
  const brand = resolveBrand(c.env, new URL(c.req.url).host);
  if (!brand.funnel) return next();
  return c.env.ASSETS.fetch(new Request(new URL("/pentest.html", c.req.url)));
});

// Berichtsanfrage — dieselbe Bedingung. NICHT zu verwechseln mit /report:
// das ist der passwortgeschützte Vertriebsgenerator und bleibt unberührt.
app.get("/bericht", async (c, next) => {
  const brand = resolveBrand(c.env, new URL(c.req.url).host);
  if (!brand.funnel) return next();
  return c.env.ASSETS.fetch(new Request(new URL("/bericht.html", c.req.url)));
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
