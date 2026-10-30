// Coverage: every result the scanner can produce has an approved text.
//
// PROMPT.md 3.5. The report is assembled statically, so a result without a
// catalogue entry is not a cosmetic gap — it either renders a generic
// placeholder text or describes the finding wrongly. This walks the full list of
// possible results rather than the ones that happen to appear in test data.
//
// The rendering half of 3.5 — one synthetic dataset per key, rendered and
// checked for overflow — needs headless Chrome and runs in tools/referenz;
// see `npm run bericht:pruefen`. Here the datasets are built and checked for
// unresolved placeholders, missing keys and the generic fallback.

import { describe, expect, it } from "vitest";
import { OBS_CODES, katalogSchluessel } from "../src/report/observatory-codes.js";

/** Every short id the mapping can produce, including the scan-level one. */
const OBS_TEST_IDS = [...new Set(Object.values(OBS_CODES).map((c) => c.id))].sort();
import { ZUSTAND_SCHLUESSEL, buildViewmodel, type Katalog } from "../src/report/viewmodel.js";
import { sauber, synthetisch } from "../tools/synthetisch.js";
import { buildSignal } from "../src/report/signal.js";
import type { Signal, SignalLevel } from "../src/report/signal.js";
import katalogJson from "../src/report/daten/katalog.json";
import firmaJson from "../src/report/daten/firma.json";

const katalog = katalogJson as unknown as Katalog;

function bau(sig: Signal) {
  return buildViewmodel(sig, katalog, firmaJson as any, {
    assets: "ASSETS_URL",
    berichtNr: "RT-DS-20261030-01",
  });
}

const PFLICHTFELDER = [
  "bereich", "prio", "massnahme", "fach", "titel", "kurz",
  "feststellung", "angriff", "auswirkung", "aufwand", "aufwand_text", "tech",
] as const;

const SYNTH = synthetisch();

describe("every possible result has an approved text", () => {
  it("covers all 77 website result codes", () => {
    expect(Object.keys(OBS_CODES)).toHaveLength(77);
  });

  for (const [code, c] of Object.entries(OBS_CODES)) {
    if (c.art === "feststellung") {
      it(`${code} → finding text ${katalogSchluessel(c)}`, () => {
        const e = katalog.feststellungen[katalogSchluessel(c)];
        expect(e, `${katalogSchluessel(c)} fehlt im Katalog`).toBeDefined();
        for (const f of PFLICHTFELDER) expect(e![f], `${f} fehlt`).toBeTruthy();
      });
    } else if (c.art === "positiv") {
      it(`${code} → positive text`, () => {
        expect(katalog.positiv[katalogSchluessel(c)]).toBeTruthy();
      });
    }
  }

  for (const [bereich, tabelle] of Object.entries(ZUSTAND_SCHLUESSEL)) {
    for (const [zustand, key] of Object.entries(tabelle)) {
      if (!key) continue;
      it(`${bereich}.${zustand} → ${key}`, () => {
        const e = katalog.feststellungen[key];
        expect(e, `${key} fehlt im Katalog`).toBeDefined();
        for (const f of PFLICHTFELDER) expect(e![f], `${f} fehlt`).toBeTruthy();
      });
    }
  }
});

describe("a result code MDN adds after this release", () => {
  // The dangerous case is not a missing sentence but a report that is never
  // produced: a bonus code has no fallback chain, and its catalogue key would be
  // built from an empty variant.
  function mitUnbekanntemCode(modifier: number) {
    const sig = sauber();
    sig.observatory = {
      ...sig.observatory,
      grade: "B",
      score: 70,
      tests: [
        {
          id: "csp", variant: "", modifier, unbekannt: true,
          code: "csp-implemented-with-trusted-types",
          result_text: "Originalmeldung von MDN.", recommendation: "Empfehlung von MDN.",
        },
      ],
    };
    return sig;
  }

  it("does not stop the report when MDN scores it as a bonus", () => {
    const v = bau(mitUnbekanntemCode(5)) as Record<string, any>;
    expect(v.feststellungen.filter((f: any) => f.bereich === "website")).toEqual([]);
    expect(v.positiv.filter((p: any) => p.bereich === "website")).toEqual([]);
  });

  it("does not stop the report when MDN scores it as a deduction", () => {
    const v = bau(mitUnbekanntemCode(-10)) as Record<string, any>;
    expect(() => v).not.toThrow();
  });

  it("keeps it in the appendix either way, so the measurement is not lost", () => {
    for (const m of [5, 0, -10]) {
      const v = bau(mitUnbekanntemCode(m)) as Record<string, any>;
      expect(v.technik.observatory.tests, `modifier ${m}`).toHaveLength(1);
      expect(v.technik.observatory.tests[0].result_text).toBe("Originalmeldung von MDN.");
    }
  });

  it("is scored as neutral already in the signal layer", () => {
    const sig = buildSignal(
      {
        domain: "beispiel.de",
        queriedAt: "2026-10-30T00:00:00Z",
        dmarc: { status: "pass", summary: "", issues: [], data: null },
        spf: { status: "pass", summary: "", issues: [], data: null },
        dkim: { status: "pass", summary: "", issues: [], data: [] },
        mx: { status: "pass", summary: "", issues: [], data: [] },
        mtaSts: { status: "pass", summary: "", issues: [], data: {} },
        tlsRpt: { status: "pass", summary: "", issues: [], data: {} },
        dnssec: { status: "pass", summary: "", issues: [], data: { secure: true } },
      } as never,
      {
        status: "pass",
        summary: "",
        issues: [],
        grade: "A",
        data: {
          grade: "A", score: 95, testsPassed: 12, testsFailed: 0, testsQuantity: 12,
          scannedAt: null, detailsUrl: "",
          tests: [
            {
              name: "content-security-policy",
              title: "CSP",
              result: "csp-implemented-with-trusted-types",
              pass: true,
              scoreModifier: 5,
              reason: "x",
              recommendation: "",
            },
          ],
        },
      } as never,
      "2026-10-30",
    );
    expect(sig.observatory.tests[0]!.unbekannt).toBe(true);
    expect(sig.observatory.tests[0]!.modifier).toBe(0);
  });
});

