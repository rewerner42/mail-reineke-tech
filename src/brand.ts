// ─── Brand layer (white-label) ───────────────────────────────────────────────
// One codebase serves multiple brands from separate Workers. Mainline brands:
// "sharp" (sharp.reineke.tech, partner channel — the DEFAULT brand: its values
// are the EXACT literals of the static files, so its output is byte-unchanged)
// and "reineke" (scan.reineke.tech, pure Reineke). Client white-labels live in
// their own file under src/brands/ and are registered on their client branch
// (one line in EXTRA below) — keeping the branch diff OFF the shared files.
//
// Selection (resolveBrand): env.BRAND (set per Wrangler environment — every
// deployment pins its brand) → Host match (local dev fallback) → default. For
// NON-default brands the response middleware (src/index.ts) rewrites the served
// HTML/CSS; for the default brand the middleware is a no-op.

import { sharp } from "./brands/sharp.js";
import { reineke } from "./brands/reineke.js";

export interface BrandContact {
  name: string;
  role: string;
  org: string;
  mail: string;
  tel: string;
  mobile?: string;
  fax?: string;
  addr: string;
  web: string;
  short?: string; // short org name in the report brand-foot parenthetical
}

export interface Brand {
  id: string;
  hosts: string[]; // Host fallback (used when env.BRAND is unset, e.g. local dev)
  privateAssets?: string[]; // asset paths owned by THIS brand; 404 on other brands' Workers
  // Consent-gated analytics; null id = service disabled for this brand. Absent
  // (older client-branch brand files) = fall back to the default brand's app.js
  // literals, i.e. behave like the default brand.
  analytics?: {
    umamiId: string | null; // Umami website-id (cookieless page analytics)
    leadfeederId: string | null; // Leadfeeder/Dealfront tracker id (firm identification)
  };
  // Pentest-Lead-Strecke (nur Reineke): schaltet die /pentest-Route frei, ersetzt
  // den primären CTA und hängt die "Der nächste Schritt"-Seite ans Besucher-PDF.
  funnel?: {
    pentestPath: string; // Route der Pentest-Seite, z.B. "/pentest"
    ctaLabel: string; // ersetzt den Default-CTA-Text ("Beratung anfragen")
    bookingUrl: string; // Terminbuchung (Scoping-Block + PDF-Abschlussseite)
  };

  // ── Static-HTML rewrite anchors/targets (applied for non-default brands) ──
  shortName: string; // replaceAll text anchor, e.g. "Reineke Technik"
  domain: string; // replaceAll URL anchor, e.g. "reineke-technik.de"
  themeColor: string; // <meta theme-color>
  headerLogo: string; // header brand logo asset path
  faviconIcon: string; // favicon asset path (icon + apple-touch)
  partnerLogoTag: string; // full header partner-logo <img …/> ("" to remove)
  reportPageLogo: string; // report.html login-page logo asset path
  contactHref: string; // CTA primary link
  footerStreetCity: string; // footer address line 1
  footerTelHref: string; // footer tel: href
  footerTelText: string; // footer tel display

  // ── Site palette → injected :root override (non-default only) ──
  sitePalette: {
    red: string;
    redDark: string;
    redSoft: string;
    accent: string; // hero bar + spark; default == red
    fail?: string; // omit on default (keeps styles.css `--fail: var(--rt-red)`)
    failBg?: string;
    brandLogoHeight: string; // e.g. "52px"
  };

  // ── In-app report letterhead + DSGVO lead gate (app.js reads via brand-data) ──
  app: {
    reportContact: {
      company: string;
      name: string;
      street: string;
      city: string;
      phone: string;
      email: string;
    };
    letterheadLogo: string;
    leadConsentCompany: string;
    leadDatenschutzHref: string;
    filenameFull: string; // /api/report-pdf full report
    filenameSingle: string; // /api/report-pdf single finding
  };

  // ── Server-side PDF report (src/report/build.ts + src/index.ts) ──
  report: {
    toolUrl: string; // "sharp.reineke.tech"
    layout?: "emblem"; // opt-in layout: centered emblem cover, brand-name page head, numbered footers
    conductor: BrandContact; // first contact card + "durchgeführt & erstellt von"
    partner: BrandContact | null; // second card (null = single-company); default when no rep picked
    reps?: BrandContact[]; // selectable sales reps in the /report generator (swap the partner card); first = default
    wordmarkAsset: string; // top wordmark logo asset (cover-top, page-heads, bf)
    foxAsset: string; // bottom fox logo asset (cover-fox, bf-fox)
    showFox: boolean; // render the separate fox logo
    wordmarkAlt: string; // alt text for the wordmark img
    offerHeading: string;
    offerLeadIn: string;
    coBrandLine: string | null; // method brand-foot "in Zusammenarbeit mit …"
    filenamePrefix: string; // /api/generate-report → "<prefix>-<domain>.pdf"
    palette: {
      red: string;
      redDark: string;
      accent: string;
      danger: string;
      angleBg: string;
      angleBorder: string;
      coverPartnerH: string; // .cover-wordmark height
      coverFoxH: string; // .cover-fox height
    };
  };

