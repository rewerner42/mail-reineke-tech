import { describe, expect, it } from "vitest";
import { applyBrandToHtml } from "../src/brand.js";
import { odooFuerHost } from "../src/index.js";
import { reineke } from "../src/brands/reineke.js";
import { sharp } from "../src/brands/sharp.js";

/**
 * Der Scanner ist unter ZWEI Adressen erreichbar (scan.reineke-technik.de und
 * scan.reineke.tech, beide dasselbe Werkzeug, keine Weiterleitung). Drei Werte
 * gab es bisher nur einmal und muessen jetzt beide Hosts bedienen. Diese Datei
 * nagelt fest, welcher davon hostabhaengig ist und welcher nicht.
 */

const seite = "<html><head><title>x</title></head><body>y</body></html>";

// Eigene Marke mit ZWEI verschiedenen Hosts und einer davon abweichenden
// seo.origin. Gegen die echte Marke waere jeder Test hier wertlos: dort sind
// hosts[0], seo.origin und odoo.referred heute derselbe Wert -- ein Test
// koennte "Anfrage-Host" und "kanonische Anschrift" gar nicht unterscheiden.
// Genau das hat der Sabotagetest gezeigt: beide Rueckfaelle blieben gruen.
const zweiHosts = {
  ...reineke,
  hosts: ["neu.beispiel.de", "alt.beispiel.tech"],
  seo: { ...reineke.seo!, origin: "https://neu.beispiel.de" },
  odoo: { ...reineke.odoo, referred: "LITERAL" },
};

describe("canonical", () => {
  it("zeigt auf seo.origin, nicht auf den Anfrage-Host", () => {
    // Das ist der ganze Sinn: zwei Hosts, eine kanonische Anschrift.
    const out = applyBrandToHtml(seite, zweiHosts, new URL("https://alt.beispiel.tech/website"));
    expect(out).toContain('<link rel="canonical" href="https://neu.beispiel.de/website" />');
    expect(out).not.toContain("alt.beispiel.tech");
  });

  it("laesst die Query weg", () => {
    // Sonst entstuende pro geprueter Fremddomain eine eigene canonical-Variante.
    const out = applyBrandToHtml(seite, zweiHosts, new URL("https://alt.beispiel.tech/?d=fremde-firma.de&s=a"));
    expect(out).toContain('href="https://neu.beispiel.de/"');
    expect(out).not.toContain("fremde-firma.de");
  });

  it("setzt kein zweites, wenn schon eins da ist", () => {
    const mit = '<html><head><link rel="canonical" href="https://vorgabe/"></head><body></body></html>';
    const out = applyBrandToHtml(mit, zweiHosts, new URL("https://alt.beispiel.tech/"));
    expect(out.match(/rel="canonical"/g)?.length).toBe(1);
  });

  it("ohne URL unveraendert — der alte Aufrufweg bleibt gueltig", () => {
    expect(applyBrandToHtml(seite, zweiHosts)).not.toContain("canonical");
  });

  it("nichts fuer die Standardmarke", () => {
    expect(applyBrandToHtml(seite, sharp, new URL("https://sharp.reineke.tech/"))).toBe(seite);
  });
});

describe("Odoo-Kanalmarker", () => {
  it("nennt den Host, ueber den der Lead kam", () => {
    // Sonst truegen alle Leads denselben Marker und die Frage "wie viele
    // kommen noch ueber die alte Adresse?" waere unbeantwortbar.
    for (const h of zweiHosts.hosts) {
      expect(odooFuerHost(zweiHosts, `https://${h}/api/pentest-lead`).referred).toBe(h);
    }
    // und er unterscheidet sich vom Literal — sonst prueft der Test nichts
    expect(zweiHosts.odoo.referred).not.toBe(zweiHosts.hosts[0]);
  });

  it("faellt auf das Literal zurueck, wenn der Host nicht zur Marke gehoert", () => {
    expect(odooFuerHost(zweiHosts, "https://irgendwo.example/api/x").referred).toBe("LITERAL");
  });

  it("laesst die uebrigen Felder unangetastet", () => {
    const o = odooFuerHost(zweiHosts, `https://${zweiHosts.hosts[0]}/x`);
    expect(o.toolLabel).toBe(zweiHosts.odoo.toolLabel);
  });
});
