// Reineke Technik (scan.reineke.tech) — the pure Reineke deployment,
// no Sharp element anywhere: no partner logo, no Sharp contact
// cards, Reineke wordmark on the report cover. Selected via BRAND="reineke"
// on the scan-reineke-tech Worker (wrangler deploy --env reineke).
import type { Brand } from "../brand.js";

export const reineke: Brand = {
  id: "reineke",
  hosts: ["scan.reineke.tech"],
  privateAssets: ["/pentest.html", "/pentest.js", "/bericht.html", "/bericht.js"], // Lead-Strecken — nicht auf anderen Brands
  // Analyse laeuft ausschliesslich ueber PostHog und erst NACH aktiver
  // Einwilligung (Opt-in in app.js).
  //
  // Umami abgeschaltet 28.08.2026 (umamiId: null). Es mass dasselbe wie
  // PostHog; auf www.reineke-technik.de ist es am 26.08. aus demselben Grund
  // geflogen ("umami raus"). Der Schalter entfernt zugleich cloud.umami.is und
  // gateway.umami.is aus der CSP -- die Hosts haengen in src/index.ts an
  // a?.umamiId. Die Umami-Site selbst bleibt bestehen, nur ungenutzt.
  analytics: {
    umamiId: null,
    posthogToken: "phc_xTC8gQxdjvK4KAS4V9mYJzPi6K86GmKxtVZNisUTUf5J",
    posthogHost: "https://eu.i.posthog.com",
    sessionReplay: true,
  },
  // /report fehlt bewusst: Die Seite trägt noindex. Ein zusätzliches
  // Disallow in der robots.txt würde verhindern, dass Google dieses noindex
  // überhaupt liest — die URL könnte dann ohne Inhalt im Index landen.
  seo: {
    origin: "https://scan.reineke.tech",
    sitemapPaths: ["/", "/website", "/dnssec", "/pentest"],
  },
  // Pentest-Lead-Strecke: /pentest ersetzt den Kontakt-Absprung als einziger CTA.
  funnel: {
    pentestPath: "/pentest",
    ctaLabel: "Pentest — Umfang und Ablauf ansehen",
    bookingUrl:
      "https://outlook.office.com/bookwithme/user/99dfe8391d044c208563dd3afbc7439f@reineke-technik.de?anonymous&ismsaljsauthenabled&ep=plink",
    turnstileSiteKey: "0x4AAAAAAEGFZzbATXzWA_LB",
    // reineke.tech ist in Resend verifiziert (DKIM + send-Subdomain) und durch
    // SPF/DMARC (p=reject) gedeckt — siehe DNS der Zone.
    notify: {
      from: "Reineke Sicherheits-Check <scan@reineke.tech>",
      to: "wf.reineke@reineke-technik.de",
    },
  },

  // Text/domain anchors equal the default brand → those replaceAlls are no-ops;
  // the visible difference comes from the asset/partner/report fields below.
  shortName: "Reineke Technik",
  domain: "reineke-technik.de",
  themeColor: "#dc0d23",
  headerLogo: "/assets/reineke-logo.png",
  faviconIcon: "/assets/favicon.png",
  partnerLogoTag: "", // single-brand: no Sharp partner logo in the header
  reportPageLogo: "/assets/reineke-logo.png",
  // Schmale Bildschirme zeigen Fuchs + Schriftzug nebeneinander (CSS blendet je
  // nach Breite das eine oder andere aus); auf dem Desktop bleibt das bisherige
  // Logo unverändert.
  headerLogoTag:
    '<img src="/assets/reineke-logo.png" alt="Reineke Technik" class="brand-logo" />' +
    '<span class="brand-lockup" aria-hidden="true">' +
    '<img src="/assets/reineke-fox.svg" alt="" class="brand-fox" />' +
    '<img src="/assets/reineke-wordmark.svg" alt="" class="brand-word" />' +
    "</span>",
  contactHref: "/pentest", // primärer CTA führt in die Pentest-Strecke, kein Absprung
  footerStreetCity: "Geseker Straße 26 · 33154 Salzkotten",
  footerTelHref: "tel:+495258987282",
  footerTelText: "+49 (0) 5258 987-282",

  sitePalette: {
    red: "#dc0d23",
    redDark: "#8a060e",
    redSoft: "#fcf0ef",
    accent: "#dc0d23",
    brandLogoHeight: "52px",
  },

  app: {
    reportContact: {
      company: "Reineke Technik GmbH",
      name: "Werner Francis Reineke",
      street: "Geseker Straße 26",
      city: "33154 Salzkotten",
      phone: "+49 (0) 5258 987-282",
      email: "wf.reineke@reineke-technik.de",
    },
    letterheadLogo: "/assets/reineke-logo.png",
    leadConsentCompany: "Reineke Technik GmbH",
    leadDatenschutzHref: "https://www.reineke-technik.de/datenschutz/",
    filenameFull: "Sicherheitsbericht",
    filenameSingle: "Befund",
  },

  report: {
    toolUrl: "scan.reineke.tech",
    layout: "emblem", // centered emblem cover, brand-name page head, numbered footers
    // 100% Reineke Technik: one company, one contact card.
    conductor: {
      name: "Werner Reineke",
      role: "Geschäftsführer",
      org: "Reineke Technik GmbH",
      mail: "wf.reineke@reineke-technik.de",
      tel: "+49 172 2872390",
      mobile: "",
      addr: "Geseker Straße 26, 33154 Salzkotten",
      web: "www.reineke-technik.de",
      short: "Reineke Technik",
    },
    partner: null, // single-company report: no second contact card
    wordmarkAsset: "/assets/reineke-logo.png",
    foxAsset: "/assets/reineke-official.svg", // fox-only emblem: page-head icon in the emblem layout
    showFox: false, // the wordmark already carries the fox — no duplicate emblem
    wordmarkAlt: "Reineke Technik",
    offerHeading: "Unser Angebot — Reineke Technik",
    offerLeadIn:
      "Wir bringen Ihre Domains kontrolliert und nachvollziehbar auf ein durchgesetztes Schutzniveau — technische Umsetzung und persönliche Betreuung aus einer Hand, durchgängig DSGVO-konform und deutschsprachig:",
    coBrandLine: null,
    filenamePrefix: "Reineke-Befund",
    palette: {
      red: "#dc0d23",
      redDark: "#8a060e",
      accent: "#dc0d23",
      danger: "#dc0d23",
      angleBg: "#fff7f8",
      angleBorder: "#f4c9cf",
      coverPartnerH: "240px", // large centered emblem on the cover (portrait fox+wordmark)
      coverFoxH: "40px",
    },
  },

  odoo: {
    referred: "scan.reineke.tech",
    toolLabel: "Reineke Technik",
  },
};
