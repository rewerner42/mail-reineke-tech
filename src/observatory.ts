import type { CheckIssue, CheckResult, ObservatoryResult, Severity } from "./types.js";

const OBSERVATORY_API = "https://observatory-api.mdn.mozilla.net/api/v2/scan";
const SCAN_TIMEOUT_MS = 20000; // fresh scans take ~10s; allow headroom

interface ObservatoryApiResponse {
  id?: number;
  details_url?: string;
  algorithm_version?: number;
  scanned_at?: string;
  error?: string | null;
  message?: string;
  grade?: string | null;
  score?: number | null;
  status_code?: number | null;
  tests_failed?: number;
  tests_passed?: number;
  tests_quantity?: number;
}

/**
 * Map an MDN Observatory letter grade to our severity scale.
 * A range → pass, B/C → warn, D/E/F → fail.
 */
export function gradeToSeverity(grade: string | null | undefined): Severity {
  if (!grade) return "info";
  const letter = grade.trim().charAt(0).toUpperCase();
  switch (letter) {
    case "A":
      return "pass";
    case "B":
    case "C":
      return "warn";
    case "D":
    case "E":
    case "F":
      return "fail";
    default:
      return "info";
  }
}

export function normalizeObservatory(
  res: ObservatoryApiResponse,
): ObservatoryResult {
  return {
    grade: res.grade ?? null,
    score: res.score ?? null,
    testsPassed: res.tests_passed ?? null,
    testsFailed: res.tests_failed ?? null,
    testsQuantity: res.tests_quantity ?? null,
    scannedAt: res.scanned_at ?? null,
    detailsUrl: res.details_url ?? null,
  };
}

const EMPTY: ObservatoryResult = {
  grade: null,
  score: null,
  testsPassed: null,
  testsFailed: null,
  testsQuantity: null,
  scannedAt: null,
  detailsUrl: null,
};

export async function analyzeObservatory(
  host: string,
): Promise<CheckResult<ObservatoryResult>> {
  const issues: CheckIssue[] = [];
  const url = `${OBSERVATORY_API}?host=${encodeURIComponent(host)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  let res: ObservatoryApiResponse;
  try {
    // The MDN v2 API rejects an "application/json" content-type with an empty
    // body, so we POST with no content-type and no body.
    const r = await fetch(url, {
      method: "POST",
      signal: controller.signal,
    });
    res = (await r.json()) as ObservatoryApiResponse;
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      status: "info",
      summary: aborted ? "Observatory-Scan-Timeout" : "Observatory nicht erreichbar",
      issues: [
        {
          severity: "info",
          code: aborted ? "OBS_TIMEOUT" : "OBS_UNREACHABLE",
          message: aborted
            ? "Der MDN-Observatory-Scan hat zu lange gedauert. Bitte später erneut versuchen."
            : `MDN Observatory nicht erreichbar: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      data: EMPTY,
    };
  } finally {
    clearTimeout(timer);
  }

  if (res.error) {
    const detail = res.message ?? res.error;
    // MDN's scanner occasionally reports a transient "site seems to be down"
    // even for reachable hosts — surface a retry hint in that case.
    const transient = /down|timeout|timed out|unreachable/i.test(detail);
    return {
      status: "info",
      summary: "Observatory-Scan nicht möglich",
      issues: [
        {
          severity: "info",
          code: "OBS_SCAN_ERROR",
          message: `MDN Observatory konnte ${host} nicht scannen: ${detail}.`,
          recommendation: transient
            ? "Der MDN-Scanner hat die Website kurzzeitig nicht erreicht. Bitte die Analyse in einem Moment erneut starten. Falls es bestehen bleibt: erreichbare HTTPS-Website unter https://" +
              host +
              " vorhanden?"
            : "Das HTTP Observatory prüft eine öffentlich erreichbare HTTPS-Website. Reine Sender- oder Mail-Domains ohne Website liefern hier kein Ergebnis.",
        },
      ],
      data: EMPTY,
    };
  }

  const data = normalizeObservatory(res);
  const severity = gradeToSeverity(data.grade);

  if (data.grade) {
    const failedNote =
      data.testsFailed && data.testsFailed > 0
        ? ` ${data.testsFailed} von ${data.testsQuantity} Tests nicht bestanden.`
        : " Alle Tests bestanden.";
    issues.push({
      severity,
      code: `OBS_GRADE_${data.grade.replace(/[^A-Z]/gi, "").toUpperCase() || "NA"}`,
      message: `MDN HTTP Observatory bewertet die Website mit Note ${data.grade} (Score ${data.score}).${failedNote}`,
      recommendation:
        severity === "pass"
          ? undefined
          : "Details und konkrete Header-Empfehlungen im verlinkten MDN-Report. Wichtige Header: Content-Security-Policy, Strict-Transport-Security (HSTS), X-Content-Type-Options, X-Frame-Options.",
    });
  }

  return {
    status: data.grade ? severity : "info",
    summary: data.grade
      ? `Note ${data.grade} (Score ${data.score})`
      : "Kein Observatory-Ergebnis",
    issues,
    data,
  };
}
