// Seiten und Dateien einer Marke duerfen auf keiner anderen erscheinen.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import app from "../src/index.js";
import { BRANDS } from "../src/brand.js";

// Bewusst ausgeschrieben statt aus reineke.privateAssets gelesen: Faellt ein
// Eintrag dort weg, soll dieser Test rot werden.
const REINEKE_EIGEN = [
  "/pentest",
  "/pentest.html",
  "/pentest.js",
  "/bericht",
  "/bericht.html",
  "/bericht.js",
  "/assets/musterbericht.pdf",
  "/assets/muster-seite-1.webp",
  "/assets/muster-seite-3.webp",
  "/assets/muster-seite-8.webp",
  "/assets/muster-seite-12.webp",
];

// Bildet Cloudflares Auslieferung nach, soweit es hier zaehlt: /x findet auch
// /x.html, und was es nicht gibt, ist 404 (not_found_handling = "404-page",
// siehe unten). Ein 404 fuer eine VORHANDENE Datei kann also nur aus der
// Sperre im Worker kommen.
const DATEIEN = new Set([
  "/index.html",
  "/report.html",
  "/assets/sharp-logo.png",
  ...REINEKE_EIGEN.filter((p) => p.includes(".")),
]);
const ASSETS = {
  fetch: async (req: Request) => {
    const p = new URL(req.url).pathname;
    const da = DATEIEN.has(p === "/" ? "/index.html" : p) || DATEIEN.has(`${p}.html`);
    return new Response(da ? "<!doctype html>" : "Not found", {
      status: da ? 200 : 404,
      headers: { "Content-Type": "text/html" },
    });
  },
};
const sharp = { BRAND: "sharp", ASSETS };
const reineke = { BRAND: "reineke", ASSETS };

describe("Reineke-Seiten auf Sharp", () => {
  // Bis 01.11.2026 lieferte sharp.reineke.tech/pentest die Pentest-Seite von
  // Reineke aus: gesperrt war nur /pentest.html.
  it.each(REINEKE_EIGEN)("%s liefert 404", async (pfad) => {
    const res = await app.request(`https://sharp.reineke.tech${pfad}`, {}, sharp);
    expect(res.status).toBe(404);
  });

  // Mit echten 404 haengen diese Ansichten an ihren Routen. Fehlt eine, ist
  // die Ansicht nach dem Neuladen weg.
  it.each(["/", "/website", "/dnssec", "/report"])("%s bleibt erreichbar", async (pfad) => {
    const res = await app.request(`https://sharp.reineke.tech${pfad}`, {}, sharp);
    expect(res.status).toBe(200);
  });
});

describe("Gegenprobe", () => {
  // Die Sperre gilt nur fuer FREMDE Marken; auf der eigenen muss alles bleiben.
  it.each(REINEKE_EIGEN)("%s bleibt auf Reineke erreichbar", async (pfad) => {
    const res = await app.request(`https://scan.reineke-technik.de${pfad}`, {}, reineke);
    expect(res.status).toBe(200);
  });

  it("das Sharp-Logo bleibt auf Reineke gesperrt", async () => {
    const res = await app.request("https://scan.reineke-technik.de/assets/sharp-logo.png", {}, reineke);
    expect(res.status).toBe(404);
  });
});

describe("privateAssets", () => {
  // Cloudflare liefert /x.html auch unter /x aus. Wer kuenftig eine Seite
  // sperrt und die kurze Form vergisst, macht denselben Fehler noch einmal.
  it.each(Object.values(BRANDS))("$id sperrt jede .html-Seite auch ohne Endung", (marke) => {
    const liste = marke.privateAssets ?? [];
    for (const p of liste.filter((p) => p.endsWith(".html"))) {
      expect(liste).toContain(p.slice(0, -".html".length));
    }
  });
});

describe("wrangler.toml", () => {
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  // Text des Abschnitts bis zur naechsten Tabellen-Ueberschrift.
  const abschnitt = (name: string) => toml.split(`[${name}]`)[1]?.split(/^\[/m)[0] ?? "";

  // Sonst bekaeme jede unbekannte URL Status 200 mit der Startseite, auch
  // /.DS_Store. Fuer Sharp so entschieden am 01.11.2026.
  it.each(["sharp", "reineke"])("%s liefert echte 404 statt der Startseite", (env) => {
    expect(abschnitt(`env.${env}.assets`)).toMatch(/^not_found_handling = "404-page"$/m);
  });
});
