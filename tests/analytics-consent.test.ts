import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cspFor } from "../src/index.js";
import { reineke } from "../src/brands/reineke.js";
import { sharp } from "../src/brands/sharp.js";
// @ts-expect-error -- ausgeliefertes Browser-Modul ohne Typen
import { scrubUrl, scrubEvent } from "../public/scrub.js";

/**
 * Diese Datei sichert Zusagen ab, die sonst nirgends geprueft werden und
 * beim naechsten Umbau lautlos brechen koennen. Sie entstand, nachdem eine
 * Pruefung zeigte, dass weder CSP noch Marke noch Einwilligung von Tests
 * gedeckt waren -- und dass die Sitzungsaufzeichnung personenbezogene Daten
 * Dritter aufgezeichnet haette (rua=mailto:... aus fremden DMARC-Saetzen).
 */

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const stylesCss = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("CSP je Marke", () => {
  it("Reineke: PostHog erlaubt, Umami nicht mehr", () => {
    const csp = cspFor(reineke);
    expect(csp).toContain("https://*.posthog.com");
    expect(csp).not.toContain("umami");
  });

  it("Reineke: worker-src fuer den Recorder, mit blob: und data:", () => {
    expect(cspFor(reineke)).toContain("worker-src 'self' blob: data:");
  });

  it("script-src bleibt frei von unsafe-inline", () => {
    for (const b of [reineke, sharp]) {
      const scriptSrc = cspFor(b).split(";").find((d) => d.trim().startsWith("script-src"))!;
      expect(scriptSrc).not.toContain("unsafe-inline");
    }
  });

  it("Sharp bekommt keine Analyse-Herkunft", () => {
    const csp = cspFor(sharp);
    expect(csp).not.toContain("posthog");
    expect(csp).not.toContain("umami");
  });
});

describe("Sitzungsaufzeichnung nur, wo sie hingehoert", () => {
  it("nur die Reineke-Marke hat sie eingeschaltet", () => {
    expect(reineke.analytics?.sessionReplay).toBe(true);
    expect(sharp.analytics?.sessionReplay ?? false).toBe(false);
  });

  it("Umami ist fuer Reineke abgeschaltet", () => {
    expect(reineke.analytics?.umamiId).toBeNull();
  });

  it("haengt im Code an der Einwilligung, nicht am Aufrufweg", () => {
    // Der Aufrufweg (loadTrackers) haengt an ANALYTICS_OPT_IN, also daran, ob
    // der Worker brand-data eingefuegt hat -- NICHT an der Zustimmung. Die
    // Aufzeichnung muss ihre Bedingung deshalb selbst tragen.
    expect(appJs).toMatch(/const replay\s*=\s*Boolean\(ANALYTICS\.sessionReplay\)\s*&&\s*hasConsent\("statistics"\)/);
    expect(appJs).toContain("disable_session_recording: !replay");
  });

  it("Konsolenausgaben werden nicht mitgeschnitten", () => {
    // Die Projektvorgabe steht auf true; hier wird sie ueberschrieben.
    expect(appJs).toContain("enable_recording_console_log: false");
  });
});

