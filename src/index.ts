import { Hono } from "hono";
import { cors } from "hono/cors";
import { analyzeDmarc } from "./analyzers/dmarc.js";
import { analyzeSpf } from "./analyzers/spf.js";
import { analyzeDkim } from "./analyzers/dkim.js";
import { analyzeMx } from "./analyzers/mx.js";
import { analyzeMtaSts } from "./analyzers/mta-sts.js";
import { analyzeTlsRpt } from "./analyzers/tls-rpt.js";
import { analyzeDnssec } from "./analyzers/dnssec.js";
import { analyzeObservatory } from "./observatory.js";
import type { AnalysisResponse } from "./types.js";

type Bindings = {
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

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

app.get("/api/health", (c) => c.json({ ok: true, service: "mail.reineke.tech" }));

// E-mail tab: DMARC, SPF, DKIM, MX, MTA-STS, TLS-RPT.
app.get("/api/email", async (c) => {
  const domain = normalizeDomain(c.req.query("domain") ?? "");
  if (!domain) return c.json(INVALID_DOMAIN, 400);

  const email = await runEmailChecks(domain, parseSelectors(c.req.query("selectors")));
  return c.json(
    { domain, queriedAt: new Date().toISOString(), ...email },
    200,
    { "Cache-Control": "public, max-age=60" },
  );
});

// DNSSEC tab: chain-of-trust validation only (fast).
app.get("/api/dnssec", async (c) => {
  const domain = normalizeDomain(c.req.query("domain") ?? "");
  if (!domain) return c.json(INVALID_DOMAIN, 400);

  const dnssec = await analyzeDnssec(domain);
  return c.json(
    { domain, queriedAt: new Date().toISOString(), dnssec },
    200,
    { "Cache-Control": "public, max-age=60" },
  );
});

// Website tab: MDN HTTP Observatory scan. Fresh scans take ~10s, so this is its
// own endpoint and the frontend loads it independently with a progress state.
app.get("/api/observatory", async (c) => {
  const domain = normalizeDomain(c.req.query("domain") ?? "");
  if (!domain) return c.json(INVALID_DOMAIN, 400);

  const result = await analyzeObservatory(domain);
  return c.json(
    { domain, queriedAt: new Date().toISOString(), observatory: result },
    200,
    { "Cache-Control": "public, max-age=300" },
  );
});

// All-in-one endpoint (API consumers): every DNS-based check in one response.
app.get("/api/analyze", async (c) => {
  const domain = normalizeDomain(c.req.query("domain") ?? "");
  if (!domain) return c.json(INVALID_DOMAIN, 400);

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
  return c.json(response, 200, { "Cache-Control": "public, max-age=60" });
});

// Static assets fallback (frontend)
app.get("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
