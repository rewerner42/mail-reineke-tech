// Die Sharp-Fassung des Berichts v15, Inhalte von Werner am 01.11.2026
// entschieden: was sie anders macht als die Reineke-Fassung, und dass die
// Reineke-Fassung davon unberührt bleibt.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRANDS, type BrandContact } from "../src/brand.js";
import { MAX_BERICHT_BYTES, berichtDokument } from "../src/report/bericht.js";
import { fassungFuer } from "../src/report/fassung.js";
import { berichtNummer, ersatzNummer } from "../src/report/nummer.js";
import type { Signal } from "../src/report/signal.js";
import { adaptReferenz } from "../tools/referenz-signal.js";
import { synthetisch } from "../tools/synthetisch.js";

const REF = fileURLToPath(new URL("./fixtures/referenz/signale", import.meta.url));
const ORIGIN = "https://sharp.reineke.tech";
const NUMMER = "SH-DS-20261101-0001";
const sharp = BRANDS.sharp!;
const reineke = BRANDS.reineke!;
const nico = sharp.report.reps!.find((r) => r.name === "Nico Höferlin")!;

function alleSignale(): Array<{ name: string; sig: Signal }> {
  const aus = readdirSync(REF)
    .filter((x) => x.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw = JSON.parse(readFileSync(`${REF}/${f}`, "utf8"));
      return { name: raw.domain as string, sig: adaptReferenz(raw) };
    });
  for (const [key, sig] of synthetisch()) aus.push({ name: key, sig });
  return aus;
}
const SIGNALE = alleSignale();
const SIG = SIGNALE[0]!.sig;

function sharpHtml(sig: Signal, vertrieb?: BrandContact | null): string {
  return berichtDokument(sig, { origin: ORIGIN, nummer: NUMMER, fassung: fassungFuer(sharp, vertrieb) }).html;
}
const DOKUMENTE = SIGNALE.map(({ name, sig }) => ({ name, html: sharpHtml(sig) }));
const HTML = DOKUMENTE[0]!.html;

/** Der Abschnitt einer Seite ab einem Kapitelanker bis zur nächsten Seite. */
function kapitel(html: string, anker: string): string {
  const ab = html.indexOf(`id="${anker}"`);
  expect(ab, anker).toBeGreaterThan(0);
  return html.slice(ab, html.indexOf("</section>", ab));
}

describe("fassungFuer", () => {
  it("gibt Reineke keine Fassung: dort gilt firma.json", () => {
    expect(fassungFuer(reineke)).toBeNull();
  });

  it("gibt Sharp den eigenen Nummernkreis SH-DS mit eigenem Zähler", () => {
    const f = fassungFuer(sharp)!;
    expect(f.nummer.kuerzel).toBe("SH-DS");
    expect(f.nummer.code).toBe("sharp.bericht");
    expect(f.scanHost).toBe("sharp.reineke.tech");
  });

  it("setzt ohne Auswahl die Standardkarte der Marke, sonst den gewählten Vertriebler", () => {
    expect(fassungFuer(sharp)!.vertrieb?.name).toBe("Theo Müller");
    expect(fassungFuer(sharp, nico)!.vertrieb?.name).toBe("Nico Höferlin");
  });
});

