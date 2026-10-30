// The view model, dataset by dataset and decision by decision.
//
// Two layers. The golden comparison catches any unintended change across all
// eleven reference datasets at once. The named assertions below it say what each
// content decision is supposed to do, so a regression is reported as "B12 broke"
// rather than as a diff someone has to interpret.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildViewmodel, type Katalog } from "../src/report/viewmodel.js";
import type { Signal } from "../src/report/signal.js";
import { adaptReferenz } from "../tools/referenz-signal.js";
import { sauber } from "../tools/synthetisch.js";
import katalogJson from "../src/report/daten/katalog.json";
import firmaJson from "../src/report/daten/firma.json";

const REF = fileURLToPath(new URL("./fixtures/referenz", import.meta.url));
const katalog = katalogJson as unknown as Katalog;

function signale(): Array<{ slug: string; sig: Signal }> {
  return readdirSync(`${REF}/signale`)
    .filter((x) => x.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw = JSON.parse(readFileSync(`${REF}/signale/${f}`, "utf8"));
      return { slug: raw.domain as string, sig: adaptReferenz(raw) };
    });
}

function bau(sig: Signal): Record<string, any> {
  return JSON.parse(
    JSON.stringify(
      buildViewmodel(sig, katalog, firmaJson as any, {
        assets: "ASSETS_URL",
        berichtNr: `RT-DS-${sig.scan_date.replace(/-/g, "")}-01`,
      }),
    ),
  );
}

const DATEN = signale();
const vm = new Map(DATEN.map(({ slug, sig }) => [slug, bau(sig)]));
const keys = (slug: string) => vm.get(slug)!.feststellungen.map((f: any) => f.key);
const find = (slug: string, key: string) =>
  vm.get(slug)!.feststellungen.find((f: any) => f.key === key);

describe("reference datasets", () => {
  it("covers all eleven reproducible datasets", () => {
    expect(DATEN).toHaveLength(11);
  });

  for (const { slug } of DATEN) {
    it(`${slug} matches its golden view model`, () => {
      const golden = JSON.parse(readFileSync(`${REF}/erwartet/${slug}.viewmodel.json`, "utf8"));
      expect(vm.get(slug)).toEqual(golden);
    });
  }
});

describe("B6 — measures are assembled from the findings' steps", () => {
  it("states what to do instead of listing topics", () => {
    const m = vm.get("steuerkanzlei-lauterbach.com")!.massnahmen[0];
    expect(m.key).toBe("M_MAIL_AUTH");
    expect(m.text).toContain("SPF-Eintrag mit allen genutzten Versanddiensten");
    expect(m.text).toContain("Berichtsadresse (rua)");
    expect(m.text).not.toContain("Betroffen:");
  });

  it("names each step once even when several findings share it", () => {
    for (const [, v] of vm) {
      for (const m of v.massnahmen) {
        const teile = String(m.text).split("; ");
        expect(new Set(teile).size).toBe(teile.length);
      }
    }
  });

  it("derives the effort from the findings, lowest to highest step", () => {
    const m = vm.get("steuerkanzlei-lauterbach.com")!.massnahmen[0];
    expect(m.aufwand).toBe("gering");
    const web = vm.get("steuerkanzlei-lauterbach.com")!.massnahmen.find((x: any) => x.key === "M_WEB");
    expect(web.aufwand).toBe("gering bis mittel");
  });

  it("names who normally carries out each measure", () => {
    for (const [, v] of vm) {
      for (const m of v.massnahmen) if (m.key !== "M_RETEST") expect(m.zustaendig).toBeTruthy();
    }
  });
});

describe("B7 — a missing SPF under an enforcing DMARC policy is a different finding", () => {
  it("reports the risk to the domain's own mail, not forgery", () => {
    expect(keys("steuerkanzlei-lauterbach.com")).toContain("spf_fehlt_dmarc_streng");
    expect(keys("steuerkanzlei-lauterbach.com")).not.toContain("spf_fehlt");
    expect(find("steuerkanzlei-lauterbach.com", "spf_fehlt_dmarc_streng").feststellung).toContain(
      "DKIM",
    );
  });

  it("keeps the plain finding when DMARC does not enforce", () => {
    const sig = DATEN.find((d) => d.slug === "budde.de")!.sig;
    const lose: Signal = {
      ...sig,
      dmarc: { ...sig.dmarc, policy: "none", zustand: "none" },
      mail: { ...sig.mail, spf: { status: "mangel", zustand: "fehlt", text: "kein SPF" } },
    };
    expect(bau(lose).feststellungen.map((f: any) => f.key)).toContain("spf_fehlt");
  });

  it("lowers the priority to mittel when DKIM carries authentication alone", () => {
    const sig = DATEN.find((d) => d.slug === "steuerkanzlei-lauterbach.com")!.sig;
    const mitDkim: Signal = {
      ...sig,
      mail: { ...sig.mail, dkim: { ...sig.mail.dkim, zustand: "ok", status: "ok", selectors: 1 } },
    };
    const f = bau(mitDkim).feststellungen.find((x: any) => x.key === "spf_fehlt_dmarc_streng");
    expect(f.prio).toBe("mittel");
    expect(f.prio_label).toBe("Mittel");
  });
});

