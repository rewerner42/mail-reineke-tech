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

app.get("/api/health", (c) => c.json({ ok: true, service: "mail.reineke.tech" }));

app.get("/api/analyze", async (c) => {
  const domainInput = c.req.query("domain");
  const selectorParam = c.req.query("selectors");

  const domain = normalizeDomain(domainInput ?? "");
  if (!domain) {
    return c.json(
      {
        error: "INVALID_DOMAIN",
        message: "Bitte gib eine gültige Domain ein (z.B. reineke-technik.de).",
      },
      400,
    );
  }

  const extraSelectors = selectorParam
    ? selectorParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const queriedAt = new Date().toISOString();
  const [dmarc, spf, dkim, mx, mtaSts, tlsRpt, dnssec] = await Promise.all([
    analyzeDmarc(domain),
    analyzeSpf(domain),
    analyzeDkim(domain, extraSelectors),
    analyzeMx(domain),
    analyzeMtaSts(domain),
    analyzeTlsRpt(domain),
    analyzeDnssec(domain),
  ]);

  const response: AnalysisResponse = {
    domain,
    queriedAt,
    dmarc,
    spf,
    dkim,
    mx,
    mtaSts,
    tlsRpt,
    dnssec,
  };
  return c.json(response, 200, {
    "Cache-Control": "public, max-age=60",
  });
});

// Separate endpoint: MDN HTTP Observatory scan. Fresh scans take ~10s, so the
// frontend calls this independently and fills the card in progressively rather
// than blocking the fast DNS-based checks above.
app.get("/api/observatory", async (c) => {
  const domain = normalizeDomain(c.req.query("domain") ?? "");
  if (!domain) {
    return c.json(
      {
        error: "INVALID_DOMAIN",
        message: "Bitte gib eine gültige Domain ein (z.B. reineke-technik.de).",
      },
      400,
    );
  }

  const result = await analyzeObservatory(domain);
  return c.json(
    { domain, queriedAt: new Date().toISOString(), observatory: result },
    200,
    { "Cache-Control": "public, max-age=300" },
  );
});

// Static assets fallback (frontend)
app.get("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
