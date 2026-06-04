// WS IT-TECHNOLOGY white-label (wsit.reineke.tech). This file is the ENTIRE brand
// definition — it lives on the client/wsit branch and is registered via EXTRA in
// src/brand.ts. Technical PRs never touch it, so branch merges don't conflict.
import type { Brand } from "../brand.js";

export const wsit: Brand = {
  id: "wsit",
  hosts: ["wsit.reineke.tech"],

  shortName: "WS IT-TECHNOLOGY", // replaces "Reineke Technik" text (→ "… GmbH" too)
  domain: "ws-it-technology.de",
  themeColor: "#5c2483",
  headerLogo: "/assets/wsit-logo.svg",
  faviconIcon: "/assets/wsit-favicon.png",
  partnerLogoTag: "", // single-brand: drop the Sharp partner logo in the header
  reportPageLogo: "/assets/wsit-logo.svg",
  contactHref: "https://www.ws-it-technology.de/#kontakt",
  footerStreetCity: "Bad Meinberger Straße 1 · 32760 Detmold",
  footerTelHref: "tel:+4952313080870",
  footerTelText: "+49 (0) 5231 308087-0",

  sitePalette: {
    red: "#5c2483", // WS-IT purple (primary brand)
    redDark: "#3f1860",
    redSoft: "#f3eef9",
    accent: "#009fe3", // WS-IT azure (hero bar + spark)
    fail: "#d72638", // danger stays red, decoupled from the purple brand
    failBg: "#fdecec",
    brandLogoHeight: "44px",
  },

  app: {
    reportContact: {
      company: "WS IT-TECHNOLOGY GmbH",
      name: "Werner Spellerberg",
      street: "Bad Meinberger Straße 1",
      city: "32760 Detmold",
      phone: "+49 (0) 5231 308087-0",
      email: "wspellerberg@ws-it-technology.de",
    },
    letterheadLogo: "/assets/wsit-logo.svg",
    leadConsentCompany: "WS IT-TECHNOLOGY GmbH",
    leadDatenschutzHref: "https://www.ws-it-technology.de/datenschutz/",
    filenameFull: "WS-IT-Sicherheitsbericht",
    filenameSingle: "WS-IT-Befund",
  },

  report: {
    toolUrl: "wsit.reineke.tech",
    // 100% WS-IT product: WS IT-TECHNOLOGY conducts & creates; no Reineke fox /
    // co-brand. Both people are shown as WS-IT contacts.
    conductor: {
      name: "Werner Francis Reineke",
      role: "Cybersecurity & Analyse",
      org: "WS IT-TECHNOLOGY GmbH",
      mail: "wreineke@ws-it-technology.de",
      tel: "+49 172 2872390",
      mobile: "",
      addr: "Bad Meinberger Straße 1, 32760 Detmold",
      web: "www.ws-it-technology.de",
    },
    partner: {
      name: "Werner Spellerberg",
      role: "Geschäftsführer / Managing Director",
      org: "WS IT-TECHNOLOGY GmbH",
      mail: "wspellerberg@ws-it-technology.de",
      tel: "+49 5231 308087-0",
      mobile: "",
      fax: "+49 5231 308087-99",
      addr: "Bad Meinberger Straße 1, 32760 Detmold",
      web: "www.ws-it-technology.de",
    },
    wordmarkAsset: "/assets/wsit-logo.svg",
    foxAsset: "/assets/wsit-logo.svg",
    showFox: false, // single-brand: no separate fox logo
    wordmarkAlt: "WS IT-TECHNOLOGY",
    offerHeading: "Unser Angebot — WS IT-TECHNOLOGY",
    offerLeadIn:
      "Wir bringen Ihre Domains kontrolliert und nachvollziehbar auf ein durchgesetztes Schutzniveau — technische Umsetzung und persönliche Betreuung aus einer Hand, durchgängig DSGVO-konform und deutschsprachig:",
    coBrandLine: null,
    filenamePrefix: "WS-IT-Befund",
    palette: {
      red: "#5c2483",
      redDark: "#3f1860",
      accent: "#009fe3",
      danger: "#dc0d23", // grade F + fail indicators stay red
      angleBg: "#f4f0fa",
      angleBorder: "#e0d4ec",
      coverPartnerH: "60px", // cover wordmark 2× (Werner's request)
      coverFoxH: "40px",
    },
  },

  odoo: {
    referred: "wsit.reineke.tech",
    toolLabel: "WS IT-TECHNOLOGY",
  },
};