describe("Maskierung — Verhalten, nicht Wortlaut", () => {
  it("entfernt die geprüfte Domain aus einer Report-URL", () => {
    expect(scrubUrl("/bericht?d=fremde-firma.de")).toBe("/bericht?d=maskiert");
    expect(scrubUrl("https://scan.reineke.tech/?d=fremde-firma.de&s=sel1"))
      .toBe("https://scan.reineke.tech/?d=maskiert&s=maskiert");
    expect(scrubUrl("/api/email?domain=fremde-firma.de&selectors=a"))
      .toBe("/api/email?domain=maskiert&selectors=maskiert");
  });

  it("laesst URLs ohne die Parameter unveraendert", () => {
    expect(scrubUrl("/bericht")).toBe("/bericht");
    expect(scrubUrl("https://scan.reineke.tech/impressum")).toBe("https://scan.reineke.tech/impressum");
    expect(scrubUrl("")).toBe("");
    expect(scrubUrl(undefined as unknown as string)).toBeUndefined();
  });

  it("passt zur echten PostHog-Signatur von maskCapturedNetworkRequestFn", () => {
    // Der Vorgaenger hing unter maskNetworkRequestFn und las req.name --
    // PostHog ruft das veraltete Feld aber mit {url: …} auf, der Wert war
    // also immer undefined. Dieser Test haette das gefunden.
    const fn = (req: { name: string }) => ({ ...req, name: scrubUrl(req.name) });
    expect(fn({ name: "https://scan.reineke.tech/api/email?domain=fremde-firma.de" }).name)
      .toBe("https://scan.reineke.tech/api/email?domain=maskiert");
  });

  it("bereinigt Autocapture-Attribute, wo sie wirklich liegen", () => {
    // NICHT properties.attr__href -- das Feld gibt es dort nicht.
    const ev = scrubEvent({
      properties: {
        $current_url: "https://scan.reineke.tech/?d=fremde-firma.de",
        $elements: [{ attr__href: "/bericht?d=fremde-firma.de" }],
        $elements_chain: 'a:href="/bericht?d=fremde-firma.de"nth-child="1"',
      },
    });
    expect(ev.properties.$current_url).not.toContain("fremde-firma.de");
    expect(ev.properties.$elements[0].attr__href).toBe("/bericht?d=maskiert");
    expect(ev.properties.$elements_chain).not.toContain("fremde-firma.de");
  });

  it("maskiert den gesamten Ergebnisbereich, und der Selektor trifft echte Knoten", () => {
    expect(appJs).toMatch(/REPLAY_MASK_SELECTOR\s*=\s*"\[data-results\], \[data-error\]"/);
    expect(appJs).toContain("maskTextSelector: REPLAY_MASK_SELECTOR");
    // Ein Selektor, der nichts trifft, ist gefaehrlicher als keiner: er sieht
    // nach Schutz aus. Genau das war vorher der Fall ("[data-ph-mask]").
    expect(indexHtml.match(/data-results/g)?.length).toBeGreaterThanOrEqual(3);
    expect(appJs).toContain("[data-error]");
    expect(appJs).not.toContain("data-ph-mask");
  });

  it("verwendet den nicht-veralteten PostHog-Schluessel", () => {
    // Ohne Kommentare pruefen -- die erklaeren den alten Namen ja gerade.
    const ohneKommentar = appJs.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
    expect(ohneKommentar).toContain("maskCapturedNetworkRequestFn:");
    expect(ohneKommentar).not.toMatch(/(?<!Captured)(?<!\w)maskNetworkRequestFn\s*:/);
  });

  it("der Berichtslink ist von Autocapture ausgenommen", () => {
    expect(appJs).toContain('classList.add("ph-no-capture")');
  });

  it("KEIN Link mit der gepruesten Domain ohne ph-no-capture", () => {
    // Der eigentliche Befund: href-ATTRIBUTE fallen nicht unter
    // maskTextSelector. Drei Stellen tragen die Domain im href --
    // Kopfzeilen-Knopf, Karten-Export, MDN-Link. Jede muss geblockt sein.
    const verdaechtig = [...appJs.matchAll(/<a class="([^"]*)"[^>]*href="\$\{[^}]*(reportLink|detailsUrl)[^}]*\}/g)];
    expect(verdaechtig.length).toBeGreaterThanOrEqual(2);
    for (const m of verdaechtig) expect(m[1]).toContain("ph-no-capture");
    // Der per Eigenschaft gesetzte Knopf ebenso.
    expect(appJs).toMatch(/btn\.href = reportLink\(domain\);[\s\S]{0,700}?classList\.add\("ph-no-capture"\)/);
  });

  it("die URL-Zeile des Replays wird bereinigt", () => {
    // Sie kommt aus rrwebs Meta-Ereignis in $snapshot_data, nicht aus den
    // Properties -- eine Bereinigung nur der Properties liesse sie stehen.
    const ev = scrubEvent({
      properties: {
        $snapshot_data: [
          { type: 4, data: { href: "https://scan.reineke.tech/?d=fremde-firma.de", width: 1 } },
        ],
        $set_once: { $initial_current_url: "https://scan.reineke.tech/?d=fremde-firma.de" },
      },
    });
    expect(ev.properties.$snapshot_data[0].data.href).toBe("https://scan.reineke.tech/?d=maskiert");
    expect(ev.properties.$set_once.$initial_current_url).toBe("https://scan.reineke.tech/?d=maskiert");
  });

  it("die Bereinigung ist auch wirklich verdrahtet", () => {
    // Zuletzt liess sich `before_send: scrubEvent` ersatzlos entfernen, ohne
    // dass ein Test rot wurde -- getestete Logik, ungetestete Verdrahtung.
    // Genau die Fehlerart, die schon maskNetworkRequestFn war.
    expect(appJs).toMatch(/before_send:\s*scrubEvent/);
    expect(appJs).toMatch(/import \{[^}]*scrubEvent[^}]*\} from "\.\/scrub\.js"/);
    expect(appJs).toMatch(/maskCapturedNetworkRequestFn:\s*\(req\)\s*=>\s*\(\{[^}]*scrubUrl\(req\.name\)/);
  });
});

