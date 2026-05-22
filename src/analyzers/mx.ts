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
    return {
      status: "fail",
      summary: "Keine MX-Records",
      issues: [
        {
          severity: "fail",
          code: "MX_MISSING",
          message: "Domain hat keine MX-Records — kann keine E-Mails empfangen.",
          recommendation:
            "Falls die Domain Mail empfangen soll, MX-Einträge auf die Mailserver setzen. Reine Sender-Domains können einen Null-MX (\".\") verwenden.",
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
