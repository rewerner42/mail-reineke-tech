// The document the Worker actually sends: size, assets and the report number.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_BERICHT_BYTES, berichtDokument } from "../src/report/bericht.js";
import { ersatzNummer } from "../src/report/nummer.js";
import { adaptReferenz } from "../tools/referenz-signal.js";
import { synthetisch } from "../tools/synthetisch.js";

const REF = fileURLToPath(new URL("./fixtures/referenz/signale", import.meta.url));
const ORIGIN = "https://scan.reineke.tech";

function alleSignale() {
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

const DOKUMENTE = alleSignale().map(({ name, sig }) => ({
  name,
  html: berichtDokument(sig, { origin: ORIGIN, nummer: "RT-DS-20261030-0001" }).html,
}));

describe("the generated document", () => {
  it("covers the reference and the synthetic datasets", () => {
    expect(DOKUMENTE.length).toBeGreaterThan(70);
  });

  it("stays well inside the size limit", () => {
    const groesste = DOKUMENTE.reduce((a, b) => (b.html.length > a.html.length ? b : a));
    expect(groesste.html.length, `${groesste.name} ist das größte Dokument`).toBeLessThan(
      MAX_BERICHT_BYTES / 2,
    );
  });

  it("loads every image from our own origin, never as a data URI", () => {
    for (const { name, html } of DOKUMENTE) {
      const quellen = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]!);
      expect(quellen.length, name).toBeGreaterThan(0);
      for (const q of quellen) expect(q, `${name}: ${q}`).toMatch(/^https:\/\/scan\.reineke\.tech\/assets\//);
    }
  });

  it("is a complete document with A4 pages and no script", () => {
    for (const { name, html } of DOKUMENTE) {
      expect(html.startsWith("<!doctype html>"), name).toBe(true);
      expect(html, name).toContain("@page { size: A4; margin: 0; }");
      expect(html, name).not.toMatch(/<script/i);
    }
  });

  it("prints the report number on every page footer and on the cover", () => {
    const { html } = DOKUMENTE[0]!;
    const treffer = html.match(/RT-DS-20261030-0001/g) ?? [];
    const seiten = (html.match(/class="page/g) ?? []).length;
    // Once per page footer, plus the cover block — the cover has no footer.
    expect(treffer.length).toBe(seiten);
  });

  it("carries the mandatory company details required of a GmbH", () => {
    const { html } = DOKUMENTE[0]!;
    expect(html).toContain("Amtsgericht Paderborn");
    expect(html).toContain("HRB 15938");
    expect(html).toContain("Werner Francis Reineke, Karl Pieper");
  });

  it("names the current scan host, not the retired one", () => {
    for (const { name, html } of DOKUMENTE) {
      expect(html, name).not.toContain("scan.reineke-technik.de");
      expect(html, name).toContain("scan.reineke.tech");
    }
  });
});

describe("the report number", () => {
  it("falls back to a unique number when Odoo cannot be reached", () => {
    const a = ersatzNummer(new Date("2026-10-30T15:30:42Z"));
    expect(a).toBe("RT-DS-20261030-T153042");
  });

  it("marks the fallback so it can be told from a counter value", () => {
    expect(ersatzNummer(new Date("2026-01-02T03:04:05Z"))).toMatch(/-T\d{6}$/);
  });
});
