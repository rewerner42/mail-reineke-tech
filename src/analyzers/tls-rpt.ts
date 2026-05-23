import { queryTxt } from "../dns.js";
import type { CheckIssue, CheckResult, TlsRptRecord } from "../types.js";

/**
 * Parse a TLS-RPT record (RFC 8460). Published at _smtp._tls.<domain>:
 *   v=TLSRPTv1; rua=mailto:tlsrpt@example.com
 */
export function parseTlsRpt(raw: string): TlsRptRecord | null {
  const trimmed = raw.trim();
  if (!/^v\s*=\s*TLSRPTv1\b/i.test(trimmed)) return null;

  const record: TlsRptRecord = { raw: trimmed, version: "TLSRPTv1", rua: [] };

  for (const part of trimmed.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const tag = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (!tag || !value) continue;
    if (tag === "rua") {
      record.rua = value.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (tag === "v") {
      record.version = value;
    }
  }
  return record;
}

export async function analyzeTlsRpt(
  domain: string,
): Promise<CheckResult<TlsRptRecord>> {
  const target = `_smtp._tls.${domain}`;
  const issues: CheckIssue[] = [];

  let txts: string[];
  try {
    txts = await queryTxt(target);
  } catch (err) {
    return {
      status: "info",
      summary: "TLS-RPT-Abfrage fehlgeschlagen",
      issues: [
        {
          severity: "info",
          code: "TLSRPT_QUERY_FAILED",
          message: `DNS-Abfrage für ${target} fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      data: { raw: null, rua: [] },
    };
  }

  const record = txts.map(parseTlsRpt).find((r): r is TlsRptRecord => r !== null);

  if (!record) {
    return {
      status: "warn",
      summary: "Kein TLS-RPT",
      issues: [
        {
          severity: "warn",
          code: "TLSRPT_MISSING",
          message: "Kein TLS-RPT-Record (v=TLSRPTv1) gefunden.",
          recommendation:
            "TLS-RPT liefert tägliche Reports über fehlgeschlagene TLS-Verbindungen beim Mailempfang. Veröffentliche unter _smtp._tls einen TXT-Eintrag wie \"v=TLSRPTv1; rua=mailto:tls-reports@deinedomain.de\".",
        },
      ],
      data: { raw: null, rua: [] },
    };
  }

  if (record.rua.length === 0) {
    issues.push({
      severity: "fail",
      code: "TLSRPT_NO_RUA",
      message: "TLS-RPT-Record ohne rua-Ziel — es können keine Reports zugestellt werden.",
      recommendation: "Füge ein rua=mailto: oder rua=https: Ziel hinzu.",
    });
  } else {
    for (const rua of record.rua) {
      if (!/^mailto:/i.test(rua) && !/^https?:/i.test(rua)) {
        issues.push({
          severity: "warn",
          code: "TLSRPT_RUA_FORMAT",
          message: `rua-Ziel \"${rua}\" hat kein gültiges Schema (mailto: oder https:).`,
        });
      }
    }
    if (issues.length === 0) {
      issues.push({
        severity: "pass",
        code: "TLSRPT_OK",
        message: `TLS-RPT aktiv, Reports gehen an ${record.rua.join(", ")}.`,
      });
    }
  }

  const worst = worstSeverity(issues);
  return {
    status: worst,
    summary: worst === "pass" ? "TLS-RPT aktiv" : "TLS-RPT mit Hinweisen",
    issues,
    data: record,
  };
}

function worstSeverity(issues: CheckIssue[]): CheckResult["status"] {
  if (issues.some((i) => i.severity === "fail")) return "fail";
  if (issues.some((i) => i.severity === "warn")) return "warn";
  if (issues.some((i) => i.severity === "pass")) return "pass";
  return "info";
}