describe("die Sharp-Fassung", () => {
  it("deckt die Referenz- und die synthetischen Datensätze ab", () => {
    expect(DOKUMENTE.length).toBeGreaterThan(70);
  });

  it("bleibt deutlich unter der Größengrenze", () => {
    for (const { name, html } of DOKUMENTE) expect(html.length, name).toBeLessThan(MAX_BERICHT_BYTES / 2);
  });

  it("lädt jedes Bild vom eigenen Ursprung, das SHARP-Logo als Vektor", () => {
    for (const { name, html } of DOKUMENTE) {
      const quellen = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]!);
      for (const q of quellen) expect(q, `${name}: ${q}`).toMatch(/^https:\/\/sharp\.reineke\.tech\/assets\//);
      expect(quellen, name).toContain(`${ORIGIN}/assets/sharp-logo.svg`);
    }
  });

  // Der Sharp-Bericht entsteht auf sharp.reineke.tech und führt nicht in die
  // Reineke-Strecke: kein Pentest-Link, keine Reineke-Prüfadresse.
  it("nennt sharp.reineke.tech und nie die Reineke-Prüfadresse", () => {
    for (const { name, html } of DOKUMENTE) {
      expect(html, name).toContain("Automatisierte Analyse mit sharp.reineke.tech.");
      expect(html, name).toContain("automatisiert mit sharp.reineke.tech erhoben");
      expect(html, name).not.toContain("scan.reineke-technik.de");
      expect(html, name).not.toContain("/pentest");
      expect(html, name).not.toContain("Penetrationstest anfragen");
    }
  });

  it("trägt die SH-DS-Nummer auf dem Deckblatt und in jeder Fußzeile", () => {
    const treffer = HTML.match(new RegExp(NUMMER, "g")) ?? [];
    expect(treffer.length).toBe((HTML.match(/class="page/g) ?? []).length);
  });

  it("zeigt SHARP oben auf dem Deckblatt und Reineke unten, mit Co-Brand-Zeile", () => {
    const deckblatt = HTML.slice(HTML.indexOf('<section class="page dcw'), HTML.indexOf("</section>"));
    expect(deckblatt).toMatch(/<div class="dcw-marke"><img src="[^"]+\/sharp-logo\.svg" alt="Sharp">/);
    expect(deckblatt).not.toContain('<div class="dcw-logo">');
    expect(deckblatt).toContain('<img class="dcw-rt" src="https://sharp.reineke.tech/assets/logo.png"');
    expect(deckblatt).toContain("in Zusammenarbeit mit Sharp Business Systems Deutschland GmbH");
    expect(deckblatt).toContain("<b>Reineke Technik GmbH</b>");
  });

  it("setzt SHARP in jede Kopfzeile statt Fuchs und Firmenname", () => {
    const koepfe = HTML.match(/<div class="k-marke">.*?<\/div>/g) ?? [];
    expect(koepfe.length).toBe((HTML.match(/class="page pg/g) ?? []).length);
    for (const k of koepfe) expect(k).toContain('class="k-logo"');
  });

  it("stellt in Kapitel 02 das Sharp-Angebot an die Stelle des Penetrationstests", () => {
    for (const { name, html } of DOKUMENTE) {
      expect(html.match(/id="angebot"/g) ?? [], name).toHaveLength(1);
      expect(html, name).not.toContain('id="pentest"');
      // Sharp zuerst, die Punkte in der Sprache von v15 (Werner, 01.11.2026).
      expect(html, name).toContain("<h2>Unser Angebot — Sharp Business Systems Deutschland &amp; Reineke Technik</h2>");
      expect(html, name).toContain("Adressauskünfte Ihrer Domain signieren und beim Registrar hinterlegen.");
      expect(html, name).not.toMatch(/SPF-\/DKIM-Alignment|X-Content-Type-Options und SRI/);
    }
    // Das Inhaltsverzeichnis springt zum Angebot.
    expect(HTML).toMatch(/<a class="inh-sub" href="#angebot"><span class="inh-nr"><\/span><span class="inh-t">Unser Angebot/);
  });

  it("heißt in Kapitel 03 „Über Sharp und Reineke Technik“, mit Sharp-Absatz statt Spruch", () => {
    const k03 = kapitel(HTML, "kap-03");
    expect(k03).toContain("<h1>Über Sharp und Reineke Technik</h1>");
    expect(k03).toContain("Sharp Business Systems Deutschland GmbH betreut Sie als Anbieter und fester Ansprechpartner.");
    expect(k03).not.toContain('class="s36 zitat"');
    // Der Spruch bleibt auf dem Deckblatt.
    expect(HTML.match(/Sicherheitslücken schließen,/g) ?? []).toHaveLength(1);
    // „Unabhängig“ bleibt wie bei Reineke (Werner, 01.11.2026).
    expect(k03).toContain("und verkaufen keine Technik, die wir anschließend kontrollieren.");
    expect(HTML).toContain('<span class="inh-t">Über Sharp und Reineke Technik</span>');
  });

  it("nennt in Kapitel 04 Werner und den Vertriebler, Karl nur in den Pflichtangaben", () => {
    const k04 = kapitel(HTML, "kap-04");
    const karten = k04.slice(k04.indexOf("Ansprechpartner"), k04.indexOf("absender"));
    expect(karten).toContain("Werner Francis Reineke");
    expect(karten).toContain("Geschäftsführer, Reineke Technik GmbH");
    expect(karten).toContain("Theo Müller");
    expect(karten).toContain("Verkaufsleiter Direktvertrieb, Sharp Business Systems Deutschland GmbH");
    expect(karten).toContain('href="tel:+493026344838"');
    expect(karten).not.toContain("Karl Pieper");
    // § 35a GmbHG: alle Geschäftsführer der Reineke Technik GmbH, die den Bericht erstellt.
    expect(k04).toContain("Geschäftsführer: Werner Francis Reineke, Karl Pieper");
  });

  it("verweist im Absender auf die kostenfreie Wiederholung statt auf den Pentest", () => {
    const k04 = kapitel(HTML, "kap-04");
    expect(k04).toContain('<span class="label">Analyse kostenfrei wiederholen</span>');
    expect(k04).toContain('<a class="unterstr" href="https://sharp.reineke.tech">sharp.reineke.tech</a>');
  });

  it("lässt Termin-Knopf und QR-Code auf Werners Buchungsseite", () => {
    expect(HTML).toContain('href="https://bookings.cloud.microsoft/');
    expect(HTML).toContain(`src="${ORIGIN}/assets/qr-termin.svg"`);
  });

  it("setzt den gewählten Vertriebler als zweite Karte", () => {
    const html = sharpHtml(SIG, nico);
    expect(html).toContain("Nico Höferlin");
    expect(html).toContain("Gebietsverkaufsleiter, Sharp Business Systems Deutschland GmbH");
    expect(html).not.toContain("Theo Müller");
  });

  // Im Generator angelegte Vertriebler haben nicht immer eine Telefonnummer.
  it("druckt für einen Vertriebler ohne Telefon keinen leeren tel:-Verweis", () => {
    const html = sharpHtml(SIG, { name: "Erika Muster", role: "", org: "", mail: "e.muster@sharp.eu", tel: "", addr: "", web: "" });
    expect(html).toContain("Erika Muster");
    expect(html).not.toContain('href="tel:"');
  });
});

describe("die Reineke-Fassung", () => {
  it("bleibt ohne Fassung unverändert", () => {
    for (const { name, sig } of SIGNALE.slice(0, 15)) {
      const ohne = berichtDokument(sig, { origin: "https://scan.reineke.tech", nummer: "RT-DS-20261030-0001" });
      const mitNull = berichtDokument(sig, { origin: "https://scan.reineke.tech", nummer: "RT-DS-20261030-0001", fassung: null });
      expect(mitNull.html, name).toBe(ohne.html);
      expect(ohne.html, name).not.toContain("sharp-logo");
      expect(ohne.viewmodel, name).not.toHaveProperty("marke");
    }
  });
});

describe("der Sharp-Nummernkreis", () => {
  it("fällt auf eine SH-DS-Ersatznummer zurück", () => {
    expect(ersatzNummer(new Date("2026-11-01T15:30:42Z"), "SH-DS")).toBe("SH-DS-20261101-T153042");
    expect(ersatzNummer(new Date("2026-11-01T15:30:42Z"))).toBe("RT-DS-20261101-T153042");
  });

  it("zieht ohne Odoo eine Ersatznummer mit dem Kürzel der Marke", async () => {
    const r = await berichtNummer(null, { now: new Date("2026-11-01T08:00:00Z"), kreis: fassungFuer(sharp)!.nummer });
    expect(r).toEqual({ nummer: "SH-DS-20261101-T080000", aus: "ersatz" });
  });

  it("legt den Zähler sharp.bericht beim ersten Gebrauch an und zieht daraus", async () => {
    const aufrufe: Array<{ methode: string; args: unknown }> = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const { params } = JSON.parse(String(init.body));
      if (params.service === "common") return Response.json({ result: 2 });
      const [, , , modell, methode, args] = params.args as [string, number, string, string, string, unknown[]];
      aufrufe.push({ methode: `${modell}.${methode}`, args });
      const ergebnis = methode === "search" ? [] : methode === "create" ? 9 : "0007";
      return Response.json({ result: ergebnis });
    }) as unknown as typeof fetch;
    const r = await berichtNummer(
      { url: "https://odoo.example", db: "db", username: "u", apiKey: "k" },
      { fetchImpl, now: new Date("2026-11-01T08:00:00Z"), kreis: fassungFuer(sharp)!.nummer },
    );
    expect(r).toEqual({ nummer: "SH-DS-20261101-0007", aus: "odoo" });
    expect(aufrufe.map((a) => a.methode)).toEqual(["ir.sequence.search", "ir.sequence.create", "ir.sequence.next_by_code"]);
    expect(JSON.stringify(aufrufe)).toContain('"code":"sharp.bericht"');
    expect(JSON.stringify(aufrufe)).not.toContain("reineke.bericht");
  });
});
