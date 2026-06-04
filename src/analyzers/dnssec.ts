import { dohQuery } from "../dns.js";
import { gradeToSeverity, scoreToGrade } from "../grading.js";
import type { CheckIssue, CheckResult, DnssecResult, Severity } from "../types.js";

const TYPE_DNSKEY = 48;
const TYPE_DS = 43;
const SERVFAIL = 2;

export interface DnssecSignals {
  /** AD flag on the DNSKEY answer (resolver validated the chain). */
  dnskeyAd: boolean;
  /** DNSKEY records published by the zone. */
  dnskeyCount: number;
  /** SERVFAIL on the DNSKEY query — a validating resolver couldn't validate. */
  dnskeyServfail: boolean;
  /** DS records present at the parent (delegation is signed). */
  dsCount: number;
}

export interface DnssecClassification {
  status: Severity;
  code: string;
  summary: string;
  message: string;
  recommendation?: string;
  /**
   * Posture score → letter grade. DNSSEC is binary: a zone either has a valid,
   * validated chain of trust or it does not — there are no meaningful partial
   * grades. So: secure = 100 (A+), every insecure state (unsigned, unanchored,
   * broken) = 0 (F), distinguished only by message, not by grade.
   */
  score: number;
  data: DnssecResult;
}

/**
 * Classify DNSSEC state from DNSKEY + DS signals. Pure function so it can be
 * unit-tested against the known cases:
 *   secure (reineke-technik.de, cloudflare.com), unsigned (sharp.eu, google.com),
 *   broken (dnssec-failed.org: DS present at parent but DNSKEY SERVFAILs).
 */
export function classifyDnssec(s: DnssecSignals): DnssecClassification {
  const dsPresent = s.dsCount > 0;

  // 1) Resolver validated the answer (AD flag) → secure. This holds whether the
  //    name is its own signed zone apex (own DNSKEY/DS) OR just a record inside a
  //    signed parent zone — e.g. a subdomain like sharp.reineke.tech, which has
  //    NO DNSKEY/DS of its own yet is still authenticated by the validating
  //    resolver (AD=true) because the reineke.tech zone is signed. The previous
  //    `dnskeyCount > 0` requirement wrongly flagged such protected names as
  //    unsigned (F).
  if (s.dnskeyAd) {
    const viaParent = s.dnskeyCount === 0;
    return {
      status: "pass",
      code: "DNSSEC_SECURE",
      summary: "DNSSEC aktiv",
      message: viaParent
        ? "Name ist über die signierte übergeordnete Zone DNSSEC-geschützt und validiert (AD-Flag gesetzt). Auf dieser Ebene sind keine eigenen DNSKEY-/DS-Einträge erforderlich."
        : `Zone ist DNSSEC-signiert und validiert (AD-Flag gesetzt, ${s.dnskeyCount} DNSKEY${dsPresent ? ", DS beim Parent vorhanden" : ""}).`,
      score: 100,
      data: {
        secure: true,
        authenticated: true,
        dnskeyCount: s.dnskeyCount,
        dsPresent,
        validationFailed: false,
      },
    };
  }

  // 2) Parent says the zone is signed (DS present) but validation did not
  //    succeed → broken chain of trust.
  if (dsPresent) {
    const reason = s.dnskeyServfail
      ? "die DNSKEY-Abfrage liefert SERVFAIL (der validierende Resolver lehnt die Antwort ab)"
      : "die Signaturkette validiert nicht";
    return {
      status: "fail",
      code: "DNSSEC_BROKEN",
      summary: "DNSSEC fehlerhaft",
      message: `Beim Parent ist ein DS-Record hinterlegt (die Zone soll signiert sein), aber ${reason}. Das bricht die Mailzustellung und Auflösung bei validierenden Resolvern.`,
      recommendation:
        "Signaturen/Schlüssel der Zone prüfen (z.B. abgelaufene RRSIGs, DNSKEY/DS-Mismatch nach Key-Rollover). Detailanalyse der Kette über dnsviz.net. Im Zweifel DS beim Registrar entfernen, bis die Signierung wieder sauber ist.",
      score: 0,
      data: {
        secure: false,
        authenticated: false,
        dnskeyCount: s.dnskeyCount,
        dsPresent: true,
        validationFailed: true,
      },
    };
  }

  // 3) DNSKEY published but no DS at the parent → chain not anchored, zone is
  //    treated as insecure by validators.
  if (s.dnskeyCount > 0) {
    return {
      status: "fail",
      code: "DNSSEC_UNANCHORED",
      summary: "DNSSEC nicht verankert",
      message: `Die Zone veröffentlicht ${s.dnskeyCount} DNSKEY-Record(s), aber beim Parent fehlt der DS-Record. Ohne DS gilt die Zone für Resolver als unsigniert — kein Schutz.`,
      recommendation:
        "DS-Record beim Domain-Registrar hinterlegen, um die Vertrauenskette zu schließen. Bei Cloudflare: DNS → Settings → DNSSEC aktivieren und den angezeigten DS-Record beim Registrar eintragen.",
      score: 0,
      data: {
        secure: false,
        authenticated: false,
        dnskeyCount: s.dnskeyCount,
        dsPresent: false,
        validationFailed: false,
      },
    };
  }

  // 4) No DNSSEC at all.
  return {
    status: "fail",
    code: "DNSSEC_UNSIGNED",
    summary: "Kein DNSSEC",
    message:
      "Zone ist nicht DNSSEC-signiert — kein Schutz gegen DNS-Spoofing und Cache-Poisoning.",
    recommendation:
      "DNSSEC schützt vor DNS-Spoofing und Cache-Poisoning. Bei Cloudflare mit einem Klick aktivierbar (DNS → Settings → DNSSEC); danach den DS-Record bei der Registrar-Domain hinterlegen.",
    score: 0,
    data: {
      secure: false,
      authenticated: false,
      dnskeyCount: 0,
      dsPresent: false,
      validationFailed: false,
    },
  };
}

export async function analyzeDnssec(
  domain: string,
): Promise<CheckResult<DnssecResult>> {
  let signals: DnssecSignals;
  try {
    const [dnskey, ds] = await Promise.all([
      dohQuery(domain, "DNSKEY"),
      dohQuery(domain, "DS"),
    ]);
    signals = {
      dnskeyAd: dnskey.AD === true,
      dnskeyCount: (dnskey.Answer ?? []).filter((a) => a.type === TYPE_DNSKEY).length,
      dnskeyServfail: dnskey.Status === SERVFAIL,
      dsCount: (ds.Answer ?? []).filter((a) => a.type === TYPE_DS).length,
    };
  } catch (err) {
    return {
      status: "info",
      summary: "DNSSEC-Status unbekannt",
      issues: [
        {
          severity: "info",
          code: "DNSSEC_QUERY_FAILED",
          message: `DNSSEC konnte nicht geprüft werden: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      data: {
        secure: false,
        authenticated: false,
        dnskeyCount: 0,
        dsPresent: false,
        validationFailed: false,
      },
    };
  }

  const c = classifyDnssec(signals);
  const grade = scoreToGrade(c.score);
  const status = gradeToSeverity(grade);
  const issue: CheckIssue = {
    severity: status,
    code: c.code,
    message: c.message,
  };
  if (c.recommendation) issue.recommendation = c.recommendation;

  return {
    status,
    grade,
    score: c.score,
    summary: `${c.summary} (Note ${grade})`,
    issues: [issue],
    data: c.data,
  };
}