describe("B8 — a DMARC record without a readable policy", () => {
  it("is not reported as 'no record published'", () => {
    const sig = DATEN.find((d) => d.slug === "budde.de")!.sig;
    const kaputt: Signal = {
      ...sig,
      dmarc: { ...sig.dmarc, record: "v=DMARC1; REJECT", policy: null, zustand: "ungueltig" },
    };
    const v = bau(kaputt);
    expect(v.feststellungen.map((f: any) => f.key)).toContain("dmarc_ungueltig");
    expect(v.feststellungen.map((f: any) => f.key)).not.toContain("dmarc_fehlt");
    expect(v.bereiche[0].satz).toContain("keine gültige Richtlinie");
  });
});

describe("B9 — ordering and selection of the substantial findings", () => {
  it("puts e-mail before website at equal priority", () => {
    const v = vm.get("steuerkanzlei-lauterbach.com")!;
    const rang: Record<string, number> = { email: 0, domain: 1, website: 2 };
    for (let i = 1; i < v.feststellungen.length; i++) {
      const a = v.feststellungen[i - 1], b = v.feststellungen[i];
      if (a.prio_rang === b.prio_rang) {
        expect(rang[a.bereich]).toBeLessThanOrEqual(rang[b.bereich]);
      }
    }
  });

  it("never lists a 'gering' finding as substantial", () => {
    for (const [, v] of vm) {
      for (const t of v.top) expect(["hoch", "mittel"]).toContain(t.prio);
    }
  });

  it("leaves the substantial list empty when only minor findings exist", () => {
    expect(vm.get("test-nur-gering.example")!.top).toEqual([]);
  });
});

describe("B12 — a single mail server is not a finding", () => {
  it("never produces mx_einzeln", () => {
    for (const [, v] of vm) {
      expect(v.feststellungen.map((f: any) => f.key)).not.toContain("mx_einzeln");
    }
    expect(Object.keys(katalog.feststellungen)).not.toContain("mx_einzeln");
  });

  it("keeps the measurement in the appendix", () => {
    const mx = vm.get("budde.de")!.technik.mail.find((m: any) => m.key === "mx");
    expect(mx.text).toBeTruthy();
  });

  it("still reports a mail server without a reachable address", () => {
    const sig = DATEN.find((d) => d.slug === "budde.de")!.sig;
    const kaputt: Signal = {
      ...sig,
      mail: { ...sig.mail, mx: { status: "mangel", zustand: "ohne_ip", text: "MX ohne A-Record", count: 1 } },
    };
    expect(bau(kaputt).feststellungen.map((f: any) => f.key)).toContain("mx_ohne_ip");
  });
});

describe("B13 — the positive list", () => {
  it("names a passed website test as something done right", () => {
    // The reference signals list only the failing website tests, so this needs a
    // bonus result to show at all. Live scans return all twelve.
    const sig = DATEN.find((d) => d.slug === "budde.de")!.sig;
    const mitLob: Signal = {
      ...sig,
      observatory: {
        ...sig.observatory,
        tests: [
          ...sig.observatory.tests,
          { id: "hsts", variant: "preloaded", modifier: 5, code: "", unbekannt: false, result_text: "x", recommendation: "" },
        ],
      },
    };
    const v = bau(mitLob);
    expect(v.positiv.some((p: any) => p.bereich === "website")).toBe(true);
    expect(v.positiv.some((p: any) => p.text.includes("HSTS Preload"))).toBe(true);
  });

  it("gives a report that had nothing positive at least a partial success", () => {
    // budde.de carried not a single positive sentence before B13.
    expect(vm.get("budde.de")!.positiv.length).toBeGreaterThan(0);
  });

  it("falls back to partial successes only when nothing else is positive", () => {
    const sig = DATEN.find((d) => d.slug === "budde.de")!.sig;
    const duester: Signal = {
      ...sig,
      dmarc: { ...sig.dmarc, policy: null, zustand: "fehlt", record: null, rua: false },
      dnssec: { ...sig.dnssec, signed: false, zustand: "nicht_signiert" },
      observatory: { ...sig.observatory, tests: sig.observatory.tests.filter((t) => t.modifier < 0) },
      mail: {
        spf: { status: "hinweis", zustand: "hinweis", text: "SPF mit Hinweis" },
        dkim: { status: "mangel", zustand: "nicht_gefunden", text: "kein DKIM", selectors: 0 },
        mx: { status: "ok", zustand: "ok", text: "2 MX", count: 2 },
        mta_sts: { status: "hinweis", zustand: "fehlt", text: "kein MTA-STS" },
        tls_rpt: { status: "hinweis", zustand: "fehlt", text: "kein TLS-RPT" },
      },
    };
    const v = bau(duester);
    const mx = v.positiv.filter((p: any) => p.text.includes("Mailserver"));
    expect(mx.length).toBeGreaterThan(0);
    expect(v.positiv.some((p: any) => p.text.includes("SPF-Eintrag ist vorhanden"))).toBe(false);
  });
});

