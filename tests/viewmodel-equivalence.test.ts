// Stage 1 acceptance: the TypeScript view model must match the Python reference.
//
// Two comparisons run here. The strong one feeds the reference signals through
// our port and compares the result against referenz/erwartet/*.viewmodel.json —
// the output the reference generator produced. Image paths are excluded (the
// goldens carry the literal "ASSETS_URL"), nothing else is.
//
// The reference package ships 13 expected view models but only 11 input signals;
// sema-systemtechnik.de and sollich.com have no signal file, so they cannot be
// reproduced. Reconstructing their inputs from the expected output would make the
// test check itself, so they are listed as known gaps instead.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildViewmodel, type Katalog } from "../src/report/viewmodel.js";
import type { Signal } from "../src/report/signal.js";
import katalogJson from "../src/report/daten/katalog.json";
import firmaJson from "../src/report/daten/firma.json";

const REF = "/Users/werner/Documents/social-selling-academy/lead-magnet-befund/uebergabe-generator/referenz";
const katalog = katalogJson as unknown as Katalog;

/** The 13 expected view models the reference package ships. */
const ERWARTET = existsSync(`${REF}/erwartet`)
  ? readdirSync(`${REF}/erwartet`).filter((f) => f.endsWith(".viewmodel.json")).sort()
  : [];

/** Lifts a reference signal file into the Signal shape the port expects. */
function adapt(raw: any): Signal {
  const d = raw.dmarc ?? {};
  const dn = raw.dnssec ?? {};
  const obs = raw.observatory ?? {};
  const m = raw.mail ?? {};
  const check = (c: any) => ({ status: c.status, text: c.text });
  return {
    domain: raw.domain,
    scan_date: raw.scan_date,
    level: raw.level,
    dmarc: {
      grade: d.grade ?? null, score: d.score ?? null, record: d.record ?? null,
      policy: d.policy ?? null, record_vorhanden: !!d.record, rua: !!d.rua,
    },
    dnssec: {
      grade: dn.grade ?? null, score: dn.score ?? null, signed: !!dn.signed,
      zustand: dn.signed ? "signiert" : "nicht_signiert",
    },
    observatory: {
      available: !!obs.available, grade: obs.grade ?? null, score: obs.score ?? null,
      passed: obs.passed ?? null, total: obs.total ?? null,
      tests: (obs.tests ?? []).map((t: any) => ({
        id: t.id, variant: t.variant ?? "", modifier: t.modifier ?? 0,
        code: "", unbekannt: false,
        result_text: t.result_text ?? "", recommendation: t.recommendation ?? "",
      })),
    },
    mail: {
      spf: check(m.spf),
      dkim: { ...check(m.dkim), selectors: m.dkim.selectors ?? 0 },
      mx: { ...check(m.mx), count: m.mx.count ?? 0 },
      mta_sts: check(m.mta_sts),
      tls_rpt: check(m.tls_rpt),
    },
  };
}

function signalFiles(): Array<{ slug: string; sig: Signal }> {
  const out: Array<{ slug: string; sig: Signal }> = [];
  for (const dir of ["generator/daten/signale", "generator/daten/stresstest"]) {
    const full = `${REF}/${dir}`;
    if (!existsSync(full)) continue;
    for (const f of readdirSync(full).filter((x) => x.endsWith(".json")).sort()) {
      const raw = JSON.parse(readFileSync(`${full}/${f}`, "utf8"));
      out.push({ slug: raw.domain, sig: adapt(raw) });
    }
  }
  return out;
}

const skipAll = !existsSync(REF);
describe.skipIf(skipAll)("view model equivalence with the Python reference", () => {
  const signals = signalFiles();

  it("finds the reference signals", () => {
    expect(signals.length).toBeGreaterThan(0);
  });

  for (const { slug, sig } of signals) {
    it(`${slug} matches the expected view model`, () => {
      const golden = JSON.parse(readFileSync(`${REF}/erwartet/${slug}.viewmodel.json`, "utf8"));
      const mine = buildViewmodel(sig, katalog, firmaJson as any, {
        assets: "ASSETS_URL",
        berichtNr: golden.bericht_nr,
      });
      expect(JSON.parse(JSON.stringify(mine))).toEqual(golden);
    });
  }

  it("names the expected view models that have no input signal", () => {
    const have = new Set(signals.map((s) => s.slug));
    const missing = ERWARTET.map((f) => f.replace(".viewmodel.json", "")).filter((s) => !have.has(s));
    expect(missing).toEqual(["sema-systemtechnik.de", "sollich.com"]);
  });
});
