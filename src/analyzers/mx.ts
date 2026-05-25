import { queryA, queryAaaa, queryMx } from "../dns.js";
import type { CheckIssue, CheckResult, MxRecord } from "../types.js";

export async function analyzeMx(domain: string): Promise<CheckResult<MxRecord[]>> {
  const issues: CheckIssue[] = [];
  let raw: Array<{ preference: number; exchange: string }>;

  try {
    raw = await queryMx(domain);
  } catch (err) {
    return {
      status: "fail",
      summary: "MX-Abfrage fehlgeschlagen",
      issues: [
        {
          severity: "fail",
          code: "DNS_ERROR",
          message: `DNS-Abfrage für ${domain} fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      data: [],
    };
  }

  if (raw.length === 0) {
    // No MX = the domain simply has no e-mail server. This is informational, not
    // a security failure — don't penalise web-only / non-mail domains.
    return {
      status: "info",
      summary: "Kein E-Mail-Server (kein MX)",
      issues: [
        {
          severity: "info",
          code: "MX_NONE",
          message:
            "Diese Domain hat keinen E-Mail-Server (kein MX-Eintrag) — sie empfängt keine E-Mails.",
          recommendation:
            "Falls die Domain doch Mail empfangen soll, MX-Einträge auf die Mailserver setzen. Reine Web-/Sender-Domains brauchen keinen MX — zum Schutz vor Spoofing empfiehlt sich dennoch DMARC (p=reject) und SPF (-all).",
        },
      ],
      data: [],
    };
  }

  // Detect Null MX
  if (raw.length === 1 && (raw[0]!.exchange === "" || raw[0]!.exchange === ".")) {
    issues.push({
      severity: "info",
      code: "MX_NULL",
      message: "Null-MX (RFC 7505) — Domain weist Mail explizit ab.",
    });
    return {
      status: "info",
      summary: "Null-MX gesetzt",
      issues,
      data: [{ preference: raw[0]!.preference, exchange: "." }],
    };
  }

  const records: MxRecord[] = await Promise.all(
    raw
      .sort((a, b) => a.preference - b.preference)
      .map(async (r) => {
        const [a, aaaa] = await Promise.all([
          queryA(r.exchange).catch(() => []),
          queryAaaa(r.exchange).catch(() => []),
        ]);
        return { ...r, ips: { a, aaaa } };
      }),
  );

  for (const rec of records) {
    if (!rec.ips || (rec.ips.a.length === 0 && rec.ips.aaaa.length === 0)) {
      issues.push({
        severity: "fail",
        code: "MX_NO_IP",
        message: `MX \"${rec.exchange}\" hat keine A/AAAA-Records — Mailzustellung schlägt fehl.`,
      });
    }
  }

  // Multiple MX servers = redundancy
  if (records.length === 1) {
    issues.push({
      severity: "warn",
      code: "MX_SINGLE",
      message: "Nur ein MX-Eintrag — keine Redundanz bei Ausfall des Mailservers.",
      recommendation:
        "Sekundäre MX mit höherer Preference (z.B. 20) hinzufügen, um Zustellung bei Ausfall sicherzustellen.",
    });
  } else {
    issues.push({
      severity: "pass",
      code: "MX_REDUNDANT",
      message: `${records.length} MX-Records vorhanden — Redundanz gegeben.`,
    });
  }

  const worst = worstSeverity(issues);
  return {
    status: worst,
    summary: `${records.length} MX-Server${records.length === 1 ? "" : ""} gefunden`,
    issues,
    data: records,
  };
}

function worstSeverity(issues: CheckIssue[]): CheckResult["status"] {
  if (issues.some((i) => i.severity === "fail")) return "fail";
  if (issues.some((i) => i.severity === "warn")) return "warn";
  if (issues.some((i) => i.severity === "pass")) return "pass";
  return "info";
}
