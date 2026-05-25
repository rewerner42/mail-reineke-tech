import { Hono } from "hono";
import { cors } from "hono/cors";
import { analyzeDmarc } from "./analyzers/dmarc.js";
import { analyzeSpf } from "./analyzers/spf.js";
import { analyzeDkim } from "./analyzers/dkim.js";
import { analyzeMx } from "./analyzers/mx.js";
import { analyzeMtaSts } from "./analyzers/mta-sts.js";
import { analyzeTlsRpt } from "./analyzers/tls-rpt.js";
import { analyzeDnssec } from "./analyzers/dnssec.js";
import { analyzeObservatory, fetchGradeDistribution } from "./observatory.js";
import { createLead, odooConfigFromEnv, validateEmail } from "./leads/odoo.js";
import type { AnalysisResponse } from "./types.js";

type Bindings = {
  ASSETS: Fetcher;
  // Odoo CRM lead capture (set as Worker secrets; see README).
  ODOO_URL?: string;
  ODOO_DB?: string;
  ODOO_USERNAME?: string;
  ODOO_API_KEY?: string;
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

// Global Observatory grade distribution — powers the benchmark chart.
app.get("/api/grade-distribution", async (c) => {
  const distribution = await fetchGradeDistribution();
  return c.json({ distribution }, 200, { "Cache-Control": "public, max-age=86400" });
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

// Lead capture: the report download is gated behind an e-mail + DSGVO consent.
// We enforce a valid e-mail and explicit consent here, then best-effort push the
// lead into Odoo CRM. A configuration/Odoo failure must NOT block the user from
// their report, so we log the lead (observability) and still return ok.
app.post("/api/lead", async (c) => {
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

// Static assets fallback (frontend)
app.get("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