  // ── Odoo lead attribution (src/leads/odoo.ts) ──
  odoo: {
    referred: string;
    toolLabel: string; // "Lead über das <toolLabel> Sicherheits-Analyse-Tool (<referred>)."
  };
}

// Registry. `main` ships sharp + reineke; client branches append their brand
// to EXTRA (a single line) so the branch never edits the shared files.
const EXTRA: Brand[] = [];

export const DEFAULT_BRAND = sharp;
export const BRANDS: Record<string, Brand> = Object.fromEntries(
  [sharp, reineke, ...EXTRA].map((b) => [b.id, b]),
);

/** Resolve the active brand: env.BRAND var → Host match → default. */
export function resolveBrand(env: { BRAND?: string }, host: string): Brand {
  const byEnv = env.BRAND ? BRANDS[env.BRAND] : undefined;
  if (byEnv) return byEnv;
  const h = (host || "").toLowerCase();
  return Object.values(BRANDS).find((b) => b.hosts.includes(h)) ?? DEFAULT_BRAND;
}

/** CSS `:root{…}` override for the site palette (empty for the default brand). */
export function sitePaletteCss(brand: Brand): string {
  if (brand.id === DEFAULT_BRAND.id) return "";
  const p = brand.sitePalette;
  const parts = [
    `--rt-red:${p.red}`,
    `--rt-red-dark:${p.redDark}`,
    `--rt-red-soft:${p.redSoft}`,
    `--rt-accent:${p.accent}`,
    `--brand-logo-height:${p.brandLogoHeight}`,
  ];
  if (p.fail) parts.push(`--fail:${p.fail}`);
  if (p.failBg) parts.push(`--fail-bg:${p.failBg}`);
  return `:root{${parts.join(";")}}`;
}

/** CSS `:root{…}` override for the PDF report palette (empty for default). */
export function reportPaletteCss(brand: Brand): string {
  if (brand.id === DEFAULT_BRAND.id) return "";
  const p = brand.report.palette;
  return `:root{--rt-red:${p.red};--rt-red-dark:${p.redDark};--rt-accent:${p.accent};--danger:${p.danger};--angle-bg:${p.angleBg};--angle-border:${p.angleBorder};--cover-partner-h:${p.coverPartnerH};--cover-fox-h:${p.coverFoxH}}`;
}

/** Non-executed JSON data block (CSP-safe) that app.js reads for brand content. */
function brandDataScript(brand: Brand): string {
  const data = {
    reportContact: brand.app.reportContact,
    letterheadLogo: brand.app.letterheadLogo,
    leadConsentCompany: brand.app.leadConsentCompany,
    leadDatenschutzHref: brand.app.leadDatenschutzHref,
    filenameFull: brand.app.filenameFull,
    filenameSingle: brand.app.filenameSingle,
    analytics: brand.analytics ?? null,
    funnel: brand.funnel ?? null,
  };
  // Escape `<` so the JSON can never break out of the <script> element.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/json" id="brand-data">${json}</script>`;
}

/**
 * Rebrand a served HTML document for a NON-default brand. No-op for the default
 * brand (so sharp/reineke is untouched). Uses the default brand's literals as
 * stable replace anchors, injects a `<style>` palette override (CSP allows inline
 * style) and a `<script type="application/json">` brand-data block (CSP-safe data,
 * not executable). The static HTML/CSS files therefore never need branch edits.
 */
export function applyBrandToHtml(html: string, brand: Brand): string {
  if (brand.id === DEFAULT_BRAND.id) return html;
  const D = DEFAULT_BRAND;
  let out = html
    // full-string anchors first (they contain shorter anchors handled below)
    .replaceAll(D.contactHref, brand.contactHref)
    .replaceAll(D.partnerLogoTag, brand.partnerLogoTag)
    // asset paths
    .replaceAll(`content="${D.themeColor}"`, `content="${brand.themeColor}"`)
    .replaceAll(D.headerLogo, brand.headerLogo)
    .replaceAll(D.reportPageLogo, brand.reportPageLogo)
    .replaceAll(D.faviconIcon, brand.faviconIcon)
    // footer address bits (email domain handled by the domain replace below)
    .replaceAll(D.footerStreetCity, brand.footerStreetCity)
    .replaceAll(D.footerTelHref, brand.footerTelHref)
    .replaceAll(D.footerTelText, brand.footerTelText)
    // broad text + URL anchors (titles, meta, alts, eyebrow, footer brand, links)
    .replaceAll(D.shortName, brand.shortName)
    .replaceAll(D.domain, brand.domain);
  // Pentest-Funnel: primärer CTA-Text (der Link selbst läuft über contactHref).
  if (brand.funnel) out = out.replaceAll(">Beratung anfragen<", `>${brand.funnel.ctaLabel}<`);
  const style = sitePaletteCss(brand);
  if (style) out = out.replace("</head>", `<style>${style}</style></head>`);
  out = out.replace("</body>", `${brandDataScript(brand)}</body>`);
  return out;
}
