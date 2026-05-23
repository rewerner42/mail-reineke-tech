import { queryTxt } from "../dns.js";
import type { CheckIssue, CheckResult, MtaStsRecord } from "../types.js";

const POLICY_FETCH_TIMEOUT_MS = 4500;
const RECOMMENDED_MAX_AGE = 604800; // 1 week (RFC 8461 recommends a long max_age)

interface ParsedPolicy {
  version?: string;
  mode?: "none" | "testing" | "enforce";
  maxAge?: number;
  mx: string[];
}

/**
 * Parse an MTA-STS policy file (RFC 8461). Format is "key: value" lines,
 * CRLF or LF separated. The "mx" key may appear multiple times.
 *
 *   version: STSv1
 *   mode: enforce
 *   mx: mail.example.com
 *   mx: *.example.net
 *   max_age: 604800
 */
export function parseMtaStsPolicy(text: string): ParsedPolicy {
  const policy: ParsedPolicy = { mx: [] };
  for (const line of text.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!key || !value) continue;
    switch (key) {
      case "version":
        policy.version = value;
        break;
      case "mode":
        if (value === "none" || value === "testing" || value === "enforce") {
          policy.mode = value;
        }
        break;
      case "max_age": {
        const n = Number(value);
        if (Number.isFinite(n)) policy.maxAge = n;
        break;
      }
      case "mx":
        policy.mx.push(value);
        break;
    }
  }
  return policy;
}

/** Extract the id= tag from the _mta-sts TXT record (v=STSv1; id=...). */
function parseStsDns(raw: string): { id?: string } | null {
  if (!/^v\s*=\s*STSv1\b/i.test(raw.trim())) return null;
  const out: { id?: string } = {};
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const tag = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (tag === "id") out.id = value;
  }
  return out;
}

async function fetchPolicy(domain: string): Promise<string | null> {
  const url = `https://mta-sts.${domain}/.well-known/mta-sts.txt`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POLICY_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/plain" },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeMtaSts(
  domain: string,
): Promise<CheckResult<MtaStsRecord>> {
  const issues: CheckIssue[] = [];
  const target = `_mta-sts.${domain}`;

  let txts: string[];
  try {
    txts = await queryTxt(target);
  } catch (err) {
    return {
      status: "info",
      summary: "MTA-STS-Abfrage fehlgeschlagen",
      issues: [
        {
          severity: "info",
          code: "MTASTS_QUERY_FAILED",
          message: `DNS-Abfrage für ${target} fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      data: { dnsTxt: null, policyFetched: false },
    };
  }

  const dnsRaw = txts.find((t) => /^v\s*=\s*STSv1\b/i.test(t)) ?? null;
  const stsDns = dnsRaw ? parseStsDns(dnsRaw) : null;

  if (!dnsRaw || !stsDns) {
    return {
      status: "warn",
      summary: "Kein MTA-STS",
      issues: [
        {
          severity: "warn",
          code: "MTASTS_MISSING",
          message: "Kein MTA-STS-Eintrag (v=STSv1) gefunden.",
          recommendation:
            "MTA-STS erzwingt verschlüsselte TLS-Zustellung an deine Mailserver und verhindert Downgrade-Angriffe. Veröffentliche einen TXT-Eintrag unter _mta-sts und eine Policy-Datei unter https://mta-sts.<domain>/.well-known/mta-sts.txt.",
        },
      ],
      data: { dnsTxt: null, policyFetched: false },
    };
  }

  const data: MtaStsRecord = {
    dnsTxt: dnsRaw,
    id: stsDns.id,
    policyFetched: false,
  };

  if (!stsDns.id) {
    issues.push({
      severity: "warn",
      code: "MTASTS_NO_ID",
      message: "MTA-STS DNS-Record ohne id= — Provider können Policy-Updates nicht erkennen.",
      recommendation: "Füge eine eindeutige id hinzu (z.B. einen Zeitstempel) und ändere sie bei jeder Policy-Änderung.",
    });
  }

  const policyText = await fetchPolicy(domain);
  if (policyText === null) {
    issues.push({
      severity: "fail",
      code: "MTASTS_POLICY_UNREACHABLE",
      message: `DNS-Record vorhanden, aber die Policy-Datei unter https://mta-sts.${domain}/.well-known/mta-sts.txt ist nicht erreichbar.`,
      recommendation:
        "MTA-STS ist damit unwirksam und kann Zustellprobleme verursachen. Stelle sicher, dass der Host mta-sts.<domain> per HTTPS erreichbar ist und die Policy-Datei ausliefert.",
    });
    return {
      status: "fail",
      summary: "MTA-STS Policy fehlt",
      issues,
      data,
    };
  }

  const policy = parseMtaStsPolicy(policyText);
  data.policyFetched = true;
  data.policyVersion = policy.version;
  data.mode = policy.mode;
  data.maxAge = policy.maxAge;
  data.mx = policy.mx;

  if (policy.version !== "STSv1") {
    issues.push({
      severity: "warn",
      code: "MTASTS_POLICY_VERSION",
      message: `Policy-Datei hat unerwartete version "${policy.version ?? "(fehlt)"}".`,
    });
  }

  switch (policy.mode) {
    case "enforce":
      issues.push({
        severity: "pass",
        code: "MTASTS_ENFORCE",
        message: "MTA-STS im Modus \"enforce\" — TLS-Zustellung wird erzwungen.",
      });
      break;
    case "testing":
      issues.push({
        severity: "warn",
        code: "MTASTS_TESTING",
        message: "MTA-STS im Modus \"testing\" — Fehler werden nur gemeldet, nicht erzwungen.",
        recommendation: "Nach erfolgreicher Testphase auf mode: enforce umstellen.",
      });
      break;
    case "none":
      issues.push({
        severity: "warn",
        code: "MTASTS_NONE",
        message: "MTA-STS im Modus \"none\" — die Policy ist faktisch deaktiviert.",
        recommendation: "Auf testing und anschließend enforce umstellen.",
      });
      break;
    default:
      issues.push({
        severity: "fail",
        code: "MTASTS_NO_MODE",
        message: "Policy-Datei ohne gültiges mode-Feld.",
      });
  }

  if (policy.mx.length === 0) {
    issues.push({
      severity: "fail",
      code: "MTASTS_NO_MX",
      message: "Policy-Datei listet keine mx-Einträge — kein Mailserver ist autorisiert.",
    });
  }

  if (policy.maxAge !== undefined && policy.maxAge < RECOMMENDED_MAX_AGE) {
    issues.push({
      severity: "info",
      code: "MTASTS_LOW_MAXAGE",
      message: `max_age=${policy.maxAge}s liegt unter der Empfehlung von ${RECOMMENDED_MAX_AGE}s (1 Woche).`,
      recommendation: "Ein höherer max_age erhöht den Schutz, da Policies länger gecacht werden.",
    });
  }

  const worst = worstSeverity(issues);
  return {
    status: worst,
    summary:
      policy.mode === "enforce" && worst === "pass"
        ? "MTA-STS erzwungen"
        : `MTA-STS (mode=${policy.mode ?? "?"})`,
    issues,
    data,
  };
}

function worstSeverity(issues: CheckIssue[]): CheckResult["status"] {
  if (issues.some((i) => i.severity === "fail")) return "fail";
  if (issues.some((i) => i.severity === "warn")) return "warn";
  if (issues.some((i) => i.severity === "pass")) return "pass";
  return "info";
}
