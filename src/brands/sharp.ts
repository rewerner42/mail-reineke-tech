// Sharp partner channel (sharp.reineke.tech) — the DEFAULT brand: its values
// are the EXACT literals of the static files, so the default render is unchanged
// and applyBrandToHtml uses several of them verbatim as replace anchors.
// Do not "tidy" these.
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

export const sharp: Brand = {
  id: "sharp",
  hosts: ["sharp.reineke.tech", "localhost"],
  privateAssets: ["/assets/sharp-logo.png", "/assets/sharp-logo.svg"], // Sharp co-brand assets — not for other brands
  // Leadfeeder/Dealfront am 2026-08-03 vollständig entfernt; Umami-Site liegt
  // seit demselben Tag bei scan.reineke.tech (Site-Limit).
  analytics: { umamiId: null },

  shortName: "Reineke Technik",
  domain: "reineke-technik.de",
  themeColor: "#dc0d23",
  headerLogo: "/assets/reineke-logo.png",
  faviconIcon: "/assets/favicon.png",
  partnerLogoTag: '<img src="/assets/sharp-logo.png" alt="Sharp" class="partner-logo" />',
  reportPageLogo: "/assets/sharp-logo.png",
  contactHref: "https://www.reineke-technik.de/kontakt/",
  footerStreetCity: "Geseker Straße 26 · 33154 Salzkotten",
  footerTelHref: "tel:+495258987282",
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
      "Gemeinsam bringen wir Ihre Domains kontrolliert und nachvollziehbar auf ein durchgesetztes Schutzniveau — die technische Umsetzung durch Reineke Technik, persönliche Betreuung über den Direktvertrieb von Sharp Business Systems, deutschsprachig:",
    coBrandLine: "in Zusammenarbeit mit Sharp Business Systems Deutschland GmbH",
    filenamePrefix: "Sharp-Befund",
    // Sharp-Fassung des Berichts v15, Inhalte von Werner am 01.11.2026 entschieden:
    // SHARP oben, Reineke unten; Sharp-Angebot statt Pentest; eigener Zähler.
    v15: {
      nummer: {
        kuerzel: "SH-DS",
        code: "sharp.bericht",
        name: "Sicherheitsbefund Sharp — Bericht-Nr.",
      },
      logo: "sharp-logo.svg",
      logoAlt: "Sharp",
      kapitel03: "Über Sharp und Reineke Technik",
      partner: {
        label: "Partner",
        // Reineke arbeitet als Fachpartner für Sharp: Sharp steht vorn, Reineke
        // als Spezialist dahinter (Werners Vorgabe, Fassung B).
        text:
          "Sharp Business Systems Deutschland GmbH betreut Sie als Anbieter und fester Ansprechpartner. " +
          "Die fachliche Arbeit übernimmt Reineke Technik als Sicherheitspartner von Sharp, von der Prüfung " +
          "bis zur technischen Umsetzung. So verbinden Sie die Betreuung eines etablierten Anbieters mit der " +
          "Erfahrung von Spezialisten.",
      },
      angebot: {
        label: "Angebot",
        rollen: [
          { titel: "Sharp Business Systems", text: "Persönliche Betreuung über den Direktvertrieb" },
          { titel: "Reineke Technik", text: "Prüfung und technische Umsetzung" },
        ],
        // Die vier Punkte des Vierseiters (src/report/build.ts, offerBlock).
        punkte: [
          {
            titel: "DMARC-Einführung & -Härtung",
            text: "Begleiteter Rollout von p=none über p=quarantine bis p=reject, inkl. SPF-/DKIM-Alignment und Auswertung der Aggregat-Reports.",
          },
          {
            titel: "DNSSEC-Aktivierung",
            text: "Signierung der Zonen und Hinterlegung des DS-Eintrags beim Registrar.",
          },
          {
            titel: "Website-Härtung",
            text: "CSP, HSTS, X-Frame-Options, X-Content-Type-Options und SRI sauber gesetzt.",
          },
          {
            titel: "Laufendes Monitoring",
            text: "Kontinuierliche Überwachung und verständliche Berichte — jederzeit kostenfrei nachprüfbar unter sharp.reineke.tech.",
          },
        ],
      },
      absender: {
        label: "Analyse kostenfrei wiederholen",
        url: "https://sharp.reineke.tech",
        text: "sharp.reineke.tech",
      },
    },
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
