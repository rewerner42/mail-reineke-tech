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

/** Catalogue-side status vocabulary, used for the appendix badge. */
export type SignalStatus = "ok" | "hinweis" | "mangel" | "unbekannt";

/**
 * The closed set of states each check can end in — PROMPT.md 3.1's inventory.
 *
 * The scanner's own `status` is too coarse to report from: it uses "info" both
 * for "known and fine" (a web-only domain has no mail server) and for "could not
 * check at all" (the DNS query failed). Saying "not assessed" about the first, or
 * describing the second as a defect, would both be wrong — so the state is
 * derived from the issue code and each state gets its own catalogue text.
 */
export type ZustandSpf = "ok" | "hinweis" | "fehlt" | "alle_erlaubt" | "nicht_pruefbar";
export type ZustandDkim = "ok" | "hinweis" | "nicht_gefunden" | "nicht_pruefbar";
export type ZustandMx =
  | "ok"
  | "einzeln"
  | "ohne_ip"
  | "kein_mailserver"
  | "null_mx"
  | "nicht_pruefbar";
export type ZustandTransport = "ok" | "hinweis" | "fehlt" | "nicht_pruefbar";
export type ZustandDnssec = "signiert" | "nicht_signiert" | "fehlerhaft" | "nicht_pruefbar";
export type ZustandDmarc =
  | "reject"
  | "quarantine"
  | "none"
  | "ungueltig"
  | "mehrfach"
  | "fehlt"
  | "nicht_pruefbar";

/** Handlungsbedarf. Four levels — matches katalog.json `level_labels`. */
export type SignalLevel = "kritisch" | "hoch" | "mittel" | "gering";

