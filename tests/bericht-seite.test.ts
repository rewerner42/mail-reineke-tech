// /bericht: Seite und Skript gehören zusammen, und die Einwilligung auf der
// Seite muss dem Wortlaut entsprechen, den der Worker als Nachweis speichert.

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WWW_PRAEFIX } from "../src/leads/report-request.js";

const lies = (pfad: string) => readFileSync(new URL(`../${pfad}`, import.meta.url), "utf8");
const html = lies("public/bericht.html");
const js = lies("public/bericht.js");
const indexTs = lies("src/index.ts");

describe("/bericht", () => {
  // Fehlt ein Anker, bricht bericht.js beim Laden ab — und die Seite steht ohne
  // Domain-Kasten und ohne Versand da.
  it("findet jedes data-b-* aus bericht.js im Markup", () => {
    const imCode = [...new Set([...js.matchAll(/\[(data-b-[a-z-]+)\]/g)].map((m) => m[1]!))];
    expect(imCode.length).toBeGreaterThan(5);
    for (const a of imCode) expect(html, a).toMatch(new RegExp(`\\s${a}[\\s>=]`));
  });

  it("hängt das Domain-Feld oben im Kasten per form= an das Formular", () => {
    expect(html).toMatch(/<form[^>]*\sid="b-form"/);
    expect(html).toMatch(/<input[^>]*\sname="domain"[^>]*\sform="b-form"/);
  });

  // Ohne Skript schickte der Browser ein GET — mit Name, E-Mail und Telefon in
  // der Adresszeile und damit in Verlauf und Protokollen.
  it("schickt das Formular nie per GET", () => {
    expect(html).toMatch(/<form[^>]*\smethod="post"/);
  });

  it("zeigt die Domain nach derselben www.-Regel an, nach der der Server prüft", () => {
    expect(js).toContain(`/${WWW_PRAEFIX.source}/i`);
  });

  it("bindet nur Bilder ein, die es gibt", () => {
    const bilder = [...html.matchAll(/<img[^>]+src="\/([^"]+)"/g)].map((m) => m[1]!);
    expect(bilder.length).toBeGreaterThanOrEqual(4);
    for (const b of bilder) expect(existsSync(new URL(`../public/${b}`, import.meta.url)), b).toBe(true);
  });

  // Nachweis der Werbeeinwilligung (Art. 7 Abs. 1 DSGVO): Was gespeichert wird,
  // muss so auf der Seite stehen. Die Seite nennt nach „widerrufen“ noch den Weg
  // dazu — verglichen wird bis dorthin.
  it("zeigt die Einwilligung im gespeicherten Wortlaut", () => {
    const m = indexTs.match(/const CONTACT_CONSENT_WORDING =\s*((?:"[^"]*"\s*\+?\s*)+);/);
    expect(m, "CONTACT_CONSENT_WORDING in src/index.ts").not.toBeNull();
    const wortlaut = [...m![1]!.matchAll(/"([^"]*)"/g)].map((x) => x[1]).join("");
    const block = html.match(/<label class="lead-consent">([\s\S]*?)<\/label>/);
    expect(block, "Einwilligung in bericht.html").not.toBeNull();
    const text = block![1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    expect(wortlaut).toMatch(/widerrufen\.$/);
    expect(text.startsWith(wortlaut.slice(0, -1))).toBe(true);
  });
});