describe("B14 — a report without findings", () => {
  const v = () => vm.get("test-ohne-befund.example")!;

  it("has no findings and only the re-test measure", () => {
    expect(v().feststellungen).toEqual([]);
    expect(v().massnahmen).toHaveLength(1);
    expect(v().massnahmen[0].key).toBe("M_RETEST");
  });

  it("does not promise a walk-through of findings that do not exist", () => {
    expect(v().texte.cta_text).toContain("gut aufgestellt");
    expect(v().texte.next_text).toContain("gut aufgestellt");
    expect(v().texte.ablauf).toEqual([]);
    expect(v().texte.cta_massnahmen).toBeNull();
    expect(v().texte.nachpruefung).toBeNull();
    expect(v().massnahmen[0].bezug_text).toBe("–");
  });

  it("keeps the normal texts when there are findings", () => {
    const b = vm.get("budde.de")!;
    expect(b.texte.cta_text).not.toContain("gut aufgestellt");
    expect(b.texte.cta_massnahmen).toBeTruthy();
    expect(b.massnahmen.at(-1).bezug_text).toBe("alle");
  });

  it("never leaks the replacement key into the view model", () => {
    for (const [, x] of vm) expect(x.texte.cta_text_ohne_feststellungen).toBeUndefined();
  });
});

describe("A3 — a website that could not be assessed", () => {
  const v = () => vm.get("sharp.eu")!;

  it("says 'not assessed' rather than giving an all-clear", () => {
    const web = v().bereiche[2];
    expect(web.note).toBe("–");
    expect(web.wort).toBe("Nicht bewertet");
    expect(web.satz).toBe("Nicht automatisch bewertbar: weder Mangel noch Entwarnung.");
    expect(web.detail).toBe("Test nicht verfügbar");
  });

  it("produces no website finding either", () => {
    expect(v().feststellungen.filter((f: any) => f.bereich === "website")).toEqual([]);
  });
});

describe("A4/B18 — website results", () => {
  it("derives the priority from MDN's own deduction", () => {
    // -50 → hoch, -20 → mittel, -5 → gering. Not a judgement of ours.
    const sig = DATEN.find((d) => d.slug === "socialselling-academy.com")!.sig;
    const v = bau(sig);
    const byKey = new Map(v.feststellungen.map((f: any) => [f.key, f]));
    expect(byKey.get("obs_sri_http").prio).toBe("hoch");
    expect(byKey.get("obs_hsts_missing").prio).toBe("mittel");
    expect(byKey.get("obs_xcto_missing").prio).toBe("gering");
  });

  it("gives each test variant its own text", () => {
    const sig = DATEN.find((d) => d.slug === "socialselling-academy.com")!.sig;
    const andere: Signal = {
      ...sig,
      observatory: {
        ...sig.observatory,
        tests: [
          { id: "cookies", variant: "no-secure", modifier: -20, code: "", unbekannt: false, result_text: "x", recommendation: "" },
          { id: "redirection", variant: "fremder-host", modifier: -5, code: "", unbekannt: false, result_text: "x", recommendation: "" },
        ],
      },
    };
    const v = bau(andere);
    const titel = v.feststellungen.map((f: any) => f.titel);
    const von = (key: string) => katalog.feststellungen[key]!.titel;
    expect(titel).toContain(von("obs_cookies_no-secure"));
    expect(titel).toContain(von("obs_redirection_fremder-host"));
    expect(titel).not.toContain(von("obs_cookies_no-httponly"));
  });

  it("says so in one sentence when every test passed", () => {
    const sig = DATEN.find((d) => d.slug === "socialselling-academy.com")!.sig;
    const sauber: Signal = {
      ...sig,
      observatory: { ...sig.observatory, grade: "A+", score: 100, passed: 12, total: 12, tests: [] },
    };
    expect(bau(sauber).bereiche[2].satz).toBe("Alle 12 Sicherheitstests bestanden.");
  });

  it("neither reports nor praises a neutral result", () => {
    const sig = DATEN.find((d) => d.slug === "socialselling-academy.com")!.sig;
    const neutral: Signal = {
      ...sig,
      observatory: {
        ...sig.observatory,
        tests: [{ id: "cookies", variant: "keine", modifier: 0, code: "", unbekannt: false, result_text: "x", recommendation: "" }],
      },
    };
    const v = bau(neutral);
    expect(v.feststellungen.filter((f: any) => f.bereich === "website")).toEqual([]);
    expect(v.positiv.filter((p: any) => p.bereich === "website")).toEqual([]);
    expect(v.technik.observatory.tests).toHaveLength(1);
  });
});

