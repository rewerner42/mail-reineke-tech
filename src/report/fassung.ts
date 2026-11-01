// Markenfassungen des Berichts v15.
//
// Die Grundfassung ist Reineke Technik, wie sie in daten/firma.json steht. Eine
// Markenfassung setzt darauf auf und ändert nur, was die Marke anders braucht:
// das Logo oben, Kapitel 03, den Kasten am Ende von Kapitel 02, die zweite
// Kontaktkarte, den Absender und den Nummernkreis. Heute gibt es eine: Sharp
// (Inhalte von Werner am 01.11.2026 entschieden).
//
// Ohne Fassung läuft alles hieran vorbei. View-Model und HTML der Reineke-Fassung
// bleiben damit zeichengleich mit der Jinja2-Vorlage, gegen die tools/referenz
// prüft. Die Vorlage liest die Markenteile aus `marke` im View-Model; fehlt das
// Feld, rendert sie Reineke.

import type { BerichtMarke, Brand, BrandContact } from "../brand.js";
import type { Nummernkreis } from "./nummer.js";

/** Alles, was der Generator für eine Markenfassung braucht, aufgelöst. */
export interface Fassung {
  nummer: Nummernkreis;
  /** Prüfadresse der Marke; ersetzt die Reineke-Adresse auf Deckblatt und in Anhang B. */
  scanHost: string;
  logo: string;
  logoAlt: string;
  coBrand: string | null;
  kapitel03: string;
  partner: BerichtMarke["partner"];
  angebot: BerichtMarke["angebot"] & { titel: string; einleitung: string };
  absender: BerichtMarke["absender"];
  /** Zweite Kontaktkarte in Kapitel 04, neben Werner. */
  vertrieb: BrandContact | null;
}

/** Der Vierseiter setzt die Überschrift ungefiltert ein, deshalb steht dort „&amp;“. */
function alsText(html: string): string {
  return html.replace(/&amp;/g, "&");
}

/**
 * Die Fassung einer Marke, oder null für die Reineke-Grundfassung. Der im
 * Generator gewählte Vertriebler ersetzt die Standardkarte der Marke.
 */
export function fassungFuer(brand: Brand, vertrieb?: BrandContact | null): Fassung | null {
  const m = brand.report.v15;
  if (!m) return null;
  return {
    nummer: m.nummer,
    scanHost: brand.report.toolUrl,
    logo: m.logo,
    logoAlt: m.logoAlt,
    coBrand: brand.report.coBrandLine,
    kapitel03: m.kapitel03,
    partner: m.partner,
    angebot: {
      ...m.angebot,
      titel: alsText(brand.report.offerHeading),
      einleitung: alsText(brand.report.offerLeadIn),
    },
    absender: m.absender,
    vertrieb: vertrieb ?? brand.report.partner,
  };
}

/** "+49 (0) 5258 987-282" → "+495258987282", für tel:-Verweise. */
function telHref(nummer: string): string {
  return nummer.replace(/\(0\)/g, "").replace(/[^\d+]/g, "");
}

type Vm = Record<string, any>;

/** Eine Kontaktkarte im Format von firma.json, aus einer Karte der Marke. */
function karte(c: BrandContact): Vm {
  return {
    name: c.name,
    rolle: [c.role, c.org].filter(Boolean).join(", "),
    email: c.mail,
    telefon: c.tel || null,
    telefon_href: c.tel ? telHref(c.tel) : null,
    mobil: c.mobile || null,
    mobil_href: c.mobile ? telHref(c.mobile) : null,
    foto: null,
    foto_url: null,
  };
}

/**
 * Macht aus dem View-Model der Grundfassung das der Markenfassung. Das
 * Original bleibt unverändert.
 */
export function wendeFassungAn(vm: Vm, f: Fassung): Vm {
  const firma = vm.firma as Vm;
  const grundHost = String(firma.scan_host);
  const host = (v: unknown) => (typeof v === "string" ? v.split(grundHost).join(f.scanHost) : v);
  const texte = Object.fromEntries(Object.entries(vm.texte as Vm).map(([k, v]) => [k, host(v)]));

  // Werner bleibt mit Foto; mit zwei Firmen auf der Seite trägt jede Karte ihre.
  const kontakte = firma.kontakte as Vm[];
  const werner = kontakte.find((k) => k.name === firma.vorstellung.name) ?? kontakte[0]!;
  const karten: Vm[] = [{ ...werner, rolle: `${werner.rolle}, ${firma.name}` }];
  if (f.vertrieb) karten.push(karte(f.vertrieb));

  return {
    ...vm,
    texte,
    firma: { ...firma, scan_host: f.scanHost, kontakte: karten },
    marke: {
      logo: `${vm.assets}/${f.logo}`,
      logo_alt: f.logoAlt,
      co_brand: f.coBrand,
      kapitel03: f.kapitel03,
      partner: f.partner,
      angebot: f.angebot,
      absender: f.absender,
    },
  };
}
