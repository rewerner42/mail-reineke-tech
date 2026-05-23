import { dohQuery } from "../dns.js";
import type { CheckIssue, CheckResult, DnssecResult } from "../types.js";

/**
 * DNSSEC check. Cloudflare 1.1.1.1 validates DNSSEC by default, so the AD
 * (Authenticated Data) flag in a DoH response tells us the answer chain was
 * cryptographically validated. We also query DNSKEY (type 48) — its presence
 * confirms the zone publishes signing keys.
 */
export async function analyzeDnssec(
  domain: string,
): Promise<CheckResult<DnssecResult>> {
  const issues: CheckIssue[] = [];

  let dnskeyCount = 0;
  let authenticated = false;

  try {
    const res = await dohQuery(domain, "DNSKEY");
    authenticated = res.AD === true;
    dnskeyCount = (res.Answer ?? []).filter((a) => a.type === 48).length;
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
      data: { signed: false, authenticated: false, dnskeyCount: 0 },
    };
  }

  const signed = authenticated || dnskeyCount > 0;
  const data: DnssecResult = { signed, authenticated, dnskeyCount };

  if (signed) {
    issues.push({
      severity: "pass",
      code: "DNSSEC_SIGNED",
      message: authenticated
        ? `Zone ist DNSSEC-signiert und validiert (AD-Flag gesetzt${dnskeyCount ? `, ${dnskeyCount} DNSKEY` : ""}).`
        : `Zone veröffentlicht ${dnskeyCount} DNSKEY-Record(s).`,
    });
  } else {
    issues.push({
      severity: "warn",
      code: "DNSSEC_UNSIGNED",
      message: "Zone ist nicht DNSSEC-signiert.",
      recommendation:
        "DNSSEC schützt vor DNS-Spoofing und Cache-Poisoning. Bei Cloudflare lässt es sich mit einem Klick aktivieren (DNS → Settings → DNSSEC) — danach den DS-Record bei der Registrar-Domain hinterlegen.",
    });
  }

  return {
    status: signed ? "pass" : "warn",
    summary: signed ? "DNSSEC aktiv" : "Kein DNSSEC",
    issues,
    data,
  };
}