describe("B10 — the e-mail grade rates DMARC alone", () => {
  it("says so when a good grade sits next to SPF or DKIM findings", () => {
    const email = vm.get("steuerkanzlei-lauterbach.com")!.bereiche[0];
    expect(email.klasse).toBe("good");
    expect(email.note_hinweis).toContain("bewertet nur DMARC");
    expect(email.note_hinweis).toMatch(/F-\d\d/);
  });

  it("stays silent when the grade is not good", () => {
    expect(vm.get("budde.de")!.bereiche[0].note_hinweis).toBeNull();
  });
});

describe("V15 — open points become topics for the call", () => {
  const texte = katalog.texte as Record<string, string>;

  it("collects the point each finding leaves open, in finding order", () => {
    const v = vm.get("budde.de")!;
    const erwartet = v.feststellungen.map((f: any) => f.offen).filter(Boolean);
    expect(erwartet.length).toBeGreaterThan(0);
    expect(v.offene_punkte).toEqual([...new Set(erwartet)]);
  });

  it("adds the website when it could not be rated", () => {
    const v = vm.get("sharp.eu")!;
    expect(v.technik.observatory.available).toBe(false);
    expect(v.offene_punkte.at(-1)).toBe(texte.offen_website);
  });

  it("has nothing to add when nothing is open", () => {
    expect(vm.get("test-ohne-befund.example")!.offene_punkte).toEqual([]);
  });
});

describe("V19 — every measure names who usually carries it out", () => {
  it("passes the catalogue's assignment through", () => {
    for (const [, v] of vm) {
      for (const m of v.massnahmen) {
        if (m.key === "M_RETEST") continue;
        expect(m.zustaendig, m.key).toBe(katalog.massnahmen[m.key]!.zustaendig);
        expect(m.zustaendig, m.key).toBeTruthy();
      }
    }
  });

  it("leaves it out for the re-test, whose text already says who does it", () => {
    for (const [, v] of vm) {
      expect(v.massnahmen.find((m: any) => m.key === "M_RETEST").zustaendig).toBeNull();
    }
  });
});

describe("B6 — the steps of a measure in the order they are carried out", () => {
  it("puts sender list and signature first, then the reports, then the stricter policy", () => {
    const sig = sauber();
    sig.dmarc = { ...sig.dmarc, policy: "none", zustand: "none", rua: false, grade: "C" };
    sig.mail.spf = { ...sig.mail.spf, status: "hinweis", zustand: "hinweis" };
    sig.mail.dkim = { ...sig.mail.dkim, status: "hinweis", zustand: "hinweis" };
    const text = bau(sig).massnahmen.find((m: any) => m.key === "M_MAIL_AUTH").text as string;
    const pos = (k: string) => text.indexOf(katalog.feststellungen[k]!.schritt!);
    expect(pos("spf_hinweis")).toBeGreaterThanOrEqual(0);
    expect(pos("spf_hinweis")).toBeLessThan(pos("dkim_hinweis"));
    expect(pos("dkim_hinweis")).toBeLessThan(pos("dmarc_kein_rua"));
    expect(pos("dmarc_kein_rua")).toBeLessThan(pos("dmarc_none"));
  });
});

describe("B13 — partial successes get a lead-in of their own", () => {
  it("does not call them „ohne Beanstandung“", () => {
    for (const [slug, v] of vm) {
      const teil = v.positiv.length && v.positiv.every((p: any) =>
        Object.entries(katalog.positiv).some(([k, t]) => k.endsWith("_teilerfolg") && p.text.startsWith(String(t).split("{")[0])));
      if (teil) expect(v.positiv_einleitung, slug).toBe(katalog.positiv_einleitung.teilerfolg);
      else expect(v.positiv_einleitung, slug).not.toBe(katalog.positiv_einleitung.teilerfolg);
    }
  });
});

describe("the catalogue covers every finding it is asked for", () => {
  it("never falls back to the generic website text", () => {
    for (const [, v] of vm) {
      expect(v.feststellungen.map((f: any) => f.key)).not.toContain("obs_generic");
    }
  });

  it("leaves no placeholder unresolved", () => {
    for (const [slug, v] of vm) {
      const text = JSON.stringify(v).replace(/ASSETS_URL/g, "");
      const offen = text.match(/\{[a-z_]+\}/g);
      expect(offen, `${slug}: ${offen?.join(", ")}`).toBeNull();
    }
  });
});
