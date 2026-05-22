import { queryTxt } from "../dns.js";
import type {
  CheckIssue,
  CheckResult,
  SpfMechanism,
  SpfQualifier,
  SpfRecord,
} from "../types.js";

const LOOKUP_LIMIT = 10;
const VOID_LOOKUP_LIMIT = 2;

// Mechanisms that cause DNS lookups per RFC 7208 §4.6.4
const LOOKUP_MECHANISMS = new Set([
  "include",
  "a",
  "mx",
  "ptr",
  "exists",
  "redirect",
]);

function parseMechanism(raw: string): SpfMechanism {
  let qualifier: SpfQualifier = "+";
  let rest = raw;
  if (["+", "-", "~", "?"].includes(raw[0] ?? "")) {
    qualifier = raw[0] as SpfQualifier;
    rest = raw.slice(1);
  }
  const colon = rest.indexOf(":");
  const eq = rest.indexOf("=");
  let type: string;
  let value: string | undefined;
  if (colon >= 0 && (eq < 0 || colon < eq)) {
    type = rest.slice(0, colon).toLowerCase();
    value = rest.slice(colon + 1);
  } else if (eq >= 0) {
    type = rest.slice(0, eq).toLowerCase();
    value = rest.slice(eq + 1);
  } else {
    type = rest.toLowerCase();
  }
  return {
    qualifier,
    type,
    value,
    raw,
    causesLookup: LOOKUP_MECHANISMS.has(type),
  };
}

export function parseSpf(raw: string): SpfRecord {
  const trimmed = raw.trim();
  const tokens = trimmed.split(/\s+/);
  const mechanisms: SpfMechanism[] = [];
  let all: SpfQualifier | undefined;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    const mech = parseMechanism(token);
    mechanisms.push(mech);
    if (mech.type === "all") {
      all = mech.qualifier;
    }
  }

  return {
    raw: trimmed,
    mechanisms,
    all,
    dnsLookupCount: 0,
  };
}

/**
 * Count DNS lookups recursively. Each include/redirect resolves to another SPF
 * record and contributes its own lookups (RFC 7208 §4.6.4).
 */
async function countLookups(
  record: SpfRecord,
  visited: Set<string>,
  depth = 0,
): Promise<number> {
  if (depth > 15) return LOOKUP_LIMIT + 1; // safety bail
  let count = 0;
  for (const mech of record.mechanisms) {
    if (!mech.causesLookup) continue;
    count++;
    if ((mech.type === "include" || mech.type === "redirect") && mech.value) {
      const target = mech.value.toLowerCase();
      if (visited.has(target)) continue;
      visited.add(target);
      try {
        const txts = await queryTxt(target);
        const childRaw = txts.find((t) => /^v\s*=\s*spf1\b/i.test(t));
        if (childRaw) {
          const child = parseSpf(childRaw);
          count += await countLookups(child, visited, depth + 1);
        }
      } catch {
        // ignored - lookup still counts
      }
    }
  }
  return count;
}

