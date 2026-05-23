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
  /** 0–100 posture score; mapped to a letter grade (secure 100, unsigned 55, unanchored 35, broken 10). */
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

  // 1) Resolver validated the chain → secure.
  if (s.dnskeyAd && s.dnskeyCount > 0) {
    return {
      status: "pass",
      code: "DNSSEC_SECURE",
      summary: "DNSSEC aktiv",
      message: `Zone ist DNSSEC-signiert und validiert (AD-Flag gesetzt, ${s.dnskeyCount} DNSKEY${dsPresent ? ", DS beim Parent vorhanden" : ""}).`,
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
      score: 10,
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
      status: "warn",
      code: "DNSSEC_UNANCHORED",
      summary: "DNSSEC nicht verankert",
      message: `Die Zone veröffentlicht ${s.dnskeyCount} DNSKEY-Record(s), aber beim Parent fehlt der DS-Record. Ohne DS gilt die Zone für Resolver als unsigniert.`,
      recommendation:
        "DS-Record beim Domain-Registrar hinterlegen, um die Vertrauenskette zu schließen. Bei Cloudflare: DNS → Settings → DNSSEC aktivieren und den angezeigten DS-Record beim Registrar eintragen.",
      score: 35,
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
    status: "warn",
    code: "DNSSEC_UNSIGNED",
    summary: "Kein DNSSEC",
    message: "Zone ist nicht DNSSEC-signiert.",
    recommendation:
      "DNSSEC schützt vor DNS-Spoofing und Cache-Poisoning. Bei Cloudflare mit einem Klick aktivierbar (DNS → Settings → DNSSEC); danach den DS-Record bei der Registrar-Domain hinterlegen.",
    score: 55,
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