export interface SignalCheck<Z extends string = string> {
  status: SignalStatus;
  /** Which of this check's known states applies. Selects the catalogue text. */
  zustand: Z;
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
    /** The scanner's own summary, for the technical detail line. */
    text: string;
    /** Null when no record exists *or* when the record carries no readable policy. */
    policy: "none" | "quarantine" | "reject" | null;
    /** Separates "no record" from "record present but policy unreadable" (B8). */
    zustand: ZustandDmarc;
    rua: boolean;
  };
  dnssec: {
    grade: string | null;
    score: number | null;
    signed: boolean;
    /** The scanner's own summary, for the technical detail line. */
    text: string;
    /** `fehlerhaft`: the parent zone delegates (DS) but validation fails. */
    zustand: ZustandDnssec;
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
    spf: SignalCheck<ZustandSpf>;
    dkim: SignalCheck<ZustandDkim> & { selectors: number };
    mx: SignalCheck<ZustandMx> & { count: number };
    mta_sts: SignalCheck<ZustandTransport>;
    tls_rpt: SignalCheck<ZustandTransport>;
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

/** True when the check reports this issue code. */
function hasCode(c: CheckResult<unknown> | undefined, code: string): boolean {
  return (c?.issues ?? []).some((i) => i.code === code);
}

/** The scanner could not reach DNS or the provider — not a verdict, an absence. */
function nichtPruefbar(c: CheckResult<unknown> | undefined): boolean {
  return (
    c === undefined ||
    hasCode(c, "DNS_ERROR") ||
    (c.issues ?? []).some((i) => /_QUERY_FAILED$/.test(i.code))
  );
}

function zustandSpf(c: CheckResult<unknown> | undefined): ZustandSpf {
  if (nichtPruefbar(c)) return "nicht_pruefbar";
  // "+all" is not a missing SPF but the opposite: every server passes — and with
  // an aligned envelope sender, DMARC too. Under an enforcing policy it would
  // otherwise land on spf_fehlt_dmarc_streng, which says forgery is covered.
  // Not when the record fails anyway: several records or too many lookups end
  // in a permanent error before "+all" is ever evaluated (RFC 7208 4.5, 4.6.4).
  const permerror = hasCode(c, "SPF_MULTIPLE") || hasCode(c, "SPF_LOOKUP_LIMIT");
  if (hasCode(c, "SPF_ALL_PASS") && !permerror) return "alle_erlaubt";
  if (c!.status === "pass") return "ok";
  return c!.status === "fail" ? "fehlt" : "hinweis";
}

function zustandDkim(c: CheckResult<unknown[]> | undefined): ZustandDkim {
  if (nichtPruefbar(c)) return "nicht_pruefbar";
  if (hasCode(c, "DKIM_NONE_FOUND") || (c!.data?.length ?? 0) === 0) return "nicht_gefunden";
  return c!.status === "pass" ? "ok" : "hinweis";
}

function zustandMx(c: CheckResult<unknown[]> | undefined): ZustandMx {
  if (nichtPruefbar(c)) return "nicht_pruefbar";
  if (hasCode(c, "MX_NULL")) return "null_mx";
  if (hasCode(c, "MX_NONE")) return "kein_mailserver";
  if (hasCode(c, "MX_NO_IP")) return "ohne_ip";
  if (hasCode(c, "MX_SINGLE")) return "einzeln";
  return "ok";
}

/**
 * MTA-STS and TLS-RPT. The scanner reports both "nothing published" and
 * "published but not fully effective" as `warn`, so the state is read off the
 * issue code: only MTASTS_MISSING / TLSRPT_MISSING mean absent. Without that,
 * a policy running in testing mode was reported as "not laid down at all" —
 * a statement about something that is demonstrably there.
 */
function zustandTransport(c: CheckResult<unknown> | undefined): ZustandTransport {
  if (nichtPruefbar(c)) return "nicht_pruefbar";
  if (c!.status === "pass") return "ok";
  const fehlt = hasCode(c, "MTASTS_MISSING") || hasCode(c, "TLSRPT_MISSING");
  return fehlt ? "fehlt" : "hinweis";
}

function check<Z extends string>(c: CheckResult<unknown> | undefined, zustand: Z): SignalCheck<Z> {
  return { status: status(c?.status), zustand, text: c?.summary ?? "" };
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

/**
 * A/B → ok, C → warn, D/E/F/missing → fail.
 *
 * Third of three functions that grade a letter. This copy decides the verdict in
 * the v15 report; gradeSeverity() in report/build.ts is the same rule for the
 * other brands' four-pager, except that it still has the fifth label "Niedrig",
 * so the same domain can read "Niedrig" there and "Gering" here.
 * gradeToSeverity() in grading.ts answers a different question — whether one
 * check was measurable at all — and returns "info" for a missing grade.
 */
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
      // A code MDN adds after this release has no approved text, so it counts as
      // neutral and goes to the appendix only. Keeping MDN's own score here
      // would route it into the findings or the positive list, where it would
      // look for a catalogue key built from an empty variant — which cannot
      // exist. That would not degrade one sentence, it would stop the report
      // from being produced at all, for every domain that sets that header.
      modifier: mapped?.modifier ?? 0,
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

  const policy = policyOf(raw);
  const dnssecZustand: ZustandDnssec = nichtPruefbar(ds)
    ? "nicht_pruefbar"
    : ds.data?.validationFailed
      ? "fehlerhaft"
      : ds.data?.secure
        ? "signiert"
        : "nicht_signiert";
  // Several records: receivers apply none of them (RFC 7489 6.6.3), so the
  // first record's policy must not be praised as if it were in force.
  const mehrfach = !nichtPruefbar(dm) && hasCode(dm, "DMARC_MULTIPLE");
  const dmarcZustand: ZustandDmarc = nichtPruefbar(dm)
    ? "nicht_pruefbar"
    : mehrfach
      ? "mehrfach"
      : policy !== null
      ? policy
      : raw
        ? "ungueltig"
        : "fehlt";

  return {
    domain: analyze.domain,
    scan_date: scanDate,
    level: handlungsbedarf(dm.grade ?? null, ds.grade ?? null, obd?.grade ?? null),
    dmarc: {
      grade: dm.grade ?? null,
      score: dm.score ?? null,
      record: raw,
      text: dm.summary ?? "",
      policy: mehrfach ? null : policy,
      zustand: dmarcZustand,
      rua: (dm.data?.rua?.length ?? 0) > 0,
    },
    dnssec: {
      grade: ds.grade ?? null,
      score: ds.score ?? null,
      text: ds.summary ?? "",
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
      spf: check(analyze.spf, zustandSpf(analyze.spf)),
      dkim: {
        ...check(analyze.dkim, zustandDkim(analyze.dkim)),
        selectors: analyze.dkim?.data?.length ?? 0,
      },
      mx: {
        ...check(analyze.mx, zustandMx(analyze.mx)),
        count: analyze.mx?.data?.length ?? 0,
      },
      mta_sts: check(analyze.mtaSts, zustandTransport(analyze.mtaSts)),
      tls_rpt: check(analyze.tlsRpt, zustandTransport(analyze.tlsRpt)),
    },
  };
}
