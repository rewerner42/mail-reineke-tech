import { queryTxt } from "../dns.js";
import type { CheckIssue, CheckResult, DmarcRecord } from "../types.js";

/**
 * Parse a DMARC TXT record per RFC 7489.
 * Records start with "v=DMARC1" and are semicolon-separated tag=value pairs.
 */
export function parseDmarc(raw: string): DmarcRecord | null {
  const trimmed = raw.trim();
  if (!/^v\s*=\s*DMARC1\b/i.test(trimmed)) return null;

  const record: DmarcRecord = { raw: trimmed, version: "DMARC1" };

  for (const part of trimmed.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const tag = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (!tag || !value) continue;

    switch (tag) {
      case "v":
        record.version = value;
        break;
      case "p":
        record.p = value.toLowerCase();
        break;
      case "sp":
        record.sp = value.toLowerCase();
        break;
      case "pct": {
        const n = Number(value);
        if (Number.isFinite(n)) record.pct = n;
        break;
      }
      case "rua":
        record.rua = value.split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "ruf":
        record.ruf = value.split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "adkim":
        record.adkim = value.toLowerCase();
        break;
      case "aspf":
        record.aspf = value.toLowerCase();
        break;
      case "fo":
        record.fo = value.split(":").map((s) => s.trim()).filter(Boolean);
        break;
      case "rf":
        record.rf = value.toLowerCase();
        break;
      case "ri": {
        const n = Number(value);
        if (Number.isFinite(n)) record.ri = n;
        break;
      }
    }
  }
  return record;
}

export async function analyzeDmarc(
  domain: string,
): Promise<CheckResult<DmarcRecord | null>> {
  const issues: CheckIssue[] = [];
  const target = `_dmarc.${domain}`;

  let txtRecords: string[];
  try {
    txtRecords = await queryTxt(target);
  } catch (err) {
    return {
      status: "fail",
      summary: "DMARC-Abfrage fehlgeschlagen",
      issues: [
        {
          severity: "fail",
          code: "DNS_ERROR",
          message: `DNS-Abfrage für ${target} fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      data: null,
    };
  }

  const dmarcRecords = txtRecords
    .map(parseDmarc)
    .filter((r): r is DmarcRecord => r !== null);

  if (dmarcRecords.length === 0) {
    return {
      status: "fail",
      summary: "Keine DMARC-Richtlinie veröffentlicht",
      issues: [
        {
          severity: "fail",
          code: "DMARC_MISSING",
          message: `Kein DMARC-Eintrag unter ${target} gefunden.`,
          recommendation:
            "Veröffentliche einen DMARC-Eintrag. Empfehlung zum Start: \"v=DMARC1; p=none; rua=mailto:dmarc@deinedomain.de\" und nach Auswertung schrittweise auf p=quarantine bzw. p=reject erhöhen.",
        },
      ],
      data: null,
    };
  }

  if (dmarcRecords.length > 1) {
    issues.push({
      severity: "fail",
      code: "DMARC_MULTIPLE",
      message: `Mehrere DMARC-Einträge gefunden (${dmarcRecords.length}). RFC 7489 erlaubt nur einen.`,
      recommendation:
        "Konsolidiere die TXT-Einträge unter _dmarc zu genau einem DMARC-Record. Mehrere Records führen dazu, dass Provider den Eintrag ignorieren.",
    });
  }

  const record = dmarcRecords[0]!;

  if (!record.p) {
    issues.push({
      severity: "fail",
      code: "DMARC_NO_POLICY",
      message: "Pflicht-Tag \"p\" fehlt im DMARC-Record.",
      recommendation: "Füge mindestens \"p=none\" hinzu, damit Reports gesammelt werden.",
    });
  } else {
    switch (record.p) {
      case "none":
        issues.push({
          severity: "warn",
          code: "DMARC_POLICY_NONE",
          message: "Policy steht auf \"none\" — nur Monitoring, kein Schutz vor Spoofing.",
          recommendation:
            "Nach 2–4 Wochen Auswertung der RUA-Reports auf p=quarantine und später p=reject erhöhen.",
        });
        break;
      case "quarantine":
        issues.push({
          severity: "warn",
          code: "DMARC_POLICY_QUARANTINE",
          message: "Policy \"quarantine\" — verdächtige Mails landen im Spam.",
          recommendation:
            "Sobald SPF/DKIM stabil ausgerichtet sind, auf p=reject wechseln für maximalen Schutz.",
        });
        break;
      case "reject":
        issues.push({
          severity: "pass",
          code: "DMARC_POLICY_REJECT",
          message: "Strikteste Policy \"reject\" — ungültige Mails werden abgewiesen.",
        });
        break;
      default:
        issues.push({
          severity: "fail",
          code: "DMARC_POLICY_INVALID",
          message: `Ungültiger Policy-Wert \"p=${record.p}\". Erlaubt sind: none, quarantine, reject.`,
        });
    }
  }

  if (record.pct !== undefined) {
    if (record.pct < 0 || record.pct > 100) {
      issues.push({
        severity: "fail",
        code: "DMARC_PCT_INVALID",
        message: `pct=${record.pct} ist außerhalb des erlaubten Bereichs 0–100.`,
      });
    } else if (record.pct < 100 && (record.p === "quarantine" || record.p === "reject")) {
      issues.push({
        severity: "warn",
        code: "DMARC_PCT_PARTIAL",
        message: `pct=${record.pct} — nur ein Teil der Mails wird der Policy unterworfen.`,
        recommendation:
          "Nach Test-Rollout pct schrittweise auf 100 erhöhen, sonst greift die Policy nicht vollständig.",
      });
    }
  }

  if (!record.rua || record.rua.length === 0) {
    issues.push({
      severity: "warn",
      code: "DMARC_NO_RUA",
      message: "Kein \"rua\"-Tag — du erhältst keine aggregierten Reports.",
      recommendation:
        "Füge rua=mailto:dmarc-reports@deinedomain.de hinzu, um SPF/DKIM-Alignment-Probleme zu erkennen.",
    });
  } else {
    for (const rua of record.rua) {
      if (!/^mailto:/i.test(rua) && !/^https?:/i.test(rua)) {
        issues.push({
          severity: "warn",
          code: "DMARC_RUA_FORMAT",
          message: `rua-Eintrag \"${rua}\" hat kein gültiges URI-Schema (mailto: oder https:).`,
        });
      }
    }
  }

  if (record.sp === undefined && record.p) {
    issues.push({
      severity: "info",
      code: "DMARC_NO_SP",
      message:
        "Kein Subdomain-Policy-Tag (\"sp\") gesetzt — Subdomains erben die Hauptpolicy.",
    });
  }

  if (record.adkim === "s") {
    issues.push({
      severity: "info",
      code: "DMARC_ADKIM_STRICT",
      message: "DKIM-Alignment ist \"strict\" — die d=-Domain im DKIM muss exakt mit der From-Domain übereinstimmen.",
    });
  }
  if (record.aspf === "s") {
    issues.push({
      severity: "info",
      code: "DMARC_ASPF_STRICT",
      message: "SPF-Alignment ist \"strict\" — Envelope-From-Domain muss exakt mit From-Domain übereinstimmen.",
    });
  }

  const worst = worstSeverity(issues);
  return {
    status: worst,
    summary:
      worst === "pass"
        ? `DMARC ist aktiv (p=${record.p}).`
        : worst === "warn"
          ? `DMARC vorhanden, Verbesserungspotenzial (p=${record.p ?? "?"}).`
          : `DMARC fehlerhaft (p=${record.p ?? "?"}).`,
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
