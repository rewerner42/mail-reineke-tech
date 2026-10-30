// Stage 1 acceptance, frozen: the TypeScript view model must match what the
// Python reference generator produced for the same inputs.
//
// The signals, the expected view models and the catalogue they were rendered with
// all live in tests/fixtures/referenz/ — copies, deliberately. The catalogue in
// src/report/daten/ grows from here on (new finding texts, B12 removing a
// finding), which would legitimately change the output. This test is about the
// *code* being a faithful port, so it is pinned to the catalogue of that moment
// and must keep passing untouched.
//
// The reference package ships 13 expected view models but only 11 input signals;
// sema-systemtechnik.de and sollich.com have no signal file, so they cannot be
// reproduced. Reconstructing their inputs from the expected output would make the
// test check itself, so they stay out.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildViewmodel, type Katalog } from "../src/report/viewmodel.js";
import type { Signal } from "../src/report/signal.js";
import katalogJson from "./fixtures/referenz/katalog-stufe1.json";
import firmaJson from "./fixtures/referenz/firma-stufe1.json";

const REF = fileURLToPath(new URL("./fixtures/referenz", import.meta.url));
const katalog = katalogJson as unknown as Katalog;

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
  return readdirSync(`${REF}/signale`)
    .filter((x) => x.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw = JSON.parse(readFileSync(`${REF}/signale/${f}`, "utf8"));
      return { slug: raw.domain as string, sig: adapt(raw) };
    });
}

describe("view model equivalence with the Python reference", () => {
  const signals = signalFiles();

  it("covers all eleven reproducible reference datasets", () => {
    expect(signals).toHaveLength(11);
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

});
