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
import { ZUSTAND_SCHLUESSEL, buildViewmodel, type Katalog } from "../src/report/viewmodel.js";
import { sauber, synthetisch } from "../tools/synthetisch.js";
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
