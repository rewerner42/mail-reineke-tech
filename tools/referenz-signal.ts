// Lifts the reference package's signal files into the current Signal shape.
//
// The reference signals predate the state inventory (src/report/signal.ts), so
// they carry a coarse status where the generator now expects a named state. This
// mapping exists for the fixtures only — live scans get their states from the
// scanner's own issue codes.

import { OBS_CODES } from "../src/report/observatory-codes.js";
import type { Signal } from "../src/report/signal.js";

/**
 * MDN's deduction for a (test, variant) pair, looked up rather than taken from
 * the fixture. The reference signals were written by hand and give a deduction
 * to `referrer-policy-not-implemented` and `corp-not-implemented`, for which MDN
 * actually deducts nothing — verified against a live scan of sollich.com. The
 * modifier decides whether a result becomes a finding, so it has exactly one
 * source of truth: src/report/observatory-codes.ts.
 */
function modifierVon(id: string, variant: string, ausFixture: number): number {
  for (const c of Object.values(OBS_CODES)) {
    if (c.id === id && c.variant === variant) return c.modifier;
  }
  return ausFixture;
}

/** Lifts a reference signal file into the current Signal shape. */
export function adaptReferenz(raw: any): Signal {
  const d = raw.dmarc ?? {};
  const dn = raw.dnssec ?? {};
  const obs = raw.observatory ?? {};
  const m = raw.mail ?? {};
  const pol = d.policy ?? null;
  const zustand = (c: any, wenn_warn: string) =>
    c.status === "ok" ? "ok" : c.status === "mangel" ? "fehlt" : wenn_warn;
  return {
    domain: raw.domain,
    scan_date: raw.scan_date,
    level: raw.level,
    dmarc: {
      grade: d.grade ?? null, score: d.score ?? null, record: d.record ?? null,
      text: d.record ? `DMARC aktiv (Note ${d.grade}, p=${pol})` : "Kein DMARC-Eintrag",
      policy: pol, rua: !!d.rua,
      zustand: pol ?? (d.record ? "ungueltig" : "fehlt"),
    },
    dnssec: {
      grade: dn.grade ?? null, score: dn.score ?? null, signed: !!dn.signed,
      text: dn.signed ? `DNSSEC aktiv (Note ${dn.grade})` : `Kein DNSSEC (Note ${dn.grade})`,
      zustand: dn.signed ? "signiert" : "nicht_signiert",
    },
    observatory: {
      available: !!obs.available, grade: obs.grade ?? null, score: obs.score ?? null,
      passed: obs.passed ?? null, total: obs.total ?? null,
      tests: (obs.tests ?? []).map((t: any) => ({
        id: t.id,
        variant: t.variant ?? "",
        modifier: modifierVon(t.id, t.variant ?? "", t.modifier ?? 0),
        code: "", unbekannt: false,
        result_text: t.result_text ?? "", recommendation: t.recommendation ?? "",
      })),
    },
    mail: {
      spf: { status: m.spf.status, zustand: zustand(m.spf, "hinweis"), text: m.spf.text },
      dkim: {
        status: m.dkim.status, text: m.dkim.text, selectors: m.dkim.selectors ?? 0,
        zustand: m.dkim.status === "ok" ? "ok" : m.dkim.selectors ? "hinweis" : "nicht_gefunden",
      },
      mx: {
        status: m.mx.status, text: m.mx.text, count: m.mx.count ?? 0,
        zustand: m.mx.status === "ok" ? "ok" : (m.mx.count ?? 0) > 0 ? "einzeln" : "kein_mailserver",
      },
      mta_sts: { status: m.mta_sts.status, zustand: zustand(m.mta_sts, "fehlt"), text: m.mta_sts.text },
      tls_rpt: { status: m.tls_rpt.status, zustand: zustand(m.tls_rpt, "fehlt"), text: m.tls_rpt.text },
    },
  };
}

