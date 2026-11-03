import { DnsUnresolvable, queryTxt } from "../dns.js";
import type { CheckIssue, CheckResult, DkimRecord } from "../types.js";

/**
 * DKIM selectors are unknown to the public, so we probe common ones. Each probe
 * is a DNS subrequest — Cloudflare Workers cap a single request at 50 subrequests
 * (free plan), shared with DMARC/SPF/MX/MTA-STS/TLS-RPT in the same /api/email
 * call. We therefore keep this to a curated high-coverage set (Google, Microsoft
 * 365, the big ESPs, generic names) rather than an exhaustive list, so the MX
 * A/AAAA lookups in the same request stay within budget.
 */
const COMMON_SELECTORS = [
  "default", // generic
  "google", // Google Workspace
  "selector1", // Microsoft 365
  "selector2", // Microsoft 365
  "k1", // Mailchimp / Mandrill / Mailgun
  "k2",
  "s1", // generic / SendGrid
  "s2",
  "dkim", // generic
  "mail", // generic
  "smtp", // generic
  "mxvault", // MXroute
  "mandrill", // Mandrill
  "mailjet", // Mailjet
  "amazonses", // Amazon SES
  "protonmail", // Proton Mail
  "s1-ionos", // IONOS — widespread among German small businesses
  "s2-ionos",
];

export function parseDkim(selector: string, raw: string): DkimRecord | null {
  const trimmed = raw.trim();
  const record: DkimRecord = { selector, raw: trimmed };
  let hasKeyMaterial = false;

  for (const part of trimmed.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const tag = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (!tag) continue;
    switch (tag) {
      case "v":
        record.v = value;
        break;
      case "k":
        record.k = value.toLowerCase();
        break;
      case "p":
        record.p = value.replace(/\s+/g, "");
        if (record.p.length > 0) hasKeyMaterial = true;
        break;
      case "t":
        record.t = value.split(":").map((s) => s.trim()).filter(Boolean);
        break;
      case "h":
        record.h = value.split(":").map((s) => s.trim()).filter(Boolean);
        break;
      case "s":
        record.s = value.split(":").map((s) => s.trim()).filter(Boolean);
        break;
    }
  }

  if (!hasKeyMaterial && !record.v) return null;
  return record;
}

/**
 * Roughly estimate RSA key size from a base64 SPKI/RSAPublicKey blob.
 * 1024-bit keys end up around 216 chars, 2048-bit around 392.
 */
function estimateKeySize(p: string): number | undefined {
  if (!p) return undefined;
  const len = p.length;
  if (len < 100) return undefined;
  if (len < 250) return 1024;
  if (len < 450) return 2048;
  if (len < 800) return 4096;
  return undefined;
}

/**
 * Probes one selector. Returns the record, null when the selector simply has no
 * DKIM key, or "unaufloesbar" when the resolver could not answer at all — a zone
 * with a broken DNSSEC signature answers SERVFAIL for everything, and reporting
 * that as "no DKIM selector found" would state something never measured.
 */
async function probeSelector(
  domain: string,
  selector: string,
): Promise<DkimRecord | null | "unaufloesbar"> {
  const name = `${selector}._domainkey.${domain}`;
  try {
    const txts = await queryTxt(name);
    for (const txt of txts) {
      const parsed = parseDkim(selector, txt);
      if (parsed) {
        if (parsed.p) parsed.keySize = estimateKeySize(parsed.p);
        return parsed;
      }
    }
  } catch (err) {
    if (err instanceof DnsUnresolvable) return "unaufloesbar";
    // otherwise ignored — a single selector probe failing is expected
  }
  return null;
}

export async function analyzeDkim(
  domain: string,
  extraSelectors: string[] = [],
): Promise<CheckResult<DkimRecord[]>> {
  const selectors = [...new Set([...extraSelectors, ...COMMON_SELECTORS])];
  const results = await Promise.all(
    selectors.map((s) => probeSelector(domain, s)),
  );
  const found = results.filter((r): r is DkimRecord => r !== null && r !== "unaufloesbar");

  const issues: CheckIssue[] = [];

  // Every probe came back unresolvable and none found a key: the zone itself
  // cannot be read, so nothing is known about DKIM either way.
  if (!found.length && results.every((r) => r === "unaufloesbar")) {
    return {
      status: "info",
      summary: "DKIM-Abfrage fehlgeschlagen",
      issues: [
        {
          severity: "info",
          code: "DKIM_QUERY_FAILED",
          message: `Die DNS-Abfragen für ${domain} ließen sich nicht auflösen — ob DKIM eingerichtet ist, konnte nicht geprüft werden.`,
          recommendation:
            "Häufigste Ursache ist eine fehlerhafte DNSSEC-Signatur der Zone. Prüfung nach deren Behebung wiederholen.",
        },
      ],
      data: [],
    };
  }

  if (found.length === 0) {
    return {
      status: "warn",
      summary: "Keine DKIM-Selektoren gefunden",
      issues: [
        {
          severity: "warn",
          code: "DKIM_NONE_FOUND",
          message: `Es wurden ${selectors.length} gängige Selektoren probiert, kein DKIM-Record gefunden.`,
          recommendation:
            "Das heißt nicht zwingend, dass kein DKIM existiert — der Selektor ist nicht öffentlich auflistbar. Prüfe in deinen DNS-Einstellungen oder gib einen Selektor manuell an.",
        },
      ],
      data: [],
    };
  }

  for (const rec of found) {
    if (rec.p === "" || rec.p === undefined) {
      issues.push({
        severity: "fail",
        code: "DKIM_REVOKED",
        message: `Selektor \"${rec.selector}\" hat ein leeres p= — der Key ist widerrufen.`,
        recommendation:
          "Falls der Selektor noch aktiv genutzt wird, neuen Schlüssel veröffentlichen. Sonst den Eintrag entfernen.",
      });
      continue;
    }
    if (rec.keySize && rec.keySize < 2048) {
      issues.push({
        severity: "warn",
        code: "DKIM_KEY_WEAK",
        message: `Selektor \"${rec.selector}\" verwendet einen ${rec.keySize}-Bit-Schlüssel.`,
        recommendation:
          "Auf mindestens 2048 Bit umstellen — Google und Microsoft bevorzugen 2048-Bit-Schlüssel.",
      });
    } else {
      issues.push({
        severity: "pass",
        code: "DKIM_OK",
        message: `Selektor \"${rec.selector}\" aktiv${rec.keySize ? ` (${rec.keySize}-Bit)` : ""}.`,
      });
    }
    if (rec.t?.includes("y")) {
      issues.push({
        severity: "warn",
        code: "DKIM_TEST_MODE",
        message: `Selektor \"${rec.selector}\" steht auf Testmodus (t=y) — Mails werden nicht hart geprüft.`,
        recommendation: "Nach Tests den t=y-Flag entfernen.",
      });
    }
  }

  const worst = worstSeverity(issues);
  return {
    status: worst,
    summary: `${found.length} DKIM-Selektor${found.length === 1 ? "" : "en"} gefunden`,
    issues,
    data: found,
  };
}

function worstSeverity(issues: CheckIssue[]): CheckResult["status"] {
  if (issues.some((i) => i.severity === "fail")) return "fail";
  if (issues.some((i) => i.severity === "warn")) return "warn";
  if (issues.some((i) => i.severity === "pass")) return "pass";
  return "info";
}