describe("every test id has a German label", () => {
  // Without this the technical detail line printed our internal short id —
  // "coep: −5 Punkte" — in a report for a managing director.
  for (const id of OBS_TEST_IDS) {
    it(`${id}`, () => {
      expect(katalog.observatory_labels[id], `observatory_labels.${id} fehlt`).toBeTruthy();
      expect(katalog.observatory_labels[id]).not.toBe(id);
    });
  }
});

describe("one synthetic dataset per catalogue key", () => {
  it("builds a dataset for every finding the catalogue is asked for", () => {
    const gefordert = new Set<string>(
      Object.values(ZUSTAND_SCHLUESSEL)
        .flatMap((t) => Object.values(t))
        .filter((x): x is string => !!x),
    );
    for (const c of Object.values(OBS_CODES)) {
      if (c.art === "feststellung") gefordert.add(katalogSchluessel(c));
    }
    gefordert.add("spf_fehlt_dmarc_streng");
    gefordert.add("dmarc_kein_rua");
    expect([...gefordert].filter((k) => !SYNTH.has(k))).toEqual([]);
  });

  for (const [key, sig] of SYNTH) {
    it(`${key} renders with no placeholder left and no generic fallback`, () => {
      const v = bau(sig) as Record<string, any>;
      const keys = v.feststellungen.map((f: any) => f.key);
      expect(keys, `${key} wurde nicht ausgelöst`).toContain(key);
      expect(keys).not.toContain("obs_generic");
      const text = JSON.stringify(v).replace(/ASSETS_URL/g, "");
      const offen = text.match(/\{[a-z_]+\}/g);
      expect(offen, `${key}: ${offen?.join(", ")}`).toBeNull();
    });
  }
});

describe("the catalogue carries no text that can never be reached", () => {
  it("has a reachable trigger for every finding entry", () => {
    const erreichbar = new Set(SYNTH.keys());
    // obs_generic is the safety net for a result code MDN adds after this
    // release. It must never fire for a known code, which the tests above check.
    erreichbar.add("obs_generic");
    expect(Object.keys(katalog.feststellungen).filter((k) => !erreichbar.has(k))).toEqual([]);
  });

  it("gives every finding a measure that exists", () => {
    for (const [key, e] of Object.entries(katalog.feststellungen)) {
      expect(katalog.massnahmen[e.massnahme], `${key} → ${e.massnahme}`).toBeDefined();
    }
  });

  it("gives every finding a step where its measure is assembled from steps", () => {
    for (const [key, e] of Object.entries(katalog.feststellungen)) {
      const m = katalog.massnahmen[e.massnahme];
      if (m?.text.includes("{schritte}")) {
        expect(e.schritt, `${key} braucht ein Feld schritt für ${e.massnahme}`).toBeTruthy();
      }
    }
  });

  it("rates every finding on the scale the labels define", () => {
    for (const [key, e] of Object.entries(katalog.feststellungen)) {
      expect(Object.keys(katalog.prio_labels), key).toContain(e.prio);
      expect(Object.keys(katalog.bereich_labels), key).toContain(e.bereich);
    }
  });
});