describe("Einwilligung", () => {
  it("alte Zustimmungen decken die Aufzeichnung nicht", () => {
    // Wer zu "Cookies & Analyse-Tools" ja gesagt hat, hat nicht zu einer
    // Bildschirmaufzeichnung ja gesagt. Neuer Schluessel = alle werden gefragt.
    expect(appJs).toContain('const CONSENT_KEY = "rt-consent-v2"');
    expect(appJs).not.toMatch(/CONSENT_KEY\s*=\s*"rt-consent"/);
  });

  it("es gibt einen Widerrufsweg", () => {
    // Die Datenschutzerklaerung verspricht ihn -- also muss es ihn geben.
    expect(indexHtml).toContain("data-consent-open");
    expect(appJs).toContain("function clearTrackingState");
    expect(appJs).toContain("ph_");
  });

  it("der Banner nennt die Aufzeichnung ausdruecklich", () => {
    // "Analyse-Tools" beschreibt eine Bildschirmaufzeichnung nicht. Eine
    // Einwilligung muss informiert sein -- also muss das Wort fallen.
    expect(indexHtml).toMatch(/Aufzeichnung Ihres Besuchsablaufs/);
    expect(indexHtml).toMatch(/unkenntlich/);
    expect(indexHtml).toContain('data-cat="statistics"');
  });

  it("sieht aus wie der Banner der Hauptseite", () => {
    // Gleicher Absender, gleiches Bild: dieselben Klassennamen wie in
    // reineke-consent.css auf www.reineke-technik.de.
    for (const k of ["rt-consent", "rt-consent__title", "rt-consent__opts",
                     "rt-consent__actions", "rt-consent__btn--primary",
                     "rt-consent__more", "rt-consent-link"]) {
      expect(indexHtml + stylesCss).toContain(k);
    }
    // Die alten, abweichenden Klassen sind restlos weg.
    expect(indexHtml + stylesCss).not.toContain("cookie-banner");
    expect(indexHtml + stylesCss).not.toContain("cookie-accept");
  });

  it("jeder Knopf im Markup hat einen Zweig im Code", () => {
    const imMarkup = [...new Set([...indexHtml.matchAll(/data-act="([a-z]+)"/g)].map((m) => m[1]))];
    const imCode = [...new Set([...appJs.matchAll(/act === "([a-z]+)"/g)].map((m) => m[1]))];
    expect(imMarkup.length).toBeGreaterThan(0);
    for (const a of imMarkup) expect(imCode).toContain(a);
    // "sel" wird erst zur Laufzeit gesetzt (aus "detail"), steht also nicht im
    // Markup -- muss aber im Code behandelt sein, sonst ist "Auswahl
    // speichern" ein toter Knopf.
    expect(imCode).toContain("sel");
    expect(appJs).toMatch(/setAttribute\("data-act", "sel"\)/);
  });

  it("jede Kategorie im Markup ist dem Code bekannt", () => {
    const cats = [...indexHtml.matchAll(/data-cat="([a-z]+)"/g)].map((m) => m[1]);
    const bekannt = /const CATEGORIES = \[([^\]]*)\]/.exec(appJs)![1];
    for (const c of cats) expect(bekannt).toContain('"' + c + '"');
  });

  it("die Standardmarke bekommt weder Banner noch toten Fusszeilen-Link", () => {
    expect(appJs).toMatch(/querySelectorAll\("\[data-consent-open\]"\)[\s\S]{0,60}remove\(\)/);
  });

  it("die Standardmarke bekommt den Banner NICHT", () => {
    // public/ ist von beiden Marken geteilt. Der Bannertext nennt PostHog und
    // die Aufzeichnung -- auf Sharp laeuft beides nicht.
    expect(appJs).toMatch(/if \(!ANALYTICS_OPT_IN\)[\s\S]{0,1400}?return;/);
    const opt = /if \(!ANALYTICS_OPT_IN\)[\s\S]{0,1400}?return;/.exec(appJs)![0];
    expect(opt).not.toContain("wireConsentUi");
  });

  it("kein ungekapselter Speicherzugriff", () => {
    // Safari-Privatmodus wirft bei localStorage. Ein ungefangener Zugriff
    // haette die ganze Initialisierung abgebrochen -- samt Banner.
    const roh = [...appJs.matchAll(/^(?!\s*(\/\/|\*)).*localStorage\.(getItem|setItem|removeItem)/gm)];
    for (const m of roh) {
      const rundherum = appJs.slice(Math.max(0, m.index! - 260), m.index! + 60);
      expect(rundherum).toContain("try {");
    }
  });

  it("der Widerruf haelt PostHog an, bevor er aufraeumt", () => {
    expect(appJs).toContain("function stopTrackers");
    expect(appJs).toMatch(/stopTrackers\(\);\s*\n\s*clearTrackingState\(\);/);
    expect(appJs).toContain("stopSessionRecording");
    expect(appJs).toContain("sessionStorage");
  });
});