export async function analyzeSpf(
  domain: string,
): Promise<CheckResult<SpfRecord | null>> {
  const issues: CheckIssue[] = [];
  let txts: string[];
  try {
    txts = await queryTxt(domain);
  } catch (err) {
    return {
      status: "fail",
      summary: "SPF-Abfrage fehlgeschlagen",
      issues: [
        {
          severity: "fail",
          code: "DNS_ERROR",
          message: `DNS-Abfrage für ${domain} fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      data: null,
    };
  }

  const spfRaw = txts.filter((t) => /^v\s*=\s*spf1\b/i.test(t));
  if (spfRaw.length === 0) {
    return {
      status: "fail",
      summary: "Kein SPF-Eintrag",
      issues: [
        {
          severity: "fail",
          code: "SPF_MISSING",
          message: "Kein SPF-Record (v=spf1) für die Domain gefunden.",
          recommendation:
            "Veröffentliche einen TXT-Eintrag mit v=spf1, der alle berechtigten Mailserver listet, z.B. \"v=spf1 include:_spf.google.com -all\".",
        },
      ],
      data: null,
    };
  }
  if (spfRaw.length > 1) {
    issues.push({
      severity: "fail",
      code: "SPF_MULTIPLE",
      message: `Mehrere SPF-Einträge gefunden (${spfRaw.length}). RFC 7208 erlaubt nur einen.`,
      recommendation:
        "Konsolidiere die Einträge zu einem einzigen v=spf1-Record, sonst ignorieren Empfänger ihn (Permerror).",
    });
  }

  const record = parseSpf(spfRaw[0]!);
  record.dnsLookupCount = await countLookups(record, new Set([domain.toLowerCase()]));

  if (record.dnsLookupCount > LOOKUP_LIMIT) {
    issues.push({
      severity: "fail",
      code: "SPF_LOOKUP_LIMIT",
      message: `${record.dnsLookupCount} DNS-Lookups — RFC 7208 erlaubt maximal ${LOOKUP_LIMIT}.`,
      recommendation:
        "Reduziere Includes (z.B. via SPF-Flattening) oder entferne nicht genutzte Sender, sonst entsteht ein Permerror.",
    });
  } else if (record.dnsLookupCount >= 8) {
    issues.push({
      severity: "warn",
      code: "SPF_LOOKUP_HIGH",
      message: `${record.dnsLookupCount} DNS-Lookups — nahe am Limit von ${LOOKUP_LIMIT}.`,
    });
  }

  if (!record.all) {
    issues.push({
      severity: "warn",
      code: "SPF_NO_ALL",
      message: "Kein \"all\"-Mechanismus am Ende des Records.",
      recommendation: "Schließe den Record mit -all (hard fail) oder ~all (soft fail) ab.",
    });
  } else {
    switch (record.all) {
      case "-":
        issues.push({
          severity: "pass",
          code: "SPF_ALL_HARD",
          message: "Striktes \"-all\" am Ende — nicht gelistete Sender werden abgewiesen.",
        });
        break;
      case "~":
        issues.push({
          severity: "warn",
          code: "SPF_ALL_SOFT",
          message: "\"~all\" (Softfail) — empfangende Server akzeptieren nicht gelistete Sender meistens trotzdem.",
          recommendation: "Sobald alle Sender bekannt sind, auf -all umstellen.",
        });
        break;
      case "?":
        issues.push({
          severity: "warn",
          code: "SPF_ALL_NEUTRAL",
          message: "\"?all\" (neutral) — bietet keinen Schutz, wirkt wie kein SPF.",
          recommendation: "Auf ~all oder -all umstellen.",
        });
        break;
      case "+":
        issues.push({
          severity: "fail",
          code: "SPF_ALL_PASS",
          message: "\"+all\" erlaubt allen Servern den Versand — gefährlich, im Grunde kein SPF.",
          recommendation: "Sofort auf -all umstellen.",
        });
        break;
    }
  }

  if (record.mechanisms.some((m) => m.type === "ptr")) {
    issues.push({
      severity: "warn",
      code: "SPF_PTR_DEPRECATED",
      message: "\"ptr\"-Mechanismus ist veraltet (RFC 7208 §5.5) und sollte nicht mehr verwendet werden.",
    });
  }

  if (record.raw.length > 450) {
    issues.push({
      severity: "info",
      code: "SPF_LENGTH",
      message: `SPF-Record ist ${record.raw.length} Zeichen lang — bei >255 wird der TXT-Record in Strings aufgeteilt.`,
    });
  }

  const worst = worstSeverity(issues);
  return {
    status: worst,
    summary:
      worst === "pass"
        ? `SPF korrekt (${record.dnsLookupCount}/10 Lookups).`
        : worst === "warn"
          ? `SPF vorhanden, Verbesserungen möglich.`
          : "SPF fehlerhaft.",
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