describe("Handlungsbedarf against the highest finding priority", () => {
  const LEVELS: SignalLevel[] = ["kritisch", "hoch", "mittel", "gering"];
  // Highest priority present, as the catalogue scale sees it: no findings and
  // "gering" both sit at the bottom of the scale.
  const HOECHSTE = [
    { name: "keine", key: null },
    { name: "gering", key: "obs_xcto_missing" },
    { name: "mittel", key: "obs_hsts_missing" },
    { name: "hoch", key: "obs_sri_http" },
  ] as const;

  for (const level of LEVELS) {
    for (const h of HOECHSTE) {
      it(`${level} × ${h.name} explains itself at most once`, () => {
        const sig = h.key ? structuredClone(SYNTH.get(h.key)!) : sauber();
        sig.level = level;
        const v = bau(sig) as Record<string, any>;
        const hinweise = katalog.texte.handlungsbedarf_hinweis as Record<string, string>;
        const treffer = Object.values(hinweise).filter((t) => v.level.hinweis === t);
        expect(treffer.length).toBeLessThanOrEqual(1);
        const stufe: Record<string, number> = { gering: 0, mittel: 1, hoch: 2, kritisch: 2 };
        const soll = stufe[level]! - (h.key ? stufe[v.feststellungen[0].prio]! : 0);
        if (soll === 0) expect(v.level.hinweis).toBeNull();
        else expect(v.level.hinweis).toBe(hinweise[soll > 0 ? "hoeher" : "niedriger"]);
      });
    }
  }
});

describe("states the technical review found misread", () => {
  // A scan in which everything passes, with one check replaced.
  function scan(ueber: Record<string, unknown>) {
    return buildSignal(
      {
        domain: "beispiel.de",
        queriedAt: "2026-10-30T00:00:00Z",
        dmarc: {
          status: "pass", summary: "DMARC aktiv", issues: [], grade: "A", score: 100,
          data: { raw: "v=DMARC1; p=reject; rua=mailto:a@beispiel.de", rua: ["mailto:a@beispiel.de"] },
        },
        spf: { status: "pass", summary: "SPF korrekt", issues: [], data: null },
        dkim: { status: "pass", summary: "", issues: [], data: [{ selector: "google" }] },
        mx: { status: "pass", summary: "", issues: [], data: [] },
        mtaSts: { status: "pass", summary: "", issues: [], data: {} },
        tlsRpt: { status: "pass", summary: "", issues: [], data: {} },
        dnssec: { status: "pass", summary: "", issues: [], data: { secure: true } },
        ...ueber,
      } as never,
      undefined,
      "2026-10-30",
    );
  }

  it("treats SPF „+all“ as every server allowed, not as a missing SPF", () => {
    const sig = scan({
      spf: {
        status: "fail", summary: "SPF erlaubt alle Server (+all)", data: null,
        issues: [{ severity: "fail", code: "SPF_ALL_PASS", message: "+all" }],
      },
    });
    expect(sig.mail.spf.zustand).toBe("alle_erlaubt");
    const keys = (bau(sig) as any).feststellungen.map((f: any) => f.key);
    expect(keys).toContain("spf_alle_erlaubt");
    // Under p=reject this used to say forgery is covered by DMARC.
    expect(keys).not.toContain("spf_fehlt_dmarc_streng");
  });

  it("leaves „+all“ to the missing-SPF texts when the record fails anyway", () => {
    const sig = scan({
      spf: {
        status: "fail", summary: "Mehrere SPF-Einträge", data: null,
        issues: [
          { severity: "fail", code: "SPF_MULTIPLE", message: "2 Einträge" },
          { severity: "fail", code: "SPF_ALL_PASS", message: "+all" },
        ],
      },
    });
    expect(sig.mail.spf.zustand).toBe("fehlt");
  });

  it("does not praise the first of several DMARC records", () => {
    const sig = scan({
      dmarc: {
        status: "fail", summary: "DMARC unzureichend", grade: "F", score: 0,
        issues: [{ severity: "fail", code: "DMARC_MULTIPLE", message: "2 Einträge" }],
        data: { raw: "v=DMARC1; p=reject", rua: [] },
      },
    });
    expect(sig.dmarc.zustand).toBe("mehrfach");
    expect(sig.dmarc.policy).toBeNull();
    const v = bau(sig) as any;
    expect(v.feststellungen.map((f: any) => f.key)).toContain("dmarc_mehrfach");
    expect(v.feststellungen.map((f: any) => f.key)).not.toContain("dmarc_kein_rua");
    expect(v.positiv.map((p: any) => p.text)).not.toContain(katalog.positiv.dmarc_reject);
    expect(v.bereiche[0].satz).toBe(katalog.bereiche.email!.satz.mehrfach);
  });

  it("names a failing DNSSEC signature as such in the appendix", () => {
    const sig = scan({
      dnssec: { status: "fail", summary: "Signatur ungültig", issues: [], data: { secure: false, validationFailed: true } },
    });
    expect(sig.dnssec.zustand).toBe("fehlerhaft");
    const v = bau(sig) as any;
    expect(v.technik.dnssec.zustand_text).toBe("Signatur fehlerhaft");
    expect(v.rohdaten.join("\n")).not.toContain("Zone nicht signiert");
  });
});
