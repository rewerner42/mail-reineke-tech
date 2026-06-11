// Default brand = Reineke Technik (sharp.reineke.tech). Values are the EXACT
// current literals so the default render is unchanged. Do not "tidy" these — the
// middleware uses several of them verbatim as replace anchors.
import type { Brand, BrandContact } from "../brand.js";

// Sharp sales reps selectable in the report generator. The "partner" card swaps
// to the chosen rep; the conductor/persona (Reineke) stays fixed. These are the
// always-available defaults; reps added via the UI live client-side (localStorage).
const THEO: BrandContact = {
  name: "Theo Müller",
  role: "Verkaufsleiter Direktvertrieb",
  org: "Sharp Business Systems Deutschland GmbH",
  mail: "Theo.Mueller@sharp.eu",
  tel: "+49 30 263 44 838",
  mobile: "+49 173 778 19 17",
  addr: "Fritschestraße 27/28, 10585 Berlin",
  web: "www.sharp.de",
  short: "Sharp Business Systems",
};
const NICO: BrandContact = {
  name: "Nico Höferlin",
  role: "Gebietsverkaufsleiter",
  org: "Sharp Business Systems Deutschland GmbH",
  mail: "Nico.Hoeferlin@sharp.eu",
  tel: "+49 5251 144 131",
  mobile: "+49 160 98949872",
  addr: "Pagendarmweg 9-9a, 33100 Paderborn",
  web: "www.sharp.de",
  short: "Sharp Business Systems",
};

export const reineke: Brand = {
  id: "reineke",
  hosts: ["sharp.reineke.tech", "mail.reineke.tech", "scan.reineke.tech", "localhost"],

  shortName: "Reineke Technik",
  domain: "reineke-technik.de",
  themeColor: "#dc0d23",
  headerLogo: "/assets/reineke-logo.png",
  faviconIcon: "/assets/favicon.png",
  partnerLogoTag: '<img src="/assets/sharp-logo.png" alt="Sharp" class="partner-logo" />',
  reportPageLogo: "/assets/sharp-logo.png",
  contactHref: "https://www.reineke-technik.de/kontakt/",
  footerStreetCity: "Geseker Straße 26 · 33154 Salzkotten",
  footerTelHref: "tel:+4952589878282",
  footerTelText: "+49 (0) 5258 987-282",

  sitePalette: {
    red: "#dc0d23",
    redDark: "#8a060e",
    redSoft: "#fcf0ef",
    accent: "#dc0d23", // default: accent == primary (hero bar stays red)
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
    toolUrl: "sharp.reineke.tech",
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
    partner: THEO, // default partner card (used when no rep is picked)
    reps: [THEO, NICO], // selectable in the /report generator
    wordmarkAsset: "/assets/sharp-logo.png",
    foxAsset: "/assets/reineke-official.svg",
    showFox: true,
    wordmarkAlt: "sharp",
    offerHeading: "Unser Angebot — Reineke Technik &amp; Sharp Business Systems Deutschland",
    offerLeadIn:
      "Gemeinsam bringen wir Ihre Domains kontrolliert und nachvollziehbar auf ein durchgesetztes Schutzniveau — die technische Umsetzung durch Reineke Technik, persönliche Betreuung über den Direktvertrieb von Sharp Business Systems, durchgängig DSGVO-konform und deutschsprachig:",
    coBrandLine: "in Zusammenarbeit mit Sharp Business Systems Deutschland GmbH",
    filenamePrefix: "Sharp-Befund",
    palette: {
      red: "#dc0d23",
      redDark: "#8a060e",
      accent: "#dc0d23",
      danger: "#dc0d23",
      angleBg: "#fff7f8",
      angleBorder: "#f4c9cf",
      coverPartnerH: "30px",
      coverFoxH: "96px",
    },
  },

  odoo: {
    referred: "sharp.reineke.tech",
    toolLabel: "Reineke Technik",
  },
};
