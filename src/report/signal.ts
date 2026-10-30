// Scan → Signal: the serialisable snapshot the report is built from.
//
// The report is assembled statically from an approved text catalogue, so the
// generator never sees a CheckResult. It sees a Signal: a flat, JSON-safe record
// of what was measured, with every website result reduced to a stable
// (id, variant) pair. Nothing here formulates prose for the report body — the
// `text` fields carry the scanner's own wording for the measurement appendix only.

import { OBS_CODES, OBS_TEST_ID, type ObsTestId } from "./observatory-codes.js";
import type {
  AnalysisResponse,
  CheckResult,
  ObservatoryResult,
  Severity,
} from "../types.js";

/** Catalogue-side status vocabulary. `unbekannt` means the check could not run. */
export type SignalStatus = "ok" | "hinweis" | "mangel" | "unbekannt";

/** Handlungsbedarf. Four levels — matches katalog.json `level_labels`. */
export type SignalLevel = "kritisch" | "hoch" | "mittel" | "gering";

export interface SignalCheck {
  status: SignalStatus;
  /** The scanner's own summary. Appendix only, never a report sentence. */
  text: string;
}

export interface SignalObsTest {
  id: ObsTestId;
  variant: string;
  modifier: number;
  /** MDN's result code, kept so the appendix and the tests can name it. */
  code: string;
  /** True when MDN returned a code we have no mapping for. */
  unbekannt: boolean;
  result_text: string;
  recommendation: string;
}

export interface Signal {
  domain: string;
  /** ISO date (YYYY-MM-DD) of the scan. */
  scan_date: string;
  level: SignalLevel;
  dmarc: {
    grade: string | null;
    score: number | null;
    record: string | null;
    /** Null when no record exists *or* when the record carries no readable policy. */
    policy: "none" | "quarantine" | "reject" | null;
    /** Separates "no record" from "record present but policy unreadable" (B8). */
    record_vorhanden: boolean;
    rua: boolean;
  };
  dnssec: {
    grade: string | null;
    score: number | null;
    signed: boolean;
    /** `fehlerhaft`: the parent zone delegates (DS) but validation fails. */
    zustand: "signiert" | "nicht_signiert" | "fehlerhaft";
  };
  observatory: {
    available: boolean;
    grade: string | null;
    score: number | null;
    passed: number | null;
    total: number | null;
    tests: SignalObsTest[];
  };
  mail: {
    spf: SignalCheck;
    dkim: SignalCheck & { selectors: number };
    mx: SignalCheck & { count: number };
    mta_sts: SignalCheck;
    tls_rpt: SignalCheck;
  };
}

/** Scanner severity → catalogue status. `info` means "not assessed", not "fine". */
function status(sev: Severity | undefined): SignalStatus {
  switch (sev) {
    case "pass":
      return "ok";
    case "warn":
      return "hinweis";
    case "fail":
      return "mangel";
    default:
      return "unbekannt";
  }
}

function check(c: CheckResult<unknown> | undefined): SignalCheck {
  return { status: status(c?.status), text: c?.summary ?? "" };
}

/**
 * Reads a DMARC policy without trusting its spelling (B8): `p=REJECT`, stray
 * whitespace and a missing `p=` must not abort the report, and a record that
 * exists but cannot be read must not be reported as "no record published".
 */
function policyOf(raw: string | null | undefined): Signal["dmarc"]["policy"] {
  if (!raw) return null;
  const m = /(?:^|;)\s*p\s*=\s*([A-Za-z]+)/.exec(raw);
  const p = m?.[1]?.toLowerCase();
  return p === "none" || p === "quarantine" || p === "reject" ? p : null;
}

/**
 * Handlungsbedarf, unchanged in substance from src/report/build.ts.
 *
 * Counts how many of the three graded areas fail. A *missing* grade counts as a
 * failure — that is why sharp.eu reads "Kritisch" although its website could not
 * be assessed at all. Deliberately left as it was (the brief forbids changing
 * `level`); the fifth label "Niedrig" is gone, folded into "Gering", because the
 * catalogue only ever had four.
 */
export function handlungsbedarf(
  dmarcGrade: string | null,
  dnssecGrade: string | null,
  obsGrade: string | null,
): SignalLevel {
  const sev = [dmarcGrade, dnssecGrade, obsGrade].map(gradeSeverity);
  const fails = sev.filter((s) => s === "fail").length;
  if (fails >= 3) return "kritisch";
  if (fails === 2) return "hoch";
  if (fails === 1) return "mittel";
  return "gering";
}

/** A/B → ok, C → warn, D/E/F/missing → fail. */
function gradeSeverity(grade: string | null | undefined): "ok" | "warn" | "fail" {
  if (!grade) return "fail";
  const g = grade.trim().charAt(0).toUpperCase();
  if (g === "A" || g === "B") return "ok";
  if (g === "C") return "warn";
  return "fail";
}

function obsTests(data: ObservatoryResult | null | undefined): SignalObsTest[] {
  return (data?.tests ?? []).map((t) => {
    const mapped = t.result ? OBS_CODES[t.result] : undefined;
    const fallbackId: ObsTestId = OBS_TEST_ID[t.name] ?? "scan";
    return {
      id: mapped?.id ?? fallbackId,
      variant: mapped?.variant ?? "",
      modifier: mapped?.modifier ?? t.scoreModifier ?? 0,
      code: t.result ?? "",
      unbekannt: !mapped,
      result_text: t.reason ?? "",
      recommendation: t.recommendation ?? "",
    };
  });
}

export function buildSignal(
  analyze: AnalysisResponse,
  observatory: CheckResult<ObservatoryResult> | undefined,
  scanDate: string,
): Signal {
  const dm = analyze.dmarc;
  const ds = analyze.dnssec;
  const obd = observatory?.data ?? null;
  const raw = dm.data?.raw ?? null;
  const available = !!obd?.grade;

  const dnssecZustand = ds.data?.validationFailed
    ? "fehlerhaft"
    : ds.data?.secure
      ? "signiert"
      : "nicht_signiert";

  return {
    domain: analyze.domain,
    scan_date: scanDate,
    level: handlungsbedarf(dm.grade ?? null, ds.grade ?? null, obd?.grade ?? null),
    dmarc: {
      grade: dm.grade ?? null,
      score: dm.score ?? null,
      record: raw,
      policy: policyOf(raw),
      record_vorhanden: !!raw,
      rua: (dm.data?.rua?.length ?? 0) > 0,
    },
    dnssec: {
      grade: ds.grade ?? null,
      score: ds.score ?? null,
      signed: dnssecZustand === "signiert",
      zustand: dnssecZustand,
    },
    observatory: {
      available,
      grade: obd?.grade ?? null,
      score: obd?.score ?? null,
      passed: obd?.testsPassed ?? null,
      total: obd?.testsQuantity ?? null,
      tests: available ? obsTests(obd) : [],
    },
    mail: {
      spf: check(analyze.spf),
      dkim: { ...check(analyze.dkim), selectors: analyze.dkim?.data?.length ?? 0 },
      mx: { ...check(analyze.mx), count: analyze.mx?.data?.length ?? 0 },
      mta_sts: check(analyze.mtaSts),
      tls_rpt: check(analyze.tlsRpt),
    },
  };
}
