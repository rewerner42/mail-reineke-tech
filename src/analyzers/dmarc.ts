import { queryTxt } from "../dns.js";
import { gradeToSeverity, scoreToGrade } from "../grading.js";
import type { CheckIssue, CheckResult, DmarcRecord } from "../types.js";

/**
 * Grade the DMARC posture (0–100 → letter grade). Policy is the dominant factor:
 * reject AND quarantine are treated as full protection (Google's Feb-2024
 * bulk-sender rules + M3AAWG/RFC guidance both accept quarantine as compliant).
 * none is monitoring only (no protection — spoofing still possible),
 * missing/invalid offers nothing.
 */
export function gradeDmarc(
  record: DmarcRecord | null,
  recordCount: number,
): { score: number; grade: string } {
  const policy = record?.p;
  const valid = policy === "none" || policy === "quarantine" || policy === "reject";
  if (!record || recordCount > 1 || !valid) {
    return { score: 0, grade: scoreToGrade(0) };
  }

  let score = policy === "reject" || policy === "quarantine" ? 100 : 40;
  const enforcing = policy === "reject" || policy === "quarantine";

  // Partial enforcement (pct < 100) weakens an otherwise enforcing policy.
  if (enforcing && record.pct !== undefined && record.pct >= 0 && record.pct < 100) {
    score -= Math.round((100 - record.pct) * 0.3); // up to −30
  }
  // No aggregate reporting → can't monitor alignment.
  if (!record.rua || record.rua.length === 0) score -= 10;
  // Subdomains left open while the main policy enforces.
  if (enforcing && record.sp === "none") score -= 10;

  score = Math.max(0, Math.min(100, score));
  return { score, grade: scoreToGrade(score) };
}

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
      grade: "F",
      score: 0,
      issues: [
        {
          severity: "fail",
          code: "DMARC_MISSING",
          message: `Kein DMARC-Eintrag unter ${target} gefunden.`,
          recommendation:
            "Veröffentliche einen DMARC-Eintrag. Empfehlung zum Start: \"v=DMARC1; p=none; rua=mailto:dmarc@deinedomain.de\" und nach Auswertung schrittweise auf p=quarantine bzw. p=reject erhöhen.",
        },
        {
          severity: "fail",
          code: "DMARC_SPOOFING_RISK",
          message:
            "Ohne DMARC ist E-Mail-Identitätsdiebstahl (Spoofing) möglich: Dritte können in Ihrem Namen täuschend echte E-Mails versenden, ohne dass empfangende Server sie abweisen.",
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
          severity: "fail",
          code: "DMARC_POLICY_NONE",
          message:
            "Policy steht auf \"none\" — nur Monitoring, kein Schutz. E-Mail-Identitätsdiebstahl (Spoofing) ist weiterhin möglich, da ungültige Mails nicht abgewiesen oder isoliert werden.",
          recommendation:
            "Nach 2–4 Wochen Auswertung der RUA-Reports auf p=quarantine und später p=reject erhöhen.",
        });
        break;
      case "quarantine":
        issues.push({
          severity: "pass",
          code: "DMARC_POLICY_QUARANTINE",
          message:
            "Policy \"quarantine\" — verdächtige Mails landen im Spam. Voller Schutz im Sinne der Google-/Microsoft-Bulk-Sender-Anforderungen.",
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

  const { score, grade } = gradeDmarc(record, dmarcRecords.length);
  const status = gradeToSeverity(grade);
  return {
    status,
    grade,
    score,
    summary:
      status === "pass"
        ? `DMARC aktiv (Note ${grade}, p=${record.p}).`
        : status === "warn"
          ? `DMARC vorhanden, Verbesserungspotenzial (Note ${grade}, p=${record.p ?? "?"}).`
          : `DMARC unzureichend (Note ${grade}, p=${record.p ?? "?"}).`,
    issues,
    data: record,
  };
}
