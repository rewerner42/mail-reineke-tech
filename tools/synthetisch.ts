// Synthetic datasets: one per catalogue key, each triggering exactly one finding.
//
// PROMPT.md 3.5 asks for a dataset per key, rendered and checked for overflow.
// They live here rather than in the test so the same definitions drive both the
// coverage test and tools/referenz, which renders them with headless Chrome.

import { OBS_CODES, katalogSchluessel } from "../src/report/observatory-codes.js";
import { ZUSTAND_SCHLUESSEL } from "../src/report/viewmodel.js";
import type { Signal, SignalObsTest } from "../src/report/signal.js";

/** A signal in which every check passes, so one state can be varied at a time. */
export function sauber(): Signal {
  return {
    domain: "beispiel.de",
    scan_date: "2026-10-30",
    level: "gering",
    dmarc: {
      grade: "A+", score: 100, policy: "reject", zustand: "reject", rua: true,
      record: "v=DMARC1; p=reject; rua=mailto:a@beispiel.de",
      text: "DMARC aktiv (Note A+, p=reject).",
    },
    dnssec: { grade: "A+", score: 100, signed: true, zustand: "signiert", text: "DNSSEC aktiv (Note A+)" },
    observatory: { available: true, grade: "A+", score: 100, passed: 12, total: 12, tests: [] },
    mail: {
      spf: { status: "ok", zustand: "ok", text: "SPF korrekt (3/10 Lookups)." },
      dkim: { status: "ok", zustand: "ok", text: "2 DKIM-Selektoren gefunden", selectors: 2 },
      mx: { status: "ok", zustand: "ok", text: "2 MX-Server gefunden", count: 2 },
      mta_sts: { status: "ok", zustand: "ok", text: "MTA-STS aktiv (enforce)" },
      tls_rpt: { status: "ok", zustand: "ok", text: "TLS-RPT aktiv" },
    },
  };
}

/**
 * Layout worst cases. They are rendered with the synthetic set but stand for no
 * single catalogue key, so the coverage test leaves them out.
 */
export function grenzfaelle(): Map<string, Signal> {
  const out = new Map<string, Signal>();
  // The two pages without a page plan at their fullest at once: the note under
  // a good e-mail grade (B10) on the summary, and every open point (V15) on the
  // next-step page — SPF, DKIM, mail server and an unrated website.
  const voll = sauber();
  voll.level = "hoch";
  voll.mail.spf = { ...voll.mail.spf, status: "hinweis", zustand: "hinweis" };
  voll.mail.dkim = { ...voll.mail.dkim, status: "mangel", zustand: "nicht_gefunden", selectors: 0 };
  voll.mail.mx = { ...voll.mail.mx, status: "mangel", zustand: "ohne_ip", count: 1 };
  voll.mail.mta_sts = { ...voll.mail.mta_sts, status: "hinweis", zustand: "fehlt" };
  voll.mail.tls_rpt = { ...voll.mail.tls_rpt, status: "hinweis", zustand: "fehlt" };
  voll.dnssec = { ...voll.dnssec, grade: "F", score: 0, signed: false, zustand: "nicht_signiert" };
  voll.observatory = { available: false, grade: null, score: null, passed: null, total: null, tests: [] };
  out.set("grenzfall-offene-punkte", voll);
  return out;
}

/** Everything the catalogue is asked for, as (key → a signal that triggers it). */
export function synthetisch(): Map<string, Signal> {
  const out = new Map<string, Signal>();
  for (const [bereich, tabelle] of Object.entries(ZUSTAND_SCHLUESSEL)) {
    for (const [zustand, key] of Object.entries(tabelle)) {
      if (!key) continue;
      const sig = sauber();
      if (bereich === "dmarc") {
        sig.dmarc.zustand = zustand as never;
        sig.dmarc.policy = ["none", "quarantine", "reject"].includes(zustand) ? (zustand as never) : null;
        sig.dmarc.record = zustand === "fehlt" ? null : "v=DMARC1; p=quarantine";
        sig.dmarc.grade = zustand === "fehlt" ? null : "C";
      } else if (bereich === "dnssec") {
        sig.dnssec.zustand = zustand as never;
        sig.dnssec.signed = zustand === "signiert";
        sig.dnssec.grade = "F";
      } else {
        const c = sig.mail[bereich as keyof Signal["mail"]] as { zustand: string };
        c.zustand = zustand;
        if (bereich === "dkim" && zustand === "nicht_gefunden") sig.mail.dkim.selectors = 0;
        if (bereich === "mx" && zustand === "ohne_ip") sig.mail.mx.count = 1;
      }
      out.set(key, sig);
    }
  }
  // Arises on its own: the policy is readable, only the report address is absent.
  const ohneRua = sauber();
  ohneRua.dmarc = { ...ohneRua.dmarc, rua: false };
  out.set("dmarc_kein_rua", ohneRua);

  // B7's variant only arises together with an enforcing DMARC policy.
  const streng = sauber();
  streng.mail.spf.zustand = "fehlt";
  out.set("spf_fehlt_dmarc_streng", streng);
  const lose = sauber();
  lose.dmarc = { ...lose.dmarc, policy: "none", zustand: "none", grade: "C" };
  lose.mail.spf.zustand = "fehlt";
  out.set("spf_fehlt", lose);

  for (const code of Object.values(OBS_CODES)) {
    if (code.art !== "feststellung") continue;
    const sig = sauber();
    const t: SignalObsTest = {
      id: code.id, variant: code.variant, modifier: code.modifier,
      code: "", unbekannt: false,
      result_text: "Originalmeldung des Prüfwerkzeugs.",
      recommendation: "Empfehlung des Prüfwerkzeugs.",
    };
    sig.observatory = { ...sig.observatory, grade: "D", score: 30, passed: 8, total: 12, tests: [t] };
    out.set(katalogSchluessel(code), sig);
  }
  return out;
}

